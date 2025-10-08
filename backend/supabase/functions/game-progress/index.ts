// Supabase Edge Function: game-progress
// 处理游戏进度的读写操作，支持 Web 版（Clerk JWT）和小程序版（微信 OpenID）

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-openid',
};

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 解析请求
    const { action, gameType, gameData, dataKey = 'progress' } = await req.json();

    // 获取用户 ID（支持两种方式）
    let userId: string | null = null;

    // 方式 1: 从自定义 header 获取 OpenID（小程序）
    const openid = req.headers.get('x-openid');
    if (openid) {
      userId = openid;
      console.log('🔑 使用 OpenID 认证:', userId);
    }

    // 方式 2: 从 JWT 获取用户 ID（Web 版 Clerk）
    if (!userId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        // 这里可以验证 Clerk JWT
        // 简化版：直接从 JWT 中提取 user_id
        try {
          const token = authHeader.replace('Bearer ', '');
          console.log('🔍 收到的 token 长度:', token.length);
          console.log('🔍 Token 前20个字符:', token.substring(0, 20));

          // 尝试解析 JWT
          const parts = token.split('.');
          if (parts.length !== 3) {
            throw new Error('JWT 格式错误，应该有3个部分，实际有 ' + parts.length);
          }

          // JWT 使用 URL-safe Base64 编码，需要转换
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const paddedBase64 = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');

          console.log('🔍 Base64 URL (前20):', base64Url.substring(0, 20));
          console.log('🔍 Padded Base64 (前20):', paddedBase64.substring(0, 20));

          // 解码 Base64 -> UTF-8 字符串 -> JSON
          let decodedString;
          try {
            decodedString = atob(paddedBase64);
            console.log('🔍 解码后字符串长度:', decodedString.length);
            console.log('🔍 解码后字符串 (前50):', decodedString.substring(0, 50));
          } catch (decodeError) {
            throw new Error(`Base64 解码失败: ${decodeError.message}`);
          }

          let payload;
          try {
            payload = JSON.parse(decodedString);
            console.log('🔍 JWT payload keys:', Object.keys(payload));
            console.log('🔍 JWT payload:', JSON.stringify(payload));
          } catch (jsonError) {
            throw new Error(`JSON 解析失败: ${jsonError.message}. 解码字符串: ${decodedString.substring(0, 100)}`);
          }

          userId = payload.sub || payload.user_id || payload.userId;
          console.log('🔑 使用 JWT 认证:', userId);
        } catch (e) {
          console.error('❌ JWT 解析失败:', e.message);
          console.error('❌ JWT 解析错误详情:', e);

          // 返回详细的错误信息到前端，帮助调试
          const errorDetails = {
            error: 'Invalid JWT',
            message: 'JWT 解析失败: ' + e.message,
            errorName: e.name,
            errorStack: e.stack,
            tokenLength: authHeader ? authHeader.replace('Bearer ', '').length : 0,
            tokenPreview: authHeader ? authHeader.substring(0, 50) : 'N/A'
          };

          return new Response(
            JSON.stringify(errorDetails),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: '未提供有效的认证信息（无 OpenID 或 JWT）' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 创建 Supabase 客户端（使用 service_role key）
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 处理不同的操作
    if (action === 'get') {
      // 读取游戏进度
      const { data, error } = await supabaseAdmin
        .from('game_progress')
        .select('data, updated_at')
        .eq('user_id', userId)
        .eq('game', gameType)
        .eq('data_key', dataKey)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('读取失败:', error);
        return new Response(
          JSON.stringify({ error: 'Database error', details: error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: data?.data || null,
          updated_at: data?.updated_at || null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'save') {
      // 保存游戏进度
      if (!gameData) {
        return new Response(
          JSON.stringify({ error: 'Bad request', message: 'gameData 不能为空' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const timestamp = new Date().toISOString();

      const { error } = await supabaseAdmin
        .from('game_progress')
        .upsert({
          user_id: userId,
          game: gameType,
          data_key: dataKey,
          data: gameData,
          updated_at: timestamp
        }, {
          onConflict: 'user_id,game,data_key',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('保存失败:', error);
        return new Response(
          JSON.stringify({ error: 'Database error', details: error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ 保存成功: user=${userId}, game=${gameType}, key=${dataKey}`);

      return new Response(
        JSON.stringify({
          success: true,
          updated_at: timestamp
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 未知操作
    return new Response(
      JSON.stringify({ error: 'Bad request', message: `未知操作: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('处理请求失败:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
