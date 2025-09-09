// 数织关卡选择页面逻辑
// 负责展示所有难度的数织关卡，管理进度和解锁状态

class NonogramLevels {
  constructor() {
    this.currentDifficulty = 'easy';
    this.levels = {};
    this.progress = null;
    this.storage = null;
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
      
    } catch (error) {
      console.error('NonogramLevels initialization failed:', error);
      this.showError('加载关卡失败，请刷新重试');
    } finally {
      this.showLoading(false);
    }
  }

  // 初始化存储系统
  async initStorage() {
    // 创建数织专用的存储实例
    this.storage = new AuthenticatedNonogramStorage();
    
    // 如果全局认证系统可用，初始化存储
    if (window.gameAuth && window.gameAuth.isInitialized) {
      const auth = window.gameAuth.getAuthStatus();
      if (auth.isSignedIn && window.gameAuth.getSupabaseClient()) {
        await this.storage.initialize(window.gameAuth, window.gameAuth.getSupabaseClient());
      }
    }
  }

  // 加载进度数据
  async loadProgress() {
    try {
      this.progress = await this.storage.loadProgress();
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

    // 监听认证状态变化
    if (window.gameAuth) {
      window.gameAuth.onAuthChange((isSignedIn) => {
        this.handleAuthChange(isSignedIn);
      });
    }
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
      levelCard.href = `./index.html?difficulty=${difficulty}&level=${levelNumber}`;
      
      // 添加状态类
      if (isLocked) {
        levelCard.classList.add('locked');
        levelCard.removeAttribute('href');
      } else if (isCompleted) {
        levelCard.classList.add('completed');
      } else if (isCurrent) {
        levelCard.classList.add('current');
      }

      // 关卡尺寸标签
      const sizeLabel = document.createElement('div');
      sizeLabel.className = 'level-size';
      sizeLabel.textContent = `${level.size}×${level.size}`;
      levelCard.appendChild(sizeLabel);

      // 主题图标
      if (level.theme && this.themeIcons[level.theme]) {
        const themeIcon = document.createElement('div');
        themeIcon.className = 'theme-icon';
        themeIcon.textContent = this.themeIcons[level.theme];
        levelCard.appendChild(themeIcon);
      }

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

      // 星级显示（仅已完成的关卡）
      if (isCompleted && record && record.stars) {
        const stars = document.createElement('div');
        stars.className = 'level-stars';
        
        for (let i = 0; i < 3; i++) {
          const star = document.createElement('span');
          star.textContent = i < record.stars ? '★' : '☆';
          star.style.color = i < record.stars ? '#ffd700' : 'rgba(255, 255, 255, 0.3)';
          stars.appendChild(star);
        }
        levelInfo.appendChild(stars);
      }

      levelCard.appendChild(levelInfo);
      container.appendChild(levelCard);
    });
  }

  // 更新统计信息
  updateStats() {
    const difficulty = this.currentDifficulty;
    const levels = this.levels[difficulty] || [];
    const progress = this.progress[difficulty] || { completed_levels: [], level_records: {} };
    
    // 当前难度完成数量
    const completedCount = progress.completed_levels.length;
    const totalCount = levels.length;
    
    // 总星数
    let totalStars = 0;
    Object.values(progress.level_records).forEach(record => {
      if (record.stars) totalStars += record.stars;
    });
    
    // 最佳时间
    let bestTime = null;
    Object.values(progress.level_records).forEach(record => {
      if (record.time && (!bestTime || record.time < bestTime)) {
        bestTime = record.time;
      }
    });
    
    // 更新显示
    const completedEl = document.getElementById('completed-count');
    if (completedEl) completedEl.textContent = completedCount;
    
    const starsEl = document.getElementById('total-stars');
    if (starsEl) starsEl.textContent = totalStars;
    
    const timeEl = document.getElementById('best-time');
    if (timeEl) {
      timeEl.textContent = bestTime ? this.formatTime(bestTime) : '--:--';
    }

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

  // 处理认证状态变化
  async handleAuthChange(isSignedIn) {
    if (isSignedIn && window.gameAuth.getSupabaseClient()) {
      // 用户登录，初始化云同步
      try {
        await this.storage.initialize(window.gameAuth, window.gameAuth.getSupabaseClient());
        // 重新加载进度（可能从云端同步）
        await this.loadProgress();
        this.renderLevels();
        this.updateStats();
      } catch (error) {
        console.error('Failed to sync after auth change:', error);
      }
    }
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
}

// 数织专用存储类
class AuthenticatedNonogramStorage extends AuthenticatedGameStorage {
  constructor() {
    super('nonogram');
  }

  // 加载数织进度
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

  // 保存数织进度
  async saveProgress(progressData) {
    return await this.save('progress', progressData);
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

  // 加载设置
  async loadSettings() {
    const data = await this.load('settings');
    return data || {
      difficulty: 'easy',
      showHints: true,
      autoMark: true,
      theme: 'light',
      vibration: true,
      sound: true,
      colorBlind: false
    };
  }

  // 保存设置
  async saveSettings(settings) {
    return await this.save('settings', settings);
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.nonogramLevels = new NonogramLevels();
});

// 导出到全局作用域
if (typeof window !== 'undefined') {
  window.AuthenticatedNonogramStorage = AuthenticatedNonogramStorage;
}