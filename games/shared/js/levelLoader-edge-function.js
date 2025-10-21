// 通用关卡加载器 - 从 MongoDB Atlas 加载关卡数据（通过 Supabase Edge Function）
// 支持本地缓存和降级方案

class LevelLoaderEdgeFunction {
  constructor() {
    this.cacheVersion = 'v1'; // 缓存版本，更新数据时可以改这个版本号
    this.edgeFunctionUrl = null;
  }

  /**
   * 获取 Edge Function URL
   */
  getEdgeFunctionUrl() {
    if (!this.edgeFunctionUrl) {
      const supabaseUrl = window.SUPABASE_URL || 'https://iqctowmnrxqvkaxwnmvn.supabase.co';
      this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/game-levels`;
    }
    return this.edgeFunctionUrl;
  }

  /**
   * 获取 Supabase Anon Key
   */
  getSupabaseAnonKey() {
    return window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxY3Rvd21ucnhxdmtheHdubXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0MzE5NTAsImV4cCI6MjA1MDAwNzk1MH0.qJqNXlqxqSKxpv2dJc7FiHXuFwL_xEzGMh9TnNqsRgQ';
  }

  /**
   * 获取缓存键名
   */
  getCacheKey(game, difficulty) {
    return `levels_${this.cacheVersion}_${game}_${difficulty}`;
  }

  /**
   * 从缓存读取关卡数据
   */
  getFromCache(game, difficulty) {
    try {
      const cacheKey = this.getCacheKey(game, difficulty);
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        console.log(`[关卡加载] 使用缓存: ${game} ${difficulty}`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      console.error('[关卡加载] 读取缓存失败:', error);
      return null;
    }
  }

  /**
   * 保存关卡数据到缓存
   */
  saveToCache(game, difficulty, levels) {
    try {
      const cacheKey = this.getCacheKey(game, difficulty);
      localStorage.setItem(cacheKey, JSON.stringify(levels));
      console.log(`[关卡加载] 缓存已保存: ${game} ${difficulty}, ${levels.length}关`);
    } catch (error) {
      console.error('[关卡加载] 保存缓存失败:', error);
    }
  }

  /**
   * 清除指定游戏的所有缓存
   */
  clearCache(game) {
    try {
      const prefix = `levels_${this.cacheVersion}_${game}_`;
      const keysToRemove = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));

      console.log(`[关卡加载] 已清除缓存: ${game}, ${keysToRemove.length}个难度`);
      return keysToRemove.length;
    } catch (error) {
      console.error('[关卡加载] 清除缓存失败:', error);
      return 0;
    }
  }

  /**
   * 从云端加载关卡数据（通过 Edge Function）
   */
  async loadFromCloud(game, difficulty) {
    try {
      console.log(`[关卡加载] 从云端加载: ${game} ${difficulty}`);

      const url = new URL(this.getEdgeFunctionUrl());
      url.searchParams.set('game', game);
      url.searchParams.set('difficulty', difficulty);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.getSupabaseAnonKey()
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[关卡加载] 云端加载失败 (${response.status}):`, errorText);
        return null;
      }

      const result = await response.json();

      if (!result.success) {
        console.warn(`[关卡加载] 云端未找到数据: ${game} ${difficulty}`);
        return null;
      }

      const levels = result.levels || [];
      console.log(`[关卡加载] 云端加载成功: ${game} ${difficulty}, ${levels.length}关`);

      return levels;
    } catch (error) {
      console.error('[关卡加载] 云端加载失败:', error);
      return null;
    }
  }

  /**
   * 从本地文件/生成器加载关卡数据（降级方案）
   */
  loadFromLocal(game, difficulty) {
    try {
      console.log(`[关卡加载] 尝试使用本地降级方案: ${game} ${difficulty}`);

      // puzzle15 使用本地生成器
      if (game === 'puzzle15') {
        if (typeof levelGenerator === 'undefined') {
          console.error('[关卡加载] puzzle15 生成器未找到');
          return null;
        }

        const levelCount = levelGenerator.getTotalLevels();
        const generatedLevels = [];
        for (let i = 1; i <= levelCount; i++) {
          generatedLevels.push(levelGenerator.generateLevel(difficulty, i));
        }

        console.log(`[关卡加载] 本地生成成功: ${game} ${difficulty}, ${generatedLevels.length}关`);
        return generatedLevels;
      }

      // 其他游戏暂不支持本地降级
      console.warn(`[关卡加载] ${game} 暂不支持本地降级方案`);
      return null;
    } catch (error) {
      console.error('[关卡加载] 本地降级方案失败:', error);
      return null;
    }
  }

  /**
   * 加载关卡数据（智能加载：缓存 → 云端 → 本地降级）
   *
   * @param {string} game - 游戏类型 (nonogram, sudoku, klotski, puzzle15, nback)
   * @param {string} difficulty - 难度 (easy, medium, hard, expert, master)
   * @param {boolean} forceRefresh - 是否强制刷新（跳过缓存）
   * @returns {Promise<Array>} 关卡数组
   */
  async loadLevels(game, difficulty, forceRefresh = false) {
    try {
      // 1. 尝试从缓存读取（除非强制刷新）
      if (!forceRefresh) {
        const cachedLevels = this.getFromCache(game, difficulty);
        if (cachedLevels) {
          return cachedLevels;
        }
      }

      // 2. 尝试从云端加载
      const cloudLevels = await this.loadFromCloud(game, difficulty);
      if (cloudLevels) {
        // 保存到缓存
        this.saveToCache(game, difficulty, cloudLevels);
        return cloudLevels;
      }

      // 3. 降级到本地生成/文件
      console.warn(`[关卡加载] 云端加载失败，使用本地降级方案: ${game} ${difficulty}`);
      const localLevels = this.loadFromLocal(game, difficulty);

      if (localLevels) {
        // 也保存到缓存（避免下次再使用本地降级）
        this.saveToCache(game, difficulty, localLevels);
        return localLevels;
      }

      // 4. 所有方式都失败
      throw new Error(`无法加载关卡数据: ${game} ${difficulty}`);

    } catch (error) {
      console.error('[关卡加载] 加载失败:', error);
      throw error;
    }
  }

  /**
   * 从关卡数组中获取指定编号的关卡
   *
   * @param {Array} levels - 关卡数组
   * @param {number} levelNumber - 关卡编号（从1开始）
   * @returns {Object|null} 关卡数据
   */
  getLevel(levels, levelNumber) {
    if (!Array.isArray(levels)) {
      console.error('[关卡加载] levels不是数组');
      return null;
    }

    // 大多数关卡数据有 level 字段
    const level = levels.find(l => l.level === levelNumber);
    if (level) {
      return level;
    }

    // 华容道使用 id 字段
    const levelById = levels.find(l => l.id === levelNumber);
    if (levelById) {
      return levelById;
    }

    // puzzle15 使用 levelNumber 字段
    const levelByNumber = levels.find(l => l.levelNumber === levelNumber);
    if (levelByNumber) {
      return levelByNumber;
    }

    // 使用数组索引（levelNumber - 1）
    if (levelNumber > 0 && levelNumber <= levels.length) {
      return levels[levelNumber - 1];
    }

    console.warn(`[关卡加载] 未找到关卡: ${levelNumber}`);
    return null;
  }

  /**
   * 预加载指定游戏的所有难度关卡（后台预加载，提升体验）
   *
   * @param {string} game - 游戏类型
   * @param {Array<string>} difficulties - 难度列表
   */
  async preloadGame(game, difficulties) {
    console.log(`[关卡加载] 预加载游戏: ${game}, ${difficulties.length}个难度`);

    const promises = difficulties.map(difficulty =>
      this.loadLevels(game, difficulty).catch(error => {
        console.error(`[关卡加载] 预加载失败: ${game} ${difficulty}`, error);
        return null;
      })
    );

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r !== null).length;

    console.log(`[关卡加载] 预加载完成: ${game}, ${successCount}/${difficulties.length}个难度`);

    return successCount;
  }
}

// 导出全局实例
window.levelLoaderEdgeFunction = new LevelLoaderEdgeFunction();
