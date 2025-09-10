// 数独游戏主逻辑 - 集成认证系统
class SudokuGame {
  constructor() {
    this.engine = new SudokuEngine();
    this.storage = new SudokuStorage(); // 保留作为备用
    this.authStorage = new AuthenticatedSudokuStorage();
    this.gameAuth = window.gameAuth; // 全局认证实例
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
    
    this.init();
  }

  // 初始化游戏
  async init() {
    this.initElements();
    this.initEventListeners();
    
    // 初始化认证系统
    await this.initAuth();
    
    await this.checkURLParams();
    console.log('🔍 After checkURLParams - isLevelMode:', this.gameState.isLevelMode);
    console.log('🔍 After checkURLParams - board length:', this.gameState.board?.length || 0);
    this.loadGame();
    console.log('🔍 After loadGame - board length:', this.gameState.board?.length || 0);
    this.createBoard();
    
    // 确保棋盘显示正确的数据
    if (this.gameState.board && this.gameState.board.length > 0) {
      this.updateBoard();
      console.log('🎯 Initial board update after createBoard');
    }
  }

  // 初始化认证系统
  async initAuth() {
    try {
      // 检查认证系统是否存在
      if (!this.gameAuth) {
        console.warn('⚠️ GameAuth not available, continuing without auth');
        this.isAuthReady = false;
        return;
      }
      
      // 等待认证系统初始化
      if (!this.gameAuth.isInitialized) {
        console.log('🔐 Waiting for auth system initialization...');
        
        // 等待最多5秒钟认证系统初始化
        let attempts = 0;
        while (!this.gameAuth.isInitialized && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!this.gameAuth.isInitialized) {
          console.warn('⚠️ Auth system initialization timeout, continuing without auth');
          this.isAuthReady = false;
          return;
        }
      }
      
      // 如果认证系统可用，初始化认证存储
      if (this.gameAuth && this.gameAuth.isInitialized) {
        const supabaseClient = this.gameAuth.getSupabaseClient();
        if (supabaseClient) {
          await this.authStorage.initialize(this.gameAuth, supabaseClient);
          this.isAuthReady = true;
          console.log('✅ Authenticated storage initialized');
        }
      }
      
      // 监听认证状态变化
      if (this.gameAuth) {
        this.gameAuth.onAuthChange((isSignedIn) => {
          console.log(`🔐 Auth status changed: ${isSignedIn}`);
          this.handleAuthChange(isSignedIn);
        });
      }
      
    } catch (error) {
      console.warn('Auth initialization failed, using local storage:', error);
      this.isAuthReady = false;
    }
  }

  // 处理认证状态变化
  async handleAuthChange(isSignedIn) {
    if (isSignedIn && !this.isAuthReady) {
      // 用户登录，重新初始化认证存储
      try {
        const supabaseClient = this.gameAuth.getSupabaseClient();
        if (supabaseClient) {
          await this.authStorage.initialize(this.gameAuth, supabaseClient);
          this.isAuthReady = true;
          
          // 同步本地数据到云端
          console.log('🔄 Syncing local data to cloud...');
          await this.authStorage.syncFromCloud();
        }
      } catch (error) {
        console.error('Failed to initialize auth storage after login:', error);
      }
    } else if (!isSignedIn) {
      // 用户登出，切换回本地存储
      this.isAuthReady = false;
      console.log('🔐 User signed out, using local storage');
    }
  }

  // 检查URL参数（关卡模式）
  async checkURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const difficulty = urlParams.get('difficulty');
    const level = urlParams.get('level');
    
    console.log('🔍 URL params - difficulty:', difficulty, 'level:', level);
    
    if (difficulty && level) {
      console.log('🎯 Entering level mode');
      this.gameState.isLevelMode = true;
      this.gameState.difficulty = difficulty;
      this.gameState.currentLevel = parseInt(level);
      
      // 加载关卡数据
      await this.loadLevelData(difficulty, parseInt(level));
      console.log('✅ Level data loaded, board length:', this.gameState.board?.length || 0);
      this.updateUIForLevelMode();
    } else {
      console.log('❌ No URL params for level mode');
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
        console.log(`🔄 Loaded ${difficulty} levels from server with cache-busting`);
      }
      
      const levelData = this.levels[difficulty].find(l => l.level === levelNumber);
      if (!levelData) {
        throw new Error(`Level ${levelNumber} not found`);
      }
      
      // 调试信息：显示第一行数据
      console.log(`🎯 Loading ${difficulty} level ${levelNumber}`);
      console.log('📋 First row of puzzle:', levelData.puzzle[0]);
      const emptyCount = levelData.puzzle.flat().filter(cell => cell === 0).length;
      console.log(`🔢 Empty cells count: ${emptyCount}`);
      
      // 强制在页面上显示调试信息
      const debugDiv = document.createElement('div');
      debugDiv.id = 'debug-info';
      debugDiv.style.cssText = 'position:fixed;top:10px;left:10px;background:red;color:white;padding:10px;z-index:9999;font-size:12px;';
      debugDiv.innerHTML = `
        <strong>调试信息:</strong><br>
        关卡: ${difficulty} Level ${levelNumber}<br>
        第一行: [${levelData.puzzle[0].join(', ')}]<br>
        空格数: ${emptyCount}<br>
        <button onclick="this.parentElement.remove()">关闭</button>
      `;
      document.body.appendChild(debugDiv);
      
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
      
      console.log(`✅ Level ${levelNumber} loaded:`, levelData);
      
      // 调试：验证实际加载的puzzle数据
      const actualZeros = levelData.puzzle.flat().filter(cell => cell === 0).length;
      const actualFilled = levelData.puzzle.flat().filter(cell => cell !== 0).length;
      console.log(`🔍 Actual puzzle analysis: ${actualZeros} zeros, ${actualFilled} filled`);
      console.log(`🔍 Expected: 28 zeros, 53 filled`);
      
      if (actualZeros !== 28) {
        console.error(`❌ Data mismatch! Expected 28 zeros but got ${actualZeros}`);
        console.log(`🔍 First row of puzzle:`, levelData.puzzle[0]);
      }
      
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
    
    console.log('✅ DOM elements initialized successfully');
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
    
    console.log(`✅ Created ${this.elements.board.children.length} cells`);
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

  // 记录关卡完成（使用认证存储系统）
  async recordLevelCompletion(stars) {
    if (!this.gameState.isLevelMode) return;
    
    try {
      const timeInSeconds = Math.floor(this.gameState.elapsedTime / 1000);
      
      if (this.isAuthReady) {
        // 使用认证存储系统
        await this.authStorage.updateLevelRecord(
          this.gameState.difficulty,
          this.gameState.currentLevel,
          timeInSeconds,
          stars
        );
        console.log('✅ Level progress saved to cloud');
      } else {
        // 回退到本地存储（使用SudokuLevelsManager如果可用）
        if (window.SudokuLevelsManager) {
          window.SudokuLevelsManager.recordCompletion(
            this.gameState.difficulty,
            this.gameState.currentLevel,
            this.gameState.elapsedTime
          );
        }
        console.log('✅ Level progress saved locally');
      }
    } catch (error) {
      console.error('Failed to record level completion:', error);
      
      // 回退到本地存储
      if (window.SudokuLevelsManager) {
        window.SudokuLevelsManager.recordCompletion(
          this.gameState.difficulty,
          this.gameState.currentLevel,
          this.gameState.elapsedTime
        );
      }
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

  // 保存游戏（使用认证存储系统）
  async saveGame() {
    try {
      if (this.isAuthReady) {
        await this.authStorage.saveProgress(this.gameState);
      } else {
        // 回退到本地存储
        this.storage.saveProgress(this.gameState);
      }
    } catch (error) {
      console.error('Save game failed:', error);
      // 回退到本地存储
      this.storage.saveProgress(this.gameState);
    }
  }

  // 加载游戏（使用认证存储系统）
  async loadGame() {
    try {
      let saved = null;
      
      if (this.isAuthReady) {
        saved = await this.authStorage.loadProgress();
      } else {
        saved = this.storage.loadProgress();
      }
      
      if (saved && saved.puzzle && !saved.isComplete) {
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
      } else {
        // 检查是否是关卡模式，如果是则不要开始新游戏
        if (!this.gameState.isLevelMode) {
          // 只有在非关卡模式下才开始新游戏
          setTimeout(() => this.startNewGame(), 100);
        }
      }
    } catch (error) {
      console.error('Load game failed:', error);
      // 回退到本地存储
      const saved = this.storage.loadProgress();
      if (saved && saved.puzzle && !saved.isComplete) {
        this.gameState = {
          ...saved,
          fixedCells: new Set(Array.from(saved.fixedCells || [])),
          conflicts: new Set(Array.from(saved.conflicts || [])),
          startTime: saved.startTime ? Date.now() - saved.elapsedTime : null
        };
        this.elements.difficulty.value = this.gameState.difficulty;
        this.updateBoard();
        this.startTimer();
      } else {
        // 检查是否是关卡模式，如果是则不要开始新游戏
        if (!this.gameState.isLevelMode) {
          setTimeout(() => this.startNewGame(), 100);
        }
      }
    }
  }

  // 保存统计数据（使用认证存储系统）
  async saveStats() {
    try {
      let stats;
      
      if (this.isAuthReady) {
        stats = await this.authStorage.loadStats();
      } else {
        stats = this.storage.loadStats();
      }
      
      stats.gamesPlayed++;
      stats.gamesWon++;
      stats.totalPlayTime += this.gameState.elapsedTime;
      
      const difficulty = this.gameState.difficulty;
      const currentTime = this.gameState.elapsedTime;
      
      if (!stats.bestTimes[difficulty] || currentTime < stats.bestTimes[difficulty]) {
        stats.bestTimes[difficulty] = currentTime;
      }
      
      if (this.isAuthReady) {
        await this.authStorage.saveStats(stats);
      } else {
        this.storage.saveStats(stats);
      }
    } catch (error) {
      console.error('Save stats failed:', error);
      // 回退到本地存储
      const stats = this.storage.loadStats();
      stats.gamesPlayed++;
      stats.gamesWon++;
      stats.totalPlayTime += this.gameState.elapsedTime;
      
      const difficulty = this.gameState.difficulty;
      const currentTime = this.gameState.elapsedTime;
      
      if (!stats.bestTimes[difficulty] || currentTime < stats.bestTimes[difficulty]) {
        stats.bestTimes[difficulty] = currentTime;
      }
      
      this.storage.saveStats(stats);
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