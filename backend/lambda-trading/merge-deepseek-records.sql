-- ============================================
-- 数据库迁移脚本：合并 DeepSeek V3 和 R1 记录
-- ============================================
-- 用途：将 deepseek_v3 和 deepseek_r1 的所有历史数据统一为 deepseek
-- 执行方式：在 Supabase SQL Editor 中手动执行
-- 创建时间：2025-11-15
--
-- 注意：
-- 1. 此脚本会修改历史数据，请在执行前做好备份
-- 2. 执行前请先运行 check-deepseek-data.sql 检查数据
-- 3. 如果发现重置到 $50,000 的错误记录，请先手动删除或确认处理方式
-- 4. 执行后，所有 deepseek_v3 和 deepseek_r1 的记录将被更新为 deepseek
-- 5. 前端和后端代码已更新为使用统一的 deepseek 标识
-- ============================================

-- ⚠️ 重要提示：执行前请先运行 check-deepseek-data.sql
-- 如果发现异常数据，请根据实际情况调整以下步骤

BEGIN;

-- Step 0: 【可选】删除重置到初始状态的错误记录
-- 如果在 check-deepseek-data.sql 的第4个查询中发现了错误的重置记录，
-- 取消下面的注释并填入具体的时间范围来删除这些记录

-- 示例：删除某个特定时间点的重置记录
-- DELETE FROM llm_trading_portfolios
-- WHERE agent_name IN ('deepseek_v3', 'deepseek_r1')
--   AND total_value BETWEEN 49900 AND 50100
--   AND created_at = '2025-XX-XX XX:XX:XX';  -- 替换为实际的错误记录时间

-- DELETE FROM llm_trading_decisions
-- WHERE agent_name IN ('deepseek_v3', 'deepseek_r1')
--   AND created_at = '2025-XX-XX XX:XX:XX';  -- 替换为实际的错误记录时间

-- 1. 更新 llm_trading_portfolios 表：将 deepseek_v3 和 deepseek_r1 统一为 deepseek
UPDATE llm_trading_portfolios
SET agent_name = 'deepseek'
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1');

-- 2. 更新 llm_trading_decisions 表：将所有历史决策记录的 agent_name 统一
UPDATE llm_trading_decisions
SET agent_name = 'deepseek'
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1');

-- 验证更新结果
SELECT
    'llm_trading_portfolios' as table_name,
    COUNT(*) as deepseek_count
FROM llm_trading_portfolios
WHERE agent_name = 'deepseek'

UNION ALL

SELECT
    'llm_trading_decisions' as table_name,
    COUNT(*) as deepseek_count
FROM llm_trading_decisions
WHERE agent_name = 'deepseek';

-- 确认没有遗留的 deepseek_v3 和 deepseek_r1 记录
SELECT
    'llm_trading_portfolios' as table_name,
    agent_name,
    COUNT(*) as count
FROM llm_trading_portfolios
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1')
GROUP BY agent_name

UNION ALL

SELECT
    'llm_trading_decisions' as table_name,
    agent_name,
    COUNT(*) as count
FROM llm_trading_decisions
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1')
GROUP BY agent_name;

COMMIT;

-- ============================================
-- 执行完成后的预期结果：
-- 1. llm_trading_portfolios 表中所有记录的 agent_name 都是 deepseek
-- 2. 所有 llm_trading_decisions 中的 deepseek_v3 和 deepseek_r1 都变为 deepseek
-- 3. 前端将显示一个统一的 DeepSeek 卡片和连续的趋势线
-- ============================================
