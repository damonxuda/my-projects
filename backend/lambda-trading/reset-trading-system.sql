-- ============================================
-- 重置 LLM 交易系统
-- 用途：清除所有历史数据，让4个LLM从相同起点开始竞争
-- 执行方式：在 Supabase SQL Editor 中运行
-- ============================================

-- 1. 清除所有历史交易决策记录
DELETE FROM llm_trading_decisions;

-- 2. 清除所有历史账户状态记录
DELETE FROM llm_trading_portfolios;

-- 3. 验证清除结果
SELECT
    '✅ Decisions cleared' as status,
    COUNT(*) as remaining_records
FROM llm_trading_decisions
UNION ALL
SELECT
    '✅ Portfolios cleared' as status,
    COUNT(*) as remaining_records
FROM llm_trading_portfolios;

-- ============================================
-- 说明
-- ============================================
-- 执行后，所有agent将从初始状态开始：
-- - 现金: $10,000
-- - 持仓: 无
-- - 盈亏: $0 (0%)
--
-- Lambda函数会在下次执行时（每小时:10分）自动创建新记录
-- ============================================
