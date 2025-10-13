// 使用统一的智能存储系统 - SmartNonogramStorage
// (定义在 ../shared/js/smartGameStorage.js)


// 数织关卡选择页面逻辑
// 负责展示所有难度的数织关卡，管理进度和解锁状态

class NonogramLevels {
  constructor() {
    this.currentDifficulty = 'easy';
    this.levels = {};
    this.progress = null;
    // 使用 Edge Function 版本
    this.storage = new SmartGameStorageEdgeFunction('nonogram');
    console.log('🔧 Levels using storage:', this.storage.constructor.name);
    this.isLoading = false;
    
    // 难度配置
    this.difficulties = {
      easy: { name: '简单', size: '5×5', icon: '🟢', levelsPerRow: 10 },
      medium: { name: '中等', size: '10×10', icon: '🟡', levelsPerRow: 8 },
      hard: { name: '困难', size: '15×15', icon: '🟠', levelsPerRow: 7 },
      expert: { name: '专家', size: '20×20', icon: '🔴', levelsPerRow: 6 },
      master: { name: '大师', size: '25×25', icon: '🟣', levelsPerRow: 5 }
    };

    // 主题图标映射
    this.themeIcons = {
      symbols: '⭐',
      faces: '😊',
      objects: '🏠',
      nature: '🌳',
      animals: '🐱',
      food: '🍎',
      vehicles: '🚗',
      abstract: '🎨',
      geometric: '📐',
      random: '🎲',
      pattern: '🔷',
      classic: '💎'
    };

    this.init();
  }

  async init() {
    try {
      this.showLoading(true);
      
      // 初始化存储系统
      await this.initStorage();
      
      // 加载进度数据
      await this.loadProgress();
      
      // 加载关卡数据
      await this.loadAllLevels();
      
      // 设置事件监听
      this.setupEventListeners();
      
      // 渲染界面
      this.renderLevels();
      this.updateStats();
      
      // 检查是否显示新手引导
      this.checkAndShowNewbieGuide();
      
    } catch (error) {
      console.error('NonogramLevels initialization failed:', error);
      this.showError('加载关卡失败，请刷新重试');
    } finally {
      this.showLoading(false);
    }
  }

  // 初始化存储系统（智能存储系统自动处理认证）
  async initStorage() {
    // 智能存储系统已经自动处理认证，无需额外初始化
    console.log('🧠 Using SmartNonogramStorage - authentication handled automatically');
  }

  // 加载进度数据
  async loadProgress() {
    try {
      // 兼容两种存储：SmartGameStorageEdgeFunction.load() 和 SmartNonogramStorage.loadProgress()
      if (typeof this.storage.loadProgress === 'function') {
        this.progress = await this.storage.loadProgress();
      } else {
        // Edge Function版本使用通用的load方法
        this.progress = await this.storage.load('progress');
      }
      console.log('Loaded nonogram progress:', this.progress);
    } catch (error) {
      console.error('Failed to load progress:', error);
      // 使用默认进度
      this.progress = this.getDefaultProgress();
    }
  }

  // 获取默认进度
  getDefaultProgress() {
    const defaultProgress = {};
    Object.keys(this.difficulties).forEach(difficulty => {
      defaultProgress[difficulty] = {
        current_level: 1,
        completed_levels: [],
        level_records: {}
      };
    });
    return defaultProgress;
  }

  // 加载所有关卡数据
  async loadAllLevels() {
    const loadPromises = Object.keys(this.difficulties).map(async (difficulty) => {
      try {
        const response = await fetch(`../shared/levels/nonogram/${difficulty}.json`);
        if (!response.ok) throw new Error(`Failed to load ${difficulty} levels`);
        this.levels[difficulty] = await response.json();
        console.log(`✅ Loaded ${this.levels[difficulty].length} ${difficulty} nonogram levels`);
      } catch (error) {
        console.error(`Failed to load ${difficulty} levels:`, error);
        this.levels[difficulty] = [];
      }
    });

    await Promise.all(loadPromises);
  }

  // 设置事件监听
  setupEventListeners() {
    // 难度切换
    document.querySelectorAll('.difficulty-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const difficulty = e.currentTarget.getAttribute('data-difficulty');
        this.switchDifficulty(difficulty);
      });
    });

    // 重置进度按钮
    const resetBtn = document.getElementById('reset-progress');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.showResetConfirmation();
      });
    }

    // Legacy gameAuth监听已移除 - SmartGameStorage自动处理认证状态变化
  }

  // 切换难度
  switchDifficulty(difficulty) {
    if (this.currentDifficulty === difficulty) return;
    
    this.currentDifficulty = difficulty;
    
    // 更新标签页状态
    document.querySelectorAll('.difficulty-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.getAttribute('data-difficulty') === difficulty) {
        tab.classList.add('active');
      }
    });

    // 更新难度图标
    const difficultyIcon = document.getElementById('current-difficulty-icon');
    if (difficultyIcon) {
      difficultyIcon.textContent = this.difficulties[difficulty].icon;
    }
    
    // 重新渲染关卡
    this.renderLevels();
    this.updateStats();
  }

  // 渲染关卡网格
  renderLevels() {
    const container = document.getElementById('levels-grid');
    if (!container) return;

    const difficulty = this.currentDifficulty;
    const levels = this.levels[difficulty] || [];
    const progress = this.progress[difficulty] || { current_level: 1, completed_levels: [], level_records: {} };
    
    container.innerHTML = '';

    if (levels.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 2rem; opacity: 0.7;">暂无关卡数据</div>';
      return;
    }

    levels.forEach((level, index) => {
      const levelNumber = level.level;
      const isCompleted = progress.completed_levels.includes(levelNumber);
      const isCurrent = levelNumber === progress.current_level && !isCompleted;
      const isLocked = levelNumber > progress.current_level;
      const record = progress.level_records[levelNumber];

      const levelCard = document.createElement('a');
      levelCard.className = 'level-card';
      // 构建游戏链接，如果有跨模块认证状态则传递session token
      let gameUrl = `./index.html?difficulty=${difficulty}&level=${levelNumber}`;

      // 如果存在跨模块认证状态，传递session token到游戏页面
      if (window.mockClerkUser && window.mockClerkUser.isAuthenticated) {
        // 优先使用保存的session token，fallback到URL参数
        let sessionToken = window.mockClerkUser.originalSessionToken;
        if (!sessionToken) {
          const urlParams = new URLSearchParams(window.location.search);
          sessionToken = urlParams.get('session');
        }

        if (sessionToken) {
          gameUrl += `&session=${encodeURIComponent(sessionToken)}`;
        }
      }

      levelCard.href = gameUrl;
      
      // 添加状态类
      if (isLocked) {
        levelCard.classList.add('locked');
        levelCard.removeAttribute('href');
      } else if (isCompleted) {
        levelCard.classList.add('completed');
      } else if (isCurrent) {
        levelCard.classList.add('current');
      }


      // 星级显示
      const starDisplay = document.createElement('div');
      starDisplay.className = 'star-display';

      // 获取该关卡的星级记录
      const levelRecord = progress.level_records[levelNumber];
      const stars = levelRecord?.best_stars || 0;

      // 生成星星显示（3颗星的容器）
      let starsHTML = '';
      for (let i = 1; i <= 3; i++) {
        if (i <= stars) {
          starsHTML += '<span class="filled-star">★</span>'; // 亮星（上色）
        } else {
          starsHTML += '<span class="empty-star">☆</span>'; // 暗星（未上色）
        }
      }
      starDisplay.innerHTML = starsHTML;
      levelCard.appendChild(starDisplay);

      // 关卡信息容器
      const levelInfo = document.createElement('div');
      levelInfo.className = 'level-info';

      // 关卡编号
      const levelNumber_el = document.createElement('div');
      levelNumber_el.className = 'level-number';
      levelNumber_el.textContent = levelNumber;
      levelInfo.appendChild(levelNumber_el);

      // 关卡主题或标题
      if (level.title || level.theme) {
        const levelTheme = document.createElement('div');
        levelTheme.className = 'level-theme';
        levelTheme.textContent = level.title || level.theme;
        if (level.theme && !level.title) {
          levelTheme.classList.add(`theme-${level.theme}`);
        }
        levelInfo.appendChild(levelTheme);
      }


      levelCard.appendChild(levelInfo);
      container.appendChild(levelCard);
    });
  }

  // 更新统计信息
  updateStats() {
    const difficulty = this.currentDifficulty;
    const progress = this.progress[difficulty] || { level_records: {} };

    // 总星数
    let totalStars = 0;
    Object.values(progress.level_records).forEach(record => {
      if (record.best_stars) totalStars += record.best_stars;
    });

    // 更新显示
    const starsEl = document.getElementById('total-stars');
    if (starsEl) starsEl.textContent = totalStars;

    // 更新总体统计
    this.updateOverallStats();
  }

  // 更新总体统计
  updateOverallStats() {
    let totalCompleted = 0;
    let totalLevels = 0;
    
    Object.keys(this.difficulties).forEach(difficulty => {
      const levels = this.levels[difficulty] || [];
      const progress = this.progress[difficulty] || { completed_levels: [] };
      
      totalLevels += levels.length;
      totalCompleted += progress.completed_levels.length;
    });
    
    const overallStats = document.getElementById('overall-stats');
    if (overallStats) {
      overallStats.innerHTML = `<div>${totalCompleted}/${totalLevels}</div>`;
    }
  }

  // 格式化时间显示
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // 处理认证状态变化（智能存储系统自动处理）
  async handleAuthChange(isSignedIn) {
    // 智能存储系统已经自动处理认证状态变化
    console.log(`🔐 Nonogram Levels Auth status changed: ${isSignedIn} - SmartStorage handling automatically`);

    // 重新加载进度以反映可能的数据变化
    await this.loadProgress();
    this.renderLevels();
    this.updateStats();
  }

  // 显示/隐藏加载状态
  showLoading(show) {
    const loading = document.getElementById('loading');
    const levelsGrid = document.getElementById('levels-grid');
    
    if (loading && levelsGrid) {
      if (show) {
        loading.classList.add('show');
        levelsGrid.style.display = 'none';
      } else {
        loading.classList.remove('show');
        levelsGrid.style.display = 'grid';
      }
    }
  }

  // 显示错误信息
  showError(message) {
    const container = document.getElementById('levels-grid');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #ff6b6b;">
          <div style="font-size: 2rem; margin-bottom: 1rem;">😞</div>
          <div>${message}</div>
        </div>
      `;
    }
  }

  // 检查并显示新手引导
  checkAndShowNewbieGuide() {
    // 检查用户是否是新手（没有完成任何关卡）
    const hasAnyProgress = Object.keys(this.difficulties).some(difficulty => {
      const progress = this.progress[difficulty] || { completed_levels: [] };
      return progress.completed_levels.length > 0;
    });

    // 检查是否已经关闭过新手引导
    const hasSeenGuide = localStorage.getItem('nonogram_seen_guide') === 'true';

    if (!hasAnyProgress && !hasSeenGuide) {
      const guideElement = document.getElementById('newbie-guide');
      if (guideElement) {
        guideElement.style.display = 'block';
        
        // 设置关闭按钮事件
        const dismissBtn = document.getElementById('dismiss-guide');
        if (dismissBtn) {
          dismissBtn.addEventListener('click', () => {
            localStorage.setItem('nonogram_seen_guide', 'true');
            guideElement.style.display = 'none';
          });
        }
      }
    }
  }

  // 显示重置确认对话框
  showResetConfirmation() {
    if (confirm('确定要重置所有游戏进度吗？\n\n这将清除所有难度的关卡记录、星级和时间记录。此操作不可恢复。')) {
      this.resetAllProgress();
    }
  }

  // 重置所有进度
  async resetAllProgress() {
    try {
      // 重置本地存储
      localStorage.removeItem('nonogram_seen_guide');
      
      // 重置进度数据
      const defaultProgress = this.getDefaultProgress();
      await this.storage.saveProgress(defaultProgress);
      this.progress = defaultProgress;
      
      // 重新渲染界面
      this.renderLevels();
      this.updateStats();
      
      // 显示新手引导
      this.checkAndShowNewbieGuide();
      
      alert('所有进度已重置！');
    } catch (error) {
      console.error('重置进度失败:', error);
      alert('重置进度失败，请稍后重试');
    }
  }
}


// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.nonogramLevels = new NonogramLevels();
});

// 导出到全局作用域 (清理过期代码)