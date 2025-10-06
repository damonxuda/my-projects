// QuizEdgeFunctionService.js
// 通过 Supabase Edge Function 访问 Quiz 数据库的封装服务

class QuizEdgeFunctionService {
  constructor() {
    this.edgeFunctionUrl = null;
    this.supabaseUrl = null;
    this.supabaseAnonKey = null;
  }

  /**
   * 初始化服务
   */
  initialize(supabaseUrl, supabaseAnonKey) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;
    this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/quiz-management`;
    console.log('QuizEdgeFunctionService initialized:', this.edgeFunctionUrl);
  }

  /**
   * 获取 Clerk JWT Token
   */
  async getClerkToken() {
    try {
      console.log('🔑 [Quiz Edge Function] 尝试获取 Clerk token...');

      // 方式1: 从 mockClerkUser 获取缓存的 token
      if (window.mockClerkUser && window.mockClerkUser.originalSessionToken) {
        const token = window.mockClerkUser.originalSessionToken;
        console.log('  - ✅ 从 mockClerkUser 缓存获取 token');
        return token;
      }

      // 方式2: 使用 gameAuth 统一接口
      if (typeof window.getGameToken === 'function') {
        console.log('  - 🔄 尝试从 gameAuth.getToken() 获取...');
        const token = await window.getGameToken();
        if (token) {
          console.log('  - ✅ 从 gameAuth 获取 token');
          return token;
        }
      }

      // 方式3: 直接从 Clerk session 获取
      if (window.Clerk && window.Clerk.session) {
        console.log('  - 🔄 从 Clerk.session.getToken() 获取...');
        const token = await window.Clerk.session.getToken();
        if (token) {
          console.log('  - ✅ 从 Clerk session 获取 token');
          return token;
        }
      }

      console.warn('⚠️ [Quiz Edge Function] 无法获取 Clerk token');
      return null;
    } catch (error) {
      console.error('❌ [Quiz Edge Function] 获取 Clerk token 失败:', error);
      throw error;
    }
  }

  /**
   * 调用 Edge Function
   */
  async callEdgeFunction(action, params = {}) {
    try {
      const token = await this.getClerkToken();

      if (!token) {
        throw new Error('无法获取认证 token - Clerk 可能还未初始化完成');
      }

      console.log(`📤 [Quiz Edge Function] 调用 ${action}`);

      const response = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseAnonKey,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          ...params
        })
      });

      console.log(`📥 [Quiz Edge Function] 响应状态:`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Quiz Edge Function] 错误响应:`, errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }
        throw new Error(errorData.message || `Edge Function call failed (${response.status})`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ [Quiz Edge Function] ${action} 失败:`, error);
      throw error;
    }
  }

  // ==================== 查询操作 ====================

  async getPapers() {
    return await this.callEdgeFunction('getPapers');
  }

  async getQuestions() {
    return await this.callEdgeFunction('getQuestions');
  }

  async getAttempts(userId = null) {
    return await this.callEdgeFunction('getAttempts', { userId });
  }

  async findExistingPaper(teacher, semester, courseName, mathCategory, excludeId = null) {
    return await this.callEdgeFunction('findExistingPaper', {
      teacher,
      semester,
      courseName,
      mathCategory,
      excludeId
    });
  }

  // ==================== 写入操作 ====================

  async addPaper(paperData) {
    return await this.callEdgeFunction('addPaper', { paperData });
  }

  async addQuestion(questionData) {
    return await this.callEdgeFunction('addQuestion', { questionData });
  }

  async recordAttempt(attemptData) {
    return await this.callEdgeFunction('recordAttempt', { attemptData });
  }

  async updateQuestion(id, updates) {
    return await this.callEdgeFunction('updateQuestion', { id, updates });
  }

  async updatePaper(id, updates) {
    return await this.callEdgeFunction('updatePaper', { id, updates });
  }

  async deleteQuestion(id) {
    return await this.callEdgeFunction('deleteQuestion', { id });
  }

  // ==================== 复合操作 ====================

  async addPaperWithQuestions(paperData, questionsData) {
    return await this.callEdgeFunction('addPaperWithQuestions', {
      paperData,
      questionsData
    });
  }
}

// 创建单例实例
const quizEdgeFunctionService = new QuizEdgeFunctionService();

export default quizEdgeFunctionService;
