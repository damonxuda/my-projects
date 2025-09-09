// 修复重复关卡问题
// 生成唯一的简单难度关卡

const fs = require('fs');
const path = require('path');
const { EfficientNonogramGenerator } = require('./efficient_nonogram_generator.js');

class UniqueNonogramGenerator extends EfficientNonogramGenerator {
  constructor() {
    super();
    this.generatedPatterns = new Set(); // 跟踪已生成的图案
  }

  // 检查图案是否已存在
  patternExists(pattern) {
    const patternStr = JSON.stringify(pattern);
    return this.generatedPatterns.has(patternStr);
  }

  // 添加图案到集合
  addPattern(pattern) {
    const patternStr = JSON.stringify(pattern);
    this.generatedPatterns.add(patternStr);
  }

  // 生成唯一的5x5图案
  generateUnique5x5Pattern() {
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
      // 生成多种不同类型的图案
      let pattern;
      const patternType = Math.floor(Math.random() * 8);
      
      switch (patternType) {
        case 0: // 对角线
          pattern = this.generateDiagonalPattern();
          break;
        case 1: // 边框
          pattern = this.generateBorderPattern();
          break;
        case 2: // 中心点
          pattern = this.generateCenterPattern();
          break;
        case 3: // L形
          pattern = this.generateLShape();
          break;
        case 4: // T形
          pattern = this.generateTShape();
          break;
        case 5: // 随机散点
          pattern = this.generateScatteredDots();
          break;
        case 6: // 简单几何
          pattern = this.generateSimpleGeometry();
          break;
        default: // 结构化图案
          pattern = this.generateStructuredPattern(5, 0.4);
      }
      
      // 随机翻转/旋转以增加变化
      pattern = this.applyRandomTransform(pattern);
      
      if (!this.patternExists(pattern)) {
        this.addPattern(pattern);
        return pattern;
      }
      
      attempts++;
    }
    
    // 如果无法生成唯一图案，回退到完全随机
    return this.generateRandomUniquePattern();
  }

  // 生成对角线图案
  generateDiagonalPattern() {
    const pattern = Array(5).fill(null).map(() => Array(5).fill(0));
    const diagonal = Math.random() > 0.5 ? 'main' : 'anti';
    
    for (let i = 0; i < 5; i++) {
      if (diagonal === 'main') {
        pattern[i][i] = 1;
      } else {
        pattern[i][4-i] = 1;
      }
    }
    
    // 可能添加一些额外的点
    if (Math.random() > 0.5) {
      const extraDots = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < extraDots; i++) {
        const r = Math.floor(Math.random() * 5);
        const c = Math.floor(Math.random() * 5);
        pattern[r][c] = 1;
      }
    }
    
    return pattern;
  }

  // 生成边框图案
  generateBorderPattern() {
    const pattern = Array(5).fill(null).map(() => Array(5).fill(0));
    
    // 随机选择边框类型
    const borderType = Math.floor(Math.random() * 3);
    
    if (borderType === 0) {
      // 完整边框
      for (let i = 0; i < 5; i++) {
        pattern[0][i] = 1; // 上边
        pattern[4][i] = 1; // 下边
        pattern[i][0] = 1; // 左边
        pattern[i][4] = 1; // 右边
      }
    } else if (borderType === 1) {
      // 部分边框
      for (let i = 1; i < 4; i++) {
        pattern[0][i] = 1; // 上边
        pattern[4][i] = 1; // 下边
      }
    } else {
      // L形边框
      for (let i = 0; i < 5; i++) {
        pattern[4][i] = 1; // 下边
        pattern[i][0] = 1; // 左边
      }
    }
    
    return pattern;
  }

  // 生成中心图案
  generateCenterPattern() {
    const pattern = Array(5).fill(null).map(() => Array(5).fill(0));
    const centerType = Math.floor(Math.random() * 3);
    
    if (centerType === 0) {
      // 中心点
      pattern[2][2] = 1;
    } else if (centerType === 1) {
      // 中心十字
      pattern[2][1] = pattern[2][2] = pattern[2][3] = 1;
      pattern[1][2] = pattern[3][2] = 1;
    } else {
      // 中心方形
      pattern[1][1] = pattern[1][2] = pattern[1][3] = 1;
      pattern[2][1] = pattern[2][3] = 1;
      pattern[3][1] = pattern[3][2] = pattern[3][3] = 1;
    }
    
    return pattern;
  }

  // 生成L形
  generateLShape() {
    const pattern = Array(5).fill(null).map(() => Array(5).fill(0));
    const orientation = Math.floor(Math.random() * 4);
    
    // 基本L形
    const positions = [
      [[0,0],[0,1],[0,2],[1,0],[2,0]],    // 左上
      [[0,2],[0,3],[0,4],[1,4],[2,4]],    // 右上  
      [[2,0],[3,0],[4,0],[4,1],[4,2]],    // 左下
      [[2,4],[3,4],[4,4],[4,3],[4,2]]     // 右下
    ];
    
    positions[orientation].forEach(([r,c]) => {
      pattern[r][c] = 1;
    });
    
    return pattern;
  }

  // 生成T形
  generateTShape() {
    const pattern = Array(5).fill(null).map(() => Array(5).fill(0));
    const orientation = Math.floor(Math.random() * 4);
    
    if (orientation === 0) {
      // 正T
      pattern[0][1] = pattern[0][2] = pattern[0][3] = 1;
      pattern[1][2] = pattern[2][2] = 1;
    } else if (orientation === 1) {
      // 右T
      pattern[1][4] = pattern[2][4] = pattern[3][4] = 1;
      pattern[2][2] = pattern[2][3] = 1;
    } else if (orientation === 2) {
      // 倒T
      pattern[4][1] = pattern[4][2] = pattern[4][3] = 1;
      pattern[2][2] = pattern[3][2] = 1;
    } else {
      // 左T
      pattern[1][0] = pattern[2][0] = pattern[3][0] = 1;
      pattern[2][1] = pattern[2][2] = 1;
    }
    
    return pattern;
  }

  // 生成散点图案
  generateScatteredDots() {
    const pattern = Array(5).fill(null).map(() => Array(5).fill(0));
    const dotCount = Math.floor(Math.random() * 5) + 3; // 3-7个点
    
    for (let i = 0; i < dotCount; i++) {
      let r, c;
      do {
        r = Math.floor(Math.random() * 5);
        c = Math.floor(Math.random() * 5);
      } while (pattern[r][c] === 1);
      
      pattern[r][c] = 1;
    }
    
    return pattern;
  }

  // 生成简单几何图案
  generateSimpleGeometry() {
    const pattern = Array(5).fill(null).map(() => Array(5).fill(0));
    const shapeType = Math.floor(Math.random() * 4);
    
    switch (shapeType) {
      case 0: // 小方形
        pattern[1][1] = pattern[1][2] = 1;
        pattern[2][1] = pattern[2][2] = 1;
        break;
      case 1: // 小十字
        pattern[2][2] = 1;
        pattern[1][2] = pattern[3][2] = 1;
        pattern[2][1] = pattern[2][3] = 1;
        break;
      case 2: // 对角方形
        pattern[0][2] = 1;
        pattern[1][1] = pattern[1][3] = 1;
        pattern[2][0] = pattern[2][4] = 1;
        pattern[3][1] = pattern[3][3] = 1;
        pattern[4][2] = 1;
        break;
      case 3: // 简单线条
        const isVertical = Math.random() > 0.5;
        const pos = Math.floor(Math.random() * 3) + 1;
        if (isVertical) {
          for (let r = 1; r < 4; r++) pattern[r][pos] = 1;
        } else {
          for (let c = 1; c < 4; c++) pattern[pos][c] = 1;
        }
        break;
    }
    
    return pattern;
  }

  // 应用随机变换
  applyRandomTransform(pattern) {
    let result = pattern.map(row => [...row]);
    
    // 随机水平翻转
    if (Math.random() > 0.5) {
      result = result.map(row => row.reverse());
    }
    
    // 随机垂直翻转
    if (Math.random() > 0.5) {
      result = result.reverse();
    }
    
    // 随机旋转90度（50%概率）
    if (Math.random() > 0.5) {
      const size = result.length;
      const rotated = Array(size).fill(null).map(() => Array(size).fill(0));
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          rotated[c][size-1-r] = result[r][c];
        }
      }
      result = rotated;
    }
    
    return result;
  }

  // 生成完全随机但唯一的图案
  generateRandomUniquePattern() {
    let attempts = 0;
    while (attempts < 1000) {
      const pattern = Array(5).fill(null).map(() => 
        Array(5).fill(0).map(() => Math.random() > 0.6 ? 1 : 0)
      );
      
      if (!this.patternExists(pattern)) {
        this.addPattern(pattern);
        return pattern;
      }
      attempts++;
    }
    
    // 最后的回退：基于时间戳生成
    const pattern = Array(5).fill(null).map(() => Array(5).fill(0));
    const seed = Date.now() + Math.random();
    const fillCount = Math.floor(seed % 10) + 5; // 5-14个填充
    
    for (let i = 0; i < fillCount; i++) {
      const r = Math.floor((seed + i * 17) % 5);
      const c = Math.floor((seed + i * 23) % 5);
      pattern[r][c] = 1;
    }
    
    return pattern;
  }

  // 重新生成简单难度关卡
  generateAllEasyLevels() {
    console.log('🎯 重新生成简单难度关卡（确保无重复）...');
    const levels = [];
    
    // 先添加经典图案的哈希以避免冲突
    this.classic5x5.forEach(classic => {
      this.addPattern(classic.pattern);
    });
    
    // 生成前10关（经典图案）
    for (let i = 1; i <= 10; i++) {
      const classic = this.classic5x5[i - 1];
      const clues = this.generateClues(classic.pattern);
      
      levels.push({
        level: i,
        difficulty: "easy",
        size: 5,
        solution: classic.pattern,
        row_clues: clues.rows,
        col_clues: clues.cols,
        estimated_time: 60,
        theme: classic.theme,
        title: classic.title,
        source: "classic",
        created_at: new Date().toISOString()
      });
    }
    
    // 生成11-50关（唯一生成图案）
    for (let i = 11; i <= 50; i++) {
      const pattern = this.generateUnique5x5Pattern();
      const clues = this.generateClues(pattern);
      const theme = this.getRandomTheme();
      const title = this.getRandomTitle(theme);
      
      levels.push({
        level: i,
        difficulty: "easy",
        size: 5,
        solution: pattern,
        row_clues: clues.rows,
        col_clues: clues.cols,
        estimated_time: this.calculateEstimatedTime('easy', 5),
        theme: theme,
        title: title,
        source: "unique_generated",
        created_at: new Date().toISOString()
      });
      
      if (i % 10 === 0) {
        console.log(`  ✅ 已完成 ${i}/50 关`);
      }
    }
    
    console.log(`🎉 简单难度 50 个唯一关卡生成完成！`);
    return levels;
  }
}

// 生成修复的简单关卡
async function fixEasyLevels() {
  const generator = new UniqueNonogramGenerator();
  const levels = generator.generateAllEasyLevels();
  
  // 保存到文件
  const filename = path.join(__dirname, 'nonogram', 'easy.json');
  try {
    fs.writeFileSync(filename, JSON.stringify(levels, null, 2), 'utf8');
    console.log(`💾 修复的简单关卡已保存到 ${filename}`);
    
    // 验证无重复
    const patterns = new Set();
    let duplicateCount = 0;
    
    levels.forEach(level => {
      const patternStr = JSON.stringify(level.solution);
      if (patterns.has(patternStr)) {
        duplicateCount++;
      } else {
        patterns.add(patternStr);
      }
    });
    
    if (duplicateCount === 0) {
      console.log('✅ 验证完成：所有关卡都是唯一的！');
    } else {
      console.log(`❌ 仍有 ${duplicateCount} 个重复关卡`);
    }
    
  } catch (error) {
    console.error(`❌ 保存文件失败:`, error.message);
  }
}

// 运行修复
if (require.main === module) {
  fixEasyLevels();
}

module.exports = { UniqueNonogramGenerator };