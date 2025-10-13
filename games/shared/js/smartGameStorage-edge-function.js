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

    const token = await this.getClerkToken();

    // 如果无法获取 token，直接失败，不发送无效请求
    if (!token) {
      throw new Error('无法获取认证 token - Clerk 可能还未初始化完成');
    }

    console.log(`📤 [Edge Function] 调用 ${action} for ${this.gameType}/${key}`);
    console.log('  - User ID:', userId);
    console.log('  - Token:', token.substring(0, 20) + '...');

    const response = await fetch(this.edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.getSupabaseAnonKey(),
        'Authorization': `Bearer ${token}` // Clerk JWT
      },
      body: JSON.stringify({
        action,
        gameType: this.gameType,
        gameData: data,
        dataKey: key
      })
    });

    console.log(`📥 [Edge Function] 响应状态:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Edge Function] 错误响应:`, errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }
      throw new Error(errorData.message || `Edge Function call failed (${response.status})`);
    }

    return await response.json();
  }

  /**
   * 获取 Clerk JWT Token
   * 使用 clerkUnifiedAuth.js 提供的统一接口（优先使用缓存 token，避免网络延迟）
   */
  async getClerkToken() {
    try {
      console.log('🔑 [Edge Function] 尝试获取 Clerk token...');

      // 方式1 (推荐): 从 mockClerkUser 获取缓存的 token (无网络延迟)
      if (window.mockClerkUser && window.mockClerkUser.originalSessionToken) {
        const token = window.mockClerkUser.originalSessionToken;
        console.log('  - ✅ 从 mockClerkUser 缓存获取 token (无网络请求)');
        console.log('  - Token 长度:', token.length);
        console.log('  - Token 前20字符:', token.substring(0, 20));
        return token;
      }

      // 方式2: 使用 gameAuth 统一接口
      if (typeof window.getGameToken === 'function') {
        console.log('  - 🔄 尝试从 gameAuth.getToken() 获取...');
        const token = await window.getGameToken();
        if (token) {
          console.log('  - ✅ 从 gameAuth 获取 token');
          console.log('  - Token 长度:', token.length);
          console.log('  - Token 前20字符:', token.substring(0, 20));
          return token;
        }
      }

      // 方式3: 直接从 Clerk session 获取 (可能需要网络请求刷新 token)
      if (window.Clerk && window.Clerk.session) {
        console.log('  - 🔄 从 Clerk.session.getToken() 获取...');
        const token = await window.Clerk.session.getToken();
        if (token) {
          console.log('  - ✅ 从 Clerk session 获取 token');
          console.log('  - Token 长度:', token.length);
          console.log('  - Token 前20字符:', token.substring(0, 20));
          return token;
        }
      }

      console.warn('⚠️ [Edge Function] 无法获取 Clerk token');
      console.warn('  - mockClerkUser:', !!window.mockClerkUser);
      console.warn('  - getGameToken:', typeof window.getGameToken);
      console.warn('  - Clerk.session:', window.Clerk ? !!window.Clerk.session : false);

      // 返回 null，让调用方决定如何处理
      return null;
    } catch (error) {
      console.error('❌ [Edge Function] 获取 Clerk token 失败:', error);
      throw error; // 重新抛出错误，避免静默失败
    }
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
    // 从 gameConfig.js 设置的全局变量获取
    return window.SUPABASE_URL || window.GAME_CONFIG?.SUPABASE_URL || '';
  }

  /**
   * 获取 Supabase Anon Key
   */
  getSupabaseAnonKey() {
    // 从 gameConfig.js 设置的全局变量获取
    return window.SUPABASE_ANON_KEY || window.GAME_CONFIG?.SUPABASE_ANON_KEY || '';
  }

  // ===================
  // 通用游戏进度管理方法
  // 从 SmartNonogramStorage 和 SmartSudokuStorage 复制而来
  // 这些方法调用基类的 save()/load()，会自动通过 Edge Function 访问云端
  // ===================

  /**
   * 保存游戏进度
   */
  async saveProgress(progressData) {
    return await this.save('progress', progressData);
  }

  /**
   * 加载游戏进度
   */
  async loadProgress() {
    const data = await this.load('progress');
    return data || this.getDefaultProgress();
  }

  /**
   * 获取默认进度结构
   */
  getDefaultProgress() {
    // 数织游戏的难度级别（包含 master 难度）
    if (this.gameType === 'nonogram') {
      return {
        easy: { current_level: 1, completed_levels: [], level_records: {} },
        medium: { current_level: 1, completed_levels: [], level_records: {} },
        hard: { current_level: 1, completed_levels: [], level_records: {} },
        expert: { current_level: 1, completed_levels: [], level_records: {} },
        master: { current_level: 1, completed_levels: [], level_records: {} }
      };
    }

    // 数独游戏的难度级别
    if (this.gameType === 'sudoku') {
      return {
        easy: { current_level: 1, completed_levels: [], level_records: {} },
        medium: { current_level: 1, completed_levels: [], level_records: {} },
        hard: { current_level: 1, completed_levels: [], level_records: {} },
        expert: { current_level: 1, completed_levels: [], level_records: {} },
        master: { current_level: 1, completed_levels: [], level_records: {} }
      };
    }

    // 其他游戏的通用默认结构
    return {
      easy: { current_level: 1, completed_levels: [], level_records: {} },
      medium: { current_level: 1, completed_levels: [], level_records: {} },
      hard: { current_level: 1, completed_levels: [], level_records: {} },
      expert: { current_level: 1, completed_levels: [], level_records: {} }
    };
  }

  /**
   * 更新关卡记录
   * 从 SmartNonogramStorage 复制的通用实现
   */
  async updateLevelRecord(difficulty, levelNumber, timeInSeconds, stars) {
    try {
      const progress = await this.loadProgress();

      // 确保进度结构存在
      if (!progress[difficulty]) {
        progress[difficulty] = {
          current_level: 1,
          completed_levels: [],
          level_records: {}
        };
      }

      // 更新关卡记录
      const record = progress[difficulty].level_records[levelNumber] || { attempts: 0 };
      record.attempts++;
      record.completed = true;
      record.best_time = record.best_time ? Math.min(record.best_time, timeInSeconds) : timeInSeconds;
      record.best_stars = record.best_stars ? Math.max(record.best_stars, stars) : stars;
      record.last_completed = new Date().toISOString();

      progress[difficulty].level_records[levelNumber] = record;

      // 添加到已完成关卡列表
      if (!progress[difficulty].completed_levels.includes(levelNumber)) {
        progress[difficulty].completed_levels.push(levelNumber);
      }

      // 解锁下一关
      progress[difficulty].current_level = Math.max(
        progress[difficulty].current_level,
        Math.min(50, levelNumber + 1)
      );

      // 保存进度
      await this.saveProgress(progress);

      console.log(`✅ [${this.gameType}] Level ${levelNumber} (${difficulty}) completion recorded with ${stars} stars`);

    } catch (error) {
      console.error(`❌ [${this.gameType}] Failed to update level record:`, error);
      throw error;
    }
  }

  /**
   * 保存游戏设置
   */
  async saveSettings(settings) {
    return await this.save('settings', settings);
  }

  /**
   * 加载游戏设置
   */
  async loadSettings() {
    const data = await this.load('settings');
    return data || this.getDefaultSettings();
  }

  /**
   * 获取默认设置
   */
  getDefaultSettings() {
    if (this.gameType === 'sudoku') {
      return {
        difficulty: 'medium',
        hints: true,
        autoValidate: true,
        theme: 'light',
        vibration: true,
        sound: true
      };
    }

    // 数织和其他游戏的默认设置
    return {
      difficulty: 'easy',
      showHints: true,
      autoSave: true,
      theme: 'light',
      sound: true
    };
  }

  /**
   * 保存游戏统计
   */
  async saveStats(stats) {
    return await this.save('stats', stats);
  }

  /**
   * 加载游戏统计
   */
  async loadStats() {
    const data = await this.load('stats');
    return data || this.getDefaultStats();
  }

  /**
   * 获取默认统计数据
   */
  getDefaultStats() {
    // 2048 游戏的统计数据
    if (this.gameType === '2048') {
      return {
        gamesPlayed: 0,
        gamesWon: 0,
        highestTile: 0,
        totalScore: 0,
        averageScore: 0,
        bestScore: 0
      };
    }

    // 其他游戏的统计数据
    return {
      gamesPlayed: 0,
      gamesWon: 0,
      bestTimes: {
        easy: null,
        medium: null,
        hard: null,
        expert: null,
        master: null
      },
      totalPlayTime: 0,
      starsEarned: {
        easy: 0,
        medium: 0,
        hard: 0,
        expert: 0,
        master: 0
      }
    };
  }

  // ===================
  // 2048 游戏特定方法
  // ===================

  /**
   * 保存游戏状态（2048）
   */
  async saveGameState(gameState) {
    return await this.save('gameState', gameState);
  }

  /**
   * 加载游戏状态（2048）
   */
  async loadGameState() {
    const data = await this.load('gameState');
    return data || null;
  }

  /**
   * 清除游戏状态（2048）
   */
  async clearGameState() {
    this.clearLocalData('gameState');
    if (this.isUserLoggedIn()) {
      await this.clearCloudData('gameState');
    }
  }

  /**
   * 保存最佳分数（2048）
   */
  async saveBestScore(score) {
    return await this.save('bestScore', score);
  }

  /**
   * 加载最佳分数（2048）
   */
  async loadBestScore() {
    const data = await this.load('bestScore');
    return data || 0;
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartGameStorageEdgeFunction;
}

// 浏览器环境全局导出
if (typeof window !== 'undefined') {
  window.SmartGameStorageEdgeFunction = SmartGameStorageEdgeFunction;
}
