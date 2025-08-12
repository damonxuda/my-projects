// Real Supabase Database Service with Clerk Authentication
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
      console.log('✅ DatabaseService: Supabase client initialized');
    } catch (error) {
      console.error('❌ DatabaseService: Failed to initialize Supabase client:', error);
      throw error;
    }
  }

  // ===============================
  // 权限检查方法
  // ===============================

  async checkUserAccess(clerkUserId) {
    try {
      const { data: userProfile, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('clerk_user_id', clerkUserId)
        .eq('status', 'approved')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return {
        isApproved: !!userProfile,
        userProfile: userProfile || null
      };
    } catch (error) {
      console.error('Error checking user access:', error);
      return { isApproved: false, userProfile: null };
    }
  }

  async ensureUserProfile(clerkUser) {
    try {
      // 检查用户档案是否存在
      const { data: existingProfile, error: selectError } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('clerk_user_id', clerkUser.id)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        throw selectError;
      }

      // 如果档案不存在，创建新档案
      if (!existingProfile) {
        const { data: newProfile, error: insertError } = await this.supabase
          .from('user_profiles')
          .insert({
            clerk_user_id: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress,
            status: 'pending',
            requested_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return newProfile;
      }

      return existingProfile;
    } catch (error) {
      console.error('Error ensuring user profile:', error);
      throw error;
    }
  }

  // 权限验证装饰器
  async withAccessCheck(operation, clerkUser = null) {
    if (!clerkUser) {
      throw new Error('用户未登录');
    }

    // 确保用户档案存在
    await this.ensureUserProfile(clerkUser);

    // 检查访问权限
    const { isApproved } = await this.checkUserAccess(clerkUser.id);
    
    if (!isApproved) {
      throw new Error('用户未通过审批，无法访问题库内容');
    }

    return await operation();
  }

  // ===============================
  // 题目相关操作
  // ===============================
  
  async addQuestion(questionData, clerkUser = null) {
    return await this.withAccessCheck(async () => {
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
    }, clerkUser);
  }

  async getQuestions(filters = {}, clerkUser = null) {
    return await this.withAccessCheck(async () => {
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
    }, clerkUser);
  }

  async getQuestionById(id, clerkUser = null) {
    return await this.withAccessCheck(async () => {
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
    }, clerkUser);
  }

  async updateQuestion(id, updates, clerkUser = null) {
    return await this.withAccessCheck(async () => {
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
    }, clerkUser);
  }

  async deleteQuestion(id, clerkUser = null) {
    return await this.withAccessCheck(async () => {
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
    }, clerkUser);
  }

  // ===============================
  // 答题记录相关操作
  // ===============================

  async recordAttempt(attemptData, clerkUser = null) {
    return await this.withAccessCheck(async () => {
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
    }, clerkUser);
  }

  async getAttempts(filters = {}, clerkUser = null) {
    return await this.withAccessCheck(async () => {
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
    }, clerkUser);
  }

  // ===============================
  // 兼容旧API的方法（用于App.js过渡）
  // ===============================

  async selectQuestions(clerkUser = null) {
    const result = await this.getQuestions({}, clerkUser);
    return { data: result.success ? result.data : [], error: result.success ? null : result.error };
  }

  async selectAttempts(clerkUser = null) {
    const result = await this.getAttempts({}, clerkUser);
    return { data: result.success ? result.data : [], error: result.success ? null : result.error };
  }

  async insertAttempt(attemptData, clerkUser = null) {
    const result = await this.recordAttempt(attemptData, clerkUser);
    return { data: result.success ? result.data : null, error: result.success ? null : result.error };
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

  getConnectionStatus() {
    return {
      mode: 'production',
      status: this.supabase ? 'connected' : 'disconnected'
    };
  }

  // 清空数据（开发/测试用）
  async clearAll(clerkUser = null) {
    return await this.withAccessCheck(async () => {
      try {
        // 先清空attempts
        await this.supabase.from(this.tables.attempts).delete().neq('id', 0);
        // 再清空questions  
        await this.supabase.from(this.tables.questions).delete().neq('id', 0);
        
        console.log('✅ All data cleared');
        return { success: true };
      } catch (error) {
        console.error('Error clearing data:', error);
        return { success: false, error: error.message };
      }
    }, clerkUser);
  }
}

// 导出单例实例
export default new DatabaseService();