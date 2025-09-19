// 数独关卡选择页面逻辑 - 集成智能存储系统
class SudokuLevelsPage {
  constructor() {
    this.storage = null; // 延迟初始化，等待Clerk准备就绪
    this.currentDifficulty = 'easy';
    this.levels = {};
    this.progress = {};
    this.elements = {};

    // 等待Clerk初始化完成后再开始页面初始化
    this.waitForClerkAndInit();
  }

  // 等待Clerk初始化完成，然后开始页面初始化
  waitForClerkAndInit() {
    const startInit = () => {
      console.log('🎮 开始初始化Sudoku关卡页面 - Clerk状态:', window.clerkInitialized);

      // 现在可以安全地初始化存储系统了
      this.storage = new SmartSudokuStorage();

      // 开始页面初始化
      this.init();
    };

    // 检查Clerk是否已经初始化
    if (window.clerkInitialized) {
      startInit();
    } else {
      // 等待Clerk初始化完成事件
      window.addEventListener('clerkReady', startInit, { once: true });

      // 设置超时保护，避免永久等待
      setTimeout(() => {
        if (!this.storage) {
          console.warn('⚠️ Clerk初始化超时，以游客模式继续');
          startInit();
        }
      }, 5000); // 5秒超时
    }
  }

  // 初始化
  async init() {
    this.initElements();
    this.initEventListeners();

    await this.loadAllLevels();
    await this.loadProgress();
    this.updateDisplay();
  }


  // 获取DOM元素
  initElements() {
    this.elements = {
      difficultyTabs: document.querySelectorAll('.difficulty-tab'),
      levelsGrid: document.getElementById('levels-grid'),
      loading: document.getElementById('loading'),
      overallStats: document.getElementById('overall-stats'),
      totalStars: document.getElementById('total-stars')
    };
  }

  // 初始化事件监听器
  initEventListeners() {
    // 难度切换
    this.elements.difficultyTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const difficulty = e.target.dataset.difficulty;
        this.switchDifficulty(difficulty);
      });
    });
  }

  // 加载所有关卡数据
  async loadAllLevels() {
    this.showLoading();
    
    try {
      const difficulties = ['easy', 'medium', 'hard', 'expert', 'master'];
      
      for (const difficulty of difficulties) {
        const response = await fetch(`../shared/levels/sudoku/${difficulty}.json`);
        if (!response.ok) {
          throw new Error(`Failed to load ${difficulty} levels`);
        }
        
        this.levels[difficulty] = await response.json();
      }
      
      console.log('✅ All levels loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load levels:', error);
      this.showError('无法加载关卡数据');
    } finally {
      this.hideLoading();
    }
  }

  // 加载用户进度（使用智能存储系统）
  async loadProgress() {
    try {
      const savedProgress = await this.storage.loadProgress();
      this.progress = savedProgress || this.createDefaultProgress();
      console.log('✅ Progress loaded:', this.progress);
    } catch (error) {
      console.error('❌ Failed to load progress:', error);
      this.progress = this.createDefaultProgress();
    }
  }

  // 创建默认进度
  createDefaultProgress() {
    const defaultProgress = {};
    const difficulties = ['easy', 'medium', 'hard', 'expert', 'master'];

    difficulties.forEach(difficulty => {
      defaultProgress[difficulty] = {
        current_level: 1,
        completed_levels: [],
        level_records: {} // level_number -> {best_time, best_stars, attempts, completed, last_completed}
      };
    });

    return defaultProgress;
  }

  // 切换难度
  switchDifficulty(difficulty) {
    this.currentDifficulty = difficulty;
    
    // 更新标签页状态
    this.elements.difficultyTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.difficulty === difficulty);
    });
    
    this.updateDisplay();
  }

  // 更新显示
  updateDisplay() {
    this.updateLevelsGrid();
    this.updateProgressStats();
    this.updateOverallStats();
  }

  // 更新关卡网格
  updateLevelsGrid() {
    const grid = this.elements.levelsGrid;
    grid.innerHTML = '';

    const levels = this.levels[this.currentDifficulty] || [];
    const difficultyProgress = this.progress[this.currentDifficulty] || {
      current_level: 1,
      completed_levels: [],
      level_records: {}
    };

    levels.forEach(level => {
      const levelCard = this.createLevelCard(level, difficultyProgress);
      grid.appendChild(levelCard);
    });
  }

  // 创建关卡卡片
  createLevelCard(level, difficultyProgress) {
    const card = document.createElement('a');
    card.className = 'level-card';

    const isUnlocked = level.level <= difficultyProgress.current_level;
    const isCompleted = difficultyProgress.completed_levels.includes(level.level);
    const isCurrent = level.level === difficultyProgress.current_level && !isCompleted;
    const record = difficultyProgress.level_records[level.level];
    
    // 设置状态样式
    if (!isUnlocked) {
      card.classList.add('locked');
    } else if (isCompleted) {
      card.classList.add('completed');
    } else if (isCurrent) {
      card.classList.add('current');
    }
    
    // 设置链接
    if (isUnlocked) {
      // 构建游戏链接，如果有跨模块认证状态则传递session token
      let gameUrl = `index.html?difficulty=${this.currentDifficulty}&level=${level.level}`;

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

      card.href = gameUrl;
    } else {
      card.onclick = (e) => e.preventDefault();
    }
    
    // 关卡号码
    const levelNumber = document.createElement('div');
    levelNumber.className = 'level-number';
    levelNumber.textContent = level.level;
    card.appendChild(levelNumber);
    
    // 星级显示
    const starDisplay = document.createElement('div');
    starDisplay.className = 'star-display';

    // 获取该关卡的星级记录
    const stars = record?.best_stars || 0;

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
    card.appendChild(starDisplay);

    // 最佳时间（完成的关卡）
    if (record && record.best_time) {
      const time = document.createElement('div');
      time.className = 'level-time';
      time.textContent = GameUtils.formatTime(record.best_time * 1000); // 转换为毫秒
      card.appendChild(time);
    }
    
    return card;
  }

  // 更新进度统计
  updateProgressStats() {
    const difficultyProgress = this.progress[this.currentDifficulty] || {
      level_records: {}
    };

    // 计算总星数
    let totalStars = 0;
    Object.values(difficultyProgress.level_records).forEach(record => {
      if (record.best_stars) totalStars += record.best_stars;
    });

    // 更新显示
    const starsEl = document.getElementById('total-stars');
    if (starsEl) starsEl.textContent = totalStars;
  }

  // 更新总体统计
  updateOverallStats() {
    let totalCompleted = 0;

    Object.values(this.progress).forEach(difficultyProgress => {
      totalCompleted += difficultyProgress.completed_levels ? difficultyProgress.completed_levels.length : 0;
    });

    this.elements.overallStats.textContent = `${totalCompleted}/250`;
  }

  // 显示加载状态
  showLoading() {
    this.elements.loading.classList.add('show');
    this.elements.levelsGrid.style.display = 'none';
  }

  // 隐藏加载状态
  hideLoading() {
    this.elements.loading.classList.remove('show');
    this.elements.levelsGrid.style.display = 'grid';
  }

  // 显示错误信息
  showError(message) {
    this.elements.levelsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; opacity: 0.8;">
        <div style="font-size: 2rem; margin-bottom: 1rem;">😞</div>
        <div>${message}</div>
        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: rgba(255,255,255,0.2); border: none; border-radius: 6px; color: white; cursor: pointer;">重试</button>
      </div>
    `;
  }

  // 保存进度
  saveProgress() {
    this.storage.save('level_progress', this.progress);
  }

  // 解锁下一关
  unlockNextLevel(difficulty, currentLevel) {
    if (!this.progress[difficulty]) {
      this.progress[difficulty] = { unlockedLevel: 1, completedLevels: [], levelRecords: {} };
    }
    
    const difficultyProgress = this.progress[difficulty];
    
    // 标记当前关卡为完成
    if (!difficultyProgress.completedLevels.includes(currentLevel)) {
      difficultyProgress.completedLevels.push(currentLevel);
    }
    
    // 解锁下一关
    if (currentLevel >= difficultyProgress.unlockedLevel) {
      difficultyProgress.unlockedLevel = Math.min(50, currentLevel + 1);
    }
    
    this.saveProgress();
  }

  // 记录关卡成绩
  recordLevelResult(difficulty, level, time, stars = 3) {
    if (!this.progress[difficulty]) {
      this.progress[difficulty] = { unlockedLevel: 1, completedLevels: [], levelRecords: {} };
    }
    
    const record = this.progress[difficulty].levelRecords[level] || { attempts: 0 };
    
    // 更新记录
    record.attempts++;
    
    // 更新最佳时间和星级
    if (!record.time || time < record.time) {
      record.time = time;
      record.stars = stars;
    }
    
    this.progress[difficulty].levelRecords[level] = record;
    this.unlockNextLevel(difficulty, level);
    
    console.log(`✅ Level ${level} completed:`, record);
  }
}

// 已废弃 - 现在使用智能存储系统

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  new SudokuLevelsPage();
});