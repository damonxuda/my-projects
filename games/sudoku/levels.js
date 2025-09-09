// 数独关卡选择页面逻辑
class SudokuLevelsPage {
  constructor() {
    this.storage = new SudokuStorage();
    this.currentDifficulty = 'easy';
    this.levels = {};
    this.progress = {};
    this.elements = {};
    
    this.init();
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
      completedCount: document.getElementById('completed-count'),
      totalStars: document.getElementById('total-stars'),
      bestTime: document.getElementById('best-time')
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

  // 加载用户进度
  async loadProgress() {
    try {
      // 从本地存储加载进度（后期会从数据库加载）
      const savedProgress = this.storage.load('level_progress');
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
        unlockedLevel: 1,
        completedLevels: [],
        levelRecords: {} // level_number -> {time, stars, attempts}
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
    const difficultyProgress = this.progress[this.currentDifficulty] || { unlockedLevel: 1, completedLevels: [], levelRecords: {} };
    
    levels.forEach(level => {
      const levelCard = this.createLevelCard(level, difficultyProgress);
      grid.appendChild(levelCard);
    });
  }

  // 创建关卡卡片
  createLevelCard(level, difficultyProgress) {
    const card = document.createElement('a');
    card.className = 'level-card';
    
    const isUnlocked = level.level <= difficultyProgress.unlockedLevel;
    const isCompleted = difficultyProgress.completedLevels.includes(level.level);
    const isCurrent = level.level === difficultyProgress.unlockedLevel && !isCompleted;
    const record = difficultyProgress.levelRecords[level.level];
    
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
      card.href = `index.html?difficulty=${this.currentDifficulty}&level=${level.level}`;
    } else {
      card.onclick = (e) => e.preventDefault();
    }
    
    // 关卡号码
    const levelNumber = document.createElement('div');
    levelNumber.className = 'level-number';
    levelNumber.textContent = level.level;
    card.appendChild(levelNumber);
    
    // 星级显示（完成的关卡）
    if (record && record.stars) {
      const stars = document.createElement('div');
      stars.className = 'level-stars';
      stars.textContent = '★'.repeat(record.stars) + '☆'.repeat(3 - record.stars);
      card.appendChild(stars);
    }
    
    // 最佳时间（完成的关卡）
    if (record && record.time) {
      const time = document.createElement('div');
      time.className = 'level-time';
      time.textContent = GameUtils.formatTime(record.time);
      card.appendChild(time);
    }
    
    return card;
  }

  // 更新进度统计
  updateProgressStats() {
    const difficultyProgress = this.progress[this.currentDifficulty] || { completedLevels: [], levelRecords: {} };
    const completed = difficultyProgress.completedLevels.length;
    
    // 计算总星数
    let totalStars = 0;
    let bestTime = null;
    
    Object.values(difficultyProgress.levelRecords).forEach(record => {
      if (record.stars) totalStars += record.stars;
      if (record.time && (!bestTime || record.time < bestTime)) {
        bestTime = record.time;
      }
    });
    
    this.elements.completedCount.textContent = `${completed}/50`;
    this.elements.totalStars.textContent = totalStars;
    this.elements.bestTime.textContent = bestTime ? GameUtils.formatTime(bestTime) : '--:--';
  }

  // 更新总体统计
  updateOverallStats() {
    let totalCompleted = 0;
    
    Object.values(this.progress).forEach(difficultyProgress => {
      totalCompleted += difficultyProgress.completedLevels ? difficultyProgress.completedLevels.length : 0;
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

// 全局函数供其他页面调用
window.SudokuLevelsManager = {
  // 记录关卡完成
  recordCompletion(difficulty, level, time) {
    const storage = new SudokuStorage();
    const progress = storage.load('level_progress') || {};
    
    if (!progress[difficulty]) {
      progress[difficulty] = { unlockedLevel: 1, completedLevels: [], levelRecords: {} };
    }
    
    // 计算星级（基于时间）
    const levels = JSON.parse(localStorage.getItem(`sudoku_levels_${difficulty}`) || '[]');
    const levelData = levels.find(l => l.level === level);
    const estimatedTime = levelData ? levelData.estimated_time : 300;
    
    let stars = 1;
    if (time <= estimatedTime * 0.8) stars = 3;
    else if (time <= estimatedTime * 1.2) stars = 2;
    
    // 记录成绩
    const record = progress[difficulty].levelRecords[level] || { attempts: 0 };
    record.attempts++;
    
    if (!record.time || time < record.time) {
      record.time = time;
      record.stars = stars;
    }
    
    progress[difficulty].levelRecords[level] = record;
    
    // 解锁下一关
    if (!progress[difficulty].completedLevels.includes(level)) {
      progress[difficulty].completedLevels.push(level);
    }
    
    if (level >= progress[difficulty].unlockedLevel) {
      progress[difficulty].unlockedLevel = Math.min(50, level + 1);
    }
    
    storage.save('level_progress', progress);
    return stars;
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  new SudokuLevelsPage();
});