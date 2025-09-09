// 高效数织关卡生成器
// 基于主流算法和难度分类标准

const fs = require('fs');
const path = require('path');

class EfficientNonogramGenerator {
  constructor() {
    // 难度配置
    this.difficulties = {
      easy: { size: 5, density: 0.4, patterns: 'classic' },
      medium: { size: 10, density: 0.45, patterns: 'structured' },
      hard: { size: 15, density: 0.5, patterns: 'mixed' },
      expert: { size: 20, density: 0.55, patterns: 'complex' },
      master: { size: 25, density: 0.6, patterns: 'advanced' }
    };

    // 经典5x5图案库（已验证有唯一解）
    this.classic5x5 = [
      // 爱心
      { title: "爱心", theme: "symbols", pattern: [
        [0,1,0,1,0], [1,1,1,1,1], [1,1,1,1,1], [0,1,1,1,0], [0,0,1,0,0]
      ]},
      // 笑脸  
      { title: "笑脸", theme: "faces", pattern: [
        [0,1,1,1,0], [1,0,1,0,1], [1,0,1,0,1], [1,0,0,0,1], [0,1,1,1,0]
      ]},
      // 十字
      { title: "十字", theme: "symbols", pattern: [
        [0,0,1,0,0], [0,0,1,0,0], [1,1,1,1,1], [0,0,1,0,0], [0,0,1,0,0]
      ]},
      // 钻石
      { title: "钻石", theme: "symbols", pattern: [
        [0,0,1,0,0], [0,1,1,1,0], [1,1,1,1,1], [0,1,1,1,0], [0,0,1,0,0]
      ]},
      // 房子
      { title: "房子", theme: "objects", pattern: [
        [0,0,1,0,0], [0,1,1,1,0], [1,1,1,1,1], [1,0,1,0,1], [1,1,1,1,1]
      ]},
      // 树
      { title: "树", theme: "nature", pattern: [
        [0,0,1,0,0], [0,1,1,1,0], [1,1,1,1,1], [0,0,1,0,0], [0,1,1,1,0]
      ]},
      // 花
      { title: "花", theme: "nature", pattern: [
        [0,1,0,1,0], [1,1,1,1,1], [0,1,1,1,0], [0,0,1,0,0], [0,1,1,1,0]
      ]},
      // 蝴蝶
      { title: "蝴蝶", theme: "animals", pattern: [
        [1,0,1,0,1], [1,1,1,1,1], [0,1,1,1,0], [1,1,1,1,1], [1,0,1,0,1]
      ]},
      // 猫脸
      { title: "猫脸", theme: "animals", pattern: [
        [1,0,1,0,1], [0,1,1,1,0], [1,0,1,0,1], [0,1,0,1,0], [1,0,0,0,1]
      ]},
      // 雨伞
      { title: "雨伞", theme: "objects", pattern: [
        [0,1,1,1,0], [1,1,1,1,1], [0,0,1,0,0], [0,0,1,0,0], [0,1,1,1,0]
      ]}
    ];
  }

  // 生成行/列线索
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
      const column = pattern.map(row => row[c]);
      colClues.push(this.getLineClues(column));
    }
    
    return { rows: rowClues, cols: colClues };
  }

  // 获取单行线索
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

  // 线解算法验证
  isLineSolvable(rowClues, colClues, size) {
    const grid = Array(size).fill(null).map(() => Array(size).fill(-1)); // -1=未知
    let changed = true;
    let iterations = 0;
    
    while (changed && iterations < size * 2) {
      changed = false;
      iterations++;
      
      // 处理行
      for (let r = 0; r < size; r++) {
        const newRow = this.solveLine(grid[r], rowClues[r]);
        if (newRow && !this.arraysEqual(grid[r], newRow)) {
          grid[r] = newRow;
          changed = true;
        }
      }
      
      // 处理列
      for (let c = 0; c < size; c++) {
        const column = grid.map(row => row[c]);
        const newColumn = this.solveLine(column, colClues[c]);
        if (newColumn && !this.arraysEqual(column, newColumn)) {
          for (let r = 0; r < size; r++) {
            grid[r][c] = newColumn[r];
          }
          changed = true;
        }
      }
    }
    
    // 检查是否完全解出
    return grid.every(row => row.every(cell => cell !== -1));
  }

  // 求解单行
  solveLine(line, clues) {
    if (clues.length === 1 && clues[0] === 0) {
      return Array(line.length).fill(0);
    }
    
    const possibilities = this.generateAllPossibilities(line.length, clues);
    const compatible = possibilities.filter(possibility => {
      return line.every((cell, i) => cell === -1 || cell === possibility[i]);
    });
    
    if (compatible.length === 0) return null;
    
    const result = [...line];
    for (let i = 0; i < line.length; i++) {
      if (result[i] === -1) {
        const values = compatible.map(p => p[i]);
        if (values.every(v => v === values[0])) {
          result[i] = values[0];
        }
      }
    }
    
    return result;
  }

  // 生成所有可能的排列
  generateAllPossibilities(size, clues) {
    if (clues.length === 1 && clues[0] === 0) {
      return [Array(size).fill(0)];
    }
    
    const possibilities = [];
    const totalBlocks = clues.reduce((sum, clue) => sum + clue, 0);
    const minSpaces = clues.length - 1;
    const availableSpaces = size - totalBlocks - minSpaces;
    
    this.placePossibilities(0, 0, clues, Array(size).fill(0), availableSpaces, possibilities);
    return possibilities;
  }

  // 递归放置可能性
  placePossibilities(pos, clueIndex, clues, current, remainingSpaces, possibilities) {
    if (clueIndex >= clues.length) {
      possibilities.push([...current]);
      return;
    }
    
    const maxExtraSpaces = remainingSpaces;
    for (let extraSpaces = 0; extraSpaces <= maxExtraSpaces; extraSpaces++) {
      const newCurrent = [...current];
      const startPos = pos + extraSpaces;
      
      // 放置当前块
      for (let i = startPos; i < startPos + clues[clueIndex]; i++) {
        if (i < current.length) {
          newCurrent[i] = 1;
        }
      }
      
      const nextPos = startPos + clues[clueIndex] + (clueIndex < clues.length - 1 ? 1 : 0);
      this.placePossibilities(nextPos, clueIndex + 1, clues, newCurrent, remainingSpaces - extraSpaces, possibilities);
    }
  }

  // 生成结构化图案
  generateStructuredPattern(size, density) {
    const pattern = Array(size).fill(null).map(() => Array(size).fill(0));
    const targetCells = Math.floor(size * size * density);
    
    // 基于几何形状生成
    const shapes = ['cross', 'diamond', 'circle', 'square', 'lines'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    
    switch (shape) {
      case 'cross':
        this.drawCross(pattern, size);
        break;
      case 'diamond':
        this.drawDiamond(pattern, size);
        break;
      case 'circle':
        this.drawCircle(pattern, size);
        break;
      case 'square':
        this.drawSquare(pattern, size);
        break;
      case 'lines':
        this.drawLines(pattern, size);
        break;
    }
    
    return pattern;
  }

  // 绘制十字
  drawCross(pattern, size) {
    const mid = Math.floor(size / 2);
    // 垂直线
    for (let r = 0; r < size; r++) {
      pattern[r][mid] = 1;
    }
    // 水平线
    for (let c = 0; c < size; c++) {
      pattern[mid][c] = 1;
    }
  }

  // 绘制钻石
  drawDiamond(pattern, size) {
    const mid = Math.floor(size / 2);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (Math.abs(r - mid) + Math.abs(c - mid) <= mid) {
          pattern[r][c] = 1;
        }
      }
    }
  }

  // 绘制圆形
  drawCircle(pattern, size) {
    const mid = Math.floor(size / 2);
    const radius = mid - 1;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const distance = Math.sqrt(Math.pow(r - mid, 2) + Math.pow(c - mid, 2));
        if (distance <= radius) {
          pattern[r][c] = 1;
        }
      }
    }
  }

  // 绘制方形
  drawSquare(pattern, size) {
    const border = Math.floor(size * 0.2);
    for (let r = border; r < size - border; r++) {
      for (let c = border; c < size - border; c++) {
        pattern[r][c] = 1;
      }
    }
  }

  // 绘制线条
  drawLines(pattern, size) {
    const lineCount = Math.floor(size / 3);
    for (let i = 0; i < lineCount; i++) {
      const row = Math.floor(Math.random() * size);
      for (let c = 0; c < size; c++) {
        pattern[row][c] = 1;
      }
    }
  }

  // 生成单个关卡
  generateLevel(difficulty, levelNumber) {
    const config = this.difficulties[difficulty];
    let pattern, title = null, theme = null, source = "generated";
    
    if (difficulty === 'easy' && levelNumber <= this.classic5x5.length) {
      // 使用经典图案
      const classic = this.classic5x5[levelNumber - 1];
      pattern = classic.pattern;
      title = classic.title;
      theme = classic.theme;
      source = "classic";
    } else {
      // 生成新图案
      pattern = this.generateStructuredPattern(config.size, config.density);
      theme = this.getRandomTheme();
      title = this.getRandomTitle(theme);
      source = "generated";
    }
    
    const clues = this.generateClues(pattern);
    const estimatedTime = this.calculateEstimatedTime(difficulty, config.size);
    
    return {
      level: levelNumber,
      difficulty: difficulty,
      size: config.size,
      solution: pattern,
      row_clues: clues.rows,
      col_clues: clues.cols,
      estimated_time: estimatedTime,
      theme: theme,
      title: title,
      source: source,
      created_at: new Date().toISOString()
    };
  }

  // 获取随机主题
  getRandomTheme() {
    const themes = ['abstract', 'geometric', 'pattern', 'shapes', 'symbols'];
    return themes[Math.floor(Math.random() * themes.length)];
  }

  // 获取随机标题
  getRandomTitle(theme) {
    const titles = {
      abstract: ['抽象图案', '几何形状', '艺术图案'],
      geometric: ['几何图形', '对称图案', '规则形状'],  
      pattern: ['花纹图案', '装饰图案', '重复图案'],
      shapes: ['基本形状', '简单图形', '经典形状'],
      symbols: ['符号图案', '标记图形', '图标设计']
    };
    const list = titles[theme] || titles.abstract;
    return list[Math.floor(Math.random() * list.length)];
  }

  // 计算预估时间
  calculateEstimatedTime(difficulty, size) {
    const baseTimes = {
      easy: 60,     // 1分钟
      medium: 180,  // 3分钟  
      hard: 480,    // 8分钟
      expert: 900,  // 15分钟
      master: 1800  // 30分钟
    };
    
    const sizeMultiplier = Math.pow(size / 5, 1.5);
    return Math.round(baseTimes[difficulty] * sizeMultiplier);
  }

  // 数组比较
  arraysEqual(a, b) {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  // 生成指定难度的所有关卡
  generateAllLevels(difficulty, count = 50) {
    console.log(`🎯 生成 ${difficulty} 难度的 ${count} 个关卡...`);
    const levels = [];
    
    for (let i = 1; i <= count; i++) {
      const level = this.generateLevel(difficulty, i);
      levels.push(level);
      
      if (i % 10 === 0) {
        console.log(`  ✅ 已完成 ${i}/${count} 关`);
      }
    }
    
    console.log(`🎉 ${difficulty} 难度完成！`);
    return levels;
  }
}

// 生成所有难度的关卡
async function generateAllNonogramLevels() {
  const generator = new EfficientNonogramGenerator();
  const difficulties = ['easy', 'medium', 'hard', 'expert', 'master'];
  
  console.log('🚀 开始生成数织关卡...');
  console.log('📊 总计: 5个难度 × 50关 = 250关\n');
  
  for (const difficulty of difficulties) {
    const startTime = Date.now();
    const levels = generator.generateAllLevels(difficulty, 50);
    const endTime = Date.now();
    
    // 保存到文件
    const filename = path.join(__dirname, 'nonogram', `${difficulty}.json`);
    try {
      fs.writeFileSync(filename, JSON.stringify(levels, null, 2), 'utf8');
      console.log(`💾 ${difficulty}.json 已保存`);
    } catch (error) {
      console.error(`❌ 保存 ${difficulty}.json 失败:`, error.message);
    }
    
    console.log(`⏱️  ${difficulty} 用时: ${(endTime - startTime) / 1000}秒\n`);
  }
  
  console.log('🎉 所有关卡生成完成！');
}

// 运行生成器
if (require.main === module) {
  generateAllNonogramLevels();
}

module.exports = { EfficientNonogramGenerator };