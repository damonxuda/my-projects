-- 美股交易系统 - Supabase RPC函数
-- 在Supabase SQL Editor中执行

-- ========================================
-- 1. 获取每个agent的最新portfolio状态
-- ========================================
CREATE OR REPLACE FUNCTION get_latest_stock_portfolios()
RETURNS TABLE (
  id BIGINT,
  agent_name TEXT,
  cash NUMERIC,
  holdings JSONB,
  total_value NUMERIC,
  pnl NUMERIC,
  pnl_percentage NUMERIC,
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (p.agent_name)
    p.id,
    p.agent_name,
    p.cash,
    p.holdings,
    p.total_value,
    p.pnl,
    p.pnl_percentage,
    p.timestamp,
    p.created_at
  FROM stock_trading_portfolios p
  ORDER BY p.agent_name, p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. 获取24小时历史数据（每小时1个点）
-- ========================================
CREATE OR REPLACE FUNCTION get_stock_portfolio_history_24h()
RETURNS TABLE (
  agent_name TEXT,
  total_value NUMERIC,
  round_number BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH numbered_records AS (
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      ROW_NUMBER() OVER (PARTITION BY p.agent_name ORDER BY p.created_at DESC) as rn
    FROM stock_trading_portfolios p
    WHERE p.created_at >= NOW() - INTERVAL '24 hours'
  )
  SELECT
    nr.agent_name,
    nr.total_value,
    nr.rn as round_number
  FROM numbered_records nr
  ORDER BY nr.rn, nr.agent_name;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. 获取7天历史数据（每4小时1个点）
-- ========================================
CREATE OR REPLACE FUNCTION get_stock_portfolio_history_7d()
RETURNS TABLE (
  agent_name TEXT,
  total_value NUMERIC,
  round_number BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH time_buckets AS (
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 14400) as bucket_number,
      ROW_NUMBER() OVER (
        PARTITION BY p.agent_name, FLOOR(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 14400)
        ORDER BY p.created_at DESC
      ) as rn
    FROM stock_trading_portfolios p
    WHERE p.created_at >= NOW() - INTERVAL '7 days'
  )
  SELECT
    tb.agent_name,
    tb.total_value,
    tb.bucket_number as round_number
  FROM time_buckets tb
  WHERE tb.rn = 1
  ORDER BY tb.bucket_number, tb.agent_name;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. 获取30天历史数据（每天1个点）
-- ========================================
CREATE OR REPLACE FUNCTION get_stock_portfolio_history_30d()
RETURNS TABLE (
  agent_name TEXT,
  total_value NUMERIC,
  round_number BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_buckets AS (
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400) as day_number,
      ROW_NUMBER() OVER (
        PARTITION BY p.agent_name, FLOOR(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400)
        ORDER BY p.created_at DESC
      ) as rn
    FROM stock_trading_portfolios p
    WHERE p.created_at >= NOW() - INTERVAL '30 days'
  )
  SELECT
    db.agent_name,
    db.total_value,
    db.day_number as round_number
  FROM daily_buckets db
  WHERE db.rn = 1
  ORDER BY db.day_number, db.agent_name;
END;
$$ LANGUAGE plpgsql;
