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

    // 等待Clerk初始化
    this.waitForClerkAndInit();
  }

  waitForClerkAndInit() {
    const startInit = () => {
      console.log('🎮 开始初始化数字华容道游戏');

      // 初始化存储系统
      try {
        if (typeof SmartGameStorageEdgeFunction !== 'undefined') {
          this.storage = new SmartGameStorageEdgeFunction('puzzle15');
          console.log('✅ SmartGameStorageEdgeFunction 创建成功');
        } else {
          console.error('❌ 存储类不可用');
          this.storage = null;
        }
      } catch (error) {
        console.error('❌ 存储系统初始化失败:', error);
        this.storage = null;
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

      // 创建游戏引擎
      this.engine = new Puzzle15Engine(this.levelConfig.size);

      // 打乱棋盘
      this.engine.shuffle(this.levelConfig.shuffleMoves);

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
    board.className = `board size-${this.levelConfig.size}`;
  }

  renderBoard() {
    const boardGrid = document.getElementById('boardGrid');
    boardGrid.innerHTML = '';

    // 设置网格布局
    boardGrid.style.gridTemplateColumns = `repeat(${this.levelConfig.size}, 1fr)`;
    boardGrid.style.gridTemplateRows = `repeat(${this.levelConfig.size}, 1fr)`;

    // 计算瓷砖大小
    const maxBoardSize = 360;
    const tileSize = Math.floor((maxBoardSize - (this.levelConfig.size + 1) * 6) / this.levelConfig.size);
    boardGrid.style.width = `${maxBoardSize}px`;
    boardGrid.style.height = `${maxBoardSize}px`;

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

    if (value !== 0) {
      tile.textContent = value;

      // 添加点击事件
      tile.addEventListener('click', () => this.handleTileClick(row, col));
    }

    return tile;
  }

  handleTileClick(row, col) {
    if (!this.isPlaying) return;

    const success = this.engine.moveTile(row, col);

    if (success) {
      this.renderBoard();
      this.updateStats();
      this.updateStars();
      this.checkWin();
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
      `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

    document.getElementById('finalTime').textContent = `${minutes}分${secs}秒`;
    document.getElementById('finalMoves').textContent = `${moves}步`;

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
      const levelKey = `${this.difficulty}_${this.levelNumber}`;
      const record = await this.storage.getUserData(levelKey) || {};

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

      await this.storage.saveUserData(levelKey, record);

      if (isNewRecord) {
        document.getElementById('newRecordText').style.display = 'block';
      }

      // 更新进度（用于关卡列表显示）
      await this.updateProgress();
    } catch (error) {
      console.error('保存记录失败:', error);
    }
  }

  async updateProgress() {
    if (!this.storage) return;

    try {
      // 保存当前难度的进度
      const progressKey = `progress_${this.difficulty}`;
      const progress = await this.storage.getUserData(progressKey) || {};

      if (!progress.maxLevel || this.levelNumber > progress.maxLevel) {
        progress.maxLevel = this.levelNumber;
        await this.storage.saveUserData(progressKey, progress);
      }
    } catch (error) {
      console.error('更新进度失败:', error);
    }
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
      }
    });

    // 关卡列表按钮
    document.getElementById('levelsBtn').addEventListener('click', () => {
      window.location.href = `levels.html?difficulty=${this.difficulty}`;
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
        window.location.href = `index.html?difficulty=${this.difficulty}&level=${nextLevel}`;
      } else {
        // 如果是最后一关，返回关卡列表
        window.location.href = `levels.html?difficulty=${this.difficulty}`;
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
  }
}

// 初始化游戏
let game;
document.addEventListener('DOMContentLoaded', () => {
  game = new Puzzle15Game();
});
