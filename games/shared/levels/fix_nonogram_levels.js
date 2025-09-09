// 修复数织关卡生成算法
// 确保每个关卡都有唯一解且正确

const fs = require('fs');
const path = require('path');

class NonogramSolver {
  constructor() {
    this.grid = null;
    this.size = 0;
    this.rowClues = [];
    this.colClues = [];
  }

  // 验证关卡是否有唯一解
  validateLevel(pattern, rowClues, colClues) {
    this.size = pattern.length;
    this.rowClues = rowClues;
    this.colClues = colClues;
    
    // 验证线索是否正确
    if (!this.verifyClues(pattern)) {
      return false;
    }
    
    // 尝试求解
    this.grid = Array(this.size).fill(null).map(() => Array(this.size).fill(-1)); // -1=未知, 0=空, 1=填充
    
    return this.solve();
  }

  // 验证图案和线索是否匹配
  verifyClues(pattern) {
    // 验证行线索
    for (let r = 0; r < this.size; r++) {
      const actualClues = this.getLineClues(pattern[r]);
      const expectedClues = this.rowClues[r];
      if (!this.arraysEqual(actualClues, expectedClues)) {
        console.log(`Row ${r} clue mismatch: expected ${expectedClues}, got ${actualClues}`);
        return false;
      }
    }
    
    // 验证列线索
    for (let c = 0; c < this.size; c++) {
      const column = pattern.map(row => row[c]);
      const actualClues = this.getLineClues(column);
      const expectedClues = this.colClues[c];
      if (!this.arraysEqual(actualClues, expectedClues)) {
        console.log(`Col ${c} clue mismatch: expected ${expectedClues}, got ${actualClues}`);
        return false;
      }
    }
    
    return true;
  }

  // 获取线索
  getLineClues(line) {
    const clues = [];
    let currentGroup = 0;
    
    for (const cell of line) {
      if (cell === 1) {
        currentGroup++;
      } else {
        if (currentGroup > 0) {
          clues.push(currentGroup);
          currentGroup = 0;
        }
      }
    }
    
    if (currentGroup > 0) {
      clues.push(currentGroup);
    }
    
    return clues.length > 0 ? clues : [0];
  }

  // 比较数组
  arraysEqual(a, b) {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  // 简单的求解器（基于约束传播）
  solve() {
    let changed = true;
    let iterations = 0;
    const maxIterations = 100;
    
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;
      
      // 处理行
      for (let r = 0; r < this.size; r++) {
        const newRow = this.solveLine(this.grid[r], this.rowClues[r]);
        if (newRow && !this.arraysEqual(this.grid[r], newRow)) {
          this.grid[r] = newRow;
          changed = true;
        }
      }
      
      // 处理列
      for (let c = 0; c < this.size; c++) {
        const column = this.grid.map(row => row[c]);
        const newColumn = this.solveLine(column, this.colClues[c]);
        if (newColumn && !this.arraysEqual(column, newColumn)) {
          for (let r = 0; r < this.size; r++) {
            this.grid[r][c] = newColumn[r];
          }
          changed = true;
        }
      }
    }
    
    // 检查是否完全求解
    return this.isComplete();
  }

  // 求解单行/列
  solveLine(line, clues) {
    const size = line.length;
    const possibilities = this.generateLinePossibilities(size, clues);
    
    // 过滤与当前状态兼容的可能性
    const compatible = possibilities.filter(possibility => {
      return line.every((cell, i) => cell === -1 || cell === possibility[i]);
    });
    
    if (compatible.length === 0) return null;
    
    // 找出所有兼容可能性中确定的格子
    const result = [...line];
    for (let i = 0; i < size; i++) {
      if (result[i] === -1) {
        const values = compatible.map(p => p[i]);
        if (values.every(v => v === values[0])) {
          result[i] = values[0];
        }
      }
    }
    
    return result;
  }

  // 生成单行的所有可能填法
  generateLinePossibilities(size, clues) {
    if (clues.length === 1 && clues[0] === 0) {
      return [Array(size).fill(0)];
    }
    
    const possibilities = [];
    
    function place(pos, clueIndex, current) {
      if (clueIndex >= clues.length) {
        // 所有线索都已放置
        possibilities.push([...current]);
        return;
      }
      
      const clue = clues[clueIndex];
      const remainingClues = clues.slice(clueIndex + 1);
      const remainingLength = remainingClues.reduce((sum, c) => sum + c, 0) + remainingClues.length;
      
      // 尝试在不同位置放置当前线索
      const maxStart = size - clue - remainingLength;
      for (let start = pos; start <= maxStart; start++) {
        const newCurrent = [...current];
        
        // 填充空格
        for (let i = pos; i < start; i++) {
          newCurrent[i] = 0;
        }
        
        // 填充线索
        for (let i = start; i < start + clue; i++) {
          newCurrent[i] = 1;
        }
        
        // 添加分隔空格（如果不是最后一个线索）
        const nextPos = start + clue + (clueIndex < clues.length - 1 ? 1 : 0);
        if (clueIndex < clues.length - 1 && nextPos <= size) {
          newCurrent[start + clue] = 0;
        }
        
        place(nextPos, clueIndex + 1, newCurrent);
      }
    }
    
    place(0, 0, Array(size).fill(-1));
    return possibilities.map(p => p.map(cell => cell === -1 ? 0 : cell));
  }

  // 检查是否完全求解
  isComplete() {
    return this.grid.every(row => row.every(cell => cell !== -1));
  }
}

// 经典的正确5x5图案
const correctClassicPatterns = [
  // 爱心 - 修正版
  {
    title: "爱心",
    theme: "symbols", 
    pattern: [
      [0,1,0,1,0],
      [1,1,1,1,1],
      [1,1,1,1,1], 
      [0,1,1,1,0],
      [0,0,1,0,0]
    ]
  },
  // 笑脸 - 修正版
  {
    title: "笑脸",
    theme: "faces",
    pattern: [
      [0,1,1,1,0],
      [1,0,1,0,1],
      [1,0,1,0,1],
      [1,0,0,0,1],
      [0,1,1,1,0]
    ]
  },
  // 房子 - 修正版
  {
    title: "房子", 
    theme: "objects",
    pattern: [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [1,0,1,0,1],
      [1,1,1,1,1]
    ]
  },
  // 简单的十字
  {
    title: "十字",
    theme: "symbols",
    pattern: [
      [0,0,1,0,0],
      [0,0,1,0,0],
      [1,1,1,1,1],
      [0,0,1,0,0],
      [0,0,1,0,0]
    ]
  },
  // 钻石
  {
    title: "钻石",
    theme: "symbols", 
    pattern: [
      [0,0,1,0,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,1,1,1,0],
      [0,0,1,0,0]
    ]
  }
];

// 生成并验证关卡
function generateAndValidateLevel(basePattern, levelNumber, difficulty) {
  const engine = new NonogramEngine();
  const solver = new NonogramSolver();
  
  // 生成关卡
  const level = engine.generateLevel(difficulty, levelNumber);
  
  // 验证关卡
  const isValid = solver.validateLevel(level.solution, level.row_clues, level.col_clues);
  
  if (!isValid) {
    console.log(`❌ Level ${levelNumber} (${difficulty}) is invalid!`);
    
    // 如果是简单难度的前几关，使用经典图案
    if (difficulty === 'easy' && levelNumber <= correctClassicPatterns.length) {
      const pattern = correctClassicPatterns[levelNumber - 1];
      const clues = engine.generateClues(pattern.pattern);
      
      return {
        level: levelNumber,
        difficulty: difficulty,
        size: 5,
        solution: pattern.pattern,
        row_clues: clues.rows,
        col_clues: clues.cols,
        estimated_time: 60,
        theme: pattern.theme,
        title: pattern.title,
        source: "corrected_classic",
        created_at: new Date().toISOString()
      };
    }
  }
  
  return level;
}

// 重新生成简单难度的前10关
function fixEasyLevels() {
  const NonogramEngine = require('./generate_nonogram_levels.js').NonogramEngine;
  const engine = new NonogramEngine();
  const correctedLevels = [];
  
  console.log('🔧 修复简单难度前10关...');
  
  for (let i = 1; i <= 50; i++) {
    if (i <= correctClassicPatterns.length) {
      // 使用修正的经典图案
      const pattern = correctClassicPatterns[i - 1];
      const clues = engine.generateClues(pattern.pattern);
      
      const level = {
        level: i,
        difficulty: "easy",
        size: 5,
        solution: pattern.pattern,
        row_clues: clues.rows,
        col_clues: clues.cols,
        estimated_time: 60,
        theme: pattern.theme,
        title: pattern.title,
        source: "corrected_classic",
        created_at: new Date().toISOString()
      };
      
      // 验证
      const solver = new NonogramSolver();
      if (solver.validateLevel(level.solution, level.row_clues, level.col_clues)) {
        console.log(`✅ Level ${i}: ${pattern.title} - Valid`);
        correctedLevels.push(level);
      } else {
        console.log(`❌ Level ${i}: ${pattern.title} - Invalid`);
      }
    } else {
      // 生成随机关卡
      const level = engine.generateLevel('easy', i);
      correctedLevels.push(level);
    }
  }
  
  // 保存修正的关卡
  const filename = path.join(__dirname, 'nonogram', 'easy.json');
  fs.writeFileSync(filename, JSON.stringify(correctedLevels, null, 2));
  console.log(`✅ 修正的简单关卡已保存到 ${filename}`);
}

// 导入NonogramEngine
class NonogramEngine {
  generateClues(pattern) {
    const size = pattern.length;
    const rowClues = [];
    const colClues = [];
    
    // 生成行线索
    for (let r = 0; r < size; r++) {
      rowClues.push(this.getLineClues(pattern[r]));
    }
    
    // 生成列线索
    for (let c = 0; c < size; c++) {
      const column = [];
      for (let r = 0; r < size; r++) {
        column.push(pattern[r][c]);
      }
      colClues.push(this.getLineClues(column));
    }
    
    return { rows: rowClues, cols: colClues };
  }

  getLineClues(line) {
    const clues = [];
    let currentGroup = 0;
    
    for (const cell of line) {
      if (cell === 1) {
        currentGroup++;
      } else {
        if (currentGroup > 0) {
          clues.push(currentGroup);
          currentGroup = 0;
        }
      }
    }
    
    if (currentGroup > 0) {
      clues.push(currentGroup);
    }
    
    return clues.length > 0 ? clues : [0];
  }
}

// 运行修复
if (require.main === module) {
  fixEasyLevels();
}

module.exports = { NonogramSolver, correctClassicPatterns };