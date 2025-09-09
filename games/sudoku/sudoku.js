// 数独算法：生成完整解，挖空，唯一解检测
// 移植自微信小程序，优化为Web版本

class SudokuEngine {
  constructor() {
    this.difficultyMap = {
      easy: 40,
      medium: 50, 
      hard: 56,
      expert: 60
    };
  }

  // 深拷贝棋盘
  cloneBoard(board) {
    return board.map(row => row.slice());
  }

  // 数组随机打乱
  shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // 检查数字在指定位置是否安全
  isSafe(board, row, col, num) {
    // 检查行
    for (let c = 0; c < 9; c++) {
      if (board[row][c] === num) return false;
    }
    
    // 检查列
    for (let r = 0; r < 9; r++) {
      if (board[r][col] === num) return false;
    }
    
    // 检查3x3宫格
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (board[boxRow + r][boxCol + c] === num) return false;
      }
    }
    
    return true;
  }

  // 找到第一个空格
  findEmpty(board) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  // 使用回溯法求解数独
  solveBoard(board) {
    const emptyPos = this.findEmpty(board);
    if (!emptyPos) return true; // 没有空格，解完成
    
    const [row, col] = emptyPos;
    const numbers = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    
    for (const num of numbers) {
      if (this.isSafe(board, row, col, num)) {
        board[row][col] = num;
        
        if (this.solveBoard(board)) {
          return true;
        }
        
        board[row][col] = 0; // 回溯
      }
    }
    
    return false;
  }

  // 生成完整的数独解
  generateFullSolution() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.solveBoard(board);
    return board;
  }

  // 计算解的数量（用于唯一解验证）
  countSolutions(board, limit = 2) {
    let count = 0;
    const boardCopy = this.cloneBoard(board);
    
    const dfs = () => {
      if (count >= limit) return;
      
      const emptyPos = this.findEmpty(boardCopy);
      if (!emptyPos) {
        count++;
        return;
      }
      
      const [row, col] = emptyPos;
      for (let num = 1; num <= 9; num++) {
        if (this.isSafe(boardCopy, row, col, num)) {
          boardCopy[row][col] = num;
          dfs();
          if (count >= limit) return;
          boardCopy[row][col] = 0;
        }
      }
    };
    
    dfs();
    return count;
  }

  // 检查是否有唯一解
  hasUniqueSolution(board) {
    return this.countSolutions(board, 2) === 1;
  }

  // 从完整解中挖空，生成题目
  makePuzzle(solution, holes = 50) {
    const puzzle = this.cloneBoard(solution);
    const cells = this.shuffle(Array.from({ length: 81 }, (_, i) => i));
    let removed = 0;
    
    for (const idx of cells) {
      if (removed >= holes) break;
      
      const r = Math.floor(idx / 9);
      const c = idx % 9;
      const backup = puzzle[r][c];
      
      if (backup === 0) continue; // 已经是空格
      
      puzzle[r][c] = 0;
      
      // 检查是否还有唯一解
      if (!this.hasUniqueSolution(puzzle)) {
        puzzle[r][c] = backup; // 恢复
      } else {
        removed++;
      }
    }
    
    return puzzle;
  }

  // 生成数独游戏（主入口）
  generate(difficulty = 'medium') {
    const holes = this.difficultyMap[difficulty] || 50;
    const solution = this.generateFullSolution();
    const puzzle = this.makePuzzle(solution, holes);
    
    return { puzzle, solution };
  }

  // 求解给定的数独题目
  solve(puzzle) {
    const board = this.cloneBoard(puzzle);
    const solved = this.solveBoard(board);
    return { solved, board };
  }

  // 验证当前棋盘状态
  validate(board) {
    // 检查是否有冲突
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const num = board[r][c];
        if (num === 0) continue;
        
        // 临时清空当前格子，检查是否安全
        board[r][c] = 0;
        const isValid = this.isSafe(board, r, c, num);
        board[r][c] = num;
        
        if (!isValid) {
          return false;
        }
      }
    }
    return true;
  }

  // 检查是否完成
  isComplete(board, solution) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== solution[r][c]) {
          return false;
        }
      }
    }
    return true;
  }
}

// Web环境下的导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SudokuEngine;
} else if (typeof window !== 'undefined') {
  window.SudokuEngine = SudokuEngine;
}