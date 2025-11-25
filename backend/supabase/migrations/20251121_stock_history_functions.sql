-- 为美股交易创建历史数据查询函数
-- 使用绝对轮次编号（基于项目开始时间）

-- 1. 最近5个交易日历史（约70轮，每天14轮）
-- 返回最近70轮的数据，使用绝对轮次编号
CREATE OR REPLACE FUNCTION get_stock_portfolio_history_24h()
RETURNS TABLE (
  agent_name TEXT,
  total_value NUMERIC,
  round_number INT,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  project_start_time TIMESTAMPTZ;
BEGIN
  -- 获取项目开始时间（第一条记录）
  SELECT MIN(created_at) INTO project_start_time
  FROM stock_trading_portfolios;

  RETURN QUERY
  WITH ranked_portfolios AS (
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      -- 计算绝对轮次：基于项目开始时间的30分钟计数，从1开始（0保留给前端初始点）
      FLOOR(EXTRACT(EPOCH FROM (p.created_at - project_start_time)) / 1800) + 1 AS absolute_round,
      -- 在每个30分钟bucket内取最新的记录
      ROW_NUMBER() OVER (
        PARTITION BY p.agent_name, FLOOR(EXTRACT(EPOCH FROM (p.created_at - project_start_time)) / 1800)
        ORDER BY p.created_at DESC
      ) AS rn
    FROM stock_trading_portfolios p
  ),
  -- 只保留每个bucket的最新记录
  unique_rounds AS (
    SELECT
      agent_name,
      total_value,
      absolute_round,
      created_at
    FROM ranked_portfolios
    WHERE rn = 1
  ),
  -- 找出所有轮次中的最大轮次
  max_round AS (
    SELECT MAX(absolute_round) as max_r FROM unique_rounds
  )
  -- 返回最近70轮数据（约5个交易日）
  SELECT
    ur.agent_name,
    ur.total_value,
    ur.absolute_round::INT as round_number,
    ur.created_at
  FROM unique_rounds ur, max_round mr
  WHERE ur.absolute_round > mr.max_r - 70
  ORDER BY ur.absolute_round ASC, ur.agent_name;
END;
$$ LANGUAGE plpgsql;

-- 2. 7天历史（美股不使用，保留空函数以兼容API）
CREATE OR REPLACE FUNCTION get_stock_portfolio_history_7d()
RETURNS TABLE (
  agent_name TEXT,
  total_value NUMERIC,
  round_number INT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- 美股不提供7天视图，返回空结果
  RETURN QUERY
  SELECT
    NULL::TEXT as agent_name,
    NULL::NUMERIC as total_value,
    NULL::INT as round_number,
    NULL::TIMESTAMPTZ as created_at
  WHERE FALSE;
END;
$$ LANGUAGE plpgsql;

-- 3. 30天历史（每天只显示收盘数据 = 当天最后一轮）
CREATE OR REPLACE FUNCTION get_stock_portfolio_history_30d()
RETURNS TABLE (
  agent_name TEXT,
  total_value NUMERIC,
  round_number INT,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  project_start_time TIMESTAMPTZ;
BEGIN
  -- 获取项目开始时间
  SELECT MIN(created_at) INTO project_start_time
  FROM stock_trading_portfolios;

  RETURN QUERY
  WITH ranked_portfolios AS (
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      -- 计算绝对轮次（从1开始）
      FLOOR(EXTRACT(EPOCH FROM (p.created_at - project_start_time)) / 1800) + 1 AS absolute_round,
      -- 按天分组（UTC日期）
      DATE(p.created_at) as trading_date,
      -- 在每天内按轮次排序，取最大的（最后一轮 = 收盘）
      ROW_NUMBER() OVER (
        PARTITION BY p.agent_name, DATE(p.created_at)
        ORDER BY p.created_at DESC
      ) AS daily_rn
    FROM stock_trading_portfolios p
    WHERE p.created_at >= NOW() - INTERVAL '30 days'
  )
  -- 每天只取最后一轮（收盘价）
  SELECT
    rp.agent_name,
    rp.total_value,
    rp.absolute_round::INT as round_number,
    rp.created_at
  FROM ranked_portfolios rp
  WHERE rp.daily_rn = 1
  ORDER BY rp.absolute_round ASC, rp.agent_name;
END;
$$ LANGUAGE plpgsql;
