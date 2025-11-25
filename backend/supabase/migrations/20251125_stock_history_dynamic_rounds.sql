-- 修改美股历史函数，使用动态计算 round_number（模仿加密货币的实现）
-- 不依赖表中的 round_number 列

-- 1. 最近5个交易日历史（约70轮，每30分钟一轮）
CREATE OR REPLACE FUNCTION get_stock_portfolio_history_24h()
RETURNS TABLE(
  round_number INTEGER,
  agent_name TEXT,
  total_value NUMERIC,
  sample_time TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH recent_data AS (
    -- 选择最近120小时的数据（约5个交易日）
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      -- 按30分钟分组
      DATE_TRUNC('hour', p.created_at) +
        INTERVAL '30 minutes' * FLOOR(EXTRACT(MINUTE FROM p.created_at) / 30) AS half_hour_bucket
    FROM stock_trading_portfolios p
    WHERE p.created_at > NOW() - INTERVAL '120 hours'
  ),
  half_hourly_buckets AS (
    -- 获取所有30分钟bucket
    SELECT DISTINCT half_hour_bucket
    FROM recent_data
    ORDER BY half_hour_bucket
  ),
  latest_per_bucket_agent AS (
    -- 每个30分钟bucket内每个agent的最新记录
    SELECT DISTINCT ON (rd.half_hour_bucket, rd.agent_name)
      rd.agent_name,
      rd.total_value,
      rd.half_hour_bucket
    FROM recent_data rd
    ORDER BY rd.half_hour_bucket, rd.agent_name, rd.created_at DESC
  ),
  rounds_numbered AS (
    -- 动态生成 round_number（从1开始递增）
    SELECT
      half_hour_bucket,
      ROW_NUMBER() OVER (ORDER BY half_hour_bucket) AS round_num
    FROM half_hourly_buckets
  ),
  latest_70_rounds AS (
    -- 只保留最近70轮
    SELECT
      half_hour_bucket,
      round_num
    FROM rounds_numbered
    ORDER BY round_num DESC
    LIMIT 70
  ),
  renumbered AS (
    -- 重新编号：最老的=1，最新的=70（或更少）
    SELECT
      half_hour_bucket,
      ROW_NUMBER() OVER (ORDER BY half_hour_bucket) AS final_round_num
    FROM latest_70_rounds
  )
  SELECT
    rn.final_round_num::INTEGER AS round_number,
    lpba.agent_name,
    lpba.total_value,
    lpba.half_hour_bucket AS sample_time
  FROM latest_per_bucket_agent lpba
  JOIN renumbered rn ON lpba.half_hour_bucket = rn.half_hour_bucket
  ORDER BY rn.final_round_num, lpba.agent_name;
END;
$$;

-- 2. 7天历史（美股不使用，返回空结果）
CREATE OR REPLACE FUNCTION get_stock_portfolio_history_7d()
RETURNS TABLE(
  round_number INTEGER,
  agent_name TEXT,
  total_value NUMERIC,
  sample_time TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    NULL::INTEGER,
    NULL::TEXT,
    NULL::NUMERIC,
    NULL::TIMESTAMPTZ
  WHERE FALSE;
END;
$$;

-- 3. 30天历史（每天只显示收盘数据）
CREATE OR REPLACE FUNCTION get_stock_portfolio_history_30d()
RETURNS TABLE(
  round_number INTEGER,
  agent_name TEXT,
  total_value NUMERIC,
  sample_time TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH recent_data AS (
    -- 选择最近30天的数据
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      DATE_TRUNC('day', p.created_at) AS day_bucket
    FROM stock_trading_portfolios p
    WHERE p.created_at > NOW() - INTERVAL '30 days'
  ),
  daily_latest AS (
    -- 每天每个agent的最后一条记录（收盘价）
    SELECT DISTINCT ON (rd.day_bucket, rd.agent_name)
      rd.agent_name,
      rd.total_value,
      rd.day_bucket
    FROM recent_data rd
    ORDER BY rd.day_bucket, rd.agent_name, rd.created_at DESC
  ),
  daily_buckets AS (
    SELECT DISTINCT day_bucket
    FROM daily_latest
    ORDER BY day_bucket
  ),
  rounds_numbered AS (
    -- 动态生成 round_number
    SELECT
      day_bucket,
      ROW_NUMBER() OVER (ORDER BY day_bucket) AS round_num
    FROM daily_buckets
  )
  SELECT
    rn.round_num::INTEGER AS round_number,
    dl.agent_name,
    dl.total_value,
    dl.day_bucket + INTERVAL '16 hours' AS sample_time  -- 假设收盘时间
  FROM daily_latest dl
  JOIN rounds_numbered rn ON dl.day_bucket = rn.day_bucket
  ORDER BY rn.round_num, dl.agent_name;
END;
$$;
