-- 删除UTC 7:20以后的测试记录

-- 1. 先查看要删除的记录（确认数量）
SELECT 'llm_trading_decisions' as table_name, COUNT(*) as count
FROM llm_trading_decisions
WHERE created_at > '2025-11-21 07:20:00+00'
UNION ALL
SELECT 'llm_trading_portfolios' as table_name, COUNT(*) as count
FROM llm_trading_portfolios
WHERE created_at > '2025-11-21 07:20:00+00';

-- 2. 删除decisions
DELETE FROM llm_trading_decisions
WHERE created_at > '2025-11-21 07:20:00+00';

-- 3. 删除portfolios
DELETE FROM llm_trading_portfolios
WHERE created_at > '2025-11-21 07:20:00+00';

-- 4. 验证删除结果
SELECT 'llm_trading_decisions' as table_name, COUNT(*) as remaining_count
FROM llm_trading_decisions
WHERE created_at > '2025-11-21 07:20:00+00'
UNION ALL
SELECT 'llm_trading_portfolios' as table_name, COUNT(*) as remaining_count
FROM llm_trading_portfolios
WHERE created_at > '2025-11-21 07:20:00+00';
