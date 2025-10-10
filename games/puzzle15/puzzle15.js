// 数字华容道（15-Puzzle）核心引擎
// 负责游戏逻辑、滑块移动、打乱算法、胜利检测等

class Puzzle15Engine {
  constructor(size = 4) {
    this.size = size; // 棋盘尺寸（3, 4, 或 5）
    this.totalTiles = size * size - 1; // 总共的数字块数量
    this.board = [];
    this.emptyRow = size - 1;
    this.emptyCol = size - 1;
    this.moveCount = 0;
    this.moveHistory = [];

    this.initBoard();
  }

  // 初始化棋盘为已完成状态
  initBoard() {
    this.board = [];
    let num = 1;

    for (let r = 0; r < this.size; r++) {
      const row = [];
      for (let c = 0; c < this.size; c++) {
        if (r === this.size - 1 && c === this.size - 1) {
          row.push(0); // 右下角为空格
        } else {
          row.push(num++);
        }
      }
      this.board.push(row);
    }

    this.emptyRow = this.size - 1;
    this.emptyCol = this.size - 1;
    this.moveCount = 0;
    this.moveHistory = [];
  }

  // 种子随机数生成器
  seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // 生成打乱的棋盘（保证可解）
  shuffle(moves = 100, seed = Date.now()) {
    this.initBoard();
    this.shuffleSeed = seed;

    // 通过随机移动来打乱，保证可解
    const directions = ['up', 'down', 'left', 'right'];
    let lastDirection = null;
    let currentSeed = seed;

    for (let i = 0; i < moves; i++) {
      // 获取可能的移动方向
      const possibleMoves = this.getPossibleMoves();

      // 过滤掉与上一步相反的方向（避免来回移动）
      const opposites = { 'up': 'down', 'down': 'up', 'left': 'right', 'right': 'left' };
      const validMoves = possibleMoves.filter(dir => dir !== opposites[lastDirection]);

      if (validMoves.length > 0) {
        currentSeed++;
        const randomValue = this.seededRandom(currentSeed);
        const randomDir = validMoves[Math.floor(randomValue * validMoves.length)];
        this.moveEmpty(randomDir);
        lastDirection = randomDir;
      }
    }

    // 重置移动计数（打乱不计入移动步数）
    this.moveCount = 0;
    this.moveHistory = [];
  }

  // 获取空格可以移动的方向
  getPossibleMoves() {
    const moves = [];

    if (this.emptyRow > 0) moves.push('up');
    if (this.emptyRow < this.size - 1) moves.push('down');
    if (this.emptyCol > 0) moves.push('left');
    if (this.emptyCol < this.size - 1) moves.push('right');

    return moves;
  }

  // 移动空格（实际上是移动数字块到空格）
  moveEmpty(direction) {
    let targetRow = this.emptyRow;
    let targetCol = this.emptyCol;

    switch(direction) {
      case 'up':
        targetRow--;
        break;
      case 'down':
        targetRow++;
        break;
      case 'left':
        targetCol--;
        break;
      case 'right':
        targetCol++;
        break;
    }

    if (targetRow >= 0 && targetRow < this.size &&
        targetCol >= 0 && targetCol < this.size) {
      // 交换空格和目标位置
      this.board[this.emptyRow][this.emptyCol] = this.board[targetRow][targetCol];
      this.board[targetRow][targetCol] = 0;

      this.emptyRow = targetRow;
      this.emptyCol = targetCol;

      return true;
    }

    return false;
  }

  // 点击某个数字块，尝试移动它
  moveTile(row, col) {
    // 检查是否点击了空格
    if (this.board[row][col] === 0) {
      return false;
    }

    // 检查是否与空格相邻
    const rowDiff = Math.abs(row - this.emptyRow);
    const colDiff = Math.abs(col - this.emptyCol);

    if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
      // 保存状态用于撤销
      this.saveState();

      // 交换数字块和空格
      this.board[this.emptyRow][this.emptyCol] = this.board[row][col];
      this.board[row][col] = 0;

      this.emptyRow = row;
      this.emptyCol = col;

      this.moveCount++;
      return true;
    }

    return false;
  }

  // 保存当前状态用于撤销
  saveState() {
    const state = {
      board: JSON.parse(JSON.stringify(this.board)),
      emptyRow: this.emptyRow,
      emptyCol: this.emptyCol,
      moveCount: this.moveCount
    };

    this.moveHistory.push(state);

    // 限制历史记录数量
    if (this.moveHistory.length > 1000) {
      this.moveHistory.shift();
    }
  }

  // 撤销上一步
  undo() {
    if (this.moveHistory.length === 0) {
      return false;
    }

    const lastState = this.moveHistory.pop();
    this.board = lastState.board;
    this.emptyRow = lastState.emptyRow;
    this.emptyCol = lastState.emptyCol;
    this.moveCount = lastState.moveCount;

    return true;
  }

  // 检查是否完成
  checkWin() {
    let expectedNum = 1;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (r === this.size - 1 && c === this.size - 1) {
          // 最后一个应该是空格
          if (this.board[r][c] !== 0) {
            return false;
          }
        } else {
          if (this.board[r][c] !== expectedNum) {
            return false;
          }
          expectedNum++;
        }
      }
    }

    return true;
  }

  // 获取棋盘状态
  getBoard() {
    return this.board;
  }

  // 获取某个位置的数字
  getTile(row, col) {
    if (row >= 0 && row < this.size && col >= 0 && col < this.size) {
      return this.board[row][col];
    }
    return null;
  }

  // 获取移动次数
  getMoveCount() {
    return this.moveCount;
  }

  // 重置游戏（重新打乱）
  reset(shuffleMoves) {
    this.shuffle(shuffleMoves);
  }

  // 获取游戏状态快照
  getGameState() {
    return {
      size: this.size,
      board: JSON.parse(JSON.stringify(this.board)),
      emptyRow: this.emptyRow,
      emptyCol: this.emptyCol,
      moveCount: this.moveCount
    };
  }

  // 加载游戏状态
  loadGameState(state) {
    if (state.size !== this.size) {
      console.warn('Size mismatch when loading state');
      return false;
    }

    this.board = JSON.parse(JSON.stringify(state.board));
    this.emptyRow = state.emptyRow;
    this.emptyCol = state.emptyCol;
    this.moveCount = state.moveCount || 0;
    this.moveHistory = [];

    return true;
  }

  // 调试：打印棋盘
  printBoard() {
    console.log('Board:');
    for (let r = 0; r < this.size; r++) {
      let row = '';
      for (let c = 0; c < this.size; c++) {
        const num = this.board[r][c];
        row += (num === 0 ? '  ' : num.toString().padStart(2, ' ')) + ' ';
      }
      console.log(row);
    }
    console.log('Moves:', this.moveCount);
  }
}

// 难度配置
// 基于研究数据：8-puzzle最大31步，15-puzzle最大80步
const PUZZLE15_DIFFICULTIES = {
  easy: {
    name: '简单',
    size: 3,
    shuffleMoves: 5,  // 倒退5步，玩家实际可能需要10-15步
    starThresholds: {
      gold: 30,    // 30秒内完成得3星
      silver: 60,  // 1分钟内完成得2星
      bronze: 120  // 2分钟内完成得1星
    }
  },
  medium: {
    name: '中等',
    size: 4,
    shuffleMoves: 20,  // 15-puzzle最大80步，20步约为1/4难度
    starThresholds: {
      gold: 90,    // 1.5分钟内完成得3星
      silver: 180, // 3分钟内完成得2星
      bronze: 360  // 6分钟内完成得1星
    }
  },
  hard: {
    name: '困难',
    size: 5,
    shuffleMoves: 30,  // 5x5难度适中，从30步开始
    starThresholds: {
      gold: 180,   // 3分钟内完成得3星
      silver: 360, // 6分钟内完成得2星
      bronze: 720  // 12分钟内完成得1星
    }
  }
};

// 根据时间计算星级
function calculateStars(timeInSeconds, difficulty) {
  const config = PUZZLE15_DIFFICULTIES[difficulty];
  if (!config) return 0;

  const thresholds = config.starThresholds;

  if (timeInSeconds <= thresholds.gold) return 3;
  if (timeInSeconds <= thresholds.silver) return 2;
  if (timeInSeconds <= thresholds.bronze) return 1;

  return 0;
}
