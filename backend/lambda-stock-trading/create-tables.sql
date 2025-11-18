-- ============================================
-- 美股量化交易系统 - 数据库表结构
-- ============================================
-- 创建时间：2025-11-15
-- 用途：存储美股模拟交易的组合、决策和历史记录
-- ============================================

-- 1. 股票交易组合表（类似 llm_trading_portfolios）
CREATE TABLE IF NOT EXISTS stock_trading_portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name TEXT NOT NULL,
    cash DECIMAL(15,2) NOT NULL,
    holdings JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {"AAPL": 10, "MSFT": 5, "GOOGL": 3, ...}
    total_value DECIMAL(15,2) NOT NULL,
    pnl DECIMAL(15,2) NOT NULL DEFAULT 0,
    pnl_percentage DECIMAL(10,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_email TEXT NOT NULL
);

-- 2. 股票交易决策表（类似 llm_trading_decisions）
CREATE TABLE IF NOT EXISTS stock_trading_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name TEXT NOT NULL,
    decision JSONB NOT NULL,  -- {"action": "buy", "asset": "AAPL", "amount": 10, "reason": "..."}
    market_data JSONB,        -- 当时的市场数据（股价、新闻等）
    portfolio_value DECIMAL(15,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_email TEXT NOT NULL
);

-- 3. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_stock_portfolios_agent ON stock_trading_portfolios(agent_name);
CREATE INDEX IF NOT EXISTS idx_stock_portfolios_created ON stock_trading_portfolios(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_portfolios_user ON stock_trading_portfolios(user_email);

CREATE INDEX IF NOT EXISTS idx_stock_decisions_agent ON stock_trading_decisions(agent_name);
CREATE INDEX IF NOT EXISTS idx_stock_decisions_created ON stock_trading_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_decisions_user ON stock_trading_decisions(user_email);

-- 4. 启用 RLS（Row Level Security）
ALTER TABLE stock_trading_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_trading_decisions ENABLE ROW LEVEL SECURITY;

-- 5. 创建 RLS 策略（只允许用户访问自己的数据）
-- 删除旧策略（如果存在）
DROP POLICY IF EXISTS "Users can view their own stock portfolios" ON stock_trading_portfolios;
DROP POLICY IF EXISTS "Users can insert their own stock portfolios" ON stock_trading_portfolios;
DROP POLICY IF EXISTS "Users can view their own stock decisions" ON stock_trading_decisions;
DROP POLICY IF EXISTS "Users can insert their own stock decisions" ON stock_trading_decisions;

-- 查看策略
CREATE POLICY "Users can view their own stock portfolios"
    ON stock_trading_portfolios FOR SELECT
    USING (user_email = current_setting('request.jwt.claims')::json->>'email');

-- 插入策略（服务角色可以插入任何数据）
CREATE POLICY "Users can insert their own stock portfolios"
    ON stock_trading_portfolios FOR INSERT
    WITH CHECK (true);  -- Lambda 使用 service role key，可以插入任何数据

-- 查看策略
CREATE POLICY "Users can view their own stock decisions"
    ON stock_trading_decisions FOR SELECT
    USING (user_email = current_setting('request.jwt.claims')::json->>'email');

-- 插入策略
CREATE POLICY "Users can insert their own stock decisions"
    ON stock_trading_decisions FOR INSERT
    WITH CHECK (true);

-- ============================================
-- 验证表创建
-- ============================================
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('stock_trading_portfolios', 'stock_trading_decisions')
ORDER BY table_name, ordinal_position;

-- ============================================
-- 说明：
-- 1. holdings 字段存储股票持仓（股票代码 -> 股数）
-- 2. decision 字段存储决策详情（action, asset, amount, reason 等）
-- 3. market_data 字段存储决策时的市场快照（股价、新闻、技术指标等）
-- 4. user_email 用于多用户隔离（虽然现在只有管理员）
-- 5. RLS 确保数据安全（前端通过 Clerk token 访问）
-- ============================================
