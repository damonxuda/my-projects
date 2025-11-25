-- 修改美股历史函数，使用动态计算 round_number（模仿加密货币的实现）
-- 不依赖表中的 round_number 列

-- 删除旧函数（返回类型不同，必须先删除）
DROP FUNCTION IF EXISTS get_stock_portfolio_history_24h();

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
      -- 按5分钟分组（EventBridge每5分钟触发一次）
      DATE_TRUNC('hour', p.created_at) +
        INTERVAL '5 minutes' * FLOOR(EXTRACT(MINUTE FROM p.created_at) / 5) AS five_min_bucket
    FROM stock_trading_portfolios p
    WHERE p.created_at > NOW() - INTERVAL '120 hours'
  ),
  five_min_buckets AS (
    -- 获取所有5分钟bucket
    SELECT DISTINCT five_min_bucket
    FROM recent_data
    ORDER BY five_min_bucket
  ),
  latest_per_bucket_agent AS (
    -- 每个5分钟bucket内每个agent的最新记录
    SELECT DISTINCT ON (rd.five_min_bucket, rd.agent_name)
      rd.agent_name,
      rd.total_value,
      rd.five_min_bucket
    FROM recent_data rd
    ORDER BY rd.five_min_bucket, rd.agent_name, rd.created_at DESC
  ),
  rounds_numbered AS (
    -- 动态生成 round_number（从1开始递增）
    SELECT
      five_min_bucket,
      ROW_NUMBER() OVER (ORDER BY five_min_bucket) AS round_num
    FROM five_min_buckets
  ),
  latest_70_rounds AS (
    -- 只保留最近70轮
    SELECT
      five_min_bucket,
      round_num
    FROM rounds_numbered
    ORDER BY round_num DESC
    LIMIT 70
  ),
  renumbered AS (
    -- 重新编号：最老的=1，最新的=70（或更少）
    SELECT
      five_min_bucket,
      ROW_NUMBER() OVER (ORDER BY five_min_bucket) AS final_round_num
    FROM latest_70_rounds
  )
  SELECT
    rn.final_round_num::INTEGER AS round_number,
    lpba.agent_name,
    lpba.total_value,
    lpba.five_min_bucket AS sample_time
  FROM latest_per_bucket_agent lpba
  JOIN renumbered rn ON lpba.five_min_bucket = rn.five_min_bucket
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
