// 数独关卡生成脚本
// 生成250个数独关卡（5个难度 × 50关）

// 引入数独算法
const fs = require('fs');
const path = require('path');

// 数独算法类（从sudoku.js移植）
class SudokuEngine {
  constructor() {
    // Number of holes (empty cells) to create - fewer holes = easier (more clues)
    this.difficultyMap = {
      easy: 28,      // 53 clues (easier for beginners)
      medium: 40,    // 41 clues  
      hard: 50,      // 31 clues
      expert: 58,    // 23 clues
      master: 64     // 17 clues (very challenging)
    };
  }

  cloneBoard(board) {
    return board.map(row => row.slice());
  }

  shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  isSafe(board, row, col, num) {
    for (let c = 0; c < 9; c++) {
      if (board[row][c] === num) return false;
    }
    
    for (let r = 0; r < 9; r++) {
      if (board[r][col] === num) return false;
    }
    
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (board[boxRow + r][boxCol + c] === num) return false;
      }
    }
    
    return true;
  }

  findEmpty(board) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  solveBoard(board) {
    const emptyPos = this.findEmpty(board);
    if (!emptyPos) return true;
    
    const [row, col] = emptyPos;
    const numbers = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    
    for (const num of numbers) {
      if (this.isSafe(board, row, col, num)) {
        board[row][col] = num;
        
        if (this.solveBoard(board)) {
          return true;
        }
        
        board[row][col] = 0;
      }
    }
    
    return false;
  }

  generateFullSolution() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.solveBoard(board);
    return board;
  }

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

  hasUniqueSolution(board) {
    return this.countSolutions(board, 2) === 1;
  }

  makePuzzle(solution, holes = 50) {
    const puzzle = this.cloneBoard(solution);
    const cells = this.shuffle(Array.from({ length: 81 }, (_, i) => i));
    let removed = 0;
    
    for (const idx of cells) {
      if (removed >= holes) break;
      
      const r = Math.floor(idx / 9);
      const c = idx % 9;
      const backup = puzzle[r][c];
      
      if (backup === 0) continue;
      
      puzzle[r][c] = 0;
      
      if (!this.hasUniqueSolution(puzzle)) {
        puzzle[r][c] = backup;
      } else {
        removed++;
      }
    }
    
    return { puzzle, actualHoles: removed };
  }

  generate(difficulty = 'medium') {
    const holes = this.difficultyMap[difficulty] || 50;
    const solution = this.generateFullSolution();
    const { puzzle, actualHoles } = this.makePuzzle(solution, holes);
    
    return { puzzle, solution, holes: actualHoles };
  }

  getEstimatedTime(difficulty, holes) {
    const baseTime = {
      easy: 90,      // 1.5分钟 (easier with more clues)
      medium: 300,   // 5分钟
      hard: 600,     // 10分钟
      expert: 1200,  // 20分钟
      master: 1800   // 30分钟
    };
    
    // 根据实际空格数微调时间
    const adjustment = (holes - this.difficultyMap[difficulty]) * 10;
    return Math.max(60, baseTime[difficulty] + adjustment);
  }
}

// 生成关卡函数
function generateLevelsForDifficulty(difficulty, count = 50) {
  const engine = new SudokuEngine();
  const levels = [];
  
  console.log(`正在生成 ${difficulty} 难度的 ${count} 个关卡...`);
  
  for (let i = 1; i <= count; i++) {
    try {
      const { puzzle, solution, holes } = engine.generate(difficulty);
      const estimatedTime = engine.getEstimatedTime(difficulty, holes);
      
      const level = {
        level: i,
        difficulty: difficulty,
        puzzle: puzzle,
        solution: solution,
        holes: holes,
        estimated_time: estimatedTime,
        created_at: new Date().toISOString()
      };
      
      levels.push(level);
      
      if (i % 10 === 0) {
        console.log(`  已完成 ${i}/${count} 关`);
      }
    } catch (error) {
      console.error(`生成第 ${i} 关时出错:`, error);
      i--; // 重试当前关卡
    }
  }
  
  console.log(`✅ ${difficulty} 难度 ${count} 个关卡生成完成`);
  return levels;
}

// 保存关卡到JSON文件
function saveLevelsToFile(levels, difficulty) {
  const filename = path.join(__dirname, 'sudoku', `${difficulty}.json`);
  const jsonData = JSON.stringify(levels, null, 2);
  
  try {
    fs.writeFileSync(filename, jsonData, 'utf8');
    console.log(`✅ 关卡已保存到 ${filename}`);
  } catch (error) {
    console.error(`❌ 保存文件失败:`, error);
  }
}

// 主函数
function main() {
  console.log('🎮 开始生成数独关卡...');
  console.log('总计: 5个难度 × 50关 = 250关');
  console.log('');
  
  const difficulties = ['easy', 'medium', 'hard', 'expert', 'master'];
  
  for (const difficulty of difficulties) {
    const startTime = Date.now();
    const levels = generateLevelsForDifficulty(difficulty, 50);
    const endTime = Date.now();
    
    saveLevelsToFile(levels, difficulty);
    
    console.log(`⏱️  ${difficulty} 用时: ${(endTime - startTime) / 1000}秒`);
    console.log('');
  }
  
  console.log('🎉 所有数独关卡生成完成！');
  console.log('📁 文件位置: games/shared/levels/sudoku/');
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = { SudokuEngine, generateLevelsForDifficulty };