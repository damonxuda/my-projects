// 数字华容道游戏UI控制器
// 管理游戏界面、用户交互、计时、星级评分等

class Puzzle15Game {
  constructor() {
    this.engine = null;
    this.storage = null;
    this.difficulty = 'easy';
    this.levelNumber = 1;
    this.levelConfig = null;
    this.timer = null;
    this.startTime = null;
    this.elapsedTime = 0;
    this.isPlaying = false;
    this.currentStars = 0;
    this.selectedTile = null; // 记录选中的数字块位置
    this.solver = new PuzzleSolver(); // A*求解器
    this.currentSolution = null; // 当前解法路径
    this.solutionStepIndex = 0; // 当前解法步骤索引

    // 等待Clerk初始化
    this.waitForClerkAndInit();
  }

  waitForClerkAndInit() {
    const startInit = () => {
      console.log('🎮 开始初始化数字华容道游戏');

      // 初始化存储系统
      try {
        this.storage = new SmartGameStorageEdgeFunction('puzzle15');
        console.log('✅ SmartGameStorageEdgeFunction 创建成功');
      } catch (error) {
        console.error('❌ 存储系统初始化失败:', error);
        throw error; // 如果Edge Function不可用，应该完全失败而不是fallback
      }

      this.init();
    };

    let gameStarted = false;
    const forceStartGame = () => {
      if (!gameStarted) {
        gameStarted = true;
        startInit();
      }
    };

    if (window.clerkInitialized) {
      forceStartGame();
    } else {
      window.addEventListener('clerkReady', forceStartGame, { once: true });
      setTimeout(forceStartGame, 3000);
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        setTimeout(forceStartGame, 1000);
      }
    }
  }

  async init() {
    // 获取URL参数
    const urlParams = new URLSearchParams(window.location.search);
    this.difficulty = urlParams.get('difficulty') || 'easy';
    this.levelNumber = parseInt(urlParams.get('level')) || 1;

    // 加载关卡
    this.loadLevel();

    // 初始化事件监听
    this.initEventListeners();

    // 尝试恢复游戏进度
    await this.loadProgress();
  }

  loadLevel() {
    try {
      // 生成关卡配置
      this.levelConfig = levelGenerator.generateLevel(this.difficulty, this.levelNumber);
      console.log('[puzzle15] 关卡配置:', {
        difficulty: this.difficulty,
        level: this.levelNumber,
        size: this.levelConfig.size,
        shuffleMoves: this.levelConfig.shuffleMoves,
        seed: this.levelConfig.seed
      });

      // 创建游戏引擎
      this.engine = new Puzzle15Engine(this.levelConfig.size);

      // 使用种子打乱棋盘（保证每次相同关卡题目一致）
      this.engine.shuffle(this.levelConfig.shuffleMoves, this.levelConfig.seed);

      // 更新UI
      this.updateLevelInfo();
      this.renderBoard();
      this.updateStats();
      this.updateStars();

      // 启动计时器
      this.startTimer();
    } catch (error) {
      console.error('加载关卡失败:', error);
      alert('加载关卡失败，返回关卡选择页面');
      window.location.href = 'levels.html';
    }
  }

  updateLevelInfo() {
    const diffConfig = PUZZLE15_DIFFICULTIES[this.difficulty];
    document.getElementById('difficultyName').textContent = diffConfig.name;
    document.getElementById('levelNumber').textContent = this.levelNumber;

    // 更新棋盘大小样式
    const board = document.getElementById('board');
    board.className = 'board size-' + this.levelConfig.size;
  }

  renderBoard() {
    const boardGrid = document.getElementById('boardGrid');
    boardGrid.innerHTML = '';

    // 设置网格布局
    boardGrid.style.gridTemplateColumns = 'repeat(' + this.levelConfig.size + ', 1fr)';
    boardGrid.style.gridTemplateRows = 'repeat(' + this.levelConfig.size + ', 1fr)';

    // 计算瓷砖大小
    const maxBoardSize = 360;
    const tileSize = Math.floor((maxBoardSize - (this.levelConfig.size + 1) * 6) / this.levelConfig.size);
    boardGrid.style.width = maxBoardSize + 'px';
    boardGrid.style.height = maxBoardSize + 'px';

    // 创建所有瓷砖
    const board = this.engine.getBoard();
    for (let r = 0; r < this.levelConfig.size; r++) {
      for (let c = 0; c < this.levelConfig.size; c++) {
        const tile = this.createTile(r, c, board[r][c]);
        boardGrid.appendChild(tile);
      }
    }
  }

  createTile(row, col, value) {
    const tile = document.createElement('div');
    tile.className = value === 0 ? 'tile empty' : 'tile';
    tile.dataset.row = row;
    tile.dataset.col = col;

    // 如果是选中的数字块，添加selected类
    if (this.selectedTile && this.selectedTile.row === row && this.selectedTile.col === col) {
      tile.classList.add('selected');
    }

    // 所有格子都可以点击
    tile.addEventListener('click', () => this.handleTileClick(row, col));

    if (value !== 0) {
      tile.textContent = value;
    }

    return tile;
  }

  handleTileClick(row, col) {
    if (!this.isPlaying) return;

    const clickedValue = this.engine.getTile(row, col);

    // 情况1: 点击空格
    if (clickedValue === 0) {
      // 如果之前选中了数字块，尝试移动到空格
      if (this.selectedTile) {
        const success = this.engine.moveTile(this.selectedTile.row, this.selectedTile.col);
        if (success) {
          this.selectedTile = null;
          this.renderBoard();
          this.updateStats();
          this.updateStars();
          this.checkWin();
        } else {
          // 移动失败，取消选中
          this.selectedTile = null;
          this.renderBoard();
        }
      }
      return;
    }

    // 情况2: 点击数字块
    // 如果这个数字块与空格相邻，记录选中状态
    const emptyRow = this.engine.emptyRow;
    const emptyCol = this.engine.emptyCol;
    const rowDiff = Math.abs(row - emptyRow);
    const colDiff = Math.abs(col - emptyCol);
    const isAdjacent = (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);

    if (isAdjacent) {
      this.selectedTile = { row, col };
      this.renderBoard();
    }
  }

  updateStats() {
    document.getElementById('moveCount').textContent = this.engine.getMoveCount();
  }

  updateStars() {
    const seconds = Math.floor(this.elapsedTime / 1000);
    const stars = calculateStars(seconds, this.difficulty);

    const starsDisplay = document.getElementById('starsDisplay');
    const starElements = starsDisplay.querySelectorAll('.star');

    starElements.forEach((star, index) => {
      if (index < stars) {
        star.classList.add('filled');
      } else {
        star.classList.remove('filled');
      }
    });

    this.currentStars = stars;
  }

  startTimer() {
    this.startTime = Date.now() - this.elapsedTime;
    this.isPlaying = true;

    this.timer = setInterval(() => {
      if (this.isPlaying) {
        this.elapsedTime = Date.now() - this.startTime;
        this.updateTimerDisplay();
        this.updateStars();
      }
    }, 1000);
  }

  stopTimer() {
    this.isPlaying = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  updateTimerDisplay() {
    const seconds = Math.floor(this.elapsedTime / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    document.getElementById('timer').textContent =
      minutes.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
  }

  async checkWin() {
    if (this.engine.checkWin()) {
      this.stopTimer();

      const finalTime = this.elapsedTime;
      const finalMoves = this.engine.getMoveCount();
      const finalStars = this.currentStars;

      // 显示胜利提示
      this.showVictory(finalTime, finalMoves, finalStars);

      // 保存记录
      await this.saveRecord(finalTime, finalMoves, finalStars);
    }
  }

  showVictory(time, moves, stars) {
    const seconds = Math.floor(time / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    document.getElementById('finalTime').textContent = minutes + '分' + secs + '秒';
    document.getElementById('finalMoves').textContent = moves + '步';

    // 显示星星
    const victoryStars = document.getElementById('victoryStars');
    victoryStars.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const star = document.createElement('span');
      star.textContent = '★';
      star.style.color = i < stars ? '#ffd93d' : '#ddd';
      victoryStars.appendChild(star);
    }

    const modal = document.getElementById('victoryModal');
    modal.classList.add('show');
  }

  hideVictory() {
    const modal = document.getElementById('victoryModal');
    modal.classList.remove('show');
  }

  async saveRecord(time, moves, stars) {
    if (!this.storage) return;

    try {
      // 加载整个进度对象
      let progress = await this.storage.load('progress') || { records: {}, currentLevels: {} };
      if (!progress.records) progress.records = {};
      if (!progress.currentLevels) progress.currentLevels = {};

      const levelKey = this.difficulty + '_' + this.levelNumber;
      const record = progress.records[levelKey] || {};
      let isNewRecord = false;

      // 更新最佳时间
      if (!record.bestTime || time < record.bestTime) {
        record.bestTime = time;
        isNewRecord = true;
      }

      // 更新最少步数
      if (!record.bestMoves || moves < record.bestMoves) {
        record.bestMoves = moves;
        isNewRecord = true;
      }

      // 更新最高星级
      if (!record.bestStars || stars > record.bestStars) {
        record.bestStars = stars;
        isNewRecord = true;
      }

      // 标记为已完成
      record.completed = true;

      // 保存到records中
      progress.records[levelKey] = record;

      // 更新当前难度的进度
      const currentLevel = progress.currentLevels[this.difficulty] || 1;
      if (this.levelNumber >= currentLevel) {
        progress.currentLevels[this.difficulty] = this.levelNumber + 1;
      }

      // 保存整个进度对象
      await this.storage.save('progress', progress);

      if (isNewRecord) {
        document.getElementById('newRecordText').style.display = 'block';
      }
    } catch (error) {
      console.error('保存记录失败:', error);
    }
  }

  async updateProgress() {
    // 已合并到saveRecord中，保留空函数避免调用错误
  }

  async loadProgress() {
    // 这里可以加载之前未完成的游戏状态
    // 暂时不实现，让玩家每次都是新游戏
  }

  initEventListeners() {
    // 重置按钮
    document.getElementById('resetBtn').addEventListener('click', () => {
      this.resetGame();
    });

    // 撤销按钮
    document.getElementById('undoBtn').addEventListener('click', () => {
      if (this.engine.undo()) {
        this.renderBoard();
        this.updateStats();
        // 撤销后重新计算解法
        this.currentSolution = null;
      }
    });

    // 提示按钮
    document.getElementById('hintBtn').addEventListener('click', () => {
      this.showHint();
    });

    // 关闭提示面板
    document.getElementById('closeHintBtn').addEventListener('click', () => {
      this.closeHint();
    });

    // 关卡列表按钮
    document.getElementById('levelsBtn').addEventListener('click', () => {
      window.location.href = 'levels.html?difficulty=' + this.difficulty;
    });

    // 胜利弹窗按钮
    document.getElementById('retryBtn').addEventListener('click', () => {
      this.hideVictory();
      this.resetGame();
    });

    document.getElementById('nextLevelBtn').addEventListener('click', () => {
      this.hideVictory();
      const nextLevel = this.levelNumber + 1;
      const maxLevels = levelGenerator.getTotalLevels();

      if (nextLevel <= maxLevels) {
        window.location.href = 'index.html?difficulty=' + this.difficulty + '&level=' + nextLevel;
      } else {
        // 如果是最后一关，返回关卡列表
        window.location.href = 'levels.html?difficulty=' + this.difficulty;
      }
    });
  }

  resetGame() {
    this.engine.reset(this.levelConfig.shuffleMoves);
    this.elapsedTime = 0;
    this.stopTimer();
    this.startTimer();
    this.renderBoard();
    this.updateStats();
    this.updateStars();
    // 重置后清空解法
    this.currentSolution = null;
    this.solutionStepIndex = 0;
  }

  // 显示提示面板
  showHint() {
    const panel = document.getElementById('hintPanel');
    const content = document.getElementById('hintContent');

    // 显示面板
    panel.classList.add('show');

    // 显示加载中
    content.innerHTML = '<div class="hint-loading">🧠 正在分析棋盘，请稍候...</div>';

    // 使用setTimeout让UI先更新
    setTimeout(() => {
      this.calculateAndDisplayHint(content);
    }, 100);
  }

  // 计算并显示提示
  calculateAndDisplayHint(content) {
    // 如果已有解法，且棋盘状态未变，继续使用当前解法
    if (!this.currentSolution) {
      const currentBoard = this.engine.getBoard();
      const result = this.solver.solve(currentBoard);

      if (!result.success) {
        content.innerHTML = `
          <div class="hint-error">
            <strong>❌ ${result.message}</strong>
          </div>
        `;
        return;
      }

      this.currentSolution = result.path;
      this.solutionStepIndex = 0;
    }

    // 更新步骤索引，跳过已完成的步骤
    const currentBoard = this.engine.getBoard();
    this.updateSolutionIndex(currentBoard);

    // 获取下一步提示
    const hint = this.solver.getNextHint(
      currentBoard,
      this.currentSolution.slice(this.solutionStepIndex)
    );

    if (!hint) {
      content.innerHTML = `
        <div class="hint-strategy">
          <div class="hint-strategy-title">🎉 完成！</div>
          <div class="hint-strategy-text">恭喜，已经完成拼图！</div>
        </div>
      `;
      return;
    }

    // 生成策略说明
    const strategy = this.solver.generateStrategy(
      this.currentSolution.slice(this.solutionStepIndex),
      this.levelConfig.size
    );

    // 显示提示内容
    content.innerHTML = `
      <div class="hint-strategy">
        <div class="hint-strategy-title">📋 总体策略</div>
        <div class="hint-strategy-text">${strategy}</div>
      </div>
      <div class="hint-next-move">
        <div class="hint-next-title">
          👉 下一步建议
        </div>
        <div class="hint-next-text">
          ${hint.description}
        </div>
      </div>
    `;
  }

  // 更新解法步骤索引（跳过已完成的步骤）
  updateSolutionIndex(currentBoard) {
    if (!this.currentSolution) return;

    // 通过比较棋盘状态来判断玩家是否按照解法移动了
    // 这里简化处理，每次重新从当前棋盘求解
    // 更准确的做法是追踪玩家的每一步移动
  }

  // 关闭提示面板
  closeHint() {
    const panel = document.getElementById('hintPanel');
    panel.classList.remove('show');
  }
}

// 初始化游戏
let game;
document.addEventListener('DOMContentLoaded', () => {
  game = new Puzzle15Game();
});
