// 本地存储管理器

class GameStorage {
  constructor(gamePrefix = 'game') {
    this.prefix = gamePrefix;
  }

  // 保存游戏数据
  save(key, data) {
    try {
      const fullKey = `${this.prefix}_${key}`;
      const jsonData = JSON.stringify({
        data,
        timestamp: Date.now(),
        version: '1.0'
      });
      localStorage.setItem(fullKey, jsonData);
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      return false;
    }
  }

  // 加载游戏数据
  load(key) {
    try {
      const fullKey = `${this.prefix}_${key}`;
      const jsonData = localStorage.getItem(fullKey);
      
      if (!jsonData) return null;
      
      const parsed = JSON.parse(jsonData);
      return parsed.data;
    } catch (error) {
      console.error('Load failed:', error);
      return null;
    }
  }

  // 删除游戏数据
  remove(key) {
    try {
      const fullKey = `${this.prefix}_${key}`;
      localStorage.removeItem(fullKey);
      return true;
    } catch (error) {
      console.error('Remove failed:', error);
      return false;
    }
  }

  // 清空所有游戏数据
  clear() {
    try {
      const keys = Object.keys(localStorage);
      const gameKeys = keys.filter(key => key.startsWith(`${this.prefix}_`));
      gameKeys.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('Clear failed:', error);
      return false;
    }
  }

  // 获取存储使用情况
  getStorageInfo() {
    try {
      let totalSize = 0;
      let gameSize = 0;
      const gameKeys = [];

      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          const value = localStorage.getItem(key);
          totalSize += key.length + value.length;
          
          if (key.startsWith(`${this.prefix}_`)) {
            gameSize += key.length + value.length;
            gameKeys.push(key);
          }
        }
      }

      return {
        totalSize,
        gameSize,
        gameKeys: gameKeys.length,
        available: this.isStorageAvailable()
      };
    } catch (error) {
      console.error('Get storage info failed:', error);
      return null;
    }
  }

  // 检查本地存储是否可用
  isStorageAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      return false;
    }
  }

  // 批量保存
  saveBatch(dataMap) {
    const results = {};
    for (const [key, data] of Object.entries(dataMap)) {
      results[key] = this.save(key, data);
    }
    return results;
  }

  // 批量加载
  loadBatch(keys) {
    const results = {};
    keys.forEach(key => {
      results[key] = this.load(key);
    });
    return results;
  }
}

// 预定义的游戏存储实例
class SudokuStorage extends GameStorage {
  constructor() {
    super('sudoku');
  }

  // 保存游戏进度
  saveProgress(gameData) {
    return this.save('progress', gameData);
  }

  // 加载游戏进度
  loadProgress() {
    return this.load('progress');
  }

  // 保存设置
  saveSettings(settings) {
    return this.save('settings', settings);
  }

  // 加载设置
  loadSettings() {
    return this.load('settings') || {
      difficulty: 'medium',
      hints: true,
      autoValidate: true,
      theme: 'light'
    };
  }

  // 保存统计数据
  saveStats(stats) {
    return this.save('stats', stats);
  }

  // 加载统计数据
  loadStats() {
    return this.load('stats') || {
      gamesPlayed: 0,
      gamesWon: 0,
      bestTimes: {
        easy: null,
        medium: null,
        hard: null,
        expert: null
      },
      totalPlayTime: 0
    };
  }

  // 清空游戏进度（保留设置和统计）
  clearProgress() {
    return this.remove('progress');
  }
}

// Web环境下的导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameStorage, SudokuStorage };
} else if (typeof window !== 'undefined') {
  window.GameStorage = GameStorage;
  window.SudokuStorage = SudokuStorage;
}