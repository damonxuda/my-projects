// 数字华容道关卡生成器
// 每个难度50关，关卡通过种子生成保证可复现

class Puzzle15LevelGenerator {
  constructor() {
    this.levelsPerDifficulty = 50;
  }

  // 使用种子生成随机数（保证相同种子生成相同关卡）
  seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  // 生成指定难度和编号的关卡
  generateLevel(difficulty, levelNumber) {
    if (levelNumber < 1 || levelNumber > this.levelsPerDifficulty) {
      throw new Error('Invalid level number');
    }

    const config = PUZZLE15_DIFFICULTIES[difficulty];
    if (!config) {
      throw new Error('Invalid difficulty');
    }

    // 使用难度和关卡号作为种子
    const seed = this.getLevelSeed(difficulty, levelNumber);

    return {
      difficulty: difficulty,
      levelNumber: levelNumber,
      size: config.size,
      shuffleMoves: this.calculateShuffleMoves(config.shuffleMoves, levelNumber),
      seed: seed,
      starThresholds: config.starThresholds
    };
  }

  // 计算打乱步数（随关卡递增难度）
  calculateShuffleMoves(baseMoves, levelNumber) {
    // 前50关使用基础步数
    // 之后每50关增加20%
    const tier = Math.floor((levelNumber - 1) / 50);
    const multiplier = 1 + (tier * 0.2);
    return Math.floor(baseMoves * multiplier);
  }

  // 获取关卡种子
  getLevelSeed(difficulty, levelNumber) {
    const difficultySeeds = {
      'easy': 1000,
      'medium': 2000,
      'hard': 3000
    };

    return difficultySeeds[difficulty] + levelNumber;
  }

  // 获取所有难度
  getAllDifficulties() {
    return Object.keys(PUZZLE15_DIFFICULTIES);
  }

  // 获取难度配置
  getDifficultyConfig(difficulty) {
    return PUZZLE15_DIFFICULTIES[difficulty];
  }

  // 获取难度的总关卡数
  getTotalLevels() {
    return this.levelsPerDifficulty;
  }
}

// 全局关卡生成器实例
const levelGenerator = new Puzzle15LevelGenerator();
