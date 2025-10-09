// 华容道游戏UI控制器
// 管理游戏界面、用户交互和游戏状态

class KlotskiGame {
  constructor() {
    this.engine = null;
    this.storage = null;
    this.currentLevel = null;
    this.levelNumber = 1;
    this.timer = null;
    this.startTime = null;
    this.elapsedTime = 0;
    this.isPlaying = false;
    this.cellSize = 70; // 每个格子的大小（像素）
    this.gap = 4; // 格子间隙

    // 拖动相关状态
    this.draggedBlock = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.blockStartRow = 0;
    this.blockStartCol = 0;

    // 等待Clerk初始化
    this.waitForClerkAndInit();
  }

  waitForClerkAndInit() {
    const startInit = () => {
      console.log('🎮 开始初始化华容道游戏');

      // 初始化存储系统
      try {
        if (typeof SmartGameStorageEdgeFunction !== 'undefined') {
          this.storage = new SmartGameStorageEdgeFunction('klotski');
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
    // 获取URL参数中的关卡号
    const urlParams = new URLSearchParams(window.location.search);
    this.levelNumber = parseInt(urlParams.get('level')) || 1;

    // 加载关卡
    this.loadLevel(this.levelNumber);

    // 初始化事件监听
    this.initEventListeners();

    // 尝试恢复游戏进度
    await this.loadProgress();
  }

  loadLevel(levelNumber) {
    // 查找关卡数据
    this.currentLevel = KLOTSKI_LEVELS.find(l => l.id === levelNumber);
    if (!this.currentLevel) {
      console.error('关卡不存在:', levelNumber);
      this.currentLevel = KLOTSKI_LEVELS[0];
    }

    // 创建游戏引擎
    this.engine = new KlotskiEngine(this.currentLevel);

    // 更新UI
    this.updateLevelInfo();
    this.renderBoard();
    this.renderBlocks();
    this.updateStats();

    // 启动计时器
    this.startTimer();
  }

  updateLevelInfo() {
    document.getElementById('levelTitle').textContent = this.currentLevel.name;
    document.getElementById('levelDesc').textContent = this.currentLevel.description;
    document.getElementById('minMoves').textContent = this.currentLevel.minMoves;
  }

  renderBoard() {
    const boardGrid = document.getElementById('boardGrid');
    boardGrid.innerHTML = '';

    // 计算棋盘大小
    const totalWidth = this.cellSize * KLOTSKI_CONFIG.boardCols + this.gap * (KLOTSKI_CONFIG.boardCols + 1);
    const totalHeight = this.cellSize * KLOTSKI_CONFIG.boardRows + this.gap * (KLOTSKI_CONFIG.boardRows + 1);

    boardGrid.style.width = `${totalWidth}px`;
    boardGrid.style.height = `${totalHeight}px`;

    // 创建棋盘格子
    for (let r = 0; r < KLOTSKI_CONFIG.boardRows; r++) {
      for (let c = 0; c < KLOTSKI_CONFIG.boardCols; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.width = `${this.cellSize}px`;
        cell.style.height = `${this.cellSize}px`;

        boardGrid.appendChild(cell);
      }
    }
  }

  renderBlocks() {
    const board = document.querySelector('.board');

    // 移除现有方块
    const oldBlocks = board.querySelectorAll('.block');
    oldBlocks.forEach(block => block.remove());

    // 渲染所有方块
    const blocks = this.engine.getAllBlocks();
    blocks.forEach(block => {
      const blockEl = this.createBlockElement(block);
      board.appendChild(blockEl);
    });
  }

  createBlockElement(block) {
    const blockEl = document.createElement('div');
    blockEl.className = 'block';
    blockEl.id = `block-${block.id}`;
    blockEl.dataset.blockId = block.id;

    // 设置样式
    if (block.id === 'caocao') {
      blockEl.classList.add('caocao');
    }

    // 设置颜色
    blockEl.style.background = block.color;

    // 设置尺寸和位置
    this.updateBlockPosition(blockEl, block);

    // 设置方块文字
    blockEl.textContent = block.name;

    // 添加拖动事件
    this.addDragListeners(blockEl);

    return blockEl;
  }

  updateBlockPosition(blockEl, block) {
    const [row, col] = block.position;
    const [height, width] = block.shape;

    const left = col * (this.cellSize + this.gap) + this.gap;
    const top = row * (this.cellSize + this.gap) + this.gap;
    const blockWidth = width * this.cellSize + (width - 1) * this.gap;
    const blockHeight = height * this.cellSize + (height - 1) * this.gap;

    blockEl.style.left = `${left}px`;
    blockEl.style.top = `${top}px`;
    blockEl.style.width = `${blockWidth}px`;
    blockEl.style.height = `${blockHeight}px`;
  }

  addDragListeners(blockEl) {
    const blockId = blockEl.dataset.blockId;

    // 触摸事件
    blockEl.addEventListener('touchstart', (e) => this.handleDragStart(e, blockId), { passive: false });
    blockEl.addEventListener('touchmove', (e) => this.handleDragMove(e), { passive: false });
    blockEl.addEventListener('touchend', (e) => this.handleDragEnd(e), { passive: false });

    // 鼠标事件
    blockEl.addEventListener('mousedown', (e) => this.handleDragStart(e, blockId));
    document.addEventListener('mousemove', (e) => this.handleDragMove(e));
    document.addEventListener('mouseup', (e) => this.handleDragEnd(e));
  }

  handleDragStart(e, blockId) {
    e.preventDefault();

    const block = this.engine.getBlock(blockId);
    if (!block) return;

    this.draggedBlock = blockId;
    const [row, col] = block.position;
    this.blockStartRow = row;
    this.blockStartCol = col;

    // 获取触摸/鼠标位置
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    this.dragStartX = clientX;
    this.dragStartY = clientY;

    // 添加拖动样式
    const blockEl = document.getElementById(`block-${blockId}`);
    if (blockEl) {
      blockEl.classList.add('dragging');
    }
  }

  handleDragMove(e) {
    if (!this.draggedBlock) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - this.dragStartX;
    const deltaY = clientY - this.dragStartY;

    const blockEl = document.getElementById(`block-${this.draggedBlock}`);
    if (blockEl) {
      blockEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    }
  }

  handleDragEnd(e) {
    if (!this.draggedBlock) return;
    e.preventDefault();

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    const deltaX = clientX - this.dragStartX;
    const deltaY = clientY - this.dragStartY;

    // 计算移动的格子数（同时计算横向和纵向，支持L型移动）
    const moveThreshold = this.cellSize / 3;  // 最小触发阈值
    let deltaRow = 0;
    let deltaCol = 0;

    // 分别计算横向和纵向的移动格数（而不是只选择主要方向）
    if (Math.abs(deltaX) > moveThreshold) {
      deltaCol = Math.round(deltaX / (this.cellSize + this.gap));
    }
    if (Math.abs(deltaY) > moveThreshold) {
      deltaRow = Math.round(deltaY / (this.cellSize + this.gap));
    }

    // 尝试移动方块
    if (deltaRow !== 0 || deltaCol !== 0) {
      const success = this.engine.moveBlockByDrag(this.draggedBlock, deltaRow, deltaCol);
      if (success) {
        this.updateStats();
        this.renderBlocks();
        this.checkWin();
      }
    }

    // 移除拖动样式和transform
    const blockEl = document.getElementById(`block-${this.draggedBlock}`);
    if (blockEl) {
      blockEl.classList.remove('dragging');
      blockEl.style.transform = '';
    }

    this.draggedBlock = null;
  }

  updateStats() {
    document.getElementById('moveCount').textContent = this.engine.getMoveCount();
  }

  startTimer() {
    this.startTime = Date.now() - this.elapsedTime;
    this.isPlaying = true;

    this.timer = setInterval(() => {
      if (this.isPlaying) {
        this.elapsedTime = Date.now() - this.startTime;
        this.updateTimerDisplay();
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

      // 显示胜利提示
      this.showVictory(finalTime, finalMoves);

      // 保存记录
      await this.saveRecord(finalTime, finalMoves);
    }
  }

  showVictory(time, moves) {
    const seconds = Math.floor(time / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    document.getElementById('finalTime').textContent = `${minutes}分${secs}秒`;
    document.getElementById('finalMoves').textContent = `${moves}步`;

    const modal = document.getElementById('victoryModal');
    modal.classList.add('show');
  }

  hideVictory() {
    const modal = document.getElementById('victoryModal');
    modal.classList.remove('show');
  }

  async saveRecord(time, moves) {
    if (!this.storage) return;

    try {
      // 加载整个进度对象
      let progress = await this.storage.load('progress') || { records: {} };
      if (!progress.records) {
        progress.records = {};
      }

      const record = progress.records[this.levelNumber] || {};
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

      // 标记为已完成
      record.completed = true;

      // 保存回进度对象
      progress.records[this.levelNumber] = record;
      await this.storage.save('progress', progress);

      if (isNewRecord) {
        document.getElementById('newRecordText').style.display = 'block';
      }
    } catch (error) {
      console.error('保存记录失败:', error);
    }
  }

  async loadProgress() {
    if (!this.storage) return;

    try {
      // 从整个进度对象中加载
      const progress = await this.storage.load('progress');
      const record = progress?.records?.[this.levelNumber];

      if (record && record.bestTime) {
        const seconds = Math.floor(record.bestTime / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        document.getElementById('bestTime').textContent =
          `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
    } catch (error) {
      console.error('加载进度失败:', error);
    }
  }

  initEventListeners() {
    // 重置按钮
    document.getElementById('resetBtn').addEventListener('click', () => {
      this.resetGame();
    });

    // 撤销按钮
    document.getElementById('undoBtn').addEventListener('click', () => {
      if (this.engine.undo()) {
        this.renderBlocks();
        this.updateStats();
      }
    });

    // 关卡列表按钮
    document.getElementById('levelsBtn').addEventListener('click', () => {
      window.location.href = 'levels.html';
    });

    // 胜利弹窗按钮
    document.getElementById('retryBtn').addEventListener('click', () => {
      this.hideVictory();
      this.resetGame();
    });

    document.getElementById('nextLevelBtn').addEventListener('click', () => {
      this.hideVictory();
      const nextLevel = this.levelNumber + 1;
      if (nextLevel <= KLOTSKI_LEVELS.length) {
        window.location.href = `index.html?level=${nextLevel}`;
      } else {
        window.location.href = 'levels.html';
      }
    });
  }

  resetGame() {
    this.engine.reset();
    this.elapsedTime = 0;
    this.stopTimer();
    this.startTimer();
    this.renderBlocks();
    this.updateStats();
  }
}

// 初始化游戏
let game;
document.addEventListener('DOMContentLoaded', () => {
  game = new KlotskiGame();
});
