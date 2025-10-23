// Supabase Edge Function: game-progress (混合版本)
// 处理游戏进度的读写操作，支持 Web 版（Clerk JWT）和小程序版（微信 OpenID）
// 数据存储：根据游戏类型路由
//   - N-Back: Supabase PostgreSQL
//   - 其他游戏 (2048, 数独, 数织, 华容道, 拼图): MongoDB Atlas

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { MongoClient } from "https://deno.land/x/mongo@v0.32.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-openid',
};

// MongoDB 客户端（复用连接）
let mongoClient: MongoClient | null = null;

async function getMongoClient() {
  if (!mongoClient) {
    const mongoUri = Deno.env.get('MONGODB_ATLAS_URI');
    if (!mongoUri) {
      throw new Error('缺少环境变量 MONGODB_ATLAS_URI');
    }
    mongoClient = new MongoClient();
    await mongoClient.connect(mongoUri);
    console.log('✅ 已连接到 MongoDB Atlas');
  }
  return mongoClient;
}

// Supabase 客户端（用于 N-Back）
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('缺少 Supabase 环境变量');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

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
        try {
          const token = authHeader.replace('Bearer ', '');

          // 解析 JWT
          const parts = token.split('.');
          if (parts.length !== 3) {
            throw new Error('JWT 格式错误');
          }

          // JWT 使用 URL-safe Base64 编码
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const paddedBase64 = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');

          const decodedString = atob(paddedBase64);
          const payload = JSON.parse(decodedString);

          userId = payload.sub || payload.user_id || payload.userId;
          console.log('🔑 使用 JWT 认证:', userId);
        } catch (e) {
          console.error('❌ JWT 解析失败:', e.message);
          return new Response(
            JSON.stringify({ error: 'Invalid JWT', message: 'JWT 解析失败: ' + e.message }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: '未提供有效的认证信息' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 根据游戏类型路由到不同的数据库
    console.log(`📍 游戏类型: ${gameType}, 操作: ${action}`);

    if (gameType === 'nback') {
      // N-Back 使用 Supabase PostgreSQL
      console.log('🔵 路由到 Supabase PostgreSQL');
      return await handleSupabaseRequest(action, userId, gameType, gameData, dataKey);
    } else {
      // 其他游戏使用 MongoDB Atlas
      console.log('🟢 路由到 MongoDB Atlas');
      return await handleMongoDBRequest(action, userId, gameType, gameData, dataKey);
    }

  } catch (error) {
    console.error('处理请求失败:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ==================== Supabase 处理函数 ====================

async function handleSupabaseRequest(
  action: string,
  userId: string,
  gameType: string,
  gameData: any,
  dataKey: string
) {
  const supabase = getSupabaseClient();

  if (action === 'get') {
    // 读取游戏进度
    const { data, error } = await supabase
      .from('game_progress')
      .select('data, updated_at')
      .eq('user_id', userId)
      .eq('game', gameType)
      .eq('data_key', dataKey)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Supabase 读取失败:', error);
      return new Response(
        JSON.stringify({ error: 'Database error', message: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Supabase 读取成功');
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

    // 使用 upsert
    const { error } = await supabase
      .from('game_progress')
      .upsert({
        user_id: userId,
        game: gameType,
        data_key: dataKey,
        data: gameData,
        updated_at: timestamp
      }, {
        onConflict: 'user_id,game,data_key'
      });

    if (error) {
      console.error('❌ Supabase 保存失败:', error);
      return new Response(
        JSON.stringify({ error: 'Database error', message: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Supabase 保存成功: user=${userId}, game=${gameType}`);
    return new Response(
      JSON.stringify({
        success: true,
        updated_at: timestamp
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: 'Bad request', message: `未知操作: ${action}` }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ==================== MongoDB 处理函数 ====================

async function handleMongoDBRequest(
  action: string,
  userId: string,
  gameType: string,
  gameData: any,
  dataKey: string
) {
  const client = await getMongoClient();
  const db = client.database(Deno.env.get('MONGODB_DB_NAME') || 'game_db');
  const collection = db.collection('game_progress');

  if (action === 'get') {
    // 读取游戏进度
    const document = await collection.findOne({
      user_id: userId,
      game: gameType,
      data_key: dataKey
    });

    console.log('✅ MongoDB 读取成功');
    return new Response(
      JSON.stringify({
        success: true,
        data: document?.data || null,
        updated_at: document?.updated_at || null
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

    const result = await collection.updateOne(
      {
        user_id: userId,
        game: gameType,
        data_key: dataKey
      },
      {
        $set: {
          user_id: userId,
          game: gameType,
          data_key: dataKey,
          data: gameData,
          updated_at: timestamp
        },
        $setOnInsert: {
          created_at: timestamp
        }
      },
      { upsert: true }
    );

    console.log(`✅ MongoDB 保存成功: user=${userId}, game=${gameType}, matched=${result.matchedCount}, modified=${result.modifiedCount}, upserted=${result.upsertedCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        updated_at: timestamp
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: 'Bad request', message: `未知操作: ${action}` }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
