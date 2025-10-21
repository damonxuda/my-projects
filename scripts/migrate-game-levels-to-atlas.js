#!/usr/bin/env node
// 关卡数据迁移脚本：本地文件 → MongoDB Atlas
// 用法：node scripts/migrate-game-levels-to-atlas.js [action]
// 示例：
//   node scripts/migrate-game-levels-to-atlas.js migrate
//   node scripts/migrate-game-levels-to-atlas.js verify
//   node scripts/migrate-game-levels-to-atlas.js clear

require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB Atlas 连接配置（从环境变量读取）
const MONGODB_URI = process.env.MONGODB_ATLAS_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'game_db';
const COLLECTION_NAME = 'game_levels';

// 验证环境变量
if (!MONGODB_URI) {
  console.error('❌ 错误: 缺少环境变量 MONGODB_ATLAS_URI');
  console.error('请创建 .env 文件并设置 MONGODB_ATLAS_URI');
  console.error('参考 .env.example 文件');
  process.exit(1);
}

let client;
let db;

/**
 * 连接到 MongoDB Atlas
 */
async function connect() {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('✅ 已连接到 MongoDB Atlas');
    return db;
  } catch (error) {
    console.error('❌ 连接失败:', error);
    throw error;
  }
}

/**
 * 关闭数据库连接
 */
async function disconnect() {
  if (client) {
    await client.close();
    console.log('✅ 已断开数据库连接');
  }
}

/**
 * 迁移所有游戏关卡
 */
async function migrateAllLevels() {
  console.log('========== 开始迁移所有游戏关卡 ==========');

  const results = {
    sudoku: await migrateSudokuLevels(),
    nonogram: await migrateNonogramLevels(),
    klotski: await migrateKlotskiLevels(),
    puzzle15: await migratePuzzle15Levels()
  };

  const totalSuccess = Object.values(results).filter(r => r.success).length;
  const totalFailed = Object.values(results).filter(r => !r.success).length;

  console.log('========== 迁移完成 ==========');
  console.log(`✅ 成功: ${totalSuccess} 个游戏`);
  console.log(`❌ 失败: ${totalFailed} 个游戏`);

  return {
    success: totalFailed === 0,
    summary: {
      total_games: 4,
      successful: totalSuccess,
      failed: totalFailed
    },
    details: results
  };
}

/**
 * 迁移数独关卡
 */
async function migrateSudokuLevels() {
  console.log('📥 迁移数独关卡...');

  try {
    const difficulties = ['easy', 'medium', 'hard', 'expert', 'master'];
    let migrated = 0;
    let updated = 0;
    const collection = db.collection(COLLECTION_NAME);

    for (const difficulty of difficulties) {
      const filePath = path.join(__dirname, `../games/shared/levels/sudoku/${difficulty}.json`);
      const levels = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      console.log(`  处理难度: ${difficulty}, 关卡数: ${levels.length}`);

      // 检查是否已存在
      const existing = await collection.findOne({ game: 'sudoku', difficulty });

      const levelData = {
        game: 'sudoku',
        difficulty,
        level_count: levels.length,
        levels,
        updated_at: new Date().toISOString()
      };

      if (existing) {
        // 更新现有记录
        await collection.updateOne(
          { _id: existing._id },
          { $set: levelData }
        );
        updated++;
        console.log(`  ✏️  更新: ${difficulty} (${levels.length} 关)`);
      } else {
        // 插入新记录
        levelData.created_at = new Date().toISOString();
        await collection.insertOne(levelData);
        migrated++;
        console.log(`  ➕ 新增: ${difficulty} (${levels.length} 关)`);
      }
    }

    console.log(`✅ 数独迁移完成: 新增 ${migrated}, 更新 ${updated}`);

    return {
      success: true,
      game: 'sudoku',
      migrated,
      updated,
      total_difficulties: difficulties.length,
      total_levels: difficulties.length * 50
    };

  } catch (error) {
    console.error('❌ 数独迁移失败:', error);
    return {
      success: false,
      game: 'sudoku',
      error: error.message
    };
  }
}

/**
 * 迁移数织关卡
 */
async function migrateNonogramLevels() {
  console.log('📥 迁移数织关卡...');

  try {
    const difficulties = ['easy', 'medium', 'hard', 'expert', 'master'];
    let migrated = 0;
    let updated = 0;
    const collection = db.collection(COLLECTION_NAME);

    for (const difficulty of difficulties) {
      const filePath = path.join(__dirname, `../games/shared/levels/nonogram/${difficulty}.json`);
      const levels = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      console.log(`  处理难度: ${difficulty}, 关卡数: ${levels.length}`);

      // 检查是否已存在
      const existing = await collection.findOne({ game: 'nonogram', difficulty });

      const levelData = {
        game: 'nonogram',
        difficulty,
        level_count: levels.length,
        levels,
        updated_at: new Date().toISOString()
      };

      if (existing) {
        // 更新现有记录
        await collection.updateOne(
          { _id: existing._id },
          { $set: levelData }
        );
        updated++;
        console.log(`  ✏️  更新: ${difficulty} (${levels.length} 关)`);
      } else {
        // 插入新记录
        levelData.created_at = new Date().toISOString();
        await collection.insertOne(levelData);
        migrated++;
        console.log(`  ➕ 新增: ${difficulty} (${levels.length} 关)`);
      }
    }

    console.log(`✅ 数织迁移完成: 新增 ${migrated}, 更新 ${updated}`);

    return {
      success: true,
      game: 'nonogram',
      migrated,
      updated,
      total_difficulties: difficulties.length,
      total_levels: difficulties.length * 50
    };

  } catch (error) {
    console.error('❌ 数织迁移失败:', error);
    return {
      success: false,
      game: 'nonogram',
      error: error.message
    };
  }
}

/**
 * 迁移华容道关卡
 */
async function migrateKlotskiLevels() {
  console.log('📥 迁移华容道关卡...');

  try {
    // 读取华容道关卡文件
    const levelsPath = path.join(__dirname, '../games/klotski/levels.js');
    const levelsContent = fs.readFileSync(levelsPath, 'utf-8');

    // 提取 KLOTSKI_LEVELS 数组
    // 使用简单的正则提取（因为是JSON-like的数组）
    const match = levelsContent.match(/const KLOTSKI_LEVELS = (\[[\s\S]*?\]);/);
    if (!match) {
      throw new Error('无法从 levels.js 提取关卡数据');
    }

    const levels = eval(match[1]); // 注意：eval 仅用于受信任的本地文件

    console.log(`  关卡数: ${levels.length}`);

    const collection = db.collection(COLLECTION_NAME);
    const existing = await collection.findOne({ game: 'klotski' });

    const levelData = {
      game: 'klotski',
      difficulty: 'all',
      level_count: levels.length,
      levels,
      updated_at: new Date().toISOString()
    };

    let migrated = 0;
    let updated = 0;

    if (existing) {
      await collection.updateOne(
        { _id: existing._id },
        { $set: levelData }
      );
      updated = 1;
      console.log(`  ✏️  更新: all (${levels.length} 关)`);
    } else {
      levelData.created_at = new Date().toISOString();
      await collection.insertOne(levelData);
      migrated = 1;
      console.log(`  ➕ 新增: all (${levels.length} 关)`);
    }

    console.log(`✅ 华容道迁移完成: 新增 ${migrated}, 更新 ${updated}`);

    return {
      success: true,
      game: 'klotski',
      migrated,
      updated,
      total_difficulties: 1,
      total_levels: levels.length
    };

  } catch (error) {
    console.error('❌ 华容道迁移失败:', error);
    return {
      success: false,
      game: 'klotski',
      error: error.message
    };
  }
}

/**
 * 迁移拼图15关卡配置
 */
async function migratePuzzle15Levels() {
  console.log('📥 迁移拼图15关卡配置...');

  try {
    // 简化的 Puzzle15LevelGenerator（内联实现）
    class Puzzle15LevelGenerator {
      constructor() {
        this.levelsPerDifficulty = 50;
        this.difficulties = {
          easy: { size: 3, shuffleMoves: 10, starThresholds: { 3: 30, 2: 60, 1: 120 } },
          medium: { size: 4, shuffleMoves: 20, starThresholds: { 3: 60, 2: 120, 1: 240 } },
          hard: { size: 5, shuffleMoves: 30, starThresholds: { 3: 120, 2: 240, 1: 480 } }
        };
      }

      getLevelSeed(difficulty, levelNumber) {
        const difficultySeeds = { easy: 1000, medium: 2000, hard: 3000 };
        return difficultySeeds[difficulty] + levelNumber;
      }

      calculateShuffleMoves(baseMoves, levelNumber) {
        const progressRatio = (levelNumber - 1) / (this.levelsPerDifficulty - 1);
        const multiplier = 1.0 + progressRatio;
        return Math.floor(baseMoves * multiplier);
      }

      generateLevel(difficulty, levelNumber) {
        const config = this.difficulties[difficulty];
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
    }

    const generator = new Puzzle15LevelGenerator();
    const difficulties = ['easy', 'medium', 'hard'];
    let migrated = 0;
    let updated = 0;
    const collection = db.collection(COLLECTION_NAME);

    for (const difficulty of difficulties) {
      const levelCount = 50; // 每个难度50关
      const levels = [];

      for (let i = 1; i <= levelCount; i++) {
        const levelConfig = generator.generateLevel(difficulty, i);
        levels.push(levelConfig);
      }

      console.log(`  处理难度: ${difficulty}, 关卡数: ${levels.length}`);

      const existing = await collection.findOne({ game: 'puzzle15', difficulty });

      const levelData = {
        game: 'puzzle15',
        difficulty,
        level_count: levels.length,
        levels,
        updated_at: new Date().toISOString()
      };

      if (existing) {
        await collection.updateOne(
          { _id: existing._id },
          { $set: levelData }
        );
        updated++;
        console.log(`  ✏️  更新: ${difficulty} (${levels.length} 关)`);
      } else {
        levelData.created_at = new Date().toISOString();
        await collection.insertOne(levelData);
        migrated++;
        console.log(`  ➕ 新增: ${difficulty} (${levels.length} 关)`);
      }
    }

    console.log(`✅ 拼图15迁移完成: 新增 ${migrated}, 更新 ${updated}`);

    return {
      success: true,
      game: 'puzzle15',
      migrated,
      updated,
      total_difficulties: difficulties.length,
      total_levels: difficulties.length * 50
    };

  } catch (error) {
    console.error('❌ 拼图15迁移失败:', error);
    return {
      success: false,
      game: 'puzzle15',
      error: error.message
    };
  }
}

/**
 * 验证迁移结果
 */
async function verifyMigration() {
  console.log('========== 验证迁移结果 ==========');

  try {
    const verification = [];
    const collection = db.collection(COLLECTION_NAME);

    // 验证数独 (5个难度 × 50关 = 250关)
    const sudokuDifficulties = ['easy', 'medium', 'hard', 'expert', 'master'];
    for (const difficulty of sudokuDifficulties) {
      const result = await collection.findOne({ game: 'sudoku', difficulty });
      const exists = !!result;
      const levelCount = exists ? result.level_count : 0;

      verification.push({
        game: 'sudoku',
        difficulty,
        exists,
        level_count: levelCount,
        status: exists ? '✅ 存在' : '❌ 缺失'
      });

      console.log(`数独 ${difficulty}: ${exists ? '✅' : '❌'} (${levelCount} 关)`);
    }

    // 验证数织 (5个难度 × 50关 = 250关)
    const nonogramDifficulties = ['easy', 'medium', 'hard', 'expert', 'master'];
    for (const difficulty of nonogramDifficulties) {
      const result = await collection.findOne({ game: 'nonogram', difficulty });
      const exists = !!result;
      const levelCount = exists ? result.level_count : 0;

      verification.push({
        game: 'nonogram',
        difficulty,
        exists,
        level_count: levelCount,
        status: exists ? '✅ 存在' : '❌ 缺失'
      });

      console.log(`数织 ${difficulty}: ${exists ? '✅' : '❌'} (${levelCount} 关)`);
    }

    // 验证华容道 (21关)
    const klotskiResult = await collection.findOne({ game: 'klotski' });
    const klotskiExists = !!klotskiResult;
    const klotskiLevelCount = klotskiExists ? klotskiResult.level_count : 0;

    verification.push({
      game: 'klotski',
      difficulty: 'all',
      exists: klotskiExists,
      level_count: klotskiLevelCount,
      status: klotskiExists ? '✅ 存在' : '❌ 缺失'
    });

    console.log(`华容道 all: ${klotskiExists ? '✅' : '❌'} (${klotskiLevelCount} 关)`);

    // 验证拼图15 (3个难度 × 50关 = 150关)
    const puzzle15Difficulties = ['easy', 'medium', 'hard'];
    for (const difficulty of puzzle15Difficulties) {
      const result = await collection.findOne({ game: 'puzzle15', difficulty });
      const exists = !!result;
      const levelCount = exists ? result.level_count : 0;

      verification.push({
        game: 'puzzle15',
        difficulty,
        exists,
        level_count: levelCount,
        status: exists ? '✅ 存在' : '❌ 缺失'
      });

      console.log(`拼图15 ${difficulty}: ${exists ? '✅' : '❌'} (${levelCount} 关)`);
    }

    // 总体统计
    const allExists = verification.every(v => v.exists);
    const totalLevels = verification.reduce((sum, v) => sum + v.level_count, 0);

    console.log('========== 验证结果 ==========');
    console.log(`总文档数: ${verification.filter(v => v.exists).length}`);
    console.log(`总关卡数: ${totalLevels} (预期: 671 = 250数独 + 250数织 + 21华容道 + 150拼图15)`);
    console.log(`状态: ${allExists ? '✅ 全部存在' : '⚠️ 存在缺失'}`);

    return {
      success: true,
      all_exists: allExists,
      summary: {
        total_documents: verification.filter(v => v.exists).length,
        total_levels: totalLevels,
        expected_levels: 671
      },
      details: verification
    };

  } catch (error) {
    console.error('❌ 验证失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 清空关卡数据库（仅用于测试）
 */
async function clearLevelDatabase() {
  console.log('⚠️  清空关卡数据库（测试功能）...');

  try {
    const collection = db.collection(COLLECTION_NAME);
    const result = await collection.deleteMany({});

    console.log(`✅ 已删除 ${result.deletedCount} 条记录`);

    return {
      success: true,
      deleted: result.deletedCount
    };

  } catch (error) {
    console.error('❌ 清空失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 主函数
 */
async function main() {
  const action = process.argv[2] || 'migrate';

  try {
    await connect();

    let result;
    switch (action) {
      case 'migrate':
        result = await migrateAllLevels();
        break;

      case 'verify':
        result = await verifyMigration();
        break;

      case 'clear':
        result = await clearLevelDatabase();
        break;

      default:
        console.error('❌ 未知操作。支持的操作：migrate, verify, clear');
        process.exit(1);
    }

    console.log('\n========== 最终结果 ==========');
    console.log(JSON.stringify(result, null, 2));

    await disconnect();
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('❌ 执行失败:', error);
    await disconnect();
    process.exit(1);
  }
}

// 执行主函数
main();
