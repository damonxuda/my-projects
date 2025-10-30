// 魔方新手训练营 - 教学逻辑控制器

class TutorialManager {
  constructor() {
    this.currentLevel = 0;  // 当前关卡 (0-7)
    this.currentStep = 0;   // 当前步骤
    this.completedLevels = new Set();  // 已完成的关卡
    this.stats = {
      startTime: Date.now(),
      practiceCount: 0
    };

    // 初始化云端存储系统
    this.gameStorage = null;
    this.initGameStorage();

    this.loadProgress();
  }

  // 初始化游戏存储
  async initGameStorage() {
    // 等待 Clerk 初始化完成
    if (!window.clerkInitialized) {
      await new Promise(resolve => {
        window.addEventListener('clerkReady', resolve, { once: true });
      });
    }

    try {
      this.gameStorage = new SmartGameStorageEdgeFunction('rubiks-cube');
      console.log('✅ [魔方] SmartGameStorageEdgeFunction 初始化成功');

      // 加载云端进度（如果有）
      await this.loadProgressFromCloud();
    } catch (e) {
      console.warn('[魔方] SmartGameStorageEdgeFunction 初始化失败:', e);
    }
  }

  // 获取当前关卡
  getCurrentLevel() {
    return LEVELS[this.currentLevel];
  }

  // 获取当前步骤
  getCurrentStep() {
    const level = this.getCurrentLevel();
    return level.steps[this.currentStep];
  }

  // 是否有下一步
  hasNextStep() {
    const level = this.getCurrentLevel();
    return this.currentStep < level.steps.length - 1;
  }

  // 是否有上一步
  hasPrevStep() {
    return this.currentStep > 0;
  }

  // 下一步
  nextStep() {
    if (this.hasNextStep()) {
      this.currentStep++;
      this.saveProgress();
      return true;
    }
    return false;
  }

  // 上一步
  prevStep() {
    if (this.hasPrevStep()) {
      this.currentStep--;
      this.saveProgress();
      return true;
    }
    return false;
  }

  // 完成当前关卡
  completeLevel() {
    this.completedLevels.add(this.currentLevel);
    this.saveProgress();
  }

  // 进入下一关
  nextLevel() {
    if (this.currentLevel < LEVELS.length - 1) {
      this.currentLevel++;
      this.currentStep = 0;
      this.saveProgress();
      return true;
    }
    return false;
  }

  // 跳转到指定关卡
  goToLevel(levelIndex) {
    if (levelIndex >= 0 && levelIndex < LEVELS.length) {
      this.currentLevel = levelIndex;
      this.currentStep = 0;
      this.saveProgress();
      return true;
    }
    return false;
  }

  // 关卡是否已完成
  isLevelCompleted(levelIndex) {
    return this.completedLevels.has(levelIndex);
  }

  // 关卡是否已解锁
  isLevelUnlocked(levelIndex) {
    if (levelIndex === 0) return true;
    return this.completedLevels.has(levelIndex - 1);
  }

  // 获取进度百分比
  getProgressPercent() {
    return Math.round((this.currentLevel / LEVELS.length) * 100);
  }

  // 增加练习次数
  incrementPractice() {
    this.stats.practiceCount++;
    this.saveProgress();
  }

  // 获取学习时间（分钟）
  getStudyTime() {
    const elapsed = Date.now() - this.stats.startTime;
    return Math.floor(elapsed / 60000);  // 转换为分钟
  }

  // 保存进度（本地 + 云端）
  async saveProgress() {
    const progress = {
      currentLevel: this.currentLevel,
      currentStep: this.currentStep,
      completedLevels: Array.from(this.completedLevels),
      stats: this.stats
    };

    // 保存到本地
    try {
      localStorage.setItem('rubiksTutorialProgress', JSON.stringify(progress));
    } catch (e) {
      console.error('[魔方] 本地保存失败:', e);
    }

    // 保存到云端
    if (this.gameStorage) {
      try {
        await this.gameStorage.save('progress', progress);
        console.log('✅ [魔方] 进度已同步到云端');
      } catch (e) {
        console.warn('[魔方] 云端保存失败:', e);
      }
    }
  }

  // 加载进度（本地）
  loadProgress() {
    try {
      const saved = localStorage.getItem('rubiksTutorialProgress');
      if (saved) {
        const progress = JSON.parse(saved);
        this.currentLevel = progress.currentLevel || 0;
        this.currentStep = progress.currentStep || 0;
        this.completedLevels = new Set(progress.completedLevels || []);
        this.stats = progress.stats || {
          startTime: Date.now(),
          practiceCount: 0
        };
        console.log('✅ [魔方] 本地进度已加载');
      }
    } catch (e) {
      console.error('[魔方] 加载本地进度失败:', e);
    }
  }

  // 从云端加载进度
  async loadProgressFromCloud() {
    if (!this.gameStorage) return;

    try {
      const cloudProgress = await this.gameStorage.load('progress');
      if (cloudProgress) {
        this.currentLevel = cloudProgress.currentLevel || 0;
        this.currentStep = cloudProgress.currentStep || 0;
        this.completedLevels = new Set(cloudProgress.completedLevels || []);
        this.stats = cloudProgress.stats || {
          startTime: Date.now(),
          practiceCount: 0
        };

        // 更新本地缓存
        localStorage.setItem('rubiksTutorialProgress', JSON.stringify(cloudProgress));
        console.log('✅ [魔方] 云端进度已加载');

        // 通知游戏更新 UI
        if (window.game) {
          window.game.renderUI();
          window.game.renderLevelList();
          window.game.updateStats();
        }
      }
    } catch (e) {
      console.warn('[魔方] 加载云端进度失败:', e);
    }
  }

  // 重置进度（本地 + 云端）
  async resetProgress() {
    this.currentLevel = 0;
    this.currentStep = 0;
    this.completedLevels.clear();
    this.stats = {
      startTime: Date.now(),
      practiceCount: 0
    };

    // 清除本地
    localStorage.removeItem('rubiksTutorialProgress');

    // 清除云端
    if (this.gameStorage) {
      try {
        await this.gameStorage.clearCloudData('progress');
        console.log('✅ [魔方] 云端进度已清除');
      } catch (e) {
        console.warn('[魔方] 清除云端进度失败:', e);
      }
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TutorialManager };
}
