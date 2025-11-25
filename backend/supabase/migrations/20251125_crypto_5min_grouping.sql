-- 修改加密货币历史函数，从1小时分组改为5分钟分组
-- 匹配EventBridge的5分钟触发周期

-- 删除旧函数
DROP FUNCTION IF EXISTS get_portfolio_history_24h();

-- 重新创建：使用5分钟分组
CREATE OR REPLACE FUNCTION get_portfolio_history_24h()
RETURNS TABLE(
  round_number INTEGER,
  agent_name TEXT,
  total_value NUMERIC,
  sample_time TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
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
      -- 按5分钟分组（EventBridge每5分钟触发一次）
      DATE_TRUNC('hour', p.created_at) +
        INTERVAL '5 minutes' * FLOOR(EXTRACT(MINUTE FROM p.created_at) / 5) AS five_min_bucket
    FROM llm_trading_portfolios p
    WHERE p.created_at > cutoff_time
  ),
  five_min_buckets AS (
    -- 获取每个5分钟的唯一bucket
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
    SELECT
      five_min_bucket,
      ROW_NUMBER() OVER (ORDER BY five_min_bucket) AS round_num
    FROM five_min_buckets
  )
  SELECT
    rn.round_num::INTEGER AS round_number,
    lpba.agent_name,
    lpba.total_value,
    lpba.five_min_bucket AS sample_time
  FROM latest_per_bucket_agent lpba
  JOIN rounds_numbered rn ON lpba.five_min_bucket = rn.five_min_bucket
  ORDER BY rn.round_num, lpba.agent_name;
END;
$$;
