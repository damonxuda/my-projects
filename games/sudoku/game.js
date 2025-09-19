// 数独游戏主逻辑 - 集成认证系统
class SudokuGame {
  constructor() {
    this.engine = new SudokuEngine();
    this.storage = null; // 延迟初始化，等待Clerk准备就绪
    this.gameState = {
      puzzle: [],
      solution: [],
      board: [],
      fixedCells: new Set(),
      selectedCell: null,
      conflicts: new Set(),
      startTime: null,
      elapsedTime: 0,
      isComplete: false,
      difficulty: 'medium',
      isLevelMode: false,
      currentLevel: null
    };
    this.timer = null;
    this.elements = {};
    this.levels = {};
    this.isAuthReady = false;
    this.authInitPromise = null;

    // 等待Clerk初始化完成后再开始游戏初始化
    this.waitForClerkAndInit();
  }

  // 等待Clerk初始化完成，然后开始游戏初始化
  waitForClerkAndInit() {
    const startInit = () => {
      console.log('🎮 开始初始化Sudoku游戏 - Clerk状态:', window.clerkInitialized);

      // 现在可以安全地初始化存储系统了
      this.storage = new SmartSudokuStorage();

      // 开始游戏初始化
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

  // 初始化游戏
  async init() {
    this.initElements();
    this.initEventListeners();
    
    // 初始化认证系统
    await this.initAuth();
    
    await this.checkURLParams();
    this.loadGame();
    this.createBoard();
    
    // 确保棋盘显示正确的数据 - 检查DOM是否ready
    if (this.gameState.board && this.gameState.board.length > 0) {
      // 确保有81个cell元素存在
      const cells = this.elements.board.children;
      if (cells.length === 81) {
        this.updateBoard();
      }
    }
  }

  // 初始化认证系统（智能存储系统自动处理）
  async initAuth() {
    // 智能存储系统已经自动处理认证，无需额外初始化
    console.log('🧠 Using SmartSudokuStorage - authentication handled automatically');
  }

  // 处理认证状态变化（智能存储系统自动处理）
  async handleAuthChange(isSignedIn) {
    // 智能存储系统已经自动处理认证状态变化
    console.log(`🔐 Auth status changed: ${isSignedIn} - SmartStorage handling automatically`);
  }

  // 检查URL参数（关卡模式）
  async checkURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const difficulty = urlParams.get('difficulty');
    const level = urlParams.get('level');
    
    if (difficulty && level) {
      this.gameState.isLevelMode = true;
      this.gameState.difficulty = difficulty;
      this.gameState.currentLevel = parseInt(level);
      
      // 加载关卡数据
      await this.loadLevelData(difficulty, parseInt(level));
      this.updateUIForLevelMode();
    }
  }

  // 加载关卡数据
  async loadLevelData(difficulty, levelNumber) {
    try {
      this.showLoading();
      
      if (!this.levels[difficulty]) {
        // 添加缓存破坏参数强制重新加载
        const timestamp = Date.now();
        const response = await fetch(`../shared/levels/sudoku/${difficulty}.json?v=${timestamp}`);
        if (!response.ok) {
          throw new Error(`Failed to load ${difficulty} levels`);
        }
        this.levels[difficulty] = await response.json();
      }
      
      const levelData = this.levels[difficulty].find(l => l.level === levelNumber);
      if (!levelData) {
        throw new Error(`Level ${levelNumber} not found`);
      }
      
      
      // 设置游戏状态
      this.gameState.puzzle = this.engine.cloneBoard(levelData.puzzle);
      this.gameState.solution = this.engine.cloneBoard(levelData.solution);
      this.gameState.board = this.engine.cloneBoard(levelData.puzzle);
      this.gameState.fixedCells = this.buildFixedCells(levelData.puzzle);
      this.gameState.selectedCell = null;
      this.gameState.conflicts = new Set();
      this.gameState.startTime = Date.now();
      this.gameState.elapsedTime = 0;
      this.gameState.isComplete = false;

      this.updateBoard();
      this.startTimer();
      this.hideLoading();
    } catch (error) {
      console.error('❌ Failed to load level:', error);
      this.hideLoading();
      alert('无法加载关卡数据，将切换到随机模式');
      this.gameState.isLevelMode = false;
    }
  }

  // 更新UI为关卡模式
  updateUIForLevelMode() {
    if (this.gameState.isLevelMode) {
      // 显示关卡信息
      this.elements.levelInfo.style.display = 'block';
      this.elements.difficultySelector.style.display = 'none';
      
      // 更新关卡信息显示
      const difficultyNames = {
        easy: '简单',
        medium: '中等', 
        hard: '困难',
        expert: '专家',
        master: '大师'
      };
      
      this.elements.currentDifficulty.textContent = difficultyNames[this.gameState.difficulty] || this.gameState.difficulty;
      this.elements.currentLevel.textContent = this.gameState.currentLevel;
      
      // 修改按钮文本
      this.elements.newGameBtn.textContent = '随机题目';
    } else {
      // 隐藏关卡信息
      this.elements.levelInfo.style.display = 'none';
      this.elements.difficultySelector.style.display = 'flex';
      this.elements.newGameBtn.textContent = '新游戏';
    }
  }

  // 获取DOM元素
  initElements() {
    this.elements = {
      board: document.getElementById('sudoku-board'),
      timer: document.getElementById('timer'),
      difficulty: document.getElementById('difficulty'),
      newGameBtn: document.getElementById('new-game-btn'),
      restartBtn: document.getElementById('restart-btn'),
      levelsBtn: document.getElementById('levels-btn'),
      loading: document.getElementById('loading'),
      gameComplete: document.getElementById('game-complete'),
      completeTime: document.getElementById('complete-time'),
      completeStars: document.getElementById('complete-stars'),
      levelCompleteInfo: document.getElementById('level-complete-info'),
      nextLevelBtn: document.getElementById('next-level-btn'),
      levelInfo: document.getElementById('level-info'),
      difficultySelector: document.getElementById('difficulty-selector'),
      currentDifficulty: document.getElementById('current-difficulty'),
      currentLevel: document.getElementById('current-level'),
      numberPad: document.querySelectorAll('.num-btn')
    };
    
    // 检查关键元素是否存在
    if (!this.elements.board) {
      console.error('❌ Critical DOM element #sudoku-board not found');
      throw new Error('Critical DOM element #sudoku-board not found');
    }
    
  }

  // 初始化事件监听器
  initEventListeners() {
    // 难度选择
    this.elements.difficulty.addEventListener('change', (e) => {
      this.gameState.difficulty = e.target.value;
      this.startNewGame();
    });

    // 新游戏按钮
    this.elements.newGameBtn.addEventListener('click', () => {
      this.startNewGame();
    });

    // 重开按钮
    this.elements.restartBtn.addEventListener('click', () => {
      this.restartGame();
    });

    // 关卡选择按钮
    this.elements.levelsBtn.addEventListener('click', () => {
      window.location.href = 'levels.html';
    });

    // 数字输入面板
    this.elements.numberPad.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const num = e.target.dataset.num;
        const action = e.target.dataset.action;
        
        if (num) {
          this.inputNumber(parseInt(num));
        } else if (action === 'erase') {
          this.eraseCell();
        }
      });
    });

    // 键盘事件
    document.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });

    // 防止页面退出时丢失进度
    window.addEventListener('beforeunload', () => {
      this.saveGame();
    });

    // 页面隐藏时保存
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseTimer();
        this.saveGame();
      } else {
        this.resumeTimer();
      }
    });
  }

  // 创建9x9棋盘
  createBoard() {
    if (!this.elements.board) {
      console.error('❌ Board element not found in createBoard');
      return;
    }
    
    this.elements.board.innerHTML = '';
    
    for (let i = 0; i < 81; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = i;
      cell.dataset.row = Math.floor(i / 9);
      cell.dataset.col = i % 9;
      
      cell.addEventListener('click', () => {
        this.selectCell(i);
      });
      
      this.elements.board.appendChild(cell);
    }
    
  }

  // 开始新游戏
  async startNewGame() {
    this.showLoading();
    
    try {
      // 生成新的数独题目
      const { puzzle, solution } = await this.generatePuzzle();
      
      this.gameState = {
        puzzle: this.engine.cloneBoard(puzzle),
        solution: this.engine.cloneBoard(solution),
        board: this.engine.cloneBoard(puzzle),
        fixedCells: this.buildFixedCells(puzzle),
        selectedCell: null,
        conflicts: new Set(),
        startTime: Date.now(),
        elapsedTime: 0,
        isComplete: false,
        difficulty: this.elements.difficulty.value
      };
      
      this.updateBoard();
      this.startTimer();
      this.hideLoading();
      
      // 触觉反馈
      if (GameUtils.isTouchDevice()) {
        GameUtils.vibrate(50);
      }
    } catch (error) {
      console.error('Failed to generate puzzle:', error);
      this.hideLoading();
    }
  }

  // 异步生成数独题目（避免阻塞UI）
  generatePuzzle() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const result = this.engine.generate(this.gameState.difficulty);
        resolve(result);
      }, 50);
    });
  }

  // 重开当前游戏
  restartGame() {
    this.gameState.board = this.engine.cloneBoard(this.gameState.puzzle);
    this.gameState.selectedCell = null;
    this.gameState.conflicts.clear();
    this.gameState.startTime = Date.now();
    this.gameState.elapsedTime = 0;
    this.gameState.isComplete = false;
    
    this.updateBoard();
    this.startTimer();
  }

  // 构建固定格子集合
  buildFixedCells(puzzle) {
    const fixed = new Set();
    for (let i = 0; i < 81; i++) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      if (puzzle[row][col] !== 0) {
        fixed.add(i);
      }
    }
    return fixed;
  }

  // 选择格子
  selectCell(index) {
    if (this.gameState.fixedCells.has(index)) return;
    if (this.gameState.isComplete) return;
    
    this.gameState.selectedCell = index;
    this.updateBoard();
    
    // 触觉反馈
    if (GameUtils.isTouchDevice()) {
      GameUtils.vibrate(30);
    }
  }

  // 输入数字
  async inputNumber(num) {
    if (this.gameState.selectedCell === null) return;
    if (this.gameState.isComplete) return;
    
    const index = this.gameState.selectedCell;
    const row = Math.floor(index / 9);
    const col = index % 9;
    
    if (this.gameState.fixedCells.has(index)) return;
    
    this.gameState.board[row][col] = num;
    this.updateConflicts();
    this.updateBoard();
    
    // 保存游戏状态
    this.saveGame();
    
    await this.checkCompletion();
    
    // 触觉反馈
    if (GameUtils.isTouchDevice()) {
      GameUtils.vibrate(40);
    }
  }

  // 清除格子
  eraseCell() {
    if (this.gameState.selectedCell === null) return;
    if (this.gameState.isComplete) return;
    
    const index = this.gameState.selectedCell;
    const row = Math.floor(index / 9);
    const col = index % 9;
    
    if (this.gameState.fixedCells.has(index)) return;
    
    this.gameState.board[row][col] = 0;
    this.updateConflicts();
    this.updateBoard();
    
    // 保存游戏状态
    this.saveGame();
  }

  // 更新冲突检测
  updateConflicts() {
    this.gameState.conflicts.clear();
    const board = this.gameState.board;
    
    // 检查行冲突
    for (let r = 0; r < 9; r++) {
      const rowCounts = {};
      for (let c = 0; c < 9; c++) {
        const val = board[r][c];
        if (val !== 0) {
          rowCounts[val] = (rowCounts[val] || 0) + 1;
        }
      }
      
      for (let c = 0; c < 9; c++) {
        const val = board[r][c];
        if (val !== 0 && rowCounts[val] > 1) {
          this.gameState.conflicts.add(r * 9 + c);
        }
      }
    }
    
    // 检查列冲突
    for (let c = 0; c < 9; c++) {
      const colCounts = {};
      for (let r = 0; r < 9; r++) {
        const val = board[r][c];
        if (val !== 0) {
          colCounts[val] = (colCounts[val] || 0) + 1;
        }
      }
      
      for (let r = 0; r < 9; r++) {
        const val = board[r][c];
        if (val !== 0 && colCounts[val] > 1) {
          this.gameState.conflicts.add(r * 9 + c);
        }
      }
    }
    
    // 检查3x3宫格冲突
    for (let boxR = 0; boxR < 3; boxR++) {
      for (let boxC = 0; boxC < 3; boxC++) {
        const boxCounts = {};
        
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const row = boxR * 3 + r;
            const col = boxC * 3 + c;
            const val = board[row][col];
            if (val !== 0) {
              boxCounts[val] = (boxCounts[val] || 0) + 1;
            }
          }
        }
        
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const row = boxR * 3 + r;
            const col = boxC * 3 + c;
            const val = board[row][col];
            if (val !== 0 && boxCounts[val] > 1) {
              this.gameState.conflicts.add(row * 9 + col);
            }
          }
        }
      }
    }
  }

  // 更新棋盘显示
  updateBoard() {
    if (!this.elements.board) {
      console.error('❌ Board element not found in updateBoard');
      return;
    }
    
    const cells = this.elements.board.children;
    
    if (cells.length !== 81) {
      console.error(`❌ Expected 81 cells, found ${cells.length}`);
      return;
    }
    
    for (let i = 0; i < 81; i++) {
      const cell = cells[i];
      if (!cell) {
        console.error(`❌ Cell ${i} not found`);
        continue;
      }
      
      const row = Math.floor(i / 9);
      const col = i % 9;
      const value = this.gameState.board[row][col];
      
      // 设置数字
      cell.textContent = value === 0 ? '' : value;
      
      // 重置样式类
      cell.className = 'cell';
      
      // 添加状态样式
      if (this.gameState.fixedCells.has(i)) {
        cell.classList.add('fixed');
      }
      
      if (this.gameState.selectedCell === i) {
        cell.classList.add('selected');
      }
      
      if (this.gameState.conflicts.has(i)) {
        cell.classList.add('conflict');
      }
      
      // 高亮同数字和同行列
      if (this.gameState.selectedCell !== null && value !== 0) {
        const selectedRow = Math.floor(this.gameState.selectedCell / 9);
        const selectedCol = this.gameState.selectedCell % 9;
        const selectedValue = this.gameState.board[selectedRow][selectedCol];
        
        if (value === selectedValue || row === selectedRow || col === selectedCol) {
          cell.classList.add('highlight');
        }
      }
    }
  }

  // 检查游戏完成
  async checkCompletion() {
    if (this.engine.isComplete(this.gameState.board, this.gameState.solution)) {
      this.gameState.isComplete = true;
      this.stopTimer();
      
      // 关卡模式：记录进度和星级
      if (this.gameState.isLevelMode) {
        const stars = this.calculateStars();
        await this.recordLevelCompletion(stars);
        this.showLevelCompleteDialog(stars);
      } else {
        this.showCompleteDialog();
      }
      
      await this.saveStats();
      
      // 庆祝触觉反馈
      if (GameUtils.isTouchDevice()) {
        GameUtils.vibrate([100, 50, 100, 50, 200]);
      }
    }
  }

  // 计算星级（基于完成时间）
  calculateStars() {
    if (!this.gameState.isLevelMode) return 3;
    
    // 获取关卡的预估时间
    const levelData = this.levels[this.gameState.difficulty]?.find(l => l.level === this.gameState.currentLevel);
    const estimatedTime = levelData?.estimated_time || 300;
    const actualTime = this.gameState.elapsedTime / 1000;
    
    if (actualTime <= estimatedTime * 0.7) return 3; // 快速完成
    if (actualTime <= estimatedTime * 1.2) return 2; // 正常完成
    return 1; // 超时完成
  }

  // 记录关卡完成（使用智能存储系统）
  async recordLevelCompletion(stars) {
    if (!this.gameState.isLevelMode) return;

    try {
      // 使用智能存储系统更新关卡进度
      const progress = await this.storage.loadProgress();

      const difficulty = this.gameState.difficulty;
      const level = this.gameState.currentLevel;
      const timeInSeconds = Math.floor(this.gameState.elapsedTime / 1000);

      // 确保进度结构存在
      if (!progress[difficulty]) {
        progress[difficulty] = {
          current_level: 1,
          completed_levels: [],
          level_records: {}
        };
      }

      // 更新关卡记录
      const record = progress[difficulty].level_records[level] || { attempts: 0 };
      record.attempts++;
      record.completed = true;
      record.best_time = record.best_time ? Math.min(record.best_time, timeInSeconds) : timeInSeconds;
      record.best_stars = record.best_stars ? Math.max(record.best_stars, stars) : stars;
      record.last_completed = new Date().toISOString();

      progress[difficulty].level_records[level] = record;

      // 添加到已完成关卡列表
      if (!progress[difficulty].completed_levels.includes(level)) {
        progress[difficulty].completed_levels.push(level);
      }

      // 解锁下一关
      progress[difficulty].current_level = Math.max(
        progress[difficulty].current_level,
        Math.min(50, level + 1)
      );

      // 保存进度到智能存储系统
      await this.storage.saveProgress(progress);

      console.log(`✅ Level ${level} completion recorded with ${stars} stars`);

    } catch (error) {
      console.error('Failed to record level completion:', error);
    }
  }

  // 显示关卡完成对话框
  showLevelCompleteDialog(stars) {
    this.elements.completeTime.textContent = GameUtils.formatTime(this.gameState.elapsedTime);
    
    // 显示星级
    const starsText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.elements.completeStars.textContent = starsText;
    
    // 显示关卡信息
    this.elements.levelCompleteInfo.style.display = 'block';
    
    // 显示/隐藏下一关按钮
    const hasNextLevel = this.gameState.currentLevel < 50;
    this.elements.nextLevelBtn.style.display = hasNextLevel ? 'inline-block' : 'none';
    
    this.elements.gameComplete.style.display = 'flex';
  }

  // 显示完成对话框
  showCompleteDialog() {
    this.elements.completeTime.textContent = GameUtils.formatTime(this.gameState.elapsedTime);
    this.elements.gameComplete.style.display = 'flex';
  }

  // 键盘事件处理
  handleKeyboard(e) {
    if (this.gameState.isComplete) return;
    
    const key = e.key;
    
    // 数字输入
    if (key >= '1' && key <= '9') {
      e.preventDefault();
      this.inputNumber(parseInt(key));
    }
    
    // 删除/退格
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      this.eraseCell();
    }
    
    // 方向键移动
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      e.preventDefault();
      this.moveSelection(key);
    }
  }

  // 移动选择
  moveSelection(direction) {
    if (this.gameState.selectedCell === null) {
      this.gameState.selectedCell = 40; // 中心位置
      this.updateBoard();
      return;
    }
    
    let newIndex = this.gameState.selectedCell;
    const row = Math.floor(newIndex / 9);
    const col = newIndex % 9;
    
    switch (direction) {
      case 'ArrowUp':
        if (row > 0) newIndex -= 9;
        break;
      case 'ArrowDown':
        if (row < 8) newIndex += 9;
        break;
      case 'ArrowLeft':
        if (col > 0) newIndex -= 1;
        break;
      case 'ArrowRight':
        if (col < 8) newIndex += 1;
        break;
    }
    
    this.gameState.selectedCell = newIndex;
    this.updateBoard();
  }

  // 计时器
  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      if (this.gameState.startTime) {
        this.gameState.elapsedTime = Date.now() - this.gameState.startTime;
        this.elements.timer.textContent = GameUtils.formatTime(this.gameState.elapsedTime);
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pauseTimer() {
    if (this.gameState.startTime && !this.gameState.isComplete) {
      this.gameState.elapsedTime = Date.now() - this.gameState.startTime;
      this.gameState.startTime = null;
    }
  }

  resumeTimer() {
    if (!this.gameState.startTime && !this.gameState.isComplete) {
      this.gameState.startTime = Date.now() - this.gameState.elapsedTime;
    }
  }

  // 保存游戏（使用智能存储系统）
  async saveGame() {
    try {
      await this.storage.saveProgress(this.gameState);
    } catch (error) {
      console.error('Save game failed:', error);
    }
  }

  // 加载游戏（使用智能存储系统）
  async loadGame() {
    try {
      const saved = await this.storage.loadProgress();

      // 智能进度加载：关卡模式下只加载匹配当前关卡的进度
      if (saved && saved.puzzle && !saved.isComplete) {
        const shouldLoadProgress = this.gameState.isLevelMode ?
          (saved.difficulty === this.gameState.difficulty && saved.currentLevel === this.gameState.currentLevel) :
          true;

        if (shouldLoadProgress) {
          this.gameState = {
            ...saved,
            fixedCells: new Set(Array.from(saved.fixedCells || [])),
            conflicts: new Set(Array.from(saved.conflicts || [])),
            startTime: saved.startTime ? Date.now() - saved.elapsedTime : null
          };

          // 设置难度选择器
          this.elements.difficulty.value = this.gameState.difficulty;

          this.updateBoard();
          this.startTimer();
        }
      } else {
        // 检查是否是关卡模式，如果是则不要开始新游戏
        if (!this.gameState.isLevelMode) {
          // 只有在非关卡模式下才开始新游戏
          setTimeout(() => this.startNewGame(), 100);
        }
      }
    } catch (error) {
      console.error('Load game failed:', error);
      // 检查是否是关卡模式，如果是则不要开始新游戏
      if (!this.gameState.isLevelMode) {
        setTimeout(() => this.startNewGame(), 100);
      }
    }
  }

  // 保存统计数据（使用智能存储系统）
  async saveStats() {
    try {
      const stats = await this.storage.loadStats();

      stats.gamesPlayed++;
      stats.gamesWon++;
      stats.totalPlayTime += this.gameState.elapsedTime;

      const difficulty = this.gameState.difficulty;
      const currentTime = this.gameState.elapsedTime;

      if (!stats.bestTimes[difficulty] || currentTime < stats.bestTimes[difficulty]) {
        stats.bestTimes[difficulty] = currentTime;
      }

      await this.storage.saveStats(stats);
    } catch (error) {
      console.error('Save stats failed:', error);
    }
  }

  // 显示加载动画
  showLoading() {
    this.elements.loading.classList.add('show');
  }

  // 隐藏加载动画
  hideLoading() {
    this.elements.loading.classList.remove('show');
  }
}

// 全局函数（供HTML调用）
function closeCompleteDialog() {
  document.getElementById('game-complete').style.display = 'none';
}

function startNewGame() {
  closeCompleteDialog();
  game.startNewGame();
}

function goToNextLevel() {
  if (game.gameState.isLevelMode && game.gameState.currentLevel < 50) {
    const nextLevel = game.gameState.currentLevel + 1;
    window.location.href = `index.html?difficulty=${game.gameState.difficulty}&level=${nextLevel}`;
  } else {
    closeCompleteDialog();
  }
}

// 游戏初始化
let game;
document.addEventListener('DOMContentLoaded', () => {
  game = new SudokuGame();
});