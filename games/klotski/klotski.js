// 华容道游戏核心引擎
// 负责游戏逻辑、方块移动、胜利检测等

class KlotskiEngine {
  constructor(levelData) {
    this.levelData = levelData;
    this.boardRows = KLOTSKI_CONFIG.boardRows;
    this.boardCols = KLOTSKI_CONFIG.boardCols;
    this.exitPosition = KLOTSKI_CONFIG.exitPosition;
    this.targetBlockId = KLOTSKI_CONFIG.targetBlockId;

    // 初始化游戏状态
    this.blocks = JSON.parse(JSON.stringify(levelData.blocks)); // 深拷贝
    this.moveCount = 0;
    this.moveHistory = []; // 移动历史，用于撤销
    this.board = this.createBoard();
  }

  // 创建棋盘状态数组
  createBoard() {
    const board = Array(this.boardRows).fill(null).map(() =>
      Array(this.boardCols).fill(null)
    );

    // 将所有方块放置到棋盘上
    this.blocks.forEach(block => {
      this.placeBlockOnBoard(board, block);
    });

    return board;
  }

  // 将方块放置到棋盘上
  placeBlockOnBoard(board, block) {
    const [row, col] = block.position;
    const [height, width] = block.shape;

    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) {
        if (r >= 0 && r < this.boardRows && c >= 0 && c < this.boardCols) {
          board[r][c] = block.id;
        }
      }
    }
  }

  // 从棋盘上移除方块
  removeBlockFromBoard(board, block) {
    const [row, col] = block.position;
    const [height, width] = block.shape;

    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) {
        if (r >= 0 && r < this.boardRows && c >= 0 && c < this.boardCols) {
          board[r][c] = null;
        }
      }
    }
  }

  // 检查方块是否可以移动到新位置
  canMove(blockId, newRow, newCol) {
    const block = this.blocks.find(b => b.id === blockId);
    if (!block) return false;

    const [height, width] = block.shape;

    // 检查是否超出边界
    if (newRow < 0 || newCol < 0 ||
        newRow + height > this.boardRows ||
        newCol + width > this.boardCols) {
      return false;
    }

    // 临时从棋盘移除当前方块
    const tempBoard = this.board.map(row => [...row]);
    this.removeBlockFromBoard(tempBoard, block);

    // 检查新位置是否被占用
    for (let r = newRow; r < newRow + height; r++) {
      for (let c = newCol; c < newCol + width; c++) {
        if (tempBoard[r][c] !== null) {
          return false;
        }
      }
    }

    return true;
  }

  // 移动方块
  moveBlock(blockId, direction) {
    const block = this.blocks.find(b => b.id === blockId);
    if (!block) return false;

    const [row, col] = block.position;
    let newRow = row;
    let newCol = col;

    // 根据方向计算新位置
    switch(direction) {
      case 'up':
        newRow = row - 1;
        break;
      case 'down':
        newRow = row + 1;
        break;
      case 'left':
        newCol = col - 1;
        break;
      case 'right':
        newCol = col + 1;
        break;
      default:
        return false;
    }

    // 检查是否可以移动
    if (!this.canMove(blockId, newRow, newCol)) {
      return false;
    }

    // 保存当前状态用于撤销
    this.saveState();

    // 从旧位置移除
    this.removeBlockFromBoard(this.board, block);

    // 更新位置
    block.position = [newRow, newCol];

    // 放置到新位置
    this.placeBlockOnBoard(this.board, block);

    // 增加移动计数
    this.moveCount++;

    return true;
  }

  // 通过拖动移动方块（计算移动方向和距离）
  moveBlockByDrag(blockId, deltaRow, deltaCol) {
    const block = this.blocks.find(b => b.id === blockId);
    if (!block) return false;

    const [row, col] = block.position;
    const newRow = row + deltaRow;
    const newCol = col + deltaCol;

    // 检查是否可以移动
    if (!this.canMove(blockId, newRow, newCol)) {
      return false;
    }

    // 保存当前状态用于撤销
    this.saveState();

    // 从旧位置移除
    this.removeBlockFromBoard(this.board, block);

    // 更新位置
    block.position = [newRow, newCol];

    // 放置到新位置
    this.placeBlockOnBoard(this.board, block);

    // 增加移动计数
    this.moveCount++;

    return true;
  }

  // 保存当前状态用于撤销
  saveState() {
    const state = {
      blocks: JSON.parse(JSON.stringify(this.blocks)),
      moveCount: this.moveCount
    };
    this.moveHistory.push(state);

    // 限制历史记录数量，避免内存溢出
    if (this.moveHistory.length > 1000) {
      this.moveHistory.shift();
    }
  }

  // 撤销上一步移动
  undo() {
    if (this.moveHistory.length === 0) {
      return false;
    }

    const lastState = this.moveHistory.pop();
    this.blocks = lastState.blocks;
    this.moveCount = lastState.moveCount;
    this.board = this.createBoard();

    return true;
  }

  // 重置游戏
  reset() {
    this.blocks = JSON.parse(JSON.stringify(this.levelData.blocks));
    this.moveCount = 0;
    this.moveHistory = [];
    this.board = this.createBoard();
  }

  // 检查是否胜利
  checkWin() {
    const targetBlock = this.blocks.find(b => b.id === this.targetBlockId);
    if (!targetBlock) return false;

    const [row, col] = targetBlock.position;

    // 曹操（2x2方块）需要到达出口位置 [3, 1]
    // 即左上角在第4行第2列
    return row === this.exitPosition.row && col === this.exitPosition.col;
  }

  // 获取指定位置的方块ID
  getBlockAtPosition(row, col) {
    if (row < 0 || row >= this.boardRows || col < 0 || col >= this.boardCols) {
      return null;
    }
    return this.board[row][col];
  }

  // 获取方块对象
  getBlock(blockId) {
    return this.blocks.find(b => b.id === blockId);
  }

  // 获取所有方块
  getAllBlocks() {
    return this.blocks;
  }

  // 获取移动次数
  getMoveCount() {
    return this.moveCount;
  }

  // 检查方块可以向哪些方向移动
  getPossibleMoves(blockId) {
    const moves = {
      up: false,
      down: false,
      left: false,
      right: false
    };

    const block = this.getBlock(blockId);
    if (!block) return moves;

    const [row, col] = block.position;

    moves.up = this.canMove(blockId, row - 1, col);
    moves.down = this.canMove(blockId, row + 1, col);
    moves.left = this.canMove(blockId, row, col - 1);
    moves.right = this.canMove(blockId, row, col + 1);

    return moves;
  }

  // 获取游戏状态的字符串表示（用于调试）
  getBoardString() {
    let str = '';
    for (let r = 0; r < this.boardRows; r++) {
      for (let c = 0; c < this.boardCols; c++) {
        const blockId = this.board[r][c];
        if (blockId === null) {
          str += '. ';
        } else if (blockId === this.targetBlockId) {
          str += 'C ';
        } else {
          str += '# ';
        }
      }
      str += '\n';
    }
    return str;
  }

  // 获取当前游戏状态快照（用于保存）
  getGameState() {
    return {
      levelId: this.levelData.id,
      blocks: JSON.parse(JSON.stringify(this.blocks)),
      moveCount: this.moveCount
    };
  }

  // 加载游戏状态
  loadGameState(state) {
    if (state.levelId !== this.levelData.id) {
      console.warn('Level mismatch when loading state');
      return false;
    }

    this.blocks = JSON.parse(JSON.stringify(state.blocks));
    this.moveCount = state.moveCount || 0;
    this.board = this.createBoard();
    this.moveHistory = [];

    return true;
  }
}
