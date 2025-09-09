// 数织关卡生成脚本
// 基于经典图案和算法生成250个数织关卡（5个难度 × 50关）

const fs = require('fs');
const path = require('path');

// 数织引擎类
class NonogramEngine {
  constructor() {
    this.difficulties = {
      easy: { size: 5, complexity: 0.3 },
      medium: { size: 10, complexity: 0.4 },
      hard: { size: 15, complexity: 0.5 },
      expert: { size: 20, complexity: 0.6 },
      master: { size: 25, complexity: 0.7 }
    };
    
    // 经典5x5图案库
    this.classic5x5Patterns = [
      // 爱心
      { title: "爱心", theme: "symbols", pattern: [
        [0,1,0,1,0],
        [1,1,1,1,1],
        [1,1,1,1,1],
        [0,1,1,1,0],
        [0,0,1,0,0]
      ]},
      // 笑脸
      { title: "笑脸", theme: "faces", pattern: [
        [0,1,1,1,0],
        [1,0,1,0,1],
        [1,0,1,0,1],
        [1,0,0,0,1],
        [0,1,1,1,0]
      ]},
      // 房子
      { title: "房子", theme: "objects", pattern: [
        [0,0,1,0,0],
        [0,1,1,1,0],
        [1,1,1,1,1],
        [1,0,1,0,1],
        [1,1,1,1,1]
      ]},
      // 树
      { title: "树", theme: "nature", pattern: [
        [0,0,1,0,0],
        [0,1,1,1,0],
        [1,1,1,1,1],
        [0,0,1,0,0],
        [0,1,1,1,0]
      ]},
      // 星星
      { title: "星星", theme: "symbols", pattern: [
        [0,0,1,0,0],
        [0,1,1,1,0],
        [1,1,1,1,1],
        [0,1,1,1,0],
        [1,0,1,0,1]
      ]},
      // 钻石
      { title: "钻石", theme: "symbols", pattern: [
        [0,0,1,0,0],
        [0,1,1,1,0],
        [1,1,1,1,1],
        [0,1,1,1,0],
        [0,0,1,0,0]
      ]},
      // 花
      { title: "花", theme: "nature", pattern: [
        [0,1,0,1,0],
        [1,1,1,1,1],
        [0,1,1,1,0],
        [0,0,1,0,0],
        [0,1,1,1,0]
      ]},
      // 猫
      { title: "猫", theme: "animals", pattern: [
        [1,0,1,0,1],
        [0,1,1,1,0],
        [1,0,1,0,1],
        [0,1,0,1,0],
        [1,0,0,0,1]
      ]},
      // 蝴蝶
      { title: "蝴蝶", theme: "animals", pattern: [
        [1,0,1,0,1],
        [1,1,1,1,1],
        [0,1,1,1,0],
        [1,1,1,1,1],
        [1,0,1,0,1]
      ]},
      // 雨伞
      { title: "雨伞", theme: "objects", pattern: [
        [0,1,1,1,0],
        [1,1,1,1,1],
        [0,0,1,0,0],
        [0,0,1,0,0],
        [0,1,1,1,0]
      ]}
    ];

    // 经典10x10图案模板
    this.classic10x10Templates = [
      // 苹果
      { title: "苹果", theme: "food", pattern: [
        [0,0,0,1,1,0,0,0,0,0],
        [0,0,1,1,1,1,0,0,0,0],
        [0,1,1,1,1,1,1,0,0,0],
        [1,1,1,1,1,1,1,1,0,0],
        [1,1,1,1,1,1,1,1,0,0],
        [1,1,1,1,1,1,1,1,0,0],
        [1,1,1,1,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,0,0,0],
        [0,0,1,1,1,1,0,0,0,0],
        [0,0,0,1,1,0,0,0,0,0]
      ]},
      // 船
      { title: "船", theme: "vehicles", pattern: [
        [0,0,0,0,1,0,0,0,0,0],
        [0,0,0,1,1,1,0,0,0,0],
        [0,0,1,1,1,1,1,0,0,0],
        [0,0,1,1,1,1,1,0,0,0],
        [0,0,1,1,1,1,1,0,0,0],
        [0,0,0,1,1,1,0,0,0,0],
        [0,0,0,0,1,0,0,0,0,0],
        [0,1,1,1,1,1,1,1,0,0],
        [1,1,1,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1,1,1]
      ]}
    ];
  }

  // 从图案生成行列线索
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

  // 获取单行/列的线索
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

  // 生成随机图案
  generateRandomPattern(size, complexity) {
    const pattern = Array.from({ length: size }, () => Array(size).fill(0));
    const targetFilled = Math.floor(size * size * complexity);
    let filled = 0;
    
    // 随机填充
    while (filled < targetFilled) {
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);
      
      if (pattern[row][col] === 0) {
        pattern[row][col] = 1;
        filled++;
      }
    }
    
    return this.smoothPattern(pattern);
  }

  // 平滑图案
  smoothPattern(pattern) {
    const size = pattern.length;
    const smoothed = pattern.map(row => [...row]);
    
    for (let r = 1; r < size - 1; r++) {
      for (let c = 1; c < size - 1; c++) {
        let neighbors = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            neighbors += pattern[r + dr][c + dc];
          }
        }
        
        if (neighbors >= 5) {
          smoothed[r][c] = 1;
        } else if (neighbors <= 2) {
          smoothed[r][c] = 0;
        }
      }
    }
    
    return smoothed;
  }

  // 缩放图案到指定尺寸
  scalePattern(pattern, targetSize) {
    const originalSize = pattern.length;
    const scale = targetSize / originalSize;
    const scaled = Array.from({ length: targetSize }, () => Array(targetSize).fill(0));
    
    for (let r = 0; r < targetSize; r++) {
      for (let c = 0; c < targetSize; c++) {
        const origR = Math.floor(r / scale);
        const origC = Math.floor(c / scale);
        if (origR < originalSize && origC < originalSize) {
          scaled[r][c] = pattern[origR][origC];
        }
      }
    }
    
    return scaled;
  }

  // 生成关卡
  generateLevel(difficulty, levelNumber) {
    const config = this.difficulties[difficulty];
    let pattern, title = null, theme = null, source = "generated";
    
    if (difficulty === 'easy' && levelNumber <= this.classic5x5Patterns.length) {
      // 使用经典5x5图案
      const classicPattern = this.classic5x5Patterns[levelNumber - 1];
      pattern = classicPattern.pattern;
      title = classicPattern.title;
      theme = classicPattern.theme;
      source = "classic";
    } else if (difficulty === 'medium' && levelNumber <= this.classic10x10Templates.length) {
      // 使用经典10x10图案
      const classicPattern = this.classic10x10Templates[levelNumber - 1];
      pattern = classicPattern.pattern;
      title = classicPattern.title;
      theme = classicPattern.theme;
      source = "classic";
    } else if (config.size === 5 && levelNumber > this.classic5x5Patterns.length) {
      // 用5x5经典图案变种
      const baseIndex = (levelNumber - this.classic5x5Patterns.length - 1) % this.classic5x5Patterns.length;
      const basePattern = this.classic5x5Patterns[baseIndex];
      pattern = this.generateVariation(basePattern.pattern);
      theme = basePattern.theme;
      source = "variation";
    } else {
      // 生成随机图案
      pattern = this.generateRandomPattern(config.size, config.complexity);
      theme = this.getRandomTheme();
    }
    
    const clues = this.generateClues(pattern);
    const estimatedTime = this.getEstimatedTime(difficulty, config.size, pattern);
    
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

  // 生成图案变种
  generateVariation(basePattern) {
    const size = basePattern.length;
    const variation = basePattern.map(row => [...row]);
    
    // 随机翻转
    if (Math.random() > 0.5) {
      variation.reverse(); // 垂直翻转
    }
    if (Math.random() > 0.5) {
      variation.forEach(row => row.reverse()); // 水平翻转
    }
    
    return variation;
  }

  // 获取随机主题
  getRandomTheme() {
    const themes = ['abstract', 'geometric', 'random', 'pattern'];
    return themes[Math.floor(Math.random() * themes.length)];
  }

  // 计算预估时间
  getEstimatedTime(difficulty, size, pattern) {
    const baseTime = {
      easy: 60,      // 1分钟
      medium: 180,   // 3分钟
      hard: 480,     // 8分钟
      expert: 900,   // 15分钟
      master: 1800   // 30分钟
    };
    
    // 根据图案复杂度调整
    const filledCells = pattern.flat().filter(cell => cell === 1).length;
    const complexity = filledCells / (size * size);
    const adjustment = (complexity - 0.5) * baseTime[difficulty] * 0.3;
    
    return Math.max(30, Math.round(baseTime[difficulty] + adjustment));
  }
}

// 生成指定难度的关卡
function generateLevelsForDifficulty(difficulty, count = 50) {
  const engine = new NonogramEngine();
  const levels = [];
  
  console.log(`正在生成 ${difficulty} 难度的 ${count} 个数织关卡...`);
  
  for (let i = 1; i <= count; i++) {
    try {
      const level = engine.generateLevel(difficulty, i);
      levels.push(level);
      
      if (i % 10 === 0) {
        console.log(`  已完成 ${i}/${count} 关`);
      }
    } catch (error) {
      console.error(`生成第 ${i} 关时出错:`, error);
      i--; // 重试
    }
  }
  
  console.log(`✅ ${difficulty} 难度 ${count} 个关卡生成完成`);
  return levels;
}

// 保存关卡到JSON文件
function saveLevelsToFile(levels, difficulty) {
  const filename = path.join(__dirname, 'nonogram', `${difficulty}.json`);
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
  console.log('🎨 开始生成数织关卡...');
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
  
  console.log('🎉 所有数织关卡生成完成！');
  console.log('📁 文件位置: games/shared/levels/nonogram/');
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = { NonogramEngine, generateLevelsForDifficulty };