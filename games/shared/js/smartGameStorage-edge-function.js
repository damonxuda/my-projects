// 智能游戏存储管理器（Edge Function 版本）
// 通过 Edge Function 访问数据库，而不是直接访问

class SmartGameStorageEdgeFunction extends SmartGameStorage {
  constructor(gameType) {
    super(gameType);
    this.edgeFunctionUrl = `${this.getSupabaseUrl()}/functions/v1/game-progress`;
  }

  /**
   * 调用 Edge Function
   */
  async callEdgeFunction(action, key, data = null) {
    const userId = this.getUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(this.edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.getSupabaseAnonKey(),
        'Authorization': `Bearer ${await this.getClerkToken()}` // Clerk JWT
      },
      body: JSON.stringify({
        action,
        gameType: this.gameType,
        gameData: data,
        dataKey: key
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Edge Function call failed');
    }

    return await response.json();
  }

  /**
   * 获取 Clerk JWT Token
   */
  async getClerkToken() {
    // 假设 Clerk 已经初始化
    if (window.Clerk && window.Clerk.session) {
      return await window.Clerk.session.getToken();
    }
    return null;
  }

  /**
   * 保存到云端（通过 Edge Function）
   */
  async saveToCloud(key, data, timestamp = Date.now()) {
    try {
      const result = await this.callEdgeFunction('save', key, data);

      if (result.success) {
        console.log(`☁️ [${this.gameType}] Edge Function 保存成功`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`❌ [${this.gameType}] Edge Function 保存失败:`, error);
      return false;
    }
  }

  /**
   * 从云端加载（通过 Edge Function）
   */
  async loadFromCloud(key) {
    try {
      const result = await this.callEdgeFunction('get', key);

      if (result.success && result.data) {
        console.log(`☁️ [${this.gameType}] Edge Function 加载成功`);
        return result.data;
      }

      return null;
    } catch (error) {
      console.error(`❌ [${this.gameType}] Edge Function 加载失败:`, error);
      return null;
    }
  }

  /**
   * 获取 Supabase URL
   */
  getSupabaseUrl() {
    // 从配置或环境变量获取
    return window.SUPABASE_URL || 'https://your-project.supabase.co';
  }

  /**
   * 获取 Supabase Anon Key
   */
  getSupabaseAnonKey() {
    // 从配置或环境变量获取
    return window.SUPABASE_ANON_KEY || 'your-anon-key';
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartGameStorageEdgeFunction;
}
