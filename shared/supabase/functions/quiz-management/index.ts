// Supabase Edge Function: quiz-management
// 处理题库管理系统的所有数据库操作，支持 Web 版（Clerk JWT）

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 解析请求
    const { action, ...params } = await req.json();

    // 获取用户 ID（从 Clerk JWT）
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');

    if (authHeader) {
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

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: '未提供有效的认证信息' }),
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
    switch (action) {
      // ==================== 查询操作 ====================

      case 'getPapers': {
        const { data, error } = await supabaseAdmin
          .from('papers')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('获取试卷失败:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: data || [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getQuestions': {
        const { data, error } = await supabaseAdmin
          .from('questions')
          .select(`
            *,
            papers (
              id,
              title,
              teacher,
              semester,
              course_name,
              math_category,
              created_at
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('获取题目失败:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: data || [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'getAttempts': {
        const { userId: targetUserId } = params;

        let query = supabaseAdmin
          .from('attempts')
          .select('*')
          .order('created_at', { ascending: false });

        // 如果指定了用户ID，只获取该用户的记录
        if (targetUserId) {
          query = query.eq('user_id', targetUserId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('获取学习记录失败:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: data || [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'findExistingPaper': {
        const { teacher, semester, courseName, mathCategory, excludeId } = params;

        let query = supabaseAdmin
          .from('papers')
          .select('id, title, teacher, semester, course_name, math_category')
          .eq('teacher', teacher)
          .eq('semester', semester)
          .eq('course_name', courseName)
          .eq('math_category', mathCategory);

        if (excludeId) {
          query = query.neq('id', excludeId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('查找试卷失败:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: data || [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ==================== 写入操作 ====================

      case 'addPaper': {
        const { paperData } = params;

        const { data, error } = await supabaseAdmin
          .from('papers')
          .insert([paperData])
          .select()
          .single();

        if (error) {
          console.error('添加试卷失败:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'addQuestion': {
        const { questionData } = params;

        const { data, error } = await supabaseAdmin
          .from('questions')
          .insert([questionData])
          .select()
          .single();

        if (error) {
          console.error('添加题目失败:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'recordAttempt': {
        const { attemptData } = params;

        // 转换字段名以匹配数据库
        const dbData = {
          question_id: attemptData.questionId,
          user_id: attemptData.userId,
          mastery_score: attemptData.masteryScore,
          is_marked_wrong: attemptData.isMarkedWrong || false,
        };

        const { data, error } = await supabaseAdmin
          .from('attempts')
          .insert([dbData])
          .select()
          .single();

        if (error) {
          console.error('记录学习尝试失败:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updateQuestion': {
        const { id, updates } = params;

        const { data, error } = await supabaseAdmin
          .from('questions')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('更新题目失败:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'updatePaper': {
        const { id, updates } = params;

        const { data, error } = await supabaseAdmin
          .from('papers')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('更新试卷失败:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'deleteQuestion': {
        const { id } = params;

        const { error } = await supabaseAdmin
          .from('questions')
          .delete()
          .eq('id', id);

        if (error) {
          console.error('删除题目失败:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ==================== 复合操作 ====================

      case 'addPaperWithQuestions': {
        const { paperData, questionsData } = params;

        // 1. 检查是否已存在相同的试卷
        const { data: existingPapers, error: searchError } = await supabaseAdmin
          .from('papers')
          .select('*')
          .eq('title', paperData.title)
          .eq('teacher', paperData.teacher)
          .eq('semester', paperData.semester)
          .eq('course_name', paperData.course_name)
          .eq('math_category', paperData.math_category);

        if (searchError) {
          console.error('检查重复试卷失败:', searchError);
          return new Response(
            JSON.stringify({ success: false, error: '检查重复试卷失败: ' + searchError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let paperId;
        let paperResult;

        if (existingPapers && existingPapers.length > 0) {
          // 使用现有试卷
          paperId = existingPapers[0].id;
          paperResult = existingPapers[0];
          console.log('使用现有试卷:', existingPapers[0].title);
        } else {
          // 创建新试卷
          const { data: newPaper, error: paperError } = await supabaseAdmin
            .from('papers')
            .insert([paperData])
            .select()
            .single();

          if (paperError) {
            console.error('添加试卷失败:', paperError);
            return new Response(
              JSON.stringify({ success: false, error: '添加试卷失败: ' + paperError.message }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          paperId = newPaper.id;
          paperResult = newPaper;
          console.log('创建新试卷:', paperData.title);
        }

        // 2. 添加题目，关联到试卷
        const questionsWithPaperId = questionsData.map((q: any) => ({
          ...q,
          paper_id: paperId,
        }));

        const { data: questions, error: questionsError } = await supabaseAdmin
          .from('questions')
          .insert(questionsWithPaperId)
          .select();

        if (questionsError) {
          console.error('添加题目失败:', questionsError);
          return new Response(
            JSON.stringify({ success: false, error: '添加题目失败: ' + questionsError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              paper: paperResult,
              questions: questions,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Bad request', message: `未知操作: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('处理请求失败:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
