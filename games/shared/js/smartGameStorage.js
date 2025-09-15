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
      console.log(`🌐 [${this.gameType}] 网络已连接，开始处理同步队列`);
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log(`📱 [${this.gameType}] 网络已断开`);
    });

    // 定期同步机制 - 每30秒检查一次同步队列
    this.syncInterval = setInterval(() => {
      if (this.syncQueue.length > 0) {
        console.log(`⏰ [${this.gameType}] 定期同步检查 - 队列长度: ${this.syncQueue.length}`);
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
    
    console.log(`💾 [${this.gameType}] 保存数据 - 用户状态: ${isLoggedIn ? '已登录' : '游客'}, 键: ${key}`);
    
    // 总是先保存到本地（作为缓存/备份）
    const localSuccess = this.saveToLocal(key, data, timestamp);
    
    if (!localSuccess) {
      console.error('❌ 本地保存失败，中止保存操作');
      return false;
    }

    // 如果是注册用户且在线，同时保存到云端
    if (isLoggedIn && this.isOnline) {
      try {
        const cloudSuccess = await this.saveToCloud(key, data, timestamp);
        if (cloudSuccess) {
          console.log(`☁️ [${this.gameType}] 云端保存成功`);
        } else {
          console.warn(`⚠️ [${this.gameType}] 云端保存失败，已加入同步队列`);
          this.addToSyncQueue('save', key, data, timestamp);
          // 立即尝试同步队列
          setTimeout(() => this.processSyncQueue(), 1000);
        }
      } catch (error) {
        console.error(`❌ [${this.gameType}] 云端保存出错:`, error);
        this.addToSyncQueue('save', key, data, timestamp);
        // 立即尝试同步队列
        setTimeout(() => this.processSyncQueue(), 1000);
      }
    } else if (isLoggedIn && !this.isOnline) {
      // 注册用户但离线 - 加入同步队列
      console.log(`📱 [${this.gameType}] 用户已登录但离线，数据已加入同步队列`);
      this.addToSyncQueue('save', key, data, timestamp);
    } else if (isLoggedIn) {
      // 其他情况下的注册用户 - 也尝试加入同步队列
      console.log(`🔄 [${this.gameType}] 注册用户，加入同步队列稍后处理`);
      this.addToSyncQueue('save', key, data, timestamp);
      // 延迟尝试同步
      setTimeout(() => this.processSyncQueue(), 2000);
    }

    return true;
  }

  // 统一加载接口 - 游戏代码只需调用这个方法
  async load(key) {
    const isLoggedIn = this.isUserLoggedIn();
    
    console.log(`📖 [${this.gameType}] 加载数据 - 用户状态: ${isLoggedIn ? '已登录' : '游客'}, 键: ${key}`);

    // 如果是注册用户且在线，优先从云端加载
    if (isLoggedIn && this.isOnline) {
      try {
        const cloudData = await this.loadFromCloud(key);
        if (cloudData !== null) {
          console.log(`☁️ [${this.gameType}] 从云端加载成功`);
          // 更新本地缓存
          this.saveToLocal(key, cloudData, Date.now());
          return cloudData;
        }
      } catch (error) {
        console.warn(`⚠️ [${this.gameType}] 云端加载失败，回退到本地:`, error);
      }
    }

    // 从本地加载（游客 或 注册用户云端失败时的回退）
    const localData = this.loadFromLocal(key);
    console.log(`💾 [${this.gameType}] 从本地加载 ${localData ? '成功' : '无数据'}`);
    return localData;
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
        if (error.code === 'PGRST116') {
          // 数据不存在
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
    // 详细的条件检查和日志
    console.log(`🔄 [${this.gameType}] 同步队列检查 - 在线: ${this.isOnline}, 登录: ${this.isUserLoggedIn()}, 队列长度: ${this.syncQueue.length}`);

    if (!this.isOnline) {
      console.log(`❌ [${this.gameType}] 网络离线，跳过同步`);
      return;
    }

    if (!this.isUserLoggedIn()) {
      console.log(`❌ [${this.gameType}] 用户未登录，跳过同步`);
      return;
    }

    if (this.syncQueue.length === 0) {
      console.log(`✅ [${this.gameType}] 同步队列为空`);
      return;
    }

    console.log(`🔄 [${this.gameType}] 开始处理同步队列 (${this.syncQueue.length} 项)...`);

    const queue = [...this.syncQueue];
    this.syncQueue = [];
    let successCount = 0;
    let failCount = 0;

    for (const item of queue) {
      try {
        console.log(`📤 [${this.gameType}] 同步数据: ${item.key} (${item.operation})`);
        if (item.operation === 'save') {
          const success = await this.saveToCloud(item.key, item.data, item.timestamp);
          if (success) {
            successCount++;
            console.log(`✅ [${this.gameType}] 同步成功: ${item.key}`);
          } else {
            failCount++;
            console.warn(`❌ [${this.gameType}] 同步失败: ${item.key} - 重新加入队列`);
            this.syncQueue.push(item); // 失败则重新加入队列
          }
        }
      } catch (error) {
        failCount++;
        console.error(`❌ [${this.gameType}] 同步队列处理错误:`, error);
        this.syncQueue.push(item); // 失败则重新加入队列
      }
    }

    if (this.syncQueue.length === 0) {
      this.lastSyncTime = Date.now();
      console.log(`✅ [${this.gameType}] 同步队列处理完成 - 成功: ${successCount}, 失败: ${failCount}`);
    } else {
      console.warn(`⚠️ [${this.gameType}] 同步队列仍有 ${this.syncQueue.length} 项待处理 - 成功: ${successCount}, 失败: ${failCount}`);
    }
  }

  // ===================
  // 工具方法
  // ===================

  isUserLoggedIn() {
    // 🔥 增强的用户登录状态检查 - 专门优化跨模块身份传递
    console.log('🔐 检查用户登录状态:');
    console.log('  - window.Clerk:', !!window.Clerk);
    console.log('  - window.Clerk.loaded:', window.Clerk ? window.Clerk.loaded : 'N/A');
    console.log('  - window.Clerk.user:', window.Clerk ? !!window.Clerk.user : 'N/A');
    console.log('  - window.Clerk.session:', window.Clerk ? !!window.Clerk.session : 'N/A');
    console.log('  - window.clerkInitialized:', window.clerkInitialized);

    // 🔥 策略1: 最高优先级 - 检查模拟用户对象 (跨模块token解析)
    if (window.mockClerkUser && window.mockClerkUser.isAuthenticated) {
      console.log('✅ 用户已登录 (跨模块token解析):', {
        userId: window.mockClerkUser.id,
        email: window.mockClerkUser.emailAddresses?.[0]?.emailAddress,
        sessionId: window.mockClerkUser.sessionId,
        authSource: window.mockClerkUser.authSource
      });
      return true;
    }

    // 🔥 策略2: 检查活跃的session (React模块传递过来的核心指标)
    if (window.Clerk && window.Clerk.user && window.Clerk.session) {
      console.log('✅ 用户已登录 (活跃session):', {
        userId: window.Clerk.user.id,
        email: window.Clerk.user.emailAddresses?.[0]?.emailAddress,
        sessionId: window.Clerk.session.id
      });
      return true;
    }

    // 🔥 策略3: 用户对象存在检查 (兼容之前的快速检查)
    if (window.Clerk && window.Clerk.user) {
      console.log('✅ 用户已登录 (用户对象检查):', window.Clerk.user.id);
      return true;
    }

    // 🔥 策略4: 已初始化状态下的用户检查
    if (window.clerkInitialized && window.Clerk) {
      // 检查是否有任何形式的认证信息
      if (window.Clerk.user || window.Clerk.session) {
        console.log('✅ 用户已登录 (初始化后检查):', {
          user: !!window.Clerk.user,
          session: !!window.Clerk.session
        });
        return true;
      }
    }

    // 🔥 策略5: 传统的完全加载检查
    if (window.Clerk && window.Clerk.loaded && window.Clerk.user) {
      console.log('✅ 用户已登录 (传统完全加载检查):', window.Clerk.user.id);
      return true;
    }

    // 🔥 策略6: localStorage缓存数据检查 (React模块兼容性)
    try {
      const clerkEnv = localStorage.getItem('__clerk_environment');
      if (clerkEnv) {
        const envData = JSON.parse(clerkEnv);
        if (envData.user && envData.session) {
          console.log('✅ 用户已登录 (localStorage缓存检查):', {
            userId: envData.user.id,
            email: envData.user.emailAddresses?.[0]?.emailAddress,
            sessionId: envData.session.id
          });
          return true;
        }
      }
    } catch (error) {
      console.log('⚠️ localStorage检查失败:', error);
    }

    // 🔥 策略7: 等待状态判断
    if (window.Clerk && !window.clerkInitialized) {
      console.log('⏳ Clerk正在初始化中，稍后再试...');
      return false;
    }

    // 🔥 策略8: 最终的未登录判断
    console.log('❌ 用户未登录或session已过期');
    return false;
  }

  getUser() {
    // 🔥 增强的用户对象获取 - 多策略检查

    // 🔥 策略1: 模拟用户对象 (跨模块token解析)
    if (window.mockClerkUser && window.mockClerkUser.isAuthenticated) {
      console.log('👤 获取用户对象成功 (跨模块token解析):', {
        id: window.mockClerkUser.id,
        email: window.mockClerkUser.emailAddresses?.[0]?.emailAddress,
        authSource: window.mockClerkUser.authSource
      });
      return window.mockClerkUser;
    }

    // 🔥 策略2: 标准Clerk用户对象
    if (window.Clerk && window.Clerk.user) {
      console.log('👤 获取用户对象成功:', {
        id: window.Clerk.user.id,
        email: window.Clerk.user.emailAddresses?.[0]?.emailAddress
      });
      return window.Clerk.user;
    }

    // 🔥 策略3: localStorage缓存数据获取 (React模块兼容性)
    try {
      const clerkEnv = localStorage.getItem('__clerk_environment');
      if (clerkEnv) {
        const envData = JSON.parse(clerkEnv);
        if (envData.user) {
          console.log('👤 获取用户对象成功 (localStorage缓存):', {
            id: envData.user.id,
            email: envData.user.emailAddresses?.[0]?.emailAddress
          });
          return envData.user;
        }
      }
    } catch (error) {
      console.log('⚠️ localStorage用户获取失败:', error);
    }

    // 如果没有用户对象但初始化完成，可能是未登录状态
    if (window.clerkInitialized) {
      console.log('❌ 用户对象不存在 (已初始化)');
    } else {
      console.log('⏳ 用户对象不存在 (未初始化)');
    }

    return null;
  }

  getUserId() {
    // 🔥 策略1: 模拟用户对象 (跨模块token解析)
    if (window.mockClerkUser && window.mockClerkUser.isAuthenticated) {
      return window.mockClerkUser.id || null;
    }

    // 🔥 策略2: 标准Clerk用户对象
    if (window.Clerk && window.Clerk.user) {
      return window.Clerk.user.id || null;
    }

    // 🔥 策略3: localStorage缓存数据获取
    try {
      const clerkEnv = localStorage.getItem('__clerk_environment');
      if (clerkEnv) {
        const envData = JSON.parse(clerkEnv);
        if (envData.user && envData.user.id) {
          return envData.user.id;
        }
      }
    } catch (error) {
      console.log('⚠️ localStorage用户ID获取失败:', error);
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
    console.log(`🔄 [${this.gameType}] 手动强制同步`);
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

// 特定游戏的存储类
class SmartSudokuStorage extends SmartGameStorage {
  constructor() {
    super('sudoku');
  }

  // 数独特定的保存/加载方法
  async saveProgress(progressData) {
    return await this.save('progress', progressData);
  }

  async loadProgress() {
    const data = await this.load('progress');
    return data || this.getDefaultProgress();
  }

  async saveSettings(settings) {
    return await this.save('settings', settings);
  }

  async loadSettings() {
    const data = await this.load('settings');
    return data || this.getDefaultSettings();
  }

  async saveStats(stats) {
    return await this.save('stats', stats);
  }

  async loadStats() {
    const data = await this.load('stats');
    return data || this.getDefaultStats();
  }

  getDefaultProgress() {
    return {
      easy: { current_level: 1, completed_levels: [], level_records: {} },
      medium: { current_level: 1, completed_levels: [], level_records: {} },
      hard: { current_level: 1, completed_levels: [], level_records: {} },
      expert: { current_level: 1, completed_levels: [], level_records: {} },
      master: { current_level: 1, completed_levels: [], level_records: {} }
    };
  }

  getDefaultSettings() {
    return {
      difficulty: 'medium',
      hints: true,
      autoValidate: true,
      theme: 'light',
      vibration: true,
      sound: true
    };
  }

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

class SmartNonogramStorage extends SmartGameStorage {
  constructor() {
    super('nonogram');
  }

  // 数织特定的保存/加载方法
  async saveProgress(progressData) {
    return await this.save('progress', progressData);
  }

  async loadProgress() {
    const data = await this.load('progress');
    return data || this.getDefaultProgress();
  }

  async saveSettings(settings) {
    return await this.save('settings', settings);
  }

  async loadSettings() {
    const data = await this.load('settings');
    return data || this.getDefaultSettings();
  }

  getDefaultProgress() {
    return {
      easy: { current_level: 1, completed_levels: [], level_records: {} },
      medium: { current_level: 1, completed_levels: [], level_records: {} },
      hard: { current_level: 1, completed_levels: [], level_records: {} },
      expert: { current_level: 1, completed_levels: [], level_records: {} }
    };
  }

  getDefaultSettings() {
    return {
      difficulty: 'easy',
      showHints: true,
      autoSave: true,
      theme: 'light',
      sound: true
    };
  }

  // 更新关卡记录
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

      console.log(`✅ Nonogram Level ${levelNumber} completion recorded with ${stars} stars`);

    } catch (error) {
      console.error('Failed to update nonogram level record:', error);
      throw error;
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SmartGameStorage, SmartSudokuStorage, SmartNonogramStorage };
} else if (typeof window !== 'undefined') {
  window.SmartGameStorage = SmartGameStorage;
  window.SmartSudokuStorage = SmartSudokuStorage;
  window.SmartNonogramStorage = SmartNonogramStorage;
}

console.log('🧠 智能游戏存储系统已加载');