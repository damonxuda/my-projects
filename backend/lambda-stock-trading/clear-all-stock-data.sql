-- 清空所有美股交易记录和决策信息
-- 请在Supabase SQL Editor中执行

-- 1. 清空交易组合历史记录
TRUNCATE TABLE stock_trading_portfolios CASCADE;

-- 2. 清空交易决策记录
TRUNCATE TABLE stock_trading_decisions CASCADE;

-- 验证清空结果
SELECT 'stock_trading_portfolios' as table_name, COUNT(*) as record_count FROM stock_trading_portfolios
UNION ALL
SELECT 'stock_trading_decisions', COUNT(*) FROM stock_trading_decisions;
