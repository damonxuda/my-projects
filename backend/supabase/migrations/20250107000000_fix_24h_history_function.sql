-- =========================================
-- 修复24小时历史数据函数
-- 请复制以下SQL到Supabase SQL Editor执行
-- =========================================

CREATE OR REPLACE FUNCTION get_portfolio_history_24h()
RETURNS TABLE (
  round_number INTEGER,
  agent_name TEXT,
  total_value NUMERIC,
  sample_time TIMESTAMPTZ
) AS $$
DECLARE
  cutoff_time TIMESTAMPTZ;
BEGIN
  -- 计算24小时前的截止时间
  cutoff_time := NOW() - INTERVAL '24 hours';

  RETURN QUERY
  WITH recent_data AS (
    -- 只选择最近24小时的数据
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      DATE_TRUNC('hour', p.created_at) AS hour_bucket
    FROM llm_trading_portfolios p
    WHERE p.created_at > cutoff_time
  ),
  hourly_buckets AS (
    -- 获取每个小时的唯一bucket
    SELECT DISTINCT hour_bucket
    FROM recent_data
    ORDER BY hour_bucket
  ),
  latest_per_hour_agent AS (
    -- 每个小时每个agent的最新记录
    SELECT DISTINCT ON (rd.hour_bucket, rd.agent_name)
      rd.agent_name,
      rd.total_value,
      rd.hour_bucket
    FROM recent_data rd
    ORDER BY rd.hour_bucket, rd.agent_name, rd.created_at DESC
  ),
  rounds_numbered AS (
    SELECT
      hour_bucket,
      ROW_NUMBER() OVER (ORDER BY hour_bucket) AS round_num
    FROM hourly_buckets
  )
  SELECT
    rn.round_num::INTEGER AS round_number,
    lpha.agent_name,
    lpha.total_value,
    lpha.hour_bucket + INTERVAL '15 minutes' AS sample_time
  FROM latest_per_hour_agent lpha
  JOIN rounds_numbered rn ON lpha.hour_bucket = rn.hour_bucket
  ORDER BY rn.round_num, lpha.agent_name;
END;
$$ LANGUAGE plpgsql;

-- 验证：查看函数返回的前几个round
SELECT 
  round_number,
  MIN(sample_time) as time,
  COUNT(DISTINCT agent_name) as agents,
  ROUND(AVG(total_value::numeric), 2) as avg_value,
  MIN(total_value) as min_value,
  MAX(total_value) as max_value
FROM get_portfolio_history_24h()
GROUP BY round_number
ORDER BY round_number
LIMIT 5;
