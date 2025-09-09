// 认证感知的存储管理器 - 集成 auth-clerk 和 Supabase
// 支持在线/离线同步，自动处理用户认证状态

class AuthenticatedGameStorage {
  constructor(gameType = 'sudoku') {
    this.gameType = gameType;
    this.prefix = `game_${gameType}`;
    this.auth = null;
    this.supabase = null;
    this.isInitialized = false;
    this.syncQueue = [];
    this.isOnline = navigator.onLine;
    this.lastSyncTime = null;
    
    // 监听网络状态变化
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processSyncQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // 初始化认证和数据库连接
  async initialize(authHook, supabaseClient) {
    try {
      this.auth = authHook;
      this.supabase = supabaseClient;
      this.isInitialized = true;
      
      // 如果用户已登录，尝试同步数据
      if (this.auth.isSignedIn && this.isOnline) {
        await this.syncFromCloud();
      }
      
      return true;
    } catch (error) {
      console.error('AuthenticatedGameStorage initialization failed:', error);
      return false;
    }
  }

  // 生成存储键
  getStorageKey(key) {
    return `${this.prefix}_${key}`;
  }

  // 获取用户ID
  getUserId() {
    return this.auth?.user?.id || null;
  }

  // 本地存储操作
  saveLocal(key, data) {
    try {
      const fullKey = this.getStorageKey(key);
      const payload = {
        data,
        timestamp: Date.now(),
        version: '1.0',
        userId: this.getUserId(),
        gameType: this.gameType
      };
      localStorage.setItem(fullKey, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.error('Local save failed:', error);
      return false;
    }
  }

  // 本地加载操作
  loadLocal(key) {
    try {
      const fullKey = this.getStorageKey(key);
      const jsonData = localStorage.getItem(fullKey);
      
      if (!jsonData) return null;
      
      const parsed = JSON.parse(jsonData);
      return parsed.data;
    } catch (error) {
      console.error('Local load failed:', error);
      return null;
    }
  }

  // 云端保存操作
  async saveCloud(key, data) {
    if (!this.isInitialized || !this.auth.isSignedIn || !this.isOnline) {
      return false;
    }

    try {
      const userId = this.getUserId();
      if (!userId) return false;

      const gameData = {
        user_id: userId,
        game: this.gameType,
        data_key: key,
        data: data,
        updated_at: new Date().toISOString()
      };

      // 使用 upsert 来插入或更新数据
      const { error } = await this.supabase
        .from('game_progress')
        .upsert(gameData, { 
          onConflict: 'user_id,game,data_key',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Cloud save error:', error);
        return false;
      }

      console.log(`✅ Cloud save successful: ${this.gameType}/${key}`);
      return true;
    } catch (error) {
      console.error('Cloud save failed:', error);
      return false;
    }
  }

  // 云端加载操作
  async loadCloud(key) {
    if (!this.isInitialized || !this.auth.isSignedIn || !this.isOnline) {
      return null;
    }

    try {
      const userId = this.getUserId();
      if (!userId) return null;

      const { data, error } = await this.supabase
        .from('game_progress')
        .select('data, updated_at')
        .eq('user_id', userId)
        .eq('game', this.gameType)
        .eq('data_key', key)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 数据不存在，这是正常的
          return null;
        }
        console.error('Cloud load error:', error);
        return null;
      }

      return data?.data || null;
    } catch (error) {
      console.error('Cloud load failed:', error);
      return null;
    }
  }

  // 统一保存接口（智能选择本地/云端）
  async save(key, data) {
    // 总是先保存到本地
    const localSuccess = this.saveLocal(key, data);
    
    if (!localSuccess) {
      console.error('Local save failed, aborting save operation');
      return false;
    }

    // 如果用户已登录且在线，尝试同步到云端
    if (this.auth?.isSignedIn && this.isOnline) {
      const cloudSuccess = await this.saveCloud(key, data);
      if (!cloudSuccess) {
        // 云端保存失败，添加到同步队列
        this.addToSyncQueue('save', key, data);
      }
    } else if (this.auth?.isSignedIn) {
      // 用户已登录但离线，添加到同步队列
      this.addToSyncQueue('save', key, data);
    }

    return true;
  }

  // 统一加载接口（智能选择本地/云端）
  async load(key) {
    // 如果用户已登录且在线，优先从云端加载
    if (this.auth?.isSignedIn && this.isOnline) {
      try {
        const cloudData = await this.loadCloud(key);
        if (cloudData !== null) {
          // 更新本地缓存
          this.saveLocal(key, cloudData);
          return cloudData;
        }
      } catch (error) {
        console.warn('Cloud load failed, falling back to local:', error);
      }
    }

    // 从本地加载
    return this.loadLocal(key);
  }

  // 添加到同步队列
  addToSyncQueue(operation, key, data = null) {
    this.syncQueue.push({
      operation,
      key,
      data,
      timestamp: Date.now()
    });
    
    // 限制队列大小
    if (this.syncQueue.length > 50) {
      this.syncQueue = this.syncQueue.slice(-50);
    }
  }

  // 处理同步队列
  async processSyncQueue() {
    if (!this.isOnline || !this.auth?.isSignedIn || this.syncQueue.length === 0) {
      return;
    }

    console.log(`🔄 Processing sync queue (${this.syncQueue.length} items)...`);
    
    const queue = [...this.syncQueue];
    this.syncQueue = [];

    for (const item of queue) {
      try {
        if (item.operation === 'save') {
          const success = await this.saveCloud(item.key, item.data);
          if (!success) {
            // 重新加入队列
            this.syncQueue.push(item);
          }
        }
      } catch (error) {
        console.error('Sync queue processing error:', error);
        // 重新加入队列
        this.syncQueue.push(item);
      }
    }

    if (this.syncQueue.length === 0) {
      this.lastSyncTime = Date.now();
      console.log('✅ Sync queue processed successfully');
    }
  }

  // 从云端同步数据到本地
  async syncFromCloud() {
    if (!this.isInitialized || !this.auth?.isSignedIn || !this.isOnline) {
      return false;
    }

    try {
      const userId = this.getUserId();
      if (!userId) return false;

      const { data: cloudData, error } = await this.supabase
        .from('game_progress')
        .select('data_key, data, updated_at')
        .eq('user_id', userId)
        .eq('game', this.gameType);

      if (error) {
        console.error('Sync from cloud error:', error);
        return false;
      }

      if (!cloudData || cloudData.length === 0) {
        console.log('No cloud data to sync');
        return true;
      }

      // 更新本地数据
      for (const item of cloudData) {
        this.saveLocal(item.data_key, item.data);
      }

      this.lastSyncTime = Date.now();
      console.log(`✅ Synced ${cloudData.length} items from cloud`);
      return true;
    } catch (error) {
      console.error('Sync from cloud failed:', error);
      return false;
    }
  }

  // 清除本地数据
  clearLocal(key) {
    try {
      const fullKey = this.getStorageKey(key);
      localStorage.removeItem(fullKey);
      return true;
    } catch (error) {
      console.error('Clear local failed:', error);
      return false;
    }
  }

  // 清除云端数据
  async clearCloud(key) {
    if (!this.isInitialized || !this.auth?.isSignedIn) {
      return false;
    }

    try {
      const userId = this.getUserId();
      if (!userId) return false;

      const { error } = await this.supabase
        .from('game_progress')
        .delete()
        .eq('user_id', userId)
        .eq('game', this.gameType)
        .eq('data_key', key);

      if (error) {
        console.error('Clear cloud error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Clear cloud failed:', error);
      return false;
    }
  }

  // 统一清除接口
  async clear(key) {
    const localSuccess = this.clearLocal(key);
    
    if (this.auth?.isSignedIn && this.isOnline) {
      await this.clearCloud(key);
    } else if (this.auth?.isSignedIn) {
      // 离线时添加到同步队列（这里可以扩展支持删除操作）
    }

    return localSuccess;
  }

  // 获取同步状态
  getSyncStatus() {
    return {
      isInitialized: this.isInitialized,
      isAuthenticated: this.auth?.isSignedIn || false,
      isOnline: this.isOnline,
      queueLength: this.syncQueue.length,
      lastSyncTime: this.lastSyncTime,
      userId: this.getUserId()
    };
  }
}

// 特定游戏的存储类
class AuthenticatedSudokuStorage extends AuthenticatedGameStorage {
  constructor() {
    super('sudoku');
  }

  // 保存游戏进度（包含关卡进度和星级）
  async saveProgress(progressData) {
    return await this.save('progress', progressData);
  }

  // 加载游戏进度
  async loadProgress() {
    const data = await this.load('progress');
    return data || {
      easy: { current_level: 1, completed_levels: [], level_records: {} },
      medium: { current_level: 1, completed_levels: [], level_records: {} },
      hard: { current_level: 1, completed_levels: [], level_records: {} },
      expert: { current_level: 1, completed_levels: [], level_records: {} },
      master: { current_level: 1, completed_levels: [], level_records: {} }
    };
  }

  // 保存设置
  async saveSettings(settings) {
    return await this.save('settings', settings);
  }

  // 加载设置
  async loadSettings() {
    const data = await this.load('settings');
    return data || {
      difficulty: 'medium',
      hints: true,
      autoValidate: true,
      theme: 'light',
      vibration: true,
      sound: true
    };
  }

  // 保存统计数据
  async saveStats(stats) {
    return await this.save('stats', stats);
  }

  // 加载统计数据
  async loadStats() {
    const data = await this.load('stats');
    return data || {
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

  // 更新关卡记录
  async updateLevelRecord(difficulty, levelNumber, timeInSeconds, stars) {
    const progress = await this.loadProgress();
    
    if (!progress[difficulty]) {
      progress[difficulty] = { current_level: 1, completed_levels: [], level_records: {} };
    }

    // 更新关卡记录
    const currentRecord = progress[difficulty].level_records[levelNumber];
    const shouldUpdate = !currentRecord || 
                        timeInSeconds < currentRecord.time || 
                        stars > currentRecord.stars;

    if (shouldUpdate) {
      progress[difficulty].level_records[levelNumber] = {
        time: timeInSeconds,
        stars: stars,
        completed_at: Date.now()
      };
    }

    // 更新完成关卡列表
    if (!progress[difficulty].completed_levels.includes(levelNumber)) {
      progress[difficulty].completed_levels.push(levelNumber);
      progress[difficulty].completed_levels.sort((a, b) => a - b);
    }

    // 更新当前关卡（解锁下一关）
    const nextLevel = Math.max(...progress[difficulty].completed_levels) + 1;
    if (nextLevel <= 50) {
      progress[difficulty].current_level = Math.max(
        progress[difficulty].current_level,
        nextLevel
      );
    }

    return await this.saveProgress(progress);
  }
}

// Web环境下的导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthenticatedGameStorage, AuthenticatedSudokuStorage };
} else if (typeof window !== 'undefined') {
  window.AuthenticatedGameStorage = AuthenticatedGameStorage;
  window.AuthenticatedSudokuStorage = AuthenticatedSudokuStorage;
}