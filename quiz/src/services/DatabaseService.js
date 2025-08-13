// 完全简化的数据库服务 - 无权限检查版本
import { createSupabaseClientFromEnv, SUPABASE_CONFIG } from '../../../shared/supabase';

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
    } catch (error) {
      console.error('❌ DatabaseService: Failed to initialize Supabase client:', error);
      throw error;
    }
  }

  // ===============================
  // 题目相关操作 (完全无权限检查)
  // ===============================
  
  async addQuestion(questionData) {
    try {
      const { data, error } = await this.supabase
        .from(this.tables.questions)
        .insert([{
          question_type: questionData.questionType,
          question_text: questionData.questionText,
          answer: questionData.answer,
          solution_steps: questionData.solutionSteps,
          tags: questionData.tags || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
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
        .select('*')
        .order('created_at', { ascending: false });

      // 应用过滤器
      if (filters.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
      }

      if (filters.search) {
        query = query.or(`question_text.ilike.%${filters.search}%,answer.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting questions:', error);
      return { success: false, error: error.message };
    }
  }

  async getQuestionById(id) {
    try {
      const { data, error } = await this.supabase
        .from(this.tables.questions)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
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
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting question:', error);
      return { success: false, error: error.message };
    }
  }

  // ===============================
  // 答题记录相关操作 (完全无权限检查)
  // ===============================

  async recordAttempt(attemptData) {
    try {
      const { data, error } = await this.supabase
        .from(this.tables.attempts)
        .insert([{
          question_id: attemptData.questionId,
          mastery_score: attemptData.masteryScore,
          is_marked_wrong: attemptData.isMarkedWrong || false,
          created_at: new Date().toISOString()
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
        .select('*')
        .order('created_at', { ascending: false });

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
  // 工具方法
  // ===============================

  async testConnection() {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { error } = await this.supabase
        .from(this.tables.questions)
        .select('count(*)')
        .limit(1);

      if (error) throw error;
      
      return { success: true, message: 'Database connection successful' };
    } catch (error) {
      console.error('❌ Supabase connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  getConnectionStatus() {
    return {
      mode: 'production',
      status: this.supabase ? 'connected' : 'disconnected'
    };
  }

  // 清空数据（开发/测试用）- 完全无权限检查
  async clearAll() {
    try {
      // 先清空attempts
      await this.supabase.from(this.tables.attempts).delete().neq('id', 0);
      // 再清空questions  
      await this.supabase.from(this.tables.questions).delete().neq('id', 0);
      
      return { success: true };
    } catch (error) {
      console.error('Error clearing data:', error);
      return { success: false, error: error.message };
    }
  }
}

// 创建实例并导出
const databaseService = new DatabaseService();
export default databaseService;