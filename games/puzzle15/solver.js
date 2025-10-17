// solver.js - A* algorithm solver for 15-puzzle game

class PuzzleSolver {
  constructor() {
    this.maxIterations = 100000; // 防止无限循环
    this.timeoutMs = 30000; // 30秒超时
  }

  /**
   * 计算曼哈顿距离（启发式函数）
   * @param {number[][]} board - 当前棋盘状态
   * @param {number} size - 棋盘大小
   * @returns {number} 曼哈顿距离
   */
  calculateManhattanDistance(board, size) {
    let distance = 0;

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const value = board[i][j];
        if (value === 0) continue; // 跳过空格

        // 计算正确位置
        const targetRow = Math.floor((value - 1) / size);
        const targetCol = (value - 1) % size;

        // 累加曼哈顿距离
        distance += Math.abs(i - targetRow) + Math.abs(j - targetCol);
      }
    }

    return distance;
  }

  /**
   * 检查是否有解（逆序数检查）
   * @param {number[][]} board - 当前棋盘状态
   * @param {number} size - 棋盘大小
   * @returns {boolean} 是否有解
   */
  isSolvable(board, size) {
    const flat = [];
    let emptyRow = 0;

    // 展平棋盘，记录空格位置
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (board[i][j] === 0) {
          emptyRow = i;
        } else {
          flat.push(board[i][j]);
        }
      }
    }

    // 计算逆序数
    let inversions = 0;
    for (let i = 0; i < flat.length; i++) {
      for (let j = i + 1; j < flat.length; j++) {
        if (flat[i] > flat[j]) {
          inversions++;
        }
      }
    }

    // 判断可解性
    if (size % 2 === 1) {
      // 奇数尺寸：逆序数必须是偶数
      return inversions % 2 === 0;
    } else {
      // 偶数尺寸：(逆序数 + 空格所在行号) 必须是奇数
      return (inversions + emptyRow) % 2 === 1;
    }
  }

  /**
   * 获取可能的移动
   * @param {number[][]} board - 当前棋盘状态
   * @param {number} size - 棋盘大小
   * @returns {Array} 可能的移动 [{row, col, direction}]
   */
  getPossibleMoves(board, size) {
    const moves = [];
    let emptyRow = -1, emptyCol = -1;

    // 找到空格位置
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (board[i][j] === 0) {
          emptyRow = i;
          emptyCol = j;
          break;
        }
      }
      if (emptyRow !== -1) break;
    }

    // 四个方向的移动
    const directions = [
      { dr: -1, dc: 0, name: 'down', desc: '下' },  // 上方的块向下移
      { dr: 1, dc: 0, name: 'up', desc: '上' },     // 下方的块向上移
      { dr: 0, dc: -1, name: 'right', desc: '右' }, // 左方的块向右移
      { dr: 0, dc: 1, name: 'left', desc: '左' }    // 右方的块向左移
    ];

    for (const dir of directions) {
      const newRow = emptyRow + dir.dr;
      const newCol = emptyCol + dir.dc;

      if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
        moves.push({
          row: newRow,
          col: newCol,
          direction: dir.name,
          directionText: dir.desc,
          tileValue: board[newRow][newCol]
        });
      }
    }

    return moves;
  }

  /**
   * 执行移动（不修改原数组）
   * @param {number[][]} board - 当前棋盘状态
   * @param {number} row - 要移动的方块行
   * @param {number} col - 要移动的方块列
   * @returns {number[][]} 新的棋盘状态
   */
  makeMove(board, row, col) {
    const size = board.length;
    const newBoard = board.map(row => [...row]);

    // 找到空格
    let emptyRow = -1, emptyCol = -1;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (newBoard[i][j] === 0) {
          emptyRow = i;
          emptyCol = j;
          break;
        }
      }
      if (emptyRow !== -1) break;
    }

    // 交换
    [newBoard[row][col], newBoard[emptyRow][emptyCol]] =
    [newBoard[emptyRow][emptyCol], newBoard[row][col]];

    return newBoard;
  }

  /**
   * 将棋盘转换为字符串（用于哈希）
   * @param {number[][]} board - 棋盘状态
   * @returns {string} 字符串表示
   */
  boardToString(board) {
    return board.map(row => row.join(',')).join(';');
  }

  /**
   * A* 算法求解
   * @param {number[][]} initialBoard - 初始棋盘状态
   * @returns {Object} 求解结果 {success, path, message, strategy}
   */
  solve(initialBoard) {
    const startTime = Date.now();
    const size = initialBoard.length;

    // 检查是否有解
    if (!this.isSolvable(initialBoard, size)) {
      return {
        success: false,
        message: '当前棋盘布局无解！请重新打乱。'
      };
    }

    // 检查是否已经完成
    const initialH = this.calculateManhattanDistance(initialBoard, size);
    if (initialH === 0) {
      return {
        success: true,
        path: [],
        message: '已经完成，无需移动！'
      };
    }

    // 优先队列（使用数组模拟，按 f 值排序）
    const openSet = [];
    const closedSet = new Set();

    // 初始节点
    const startNode = {
      board: initialBoard,
      g: 0, // 从起点到当前点的实际代价
      h: initialH, // 启发式估计（曼哈顿距离）
      f: initialH, // f = g + h
      path: [], // 移动路径
      parent: null
    };

    openSet.push(startNode);

    let iterations = 0;

    while (openSet.length > 0) {
      // 检查超时
      if (Date.now() - startTime > this.timeoutMs) {
        return {
          success: false,
          message: '求解超时！这个布局可能太复杂了。'
        };
      }

      // 检查迭代次数
      if (iterations++ > this.maxIterations) {
        return {
          success: false,
          message: '求解步数过多！请尝试重新打乱。'
        };
      }

      // 按 f 值排序，取出 f 值最小的节点
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();

      const currentKey = this.boardToString(current.board);

      // 跳过已访问的状态
      if (closedSet.has(currentKey)) {
        continue;
      }

      closedSet.add(currentKey);

      // 检查是否达到目标
      if (current.h === 0) {
        const solveTime = ((Date.now() - startTime) / 1000).toFixed(1);
        return {
          success: true,
          path: current.path,
          steps: current.path.length,
          message: `找到解法！共需 ${current.path.length} 步，用时 ${solveTime} 秒。`,
          strategy: this.generateStrategy(current.path, size)
        };
      }

      // 获取所有可能的移动
      const moves = this.getPossibleMoves(current.board, size);

      for (const move of moves) {
        const newBoard = this.makeMove(current.board, move.row, move.col);
        const newKey = this.boardToString(newBoard);

        // 跳过已访问的状态
        if (closedSet.has(newKey)) {
          continue;
        }

        const g = current.g + 1;
        const h = this.calculateManhattanDistance(newBoard, size);
        const f = g + h;

        const newNode = {
          board: newBoard,
          g: g,
          h: h,
          f: f,
          path: [...current.path, move],
          parent: current
        };

        openSet.push(newNode);
      }
    }

    return {
      success: false,
      message: '无法找到解法！'
    };
  }

  /**
   * 生成策略说明
   * @param {Array} path - 移动路径
   * @param {number} size - 棋盘大小
   * @returns {string} 策略说明
   */
  generateStrategy(path, size) {
    if (path.length === 0) return '已完成！';
    if (path.length <= 3) return '只需几步即可完成！';

    // 分析前几步的主要方向
    const directionCount = { up: 0, down: 0, left: 0, right: 0 };
    const analyzeMoves = Math.min(10, path.length);

    for (let i = 0; i < analyzeMoves; i++) {
      directionCount[path[i].direction]++;
    }

    const mainDirection = Object.entries(directionCount)
      .sort((a, b) => b[1] - a[1])[0][0];

    const directionMap = {
      up: '向上',
      down: '向下',
      left: '向左',
      right: '向右'
    };

    let strategy = `总体策略：本题需要 ${path.length} 步。`;
    strategy += `前期主要${directionMap[mainDirection]}移动方块，`;

    if (path.length < 20) {
      strategy += '步数较少，直接按提示操作即可。';
    } else if (path.length < 50) {
      strategy += '需要一定技巧，建议逐步跟随提示。';
    } else {
      strategy += '步数较多，建议耐心跟随每一步提示。';
    }

    return strategy;
  }

  /**
   * 获取下一步提示
   * @param {number[][]} currentBoard - 当前棋盘状态
   * @param {Array} solutionPath - 完整解法路径
   * @returns {Object} 提示信息 {move, description}
   */
  getNextHint(currentBoard, solutionPath) {
    if (!solutionPath || solutionPath.length === 0) {
      return null;
    }

    const nextMove = solutionPath[0];
    const remainingSteps = solutionPath.length;

    const description = `移动方块 ${nextMove.tileValue} 向${nextMove.directionText}，还需 ${remainingSteps} 步`;

    return {
      move: nextMove,
      description: description,
      remainingSteps: remainingSteps
    };
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PuzzleSolver };
}
