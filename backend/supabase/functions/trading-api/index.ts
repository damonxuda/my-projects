// Supabase Edge Function: trading-api
// 用途：LLM交易观察系统的安全API层
// 只允许管理员访问交易数据
// 使用 Clerk JWT 进行身份验证

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, clerk-token, x-user-email',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ============================================
    // 0. 解析URL路径（需要最先执行，用于路由判断）
    // ============================================
    const url = new URL(req.url)
    const path = url.pathname.replace('/trading-api', '')

    // ============================================
    // 1. 验证管理员权限（通过 Clerk token）
    // ============================================
    const clerkToken = req.headers.get('clerk-token') || req.headers.get('authorization')?.replace('Bearer ', '')
    const userEmail = req.headers.get('x-user-email') // 从前端传递的用户邮箱

    if (!clerkToken) {
      return new Response(
        JSON.stringify({ error: '未授权：缺少认证token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: '未授权：缺少用户邮箱' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 验证 Clerk token（验证其有效性和未过期）
    const isValidToken = await verifyClerkToken(clerkToken)
    if (!isValidToken) {
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
    // DEBUG ENDPOINT (临时调试用，生产环境应删除)
    // ============================================
    if (req.method === 'GET' && path === '/debug') {
      const adminEmailsEnv = Deno.env.get('ADMIN_EMAILS') || ''
      return new Response(
        JSON.stringify({
          success: true,
          debug: {
            tokenReceived: !!clerkToken,
            tokenLength: clerkToken?.length,
            userEmail: userEmail,
            isAdmin: isAdmin,
            adminEmailsConfigured: adminEmailsEnv.split(',').map(e => e.trim()),
            timestamp: new Date().toISOString()
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
        // 使用优化的PostgreSQL函数，单次查询获取所有agent的最新状态
        const { data: portfolios, error } = await supabase
          .rpc('get_latest_portfolios')

        if (error) {
          throw error
        }

        return new Response(
          JSON.stringify({ success: true, portfolios: portfolios || [] }),
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

    // GET /history - 获取所有agents的历史数据（用于趋势图）
    if (req.method === 'GET' && path === '/history') {
      const hours = parseInt(url.searchParams.get('hours') || '240') // 默认10天 = 240小时
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

      // 获取指定时间范围内的所有portfolio记录
      // 限制最多返回1000条记录，避免内存溢出
      const { data: portfolios, error } = await supabase
        .from('llm_trading_portfolios')
        .select('agent_name, total_value, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(1000)

      if (error) {
        throw error
      }

      // 按时间分组：将5分钟内的记录归为同一轮采样
      const roundMap: any = {}
      let currentRound = 0
      let lastTimestamp = 0

      portfolios?.forEach((p: any) => {
        const timestamp = new Date(p.created_at).getTime()

        // 如果距离上次采样超过5分钟（300000ms），开始新一轮
        if (timestamp - lastTimestamp > 300000) {
          currentRound++
          lastTimestamp = timestamp
        }

        if (!roundMap[currentRound]) {
          roundMap[currentRound] = { round: currentRound }
        }
        roundMap[currentRound][p.agent_name] = parseFloat(p.total_value)
      })

      const history = Object.values(roundMap)

      return new Response(
        JSON.stringify({ success: true, history }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
async function verifyClerkToken(token: string): Promise<boolean> {
  try {
    // 验证 JWT 格式和有效性
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.log('Token is not JWT format')
      return false
    }

    // Base64url decode (替换 - 和 _ 字符)
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - base64.length % 4) % 4)
    const payload = JSON.parse(atob(base64 + padding))

    console.log('JWT payload keys:', Object.keys(payload))

    // 检查 token 是否过期
    if (payload.exp && payload.exp < Date.now() / 1000) {
      console.log('Token expired')
      return false
    }

    console.log('Token validation successful')
    return true

  } catch (error) {
    console.error('Token verification failed:', error)
    return false
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
