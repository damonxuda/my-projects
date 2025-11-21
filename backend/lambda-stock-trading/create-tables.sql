-- 美股交易系统数据库表
-- 在 Supabase SQL Editor 中执行

-- ============================================
-- 表1: 美股交易决策表
-- ============================================
CREATE TABLE IF NOT EXISTS stock_trading_decisions (
  id BIGSERIAL PRIMARY KEY,
  agent_name TEXT NOT NULL,
  decision JSONB NOT NULL,
  market_data JSONB NOT NULL,
  portfolio_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_decisions_agent
  ON stock_trading_decisions(agent_name);

CREATE INDEX IF NOT EXISTS idx_stock_decisions_created
  ON stock_trading_decisions(created_at DESC);

-- ============================================
-- 表2: 美股投资组合表
-- ============================================
CREATE TABLE IF NOT EXISTS stock_trading_portfolios (
  id BIGSERIAL PRIMARY KEY,
  agent_name TEXT NOT NULL,
  cash NUMERIC NOT NULL,
  holdings JSONB NOT NULL,
  total_value NUMERIC NOT NULL,
  pnl NUMERIC NOT NULL,
  pnl_percentage NUMERIC NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_portfolios_agent
  ON stock_trading_portfolios(agent_name);

CREATE INDEX IF NOT EXISTS idx_stock_portfolios_created
  ON stock_trading_portfolios(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_portfolios_timestamp
  ON stock_trading_portfolios(timestamp DESC);
