# DeepSeek 数据合并迁移指南

## 背景

由于 DeepSeek 模型在 V3 和 R1 之间切换，导致数据库中存在 `deepseek_v3` 和 `deepseek_r1` 两种不同的 agent_name。本次迁移将把这两种标识统一为 `deepseek`。

## ⚠️ 重要提醒

在模型切换过程中，可能出现过错误的重置记录（账户价值重置为 $50,000）。在执行迁移前，必须先检查并处理这些异常数据。

## 迁移步骤

### Step 1: 检查数据（必须执行）

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 复制并执行 `check-deepseek-data.sql` 中的所有查询
4. 仔细查看输出结果，特别关注：
   - **查询 4**：是否有非首次记录的价值接近 $50,000 的记录？
   - **查询 3**：是否有突然的价值跳变（value_change 列）？

### Step 2: 处理异常数据（如果发现）

如果在 Step 1 中发现了重置到 $50,000 的错误记录：

**选项 A：删除错误记录（推荐）**
1. 记下错误记录的 `created_at` 时间戳
2. 编辑 `merge-deepseek-records.sql` 文件
3. 取消注释 Step 0 中的 DELETE 语句
4. 将时间戳替换为实际的错误记录时间
5. 保存文件

**选项 B：咨询确认**
- 将查询结果截图或复制
- 与用户确认如何处理这些记录
- 根据确认结果调整迁移脚本

### Step 3: 备份数据（强烈推荐）

在 Supabase SQL Editor 中执行：

```sql
-- 备份相关表
CREATE TABLE portfolios_backup_20251115 AS
SELECT * FROM portfolios WHERE agent_name IN ('deepseek_v3', 'deepseek_r1');

CREATE TABLE portfolio_history_backup_20251115 AS
SELECT * FROM portfolio_history WHERE agent_name IN ('deepseek_v3', 'deepseek_r1');

CREATE TABLE trading_decisions_backup_20251115 AS
SELECT * FROM trading_decisions WHERE agent_name IN ('deepseek_v3', 'deepseek_r1');
```

### Step 4: 执行迁移

1. 确认已完成 Step 1-3
2. 在 Supabase SQL Editor 中打开 `merge-deepseek-records.sql`
3. 如果有需要，确保已调整 Step 0 的删除语句
4. 执行整个脚本
5. 检查验证查询的输出结果

### Step 5: 验证结果

迁移完成后，应该看到：

1. **portfolios 表**：只有一条 `deepseek` 记录
2. **trading_decisions 表**：所有记录的 agent_name 都是 `deepseek`
3. **portfolio_history 表**：所有记录的 agent_name 都是 `deepseek`
4. **前端显示**：DeepSeek 卡片显示正常，趋势线连续

### Step 6: 部署后端更新

迁移完成后，部署更新的 Lambda 函数：

1. 确保 `index.mjs` 已更新（agent_name 改为 'deepseek'）
2. 重新打包并部署到 AWS Lambda
3. 触发一次测试运行，确认新的决策使用 'deepseek' 标识

## 回滚方案

如果迁移出现问题，可以从备份恢复：

```sql
BEGIN;

-- 删除迁移后的数据
DELETE FROM portfolios WHERE agent_name = 'deepseek';
DELETE FROM portfolio_history WHERE agent_name = 'deepseek';
DELETE FROM trading_decisions WHERE agent_name = 'deepseek';

-- 从备份恢复
INSERT INTO portfolios SELECT * FROM portfolios_backup_20251115;
INSERT INTO portfolio_history SELECT * FROM portfolio_history_backup_20251115;
INSERT INTO trading_decisions SELECT * FROM trading_decisions_backup_20251115;

COMMIT;
```

## 联系方式

如果在迁移过程中遇到任何问题，请联系开发者确认。

## 检查清单

- [ ] 执行 check-deepseek-data.sql 检查数据
- [ ] 处理或确认异常数据
- [ ] 创建数据备份
- [ ] 执行 merge-deepseek-records.sql
- [ ] 验证迁移结果
- [ ] 部署更新的 Lambda 函数
- [ ] 测试前端显示
- [ ] 确认新的决策记录使用 'deepseek' 标识
