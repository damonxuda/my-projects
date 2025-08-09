// Real Supabase Database Service
import { createSupabaseClientFromEnv, SUPABASE_CONFIG } from '../../../auth/src';

class DatabaseService {
  constructor() {
    this.supabase = null;
    this.tables = SUPABASE_CONFIG.tables;
    this.initializeSupabase();
  }

  // 初始化Supabase客户端
  initializeSupabase() {
    try {
      this.supabase = createSupabaseClientFromEnv();
      console.log('✅ DatabaseService: Supabase client initialized');
    } catch (error) {
      console.error('❌ DatabaseService: Failed to initialize Supabase client:', error);
      throw error;
    }
  }

  // ===============================
  // 题目相关操作
  // ===============================
  
  async addQuestion(questionData) {
    try {
      const { data, error } = await this.supabase
        .from(this.tables.questions)
        .insert([{
          title: questionData.title,
          content: questionData.content,
          type: questionData.type || 'multiple_choice',
          options: questionData.options,
          correct_answer: questionData.correctAnswer,
          explanation: questionData.explanation,
          difficulty: questionData.difficulty || 1,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;
      
      // 如果有标签，添加标签关联
      if (questionData.tags && questionData.tags.length > 0) {
        await this.addQuestionTags(data.id, questionData.tags);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error adding question:', error);
      return { success: false, error: error.message };
    }
  }

  async getQuestions(filters = {}) {
    try {
      let query = this.supabase
        .from(this.tables.questions)
        .select(`
          *,
          question_tags (
            tags (
              id,
              name,
              color
            )
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // 应用过滤器
      if (filters.difficulty) {
        query = query.eq('difficulty', filters.difficulty);
      }
      
      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // 格式化数据，将标签扁平化
      const formattedData = data.map(question => ({
        ...question,
        tags: question.question_tags?.map(qt => qt.tags) || []
      }));

      return { success: true, data: formattedData };
    } catch (error) {
      console.error('Error getting questions:', error);
      return { success: false, error: error.message };
    }
  }

  async getQuestionById(id) {
    try {
      const { data, error } = await this.supabase
        .from(this.tables.questions)
        .select(`
          *,
          question_tags (
            tags (
              id,
              name,
              color
            )
          )
        `)
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (error) throw error;

      // 格式化标签
      const formattedData = {
        ...data,
        tags: data.question_tags?.map(qt => qt.tags) || []
      };

      return { success: true, data: formattedData };
    } catch (error) {
      console.error('Error getting question:', error);
      return { success: false, error: error.message };
    }
  }

  async updateQuestion(id, updates) {
    try {
      const { data, error } = await this.supabase
        .from(this.tables.questions)
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // 如果更新了标签，重新设置标签关联
      if (updates.tags !== undefined) {
        await this.updateQuestionTags(id, updates.tags);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error updating question:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteQuestion(id) {
    try {
      const { error } = await this.supabase
        .from(this.tables.questions)
        .update({ is_active: false })  // 软删除
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting question:', error);
      return { success: false, error: error.message };
    }
  }

  // ===============================
  // 标签相关操作
  // ===============================

  async getTags() {
    try {
      const { data, error } = await this.supabase
        .from(this.tables.tags)
        .select('*')
        .order('name');

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting tags:', error);
      return { success: false, error: error.message };
    }
  }

  async addTag(tagData) {
    try {
      const { data, error } = await this.supabase
        .from(this.tables.tags)
        .insert([{
          name: tagData.name,
          color: tagData.color || '#3B82F6',
          description: tagData.description
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error adding tag:', error);
      return { success: false, error: error.message };
    }
  }

  async addQuestionTags(questionId, tagIds) {
    try {
      const tagAssociations = tagIds.map(tagId => ({
        question_id: questionId,
        tag_id: tagId
      }));

      const { error } = await this.supabase
        .from(this.tables.question_tags)
        .insert(tagAssociations);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error adding question tags:', error);
      return { success: false, error: error.message };
    }
  }

  async updateQuestionTags(questionId, tagIds) {
    try {
      // 先删除现有关联
      await this.supabase
        .from(this.tables.question_tags)
        .delete()
        .eq('question_id', questionId);

      // 如果有新标签，添加新关联
      if (tagIds && tagIds.length > 0) {
        await this.addQuestionTags(questionId, tagIds);
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating question tags:', error);
      return { success: false, error: error.message };
    }
  }

  // ===============================
  // 答题记录相关操作
  // ===============================

  async recordAttempt(attemptData) {
    try {
      const { data, error } = await this.supabase
        .from(this.tables.attempts)
        .insert([{
          question_id: attemptData.questionId,
          user_answer: attemptData.userAnswer,
          is_correct: attemptData.isCorrect,
          response_time: attemptData.responseTime,
          user_id: attemptData.userId,
          session_id: attemptData.sessionId
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error recording attempt:', error);
      return { success: false, error: error.message };
    }
  }

  async getAttempts(filters = {}) {
    try {
      let query = this.supabase
        .from(this.tables.attempts)
        .select(`
          *,
          questions (
            id,
            title,
            difficulty
          )
        `)
        .order('attempted_at', { ascending: false });

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters.sessionId) {
        query = query.eq('session_id', filters.sessionId);
      }

      if (filters.questionId) {
        query = query.eq('question_id', filters.questionId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting attempts:', error);
      return { success: false, error: error.message };
    }
  }

  // ===============================
  // 统计相关操作
  // ===============================

  async getStatistics(userId = null, sessionId = null) {
    try {
      let filter = {};
      if (userId) filter.user_id = userId;
      if (sessionId) filter.session_id = sessionId;

      const { data: attempts, error } = await this.supabase
        .from(this.tables.attempts)
        .select('*')
        .match(filter);

      if (error) throw error;

      const stats = {
        totalQuestions: attempts.length,
        correctAnswers: attempts.filter(a => a.is_correct).length,
        averageTime: attempts.length > 0 ? 
          attempts.reduce((sum, a) => sum + (a.response_time || 0), 0) / attempts.length : 0,
        accuracy: attempts.length > 0 ? 
          (attempts.filter(a => a.is_correct).length / attempts.length) * 100 : 0
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('Error getting statistics:', error);
      return { success: false, error: error.message };
    }
  }

  // ===============================
  // 工具方法
  // ===============================

  async testConnection() {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data, error } = await this.supabase
        .from(this.tables.questions)
        .select('count(*)')
        .limit(1);

      if (error) throw error;
      
      console.log('✅ Supabase connection successful!');
      return { success: true, message: 'Database connection successful' };
    } catch (error) {
      console.error('❌ Supabase connection failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// 导出单例实例
export default new DatabaseService();