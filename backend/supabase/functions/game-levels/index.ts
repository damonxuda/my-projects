// Supabase Edge Function: game-levels
// 从 MongoDB Atlas 加载预设关卡数据
// 数据来源：game_levels 集合

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { MongoClient } from "https://deno.land/x/mongo@v0.32.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// MongoDB 客户端（复用连接）
let client: MongoClient | null = null;

async function getMongoClient() {
  if (!client) {
    const mongoUri = Deno.env.get('MONGODB_ATLAS_URI');
    if (!mongoUri) {
      throw new Error('缺少环境变量 MONGODB_ATLAS_URI');
    }
    client = new MongoClient();
    await client.connect(mongoUri);
    console.log('✅ 已连接到 MongoDB Atlas');
  }
  return client;
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 解析请求参数
    const url = new URL(req.url);
    const game = url.searchParams.get('game');
    const difficulty = url.searchParams.get('difficulty');

    if (!game) {
      return new Response(
        JSON.stringify({ error: 'Bad request', message: '缺少参数: game' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 连接 MongoDB
    const mongoClient = await getMongoClient();
    const db = mongoClient.database(Deno.env.get('MONGODB_DB_NAME') || 'game_db');
    const collection = db.collection('game_levels');

    // 构建查询条件
    const query: any = { game };
    if (difficulty) {
      query.difficulty = difficulty;
    }

    // 查询关卡数据
    const documents = await collection.find(query).toArray();

    if (documents.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Not found',
          message: `未找到关卡数据: game=${game}, difficulty=${difficulty || 'all'}`
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ 加载关卡: game=${game}, difficulty=${difficulty || 'all'}, 找到 ${documents.length} 个文档`);

    // 如果只查询了一个难度，返回单个文档的 levels 数组
    if (difficulty && documents.length === 1) {
      return new Response(
        JSON.stringify({
          success: true,
          game,
          difficulty,
          level_count: documents[0].level_count,
          levels: documents[0].levels,
          updated_at: documents[0].updated_at
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 返回多个难度的关卡数据（按难度分组）
    const levelsByDifficulty: any = {};
    documents.forEach(doc => {
      levelsByDifficulty[doc.difficulty] = {
        level_count: doc.level_count,
        levels: doc.levels,
        updated_at: doc.updated_at
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        game,
        difficulties: Object.keys(levelsByDifficulty),
        data: levelsByDifficulty
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('处理请求失败:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
