// 数织游戏核心逻辑
// 实现数织(Nonogram/Picross)游戏的核心算法和逻辑

class NonogramEngine {
  constructor() {
    this.grid = null;          // 当前游戏网格状态
    this.solution = null;      // 正确答案
    this.rowClues = [];        // 行线索
    this.colClues = [];        // 列线索
    this.size = 5;             // 网格尺寸
    this.completed = false;    // 是否完成
    this.mode = 'fill';        // 当前模式: 'fill' 或 'mark'
    this.startTime = null;     // 游戏开始时间
    this.errors = 0;           // 错误次数
    this.hintsUsed = 0;        // 使用提示次数
    
    // 格子状态常量
    this.CELL_STATES = {
      EMPTY: 0,     // 空白
      FILLED: 1,    // 填充
      MARKED: 2     // 标记为空
    };
  }

  // 初始化游戏
  initGame(levelData) {
    try {
      this.size = levelData.size;
      this.solution = this.deepCopy(levelData.solution);
      this.rowClues = this.deepCopy(levelData.row_clues);
      this.colClues = this.deepCopy(levelData.col_clues);
      
      // 初始化空白网格
      this.grid = Array(this.size).fill(null).map(() => 
        Array(this.size).fill(this.CELL_STATES.EMPTY)
      );
      
      this.completed = false;
      this.startTime = Date.now();
      this.errors = 0;
      this.hintsUsed = 0;
      
      console.log('NonogramEngine initialized:', {
        size: this.size,
        rowClues: this.rowClues,
        colClues: this.colClues
      });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize nonogram game:', error);
      return false;
    }
  }

  // 深拷贝辅助函数
  deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // 点击格子
  clickCell(row, col) {
    if (this.completed || row < 0 || row >= this.size || col < 0 || col >= this.size) {
      return { success: false, reason: 'invalid' };
    }

    const currentState = this.grid[row][col];
    let newState;

    if (this.mode === 'fill') {
      // 填充模式：空白->填充->空白
      newState = currentState === this.CELL_STATES.FILLED ? 
                 this.CELL_STATES.EMPTY : 
                 this.CELL_STATES.FILLED;
    } else {
      // 标记模式：空白->标记->空白
      newState = currentState === this.CELL_STATES.MARKED ? 
                 this.CELL_STATES.EMPTY : 
                 this.CELL_STATES.MARKED;
    }

    this.grid[row][col] = newState;

    // 检查是否完成
    const isComplete = this.checkCompletion();
    if (isComplete) {
      this.completed = true;
    }

    return {
      success: true,
      newState: newState,
      isComplete: isComplete,
      progress: this.getProgress()
    };
  }

  // 切换游戏模式
  setMode(mode) {
    if (mode === 'fill' || mode === 'mark') {
      this.mode = mode;
      return true;
    }
    return false;
  }

  // 获取当前模式
  getMode() {
    return this.mode;
  }

  // 检查游戏是否完成
  checkCompletion() {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const currentState = this.grid[row][col];
        const shouldBeFilled = this.solution[row][col] === 1;
        
        if (shouldBeFilled && currentState !== this.CELL_STATES.FILLED) {
          return false;
        }
        if (!shouldBeFilled && currentState === this.CELL_STATES.FILLED) {
          return false;
        }
      }
    }
    return true;
  }

  // 获取游戏进度（0-1）
  getProgress() {
    let correct = 0;
    let total = 0;
    
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const currentState = this.grid[row][col];
        const shouldBeFilled = this.solution[row][col] === 1;
        
        total++;
        
        if (shouldBeFilled && currentState === this.CELL_STATES.FILLED) {
          correct++;
        } else if (!shouldBeFilled && currentState !== this.CELL_STATES.FILLED) {
          correct++;
        }
      }
    }
    
    return total > 0 ? correct / total : 0;
  }

  // 验证当前状态并标记错误
  validateAndShowErrors() {
    const errors = [];
    
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const currentState = this.grid[row][col];
        const shouldBeFilled = this.solution[row][col] === 1;
        
        // 检查填充错误
        if (currentState === this.CELL_STATES.FILLED && !shouldBeFilled) {
          errors.push({ row, col, type: 'wrongFill' });
        }
      }
    }
    
    this.errors += errors.length;
    return errors;
  }

  // 提供提示
  giveHint() {
    if (this.completed) return null;

    // 查找一个应该填充但还没有填充的格子
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const currentState = this.grid[row][col];
        const shouldBeFilled = this.solution[row][col] === 1;
        
        if (shouldBeFilled && currentState !== this.CELL_STATES.FILLED) {
          this.hintsUsed++;
          return { row, col, action: 'fill' };
        }
      }
    }

    // 查找一个不应该填充但填充了的格子
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const currentState = this.grid[row][col];
        const shouldBeFilled = this.solution[row][col] === 1;
        
        if (!shouldBeFilled && currentState === this.CELL_STATES.FILLED) {
          this.hintsUsed++;
          return { row, col, action: 'clear' };
        }
      }
    }

    return null; // 没有可提示的内容
  }

  // 自动标记已完成的行/列
  autoMarkCompleted() {
    const markedCells = [];

    // 检查行
    for (let row = 0; row < this.size; row++) {
      if (this.isRowCompleted(row)) {
        for (let col = 0; col < this.size; col++) {
          if (this.grid[row][col] === this.CELL_STATES.EMPTY && this.solution[row][col] === 0) {
            this.grid[row][col] = this.CELL_STATES.MARKED;
            markedCells.push({ row, col });
          }
        }
      }
    }

    // 检查列
    for (let col = 0; col < this.size; col++) {
      if (this.isColCompleted(col)) {
        for (let row = 0; row < this.size; row++) {
          if (this.grid[row][col] === this.CELL_STATES.EMPTY && this.solution[row][col] === 0) {
            this.grid[row][col] = this.CELL_STATES.MARKED;
            markedCells.push({ row, col });
          }
        }
      }
    }

    return markedCells;
  }

  // 检查行是否完成
  isRowCompleted(row) {
    let filledGroups = [];
    let currentGroup = 0;

    for (let col = 0; col < this.size; col++) {
      if (this.grid[row][col] === this.CELL_STATES.FILLED) {
        currentGroup++;
      } else {
        if (currentGroup > 0) {
          filledGroups.push(currentGroup);
          currentGroup = 0;
        }
      }
    }

    if (currentGroup > 0) {
      filledGroups.push(currentGroup);
    }

    // 比较填充组和线索
    const clues = this.rowClues[row];
    if (filledGroups.length !== clues.length) return false;

    for (let i = 0; i < filledGroups.length; i++) {
      if (filledGroups[i] !== clues[i]) return false;
    }

    return true;
  }

  // 检查列是否完成
  isColCompleted(col) {
    let filledGroups = [];
    let currentGroup = 0;

    for (let row = 0; row < this.size; row++) {
      if (this.grid[row][col] === this.CELL_STATES.FILLED) {
        currentGroup++;
      } else {
        if (currentGroup > 0) {
          filledGroups.push(currentGroup);
          currentGroup = 0;
        }
      }
    }

    if (currentGroup > 0) {
      filledGroups.push(currentGroup);
    }

    // 比较填充组和线索
    const clues = this.colClues[col];
    if (filledGroups.length !== clues.length) return false;

    for (let i = 0; i < filledGroups.length; i++) {
      if (filledGroups[i] !== clues[i]) return false;
    }

    return true;
  }

  // 重置游戏
  reset() {
    this.grid = Array(this.size).fill(null).map(() => 
      Array(this.size).fill(this.CELL_STATES.EMPTY)
    );
    this.completed = false;
    this.startTime = Date.now();
    this.errors = 0;
    this.hintsUsed = 0;
  }

  // 获取游戏统计
  getGameStats() {
    const currentTime = this.completed ? 
      (this.endTime || Date.now()) : 
      Date.now();
    
    const timeElapsed = Math.floor((currentTime - this.startTime) / 1000);
    
    return {
      timeElapsed,
      errors: this.errors,
      hintsUsed: this.hintsUsed,
      progress: this.getProgress(),
      completed: this.completed
    };
  }

  // 计算星级评分
  calculateStars(timeElapsed, estimatedTime) {
    const timeRatio = timeElapsed / estimatedTime;
    
    // 基础星级计算
    let stars = 3;
    
    // 时间惩罚
    if (timeRatio > 1.5) stars = Math.max(1, stars - 1);
    if (timeRatio > 2.0) stars = Math.max(1, stars - 1);
    
    // 错误惩罚
    if (this.errors > 3) stars = Math.max(1, stars - 1);
    if (this.errors > 6) stars = Math.max(1, stars - 1);
    
    // 提示惩罚
    if (this.hintsUsed > 2) stars = Math.max(1, stars - 1);
    
    return Math.max(1, stars);
  }

  // 获取网格状态
  getGridState() {
    return this.deepCopy(this.grid);
  }

  // 设置网格状态（用于恢复游戏）
  setGridState(gridState) {
    if (gridState && gridState.length === this.size && gridState[0].length === this.size) {
      this.grid = this.deepCopy(gridState);
      this.completed = this.checkCompletion();
      return true;
    }
    return false;
  }

  // 获取行线索完成状态
  getRowClueStates() {
    return this.rowClues.map((clues, row) => this.isRowCompleted(row));
  }

  // 获取列线索完成状态
  getColClueStates() {
    return this.colClues.map((clues, col) => this.isColCompleted(col));
  }
}

// 导出到全局作用域
if (typeof window !== 'undefined') {
  window.NonogramEngine = NonogramEngine;
}

// 模块导出（如果支持）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NonogramEngine;
}