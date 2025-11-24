-- 为美股交易创建历史数据查询函数
-- 与数字货币trading-api保持一致的逻辑

-- 1. 24小时历史（每30分钟采样）
CREATE OR REPLACE FUNCTION get_stock_portfolio_history_24h()
RETURNS TABLE (
  agent_name TEXT,
  total_value NUMERIC,
  round_number INT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_portfolios AS (
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      -- 按30分钟分组（向下取整到30分钟）
      EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 1800 AS half_hours_ago,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 1800) AS round_number,
      -- 在每个30分钟bucket内按时间排序，取最新的
      ROW_NUMBER() OVER (
        PARTITION BY p.agent_name, FLOOR(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 1800)
        ORDER BY p.created_at DESC
      ) AS rn
    FROM stock_trading_portfolios p
    WHERE p.created_at >= NOW() - INTERVAL '24 hours'
  )
  SELECT
    rp.agent_name,
    rp.total_value,
    rp.round_number::INT,
    rp.created_at
  FROM ranked_portfolios rp
  WHERE rp.rn = 1
  ORDER BY rp.round_number DESC, rp.agent_name;
END;
$$ LANGUAGE plpgsql;

-- 2. 7天历史（每4小时采样）
CREATE OR REPLACE FUNCTION get_stock_portfolio_history_7d()
RETURNS TABLE (
  agent_name TEXT,
  total_value NUMERIC,
  round_number INT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_portfolios AS (
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      -- 按4小时分组
      FLOOR(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 14400) AS round_number,
      ROW_NUMBER() OVER (
        PARTITION BY p.agent_name, FLOOR(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 14400)
        ORDER BY p.created_at DESC
      ) AS rn
    FROM stock_trading_portfolios p
    WHERE p.created_at >= NOW() - INTERVAL '7 days'
  )
  SELECT
    rp.agent_name,
    rp.total_value,
    rp.round_number::INT,
    rp.created_at
  FROM ranked_portfolios rp
  WHERE rp.rn = 1
  ORDER BY rp.round_number DESC, rp.agent_name;
END;
$$ LANGUAGE plpgsql;

-- 3. 30天历史（每天采样）
CREATE OR REPLACE FUNCTION get_stock_portfolio_history_30d()
RETURNS TABLE (
  agent_name TEXT,
  total_value NUMERIC,
  round_number INT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_portfolios AS (
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      -- 按天分组
      FLOOR(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400) AS round_number,
      ROW_NUMBER() OVER (
        PARTITION BY p.agent_name, FLOOR(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400)
        ORDER BY p.created_at DESC
      ) AS rn
    FROM stock_trading_portfolios p
    WHERE p.created_at >= NOW() - INTERVAL '30 days'
  )
  SELECT
    rp.agent_name,
    rp.total_value,
    rp.round_number::INT,
    rp.created_at
  FROM ranked_portfolios rp
  WHERE rp.rn = 1
  ORDER BY rp.round_number DESC, rp.agent_name;
END;
$$ LANGUAGE plpgsql;
