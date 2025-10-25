// 智能游戏存储管理器
// 自动处理游客(本地存储) vs 注册用户(云端同步) 的存储策略

class SmartGameStorage {
  constructor(gameType) {
    this.gameType = gameType; // 'sudoku', 'nonogram', etc.
    this.prefix = `game_${gameType}`;
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
    this.lastSyncTime = null;
    this.migrationInProgress = false;
    
    // 监听网络状态变化
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // 定期同步机制 - 每30秒检查一次同步队列
    this.syncInterval = setInterval(() => {
      if (this.syncQueue.length > 0) {
        this.processSyncQueue();
      }
    }, 30000);
  }

  // ===================
  // 核心存储策略方法
  // ===================

  // 统一保存接口 - 游戏代码只需调用这个方法
  async save(key, data) {
    const isLoggedIn = this.isUserLoggedIn();
    const timestamp = Date.now();

    // 总是先保存到本地（作为缓存/备份）
    const localSuccess = this.saveToLocal(key, data, timestamp);

    if (!localSuccess) {
      console.error(`❌ [${this.gameType}] 本地保存失败`);
      return false;
    }

    // 如果是注册用户且在线，同时保存到云端
    if (isLoggedIn && this.isOnline) {
      try {
        const cloudSuccess = await this.saveToCloud(key, data, timestamp);
        if (!cloudSuccess) {
          // 失败加入队列，等待30秒定时器重试（不立即重试）
          this.addToSyncQueue('save', key, data, timestamp);
        }
      } catch (error) {
        console.error(`❌ [${this.gameType}] 云端保存出错:`, error);
        // 失败加入队列，等待30秒定时器重试（不立即重试）
        this.addToSyncQueue('save', key, data, timestamp);
      }
    } else if (isLoggedIn) {
      // 注册用户离线或其他情况 - 加入同步队列，等待30秒定时器重试
      this.addToSyncQueue('save', key, data, timestamp);
    }

    return true;
  }

  // 统一加载接口 - 游戏代码只需调用这个方法
  async load(key) {
    const isLoggedIn = this.isUserLoggedIn();

    // 如果是注册用户且在线，优先从云端加载
    if (isLoggedIn && this.isOnline) {
      try {
        const cloudData = await this.loadFromCloud(key);
        if (cloudData !== null) {
          // 更新本地缓存
          this.saveToLocal(key, cloudData, Date.now());
          return cloudData;
        }
      } catch (error) {
        console.warn(`⚠️ [${this.gameType}] 云端加载失败，使用本地数据`);
      }
    }

    // 从本地加载（游客 或 注册用户云端失败时的回退）
    return this.loadFromLocal(key);
  }

  // ===================
  // 本地存储操作
  // ===================

  saveToLocal(key, data, timestamp = Date.now()) {
    try {
      const fullKey = this.getLocalStorageKey(key);
      const payload = {
        data,
        timestamp,
        version: '1.0',
        gameType: this.gameType,
        userType: this.isUserLoggedIn() ? 'registered' : 'guest',
        userId: this.getUserId() || 'guest'
      };
      localStorage.setItem(fullKey, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.error(`❌ [${this.gameType}] 本地保存失败:`, error);
      return false;
    }
  }

  loadFromLocal(key) {
    try {
      const fullKey = this.getLocalStorageKey(key);
      const jsonData = localStorage.getItem(fullKey);
      
      if (!jsonData) return null;
      
      const parsed = JSON.parse(jsonData);
      return parsed.data;
    } catch (error) {
      console.error(`❌ [${this.gameType}] 本地加载失败:`, error);
      return null;
    }
  }

  // ===================
  // 云端存储操作
  // ===================

  async saveToCloud(key, data, timestamp = Date.now()) {
    if (!this.getSupabaseClient()) {
      console.warn('⚠️ Supabase客户端未初始化');
      return false;
    }

    try {
      const userId = this.getUserId();
      if (!userId) {
        console.warn('⚠️ 无法获取用户ID');
        return false;
      }

      const gameData = {
        user_id: userId,
        game: this.gameType,
        data_key: key,
        data: data,
        updated_at: new Date(timestamp).toISOString()
      };

      const { error } = await this.getSupabaseClient()
        .from('game_progress')
        .upsert(gameData, { 
          onConflict: 'user_id,game,data_key',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`❌ [${this.gameType}] 云端保存失败:`, error);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ [${this.gameType}] 云端保存异常:`, error);
      return false;
    }
  }

  async loadFromCloud(key) {
    if (!this.getSupabaseClient()) {
      return null;
    }

    try {
      const userId = this.getUserId();
      if (!userId) return null;

      const { data, error } = await this.getSupabaseClient()
        .from('game_progress')
        .select('data, updated_at')
        .eq('user_id', userId)
        .eq('game', this.gameType)
        .eq('data_key', key)
        .single();

      if (error) {
        // 数据不存在是正常情况，不输出日志
        if (error.code === 'PGRST116' || error.code === 'PGRST301' || error.message?.includes('406')) {
          return null;
        }
        console.error(`❌ [${this.gameType}] 云端加载失败:`, error);
        return null;
      }

      return data?.data || null;
    } catch (error) {
      console.error(`❌ [${this.gameType}] 云端加载异常:`, error);
      return null;
    }
  }

  // ===================
  // 用户身份状态管理
  // ===================

  // 获取用户身份信息（用于UI显示）
  getUserStatus() {
    if (this.isUserLoggedIn()) {
      const user = this.getUser();
      return {
        type: 'registered',
        displayName: user?.firstName || user?.emailAddresses?.[0]?.emailAddress || '注册用户',
        userId: this.getUserId(),
        storageType: 'cloud', // 云端同步
        icon: '👤'
      };
    } else {
      return {
        type: 'guest',
        displayName: '游客',
        userId: null,
        storageType: 'local', // 本地存储
        icon: '🎮'
      };
    }
  }

  // 获取存储位置描述
  getStorageDescription() {
    const status = this.getUserStatus();
    if (status.type === 'registered') {
      return '进度已同步到云端，可在多设备间共享';
    } else {
      return '进度仅保存在本设备，登录后可享受云端同步';
    }
  }

  // ===================
  // 同步队列管理
  // ===================

  addToSyncQueue(operation, key, data, timestamp) {
    this.syncQueue.push({
      operation,
      key,
      data,
      timestamp: timestamp || Date.now()
    });
    
    // 限制队列大小
    if (this.syncQueue.length > 50) {
      this.syncQueue = this.syncQueue.slice(-50);
    }
  }

  async processSyncQueue() {
    if (!this.isOnline || !this.isUserLoggedIn() || this.syncQueue.length === 0) {
      return;
    }

    const queue = [...this.syncQueue];
    this.syncQueue = [];

    for (const item of queue) {
      try {
        if (item.operation === 'save') {
          const success = await this.saveToCloud(item.key, item.data, item.timestamp);
          if (!success) {
            this.syncQueue.push(item); // 失败则重新加入队列
          }
        }
      } catch (error) {
        console.error(`❌ [${this.gameType}] 同步失败:`, error);
        this.syncQueue.push(item); // 失败则重新加入队列
      }
    }

    if (this.syncQueue.length === 0) {
      this.lastSyncTime = Date.now();
    }
  }

  // ===================
  // 工具方法
  // ===================

  isUserLoggedIn() {
    // 策略1: 检查模拟用户对象 (跨模块token解析)
    if (window.mockClerkUser && window.mockClerkUser.isAuthenticated) {
      return true;
    }

    // 策略2: 检查活跃的session
    if (window.Clerk && window.Clerk.user && window.Clerk.session) {
      return true;
    }

    // 策略3: 用户对象存在检查
    if (window.Clerk && window.Clerk.user) {
      return true;
    }

    // 策略4: 已初始化状态下的用户检查
    if (window.clerkInitialized && window.Clerk) {
      if (window.Clerk.user || window.Clerk.session) {
        return true;
      }
    }

    // 策略5: 传统的完全加载检查
    if (window.Clerk && window.Clerk.loaded && window.Clerk.user) {
      return true;
    }

    // 策略6: localStorage缓存数据检查
    try {
      const clerkEnv = localStorage.getItem('__clerk_environment');
      if (clerkEnv) {
        const envData = JSON.parse(clerkEnv);
        if (envData.user && envData.session) {
          return true;
        }
      }
    } catch (error) {
      // 忽略 localStorage 读取错误
    }

    return false;
  }

  getUser() {
    // 策略1: 模拟用户对象 (跨模块token解析)
    if (window.mockClerkUser && window.mockClerkUser.isAuthenticated) {
      return window.mockClerkUser;
    }

    // 策略2: 标准Clerk用户对象
    if (window.Clerk && window.Clerk.user) {
      return window.Clerk.user;
    }

    // 策略3: localStorage缓存数据获取
    try {
      const clerkEnv = localStorage.getItem('__clerk_environment');
      if (clerkEnv) {
        const envData = JSON.parse(clerkEnv);
        if (envData.user) {
          return envData.user;
        }
      }
    } catch (error) {
      // 忽略 localStorage 读取错误
    }

    return null;
  }

  getUserId() {
    // 策略1: 模拟用户对象 (跨模块token解析)
    if (window.mockClerkUser && window.mockClerkUser.isAuthenticated) {
      return window.mockClerkUser.id || null;
    }

    // 策略2: 标准Clerk用户对象
    if (window.Clerk && window.Clerk.user) {
      return window.Clerk.user.id || null;
    }

    // 策略3: localStorage缓存数据获取
    try {
      const clerkEnv = localStorage.getItem('__clerk_environment');
      if (clerkEnv) {
        const envData = JSON.parse(clerkEnv);
        if (envData.user && envData.user.id) {
          return envData.user.id;
        }
      }
    } catch (error) {
      // 忽略 localStorage 读取错误
    }

    return null;
  }

  getSupabaseClient() {
    return window.createGameSupabaseClient ? window.createGameSupabaseClient() : null;
  }

  // 生成用户隔离的存储键
  getLocalStorageKey(key) {
    if (this.isUserLoggedIn()) {
      // 注册用户：使用用户ID作为命名空间
      const userId = this.getUserId();
      return `${this.prefix}_user_${userId}_${key}`;
    } else {
      // 游客：使用专门的游客命名空间
      return `${this.prefix}_guest_${key}`;
    }
  }

  // 获取当前用户的所有本地游戏数据
  getAllLocalGameData() {
    const gameData = {};
    const currentUserPrefix = this.isUserLoggedIn() ? 
      `${this.prefix}_user_${this.getUserId()}_` : 
      `${this.prefix}_guest_`;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(currentUserPrefix)) {
        const gameKey = key.substring(currentUserPrefix.length);
        const data = this.loadFromLocal(gameKey);
        if (data !== null) {
          gameData[gameKey] = data;
        }
      }
    }
    
    return gameData;
  }

  // 获取游客的本地游戏数据（用于迁移）
  getGuestLocalGameData() {
    const gameData = {};
    const guestPrefix = `${this.prefix}_guest_`;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(guestPrefix)) {
        const gameKey = key.substring(guestPrefix.length);
        try {
          const jsonData = localStorage.getItem(key);
          if (jsonData) {
            const parsed = JSON.parse(jsonData);
            gameData[gameKey] = parsed.data;
          }
        } catch (error) {
          console.error(`读取游客数据失败: ${key}`, error);
        }
      }
    }
    
    return gameData;
  }

  // 获取同步状态
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      isLoggedIn: this.isUserLoggedIn(),
      queueLength: this.syncQueue.length,
      lastSyncTime: this.lastSyncTime,
      userId: this.getUserId(),
      gameType: this.gameType
    };
  }

  // 手动强制同步 - 游戏可以在关键时刻调用
  async forceSyncNow() {
    await this.processSyncQueue();
  }

  // 清除本地数据
  clearLocalData(key) {
    try {
      const fullKey = this.getLocalStorageKey(key);
      localStorage.removeItem(fullKey);
      return true;
    } catch (error) {
      console.error('清除本地数据失败:', error);
      return false;
    }
  }

  // 清除云端数据
  async clearCloudData(key) {
    if (!this.getSupabaseClient() || !this.getUserId()) {
      return false;
    }

    try {
      const { error } = await this.getSupabaseClient()
        .from('game_progress')
        .delete()
        .eq('user_id', this.getUserId())
        .eq('game', this.gameType)
        .eq('data_key', key);

      if (error) {
        console.error('清除云端数据失败:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('清除云端数据异常:', error);
      return false;
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SmartGameStorage };
} else if (typeof window !== 'undefined') {
  window.SmartGameStorage = SmartGameStorage;
}

console.log('🧠 智能游戏存储系统已加载');