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
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartGameStorageEdgeFunction;
}

// 浏览器环境全局导出
if (typeof window !== 'undefined') {
  window.SmartGameStorageEdgeFunction = SmartGameStorageEdgeFunction;
}
