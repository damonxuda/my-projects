// 使用统一的智能存储系统 - SmartNonogramStorage
// (定义在 ../shared/js/smartGameStorage.js)


// 数织游戏UI控制器
// 管理游戏界面、用户交互和游戏状态

class NonogramGame {
  constructor() {
    this.engine = new NonogramEngine();
    this.storage = null; // 延迟初始化，等待Clerk准备就绪
    this.currentLevel = null;
    this.currentDifficulty = 'easy';
    this.levelNumber = 1;
    this.timer = null;
    this.isLoading = false;

    // UI元素引用
    this.elements = {};

    // 等待Clerk初始化完成后再开始游戏初始化
    this.waitForClerkAndInit();
  }

  // 等待Clerk初始化完成，然后开始游戏初始化
  waitForClerkAndInit() {
    const startInit = () => {
      console.log('🎮 开始初始化游戏 - Clerk状态:', window.clerkInitialized);

      // 现在可以安全地初始化存储系统了
      this.storage = new SmartNonogramStorage();

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

  async init() {
    try {
      // 获取URL参数
      this.parseURLParams();
      
      // 初始化UI元素
      this.initElements();
      
      // 初始化存储系统
      await this.initStorage();
      
      // 设置事件监听
      this.setupEventListeners();
      
      // 加载并开始游戏
      await this.loadAndStartGame();
      
    } catch (error) {
      console.error('NonogramGame initialization failed:', error);
      this.showError('游戏初始化失败，请刷新重试');
    }
  }

  // 解析URL参数
  parseURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    this.currentDifficulty = urlParams.get('difficulty') || 'easy';
    this.levelNumber = parseInt(urlParams.get('level') || '1');
    
    console.log('URL params:', { difficulty: this.currentDifficulty, level: this.levelNumber });
  }

  // 初始化UI元素
  initElements() {
    this.elements = {
      timer: document.getElementById('timer'),
      levelBadge: document.getElementById('level-badge'),
      currentDifficulty: document.getElementById('current-difficulty'),
      currentLevel: document.getElementById('current-level'),
      progressIndicator: document.getElementById('progress-indicator'),
      nonogramBoard: document.getElementById('nonogram-board'),
      loading: document.getElementById('loading'),
      gameComplete: document.getElementById('game-complete'),
      
      // 按钮
      hintBtn: document.getElementById('hint-btn'),
      checkBtn: document.getElementById('check-btn'),
      restartBtn: document.getElementById('restart-btn'),
      levelsBtn: document.getElementById('levels-btn'),
      fillMode: document.getElementById('fill-mode'),
      markMode: document.getElementById('mark-mode'),
      
      // 完成对话框
      completeTime: document.getElementById('complete-time'),
      completeStars: document.getElementById('complete-stars'),
      levelCompleteInfo: document.getElementById('level-complete-info'),
      nextLevelBtn: document.getElementById('next-level-btn'),
      puzzlePreview: document.getElementById('puzzle-preview')
    };
  }

  // 初始化存储系统（智能存储系统自动处理认证）
  async initStorage() {
    // 智能存储系统已经自动处理认证，无需额外初始化
    console.log('🧠 Using SmartNonogramStorage - authentication handled automatically');
  }

  // 设置事件监听
  setupEventListeners() {
    // 模式切换按钮
    this.elements.fillMode?.addEventListener('click', () => this.setGameMode('fill'));
    this.elements.markMode?.addEventListener('click', () => this.setGameMode('mark'));
    
    // 操作按钮
    this.elements.hintBtn?.addEventListener('click', () => this.showHint());
    this.elements.checkBtn?.addEventListener('click', () => this.checkSolution());
    this.elements.restartBtn?.addEventListener('click', () => this.restartGame());
    this.elements.levelsBtn?.addEventListener('click', () => this.goToLevels());
    
    // 智能存储系统自动处理认证状态变化
  }

  // 加载并开始游戏
  async loadAndStartGame() {
    try {
      this.showLoading(true);
      
      // 加载关卡数据
      await this.loadLevel(this.currentDifficulty, this.levelNumber);
      
      // 初始化游戏引擎
      if (this.currentLevel) {
        const success = this.engine.initGame(this.currentLevel);
        if (success) {
          this.renderGame();
          this.startTimer();
          this.updateUI();
        } else {
          throw new Error('Failed to initialize game engine');
        }
      } else {
        throw new Error('Failed to load level data');
      }
      
    } catch (error) {
      console.error('Failed to load and start game:', error);
      this.showError('加载关卡失败，请重试');
    } finally {
      this.showLoading(false);
    }
  }

  // 加载关卡数据
  async loadLevel(difficulty, levelNumber) {
    try {
      const response = await fetch(`../shared/levels/nonogram/${difficulty}.json`);
      if (!response.ok) throw new Error(`Failed to load ${difficulty} levels`);
      
      const levels = await response.json();
      this.currentLevel = levels.find(level => level.level === levelNumber);
      
      if (!this.currentLevel) {
        throw new Error(`Level ${levelNumber} not found in ${difficulty}`);
      }
      
      console.log('Loaded level:', this.currentLevel);
    } catch (error) {
      console.error('Failed to load level:', error);
      throw error;
    }
  }

  // 渲染游戏界面
  renderGame() {
    if (!this.currentLevel || !this.elements.nonogramBoard) return;

    const size = this.currentLevel.size;
    const rowClues = this.currentLevel.row_clues;
    const colClues = this.currentLevel.col_clues;
    
    // 计算最大线索长度用于布局
    const maxRowClueLength = Math.max(...rowClues.map(clues => clues.length));
    const maxColClueLength = Math.max(...colClues.map(clues => clues.length));
    
    // 设置网格布局
    const totalCols = maxRowClueLength + size;
    const totalRows = maxColClueLength + size;
    
    this.elements.nonogramBoard.style.gridTemplateColumns = `repeat(${totalCols}, 1fr)`;
    this.elements.nonogramBoard.style.gridTemplateRows = `repeat(${totalRows}, 1fr)`;
    
    // 清空现有内容
    this.elements.nonogramBoard.innerHTML = '';
    
    // 添加线索和游戏格子
    this.renderCluesAndCells(size, rowClues, colClues, maxRowClueLength, maxColClueLength);
    
    // 设置合适的尺寸
    this.adjustBoardSize();
  }

  // 渲染线索和游戏格子
  renderCluesAndCells(size, rowClues, colClues, maxRowClueLength, maxColClueLength) {
    const board = this.elements.nonogramBoard;
    
    // 渲染所有格子
    for (let row = 0; row < maxColClueLength + size; row++) {
      for (let col = 0; col < maxRowClueLength + size; col++) {
        const cell = document.createElement('div');
        
        if (row < maxColClueLength && col >= maxRowClueLength) {
          // 列线索区域
          const colIndex = col - maxRowClueLength;
          const clueIndex = row - (maxColClueLength - colClues[colIndex].length);
          
          cell.className = 'clue-col';
          if (clueIndex >= 0 && clueIndex < colClues[colIndex].length) {
            const clueSpan = document.createElement('span');
            clueSpan.className = 'clue-number';
            clueSpan.textContent = colClues[colIndex][clueIndex];
            cell.appendChild(clueSpan);
          }
          
        } else if (row >= maxColClueLength && col < maxRowClueLength) {
          // 行线索区域
          const rowIndex = row - maxColClueLength;
          const clueIndex = col - (maxRowClueLength - rowClues[rowIndex].length);
          
          cell.className = 'clue-row';
          if (clueIndex >= 0 && clueIndex < rowClues[rowIndex].length) {
            const clueSpan = document.createElement('span');
            clueSpan.className = 'clue-number';
            clueSpan.textContent = rowClues[rowIndex][clueIndex];
            cell.appendChild(clueSpan);
          }
          
        } else if (row >= maxColClueLength && col >= maxRowClueLength) {
          // 游戏区域
          const gameRow = row - maxColClueLength;
          const gameCol = col - maxRowClueLength;
          
          cell.className = 'nonogram-cell';
          cell.dataset.row = gameRow;
          cell.dataset.col = gameCol;
          
          // 添加分组边框（每5个格子一组）
          if ((gameCol + 1) % 5 === 0 && gameCol < size - 1) {
            cell.classList.add('border-right');
          }
          if ((gameRow + 1) % 5 === 0 && gameRow < size - 1) {
            cell.classList.add('border-bottom');
          }
          
          // 添加点击事件
          cell.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleCellClick(gameRow, gameCol);
          });
          
          // 添加触摸支持
          cell.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleCellClick(gameRow, gameCol);
          });
          
        } else {
          // 空白区域
          cell.className = 'clue-empty';
        }
        
        board.appendChild(cell);
      }
    }
  }

  // 调整游戏板尺寸
  adjustBoardSize() {
    const board = this.elements.nonogramBoard;
    const container = board.parentElement;
    
    const containerWidth = container.clientWidth - 20;
    const containerHeight = window.innerHeight * 0.6;
    
    const maxSize = Math.min(containerWidth, containerHeight);
    board.style.width = maxSize + 'px';
    board.style.height = maxSize + 'px';
    
    // 计算格子大小
    const size = this.currentLevel.size;
    const cellSize = Math.max(12, Math.floor(maxSize / (size + 8))); // 为线索留出空间
    
    // 设置字体大小
    const fontSize = Math.max(8, Math.floor(cellSize * 0.6));
    board.style.fontSize = fontSize + 'px';
  }

  // 处理格子点击
  handleCellClick(row, col) {
    console.log(`🖱️ 点击格子 (${row}, ${col}), 游戏已完成: ${this.engine.completed}`);
    if (this.engine.completed) return;

    const result = this.engine.clickCell(row, col);
    console.log(`🎯 点击结果:`, result);
    if (result.success) {
      this.updateCell(row, col, result.newState);
      this.updateProgress(result.progress);
      
      // 自动标记完成的行/列
      const autoMarked = this.engine.autoMarkCompleted();
      autoMarked.forEach(({ row, col }) => {
        this.updateCell(row, col, this.engine.CELL_STATES.MARKED);
      });
      
      // 检查是否完成
      console.log('🔍 检查游戏完成状态:', result.isComplete);
      if (result.isComplete) {
        console.log('✅ 游戏完成，调用handleGameComplete');
        this.handleGameComplete();
      } else {
        console.log('❌ 游戏尚未完成');
      }
    }
  }

  // 更新单个格子显示
  updateCell(row, col, state) {
    const cell = this.elements.nonogramBoard.querySelector(
      `[data-row="${row}"][data-col="${col}"]`
    );
    
    if (cell) {
      cell.classList.remove('filled', 'marked', 'error', 'hint');
      
      switch (state) {
        case this.engine.CELL_STATES.FILLED:
          cell.classList.add('filled');
          break;
        case this.engine.CELL_STATES.MARKED:
          cell.classList.add('marked');
          break;
      }
    }
  }

  // 设置游戏模式
  setGameMode(mode) {
    this.engine.setMode(mode);
    
    // 更新按钮状态
    this.elements.fillMode?.classList.toggle('active', mode === 'fill');
    this.elements.markMode?.classList.toggle('active', mode === 'mark');
  }

  // 显示提示
  showHint() {
    const hint = this.engine.giveHint();
    if (hint) {
      const cell = this.elements.nonogramBoard.querySelector(
        `[data-row="${hint.row}"][data-col="${hint.col}"]`
      );
      
      if (cell) {
        cell.classList.add('hint');
        setTimeout(() => {
          cell.classList.remove('hint');
          
          if (hint.action === 'fill') {
            this.engine.grid[hint.row][hint.col] = this.engine.CELL_STATES.FILLED;
            this.updateCell(hint.row, hint.col, this.engine.CELL_STATES.FILLED);
          } else if (hint.action === 'clear') {
            this.engine.grid[hint.row][hint.col] = this.engine.CELL_STATES.EMPTY;
            this.updateCell(hint.row, hint.col, this.engine.CELL_STATES.EMPTY);
          }
          
          this.updateProgress(this.engine.getProgress());
        }, 1000);
      }
    } else {
      this.showMessage('没有可用的提示了！');
    }
  }

  // 检查解决方案
  checkSolution() {
    const errors = this.engine.validateAndShowErrors();
    
    if (errors.length === 0) {
      this.showMessage('目前没有发现错误！', 'success');
    } else {
      // 标记错误格子
      errors.forEach(({ row, col }) => {
        const cell = this.elements.nonogramBoard.querySelector(
          `[data-row="${row}"][data-col="${col}"]`
        );
        if (cell) {
          cell.classList.add('error');
          setTimeout(() => {
            cell.classList.remove('error');
          }, 2000);
        }
      });
      
      this.showMessage(`发现 ${errors.length} 个错误！`, 'error');
    }
  }

  // 重开游戏
  restartGame() {
    if (confirm('确定要重新开始这一关吗？')) {
      this.engine.reset();
      this.renderGame();
      this.startTimer();
      this.updateUI();
    }
  }

  // 返回关卡选择
  goToLevels() {
    window.location.href = './levels.html';
  }

  // 处理游戏完成
  async handleGameComplete() {
    this.stopTimer();
    
    const stats = this.engine.getGameStats();
    const stars = this.engine.calculateStars(stats.timeElapsed, this.currentLevel.estimated_time || 300);
    
    // 保存进度
    try {
      await this.storage.updateLevelRecord(
        this.currentDifficulty,
        this.levelNumber,
        stats.timeElapsed,
        stars
      );

      // 强制同步到云端
      console.log('🔄 数织关卡完成，强制同步到云端');
      await this.storage.forceSyncNow();

      this.elements.levelCompleteInfo.style.display = 'block';
    } catch (error) {
      console.error('Failed to save progress:', error);
      this.elements.levelCompleteInfo.style.display = 'none';
    }
    
    // 显示完成对话框
    this.showCompleteDialog(stats.timeElapsed, stars);
  }

  // 显示完成对话框
  showCompleteDialog(timeElapsed, stars) {
    // 更新时间显示
    this.elements.completeTime.textContent = this.formatTime(timeElapsed);
    
    // 更新星级显示
    let starsHTML = '';
    for (let i = 0; i < 3; i++) {
      starsHTML += i < stars ? '★' : '☆';
    }
    this.elements.completeStars.innerHTML = starsHTML;
    this.elements.completeStars.style.color = stars >= 3 ? '#ffd700' : '#ff6b9d';
    
    // 生成预览图
    this.generatePuzzlePreview();
    
    // 显示下一关按钮（如果有）
    this.elements.nextLevelBtn.style.display = 
      this.levelNumber < 50 ? 'inline-block' : 'none';
    
    // 显示对话框
    this.elements.gameComplete.style.display = 'flex';
  }

  // 生成谜题预览
  generatePuzzlePreview() {
    const previewSize = 80;
    const canvas = document.createElement('canvas');
    canvas.width = previewSize;
    canvas.height = previewSize;
    canvas.style.border = '2px solid #ddd';
    canvas.style.borderRadius = '4px';
    
    const ctx = canvas.getContext('2d');
    const cellSize = previewSize / this.currentLevel.size;
    
    // 绘制解决方案
    for (let row = 0; row < this.currentLevel.size; row++) {
      for (let col = 0; col < this.currentLevel.size; col++) {
        if (this.currentLevel.solution[row][col] === 1) {
          ctx.fillStyle = '#333';
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }
    
    // 添加到预览容器
    this.elements.puzzlePreview.innerHTML = '';
    this.elements.puzzlePreview.appendChild(canvas);
  }

  // 开始计时器
  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      const stats = this.engine.getGameStats();
      this.elements.timer.textContent = this.formatTime(stats.timeElapsed);
    }, 1000);
  }

  // 停止计时器
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // 格式化时间显示
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // 更新UI显示
  updateUI() {
    // 更新关卡信息
    const difficultyNames = {
      easy: '简单',
      medium: '中等', 
      hard: '困难',
      expert: '专家',
      master: '大师'
    };
    
    if (this.elements.currentDifficulty) {
      this.elements.currentDifficulty.textContent = difficultyNames[this.currentDifficulty];
    }
    if (this.elements.currentLevel) {
      this.elements.currentLevel.textContent = this.levelNumber;
    }
    
    this.updateProgress(this.engine.getProgress());
  }

  // 更新进度显示
  updateProgress(progress) {
    const percentage = Math.round(progress * 100);
    if (this.elements.progressIndicator) {
      this.elements.progressIndicator.textContent = `${percentage}% 完成`;
    }
  }

  // 处理认证状态变化（智能存储系统自动处理）
  async handleAuthChange(isSignedIn) {
    // 智能存储系统已经自动处理认证状态变化
    console.log(`🔐 Nonogram Auth status changed: ${isSignedIn} - SmartStorage handling automatically`);
  }

  // 显示加载状态
  showLoading(show) {
    if (this.elements.loading) {
      this.elements.loading.classList.toggle('show', show);
    }
  }

  // 显示错误信息
  showError(message) {
    alert(message); // 简单实现，可以改为更美观的提示
  }

  // 显示消息
  showMessage(message, type = 'info') {
    // 简单实现，可以改为更美观的提示
    const color = type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3';
    
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${color};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 1000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 3000);
  }
}

// 全局函数（用于HTML中的事件处理）
function closeCompleteDialog() {
  const dialog = document.getElementById('game-complete');
  if (dialog) {
    dialog.style.display = 'none';
  }
}

function goToNextLevel() {
  if (window.nonogramGame) {
    const nextLevel = window.nonogramGame.levelNumber + 1;
    if (nextLevel <= 50) {
      window.location.href = `./index.html?difficulty=${window.nonogramGame.currentDifficulty}&level=${nextLevel}`;
    }
  }
}

function backToLevels() {
  window.location.href = './levels.html';
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.nonogramGame = new NonogramGame();
});

// 导出到全局作用域
if (typeof window !== 'undefined') {
  window.NonogramGame = NonogramGame;
}