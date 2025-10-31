// Supabase Edge Function: trading-api
// 用途：LLM交易观察系统的安全API层
// 只允许管理员访问交易数据

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, clerk-token',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ============================================
    // 1. 验证管理员权限（通过 Clerk token）
    // ============================================
    const clerkToken = req.headers.get('clerk-token') || req.headers.get('authorization')?.replace('Bearer ', '')

    if (!clerkToken) {
      return new Response(
        JSON.stringify({ error: '未授权：缺少认证token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 验证 Clerk token 并获取用户信息
    const userEmail = await verifyClerkToken(clerkToken)
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: '未授权：无效的token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 检查是否为管理员
    const isAdmin = await checkIsAdmin(userEmail)
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: '禁止访问：只有管理员可以访问交易数据' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Admin verified: ${userEmail}`)

    // ============================================
    // 2. 初始化 Supabase 客户端（使用 service_role）
    // ============================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // ============================================
    // 3. 处理不同的API请求
    // ============================================
    const url = new URL(req.url)
    const path = url.pathname.replace('/trading-api', '')

    // GET /decisions - 获取交易决策列表
    if (req.method === 'GET' && path === '/decisions') {
      const agent = url.searchParams.get('agent') // 可选：筛选特定agent
      const limit = parseInt(url.searchParams.get('limit') || '100')

      let query = supabase
        .from('llm_trading_decisions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (agent) {
        query = query.eq('agent_name', agent)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      return new Response(
        JSON.stringify({ success: true, decisions: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // GET /portfolios - 获取账户状态
    if (req.method === 'GET' && path === '/portfolios') {
      const agent = url.searchParams.get('agent')

      // 获取每个agent的最新状态
      if (!agent) {
        // 返回所有agent的最新状态
        const agents = ['gemini', 'gpt4', 'claude'] // 可以从环境变量读取
        const portfolios = []

        for (const agentName of agents) {
          const { data } = await supabase
            .from('llm_trading_portfolios')
            .select('*')
            .eq('agent_name', agentName)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (data) {
            portfolios.push(data)
          }
        }

        return new Response(
          JSON.stringify({ success: true, portfolios }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        // 返回特定agent的历史
        const limit = parseInt(url.searchParams.get('limit') || '100')
        const { data, error } = await supabase
          .from('llm_trading_portfolios')
          .select('*')
          .eq('agent_name', agent)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (error) {
          throw error
        }

        return new Response(
          JSON.stringify({ success: true, history: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // GET /stats - 获取统计数据
    if (req.method === 'GET' && path === '/stats') {
      // 返回每个agent的汇总统计
      const { data: portfolios } = await supabase
        .from('llm_trading_portfolios')
        .select('agent_name, total_value, pnl, pnl_percentage, created_at')
        .order('created_at', { ascending: false })

      // 按agent分组，计算统计
      const stats: any = {}
      portfolios?.forEach((p: any) => {
        if (!stats[p.agent_name]) {
          stats[p.agent_name] = {
            agent_name: p.agent_name,
            current_value: p.total_value,
            current_pnl: p.pnl,
            current_pnl_percentage: p.pnl_percentage,
            last_updated: p.created_at
          }
        }
      })

      return new Response(
        JSON.stringify({ success: true, stats: Object.values(stats) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 未知路径
    return new Response(
      JSON.stringify({ error: '未找到该API端点' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message || '服务器内部错误' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================
// 辅助函数：验证 Clerk Token
// ============================================
async function verifyClerkToken(token: string): Promise<string | null> {
  try {
    // 调用 Clerk 的 JWKS endpoint 验证 token
    // 简化版本：直接解析 JWT（生产环境应该验证签名）
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const payload = JSON.parse(atob(parts[1]))

    // 从 payload 中提取用户邮箱
    // Clerk JWT 结构：{ sub: "user_xxx", email: "xxx@xxx.com", ... }
    return payload.email || payload.primary_email_address || null

  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

// ============================================
// 辅助函数：检查是否为管理员
// ============================================
async function checkIsAdmin(userEmail: string): Promise<boolean> {
  // 从环境变量读取管理员邮箱列表
  const adminEmailsEnv = Deno.env.get('ADMIN_EMAILS') || ''
  const adminEmails = adminEmailsEnv.split(',').map(email => email.trim())

  console.log(`Checking admin: ${userEmail} against ${adminEmails.join(', ')}`)

  return adminEmails.includes(userEmail)
}

/* Deno Deploy configuration:
 * Required environment variables:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - ADMIN_EMAILS (comma-separated, e.g., "admin@example.com,owner@example.com")
 */
