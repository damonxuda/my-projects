-- 完全复制数字货币的3个历史函数，只改表名
-- llm_trading_portfolios -> stock_trading_portfolios

DROP FUNCTION IF EXISTS get_stock_portfolio_history_24h();
DROP FUNCTION IF EXISTS get_stock_portfolio_history_7d();
DROP FUNCTION IF EXISTS get_stock_portfolio_history_30d();

-- 1. 24小时历史
CREATE OR REPLACE FUNCTION public.get_stock_portfolio_history_24h()
 RETURNS TABLE(round_number integer, agent_name text, total_value numeric, sample_time timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
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
    FROM stock_trading_portfolios p
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
$function$;

-- 2. 7天历史：每天的00, 04, 08, 12, 16, 20点
CREATE OR REPLACE FUNCTION public.get_stock_portfolio_history_7d()
 RETURNS TABLE(round_number integer, agent_name text, total_value numeric, sample_time timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
  BEGIN
    RETURN QUERY
    WITH four_hour_slots AS (
      -- 每天的00, 04, 08, 12, 16, 20点
      SELECT DISTINCT ON (DATE(created_at), FLOOR(EXTRACT(HOUR FROM created_at) / 4) * 4)
        DATE_TRUNC('hour', created_at) + INTERVAL '15 minutes' AS bucket_time
      FROM stock_trading_portfolios
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND EXTRACT(HOUR FROM created_at) IN (0, 4, 8, 12, 16, 20)
      ORDER BY DATE(created_at) DESC, FLOOR(EXTRACT(HOUR FROM created_at) / 4) * 4, created_at DESC
    ),
    agent_data AS (
      SELECT DISTINCT ON (fh.bucket_time, p.agent_name)
        p.agent_name,
        p.total_value,
        fh.bucket_time
      FROM four_hour_slots fh
      JOIN stock_trading_portfolios p ON
        p.created_at >= fh.bucket_time - INTERVAL '5 minutes' AND
        p.created_at <= fh.bucket_time + INTERVAL '5 minutes'
      ORDER BY fh.bucket_time, p.agent_name, p.created_at DESC
    ),
    rounds AS (
      SELECT DISTINCT bucket_time
      FROM agent_data
      ORDER BY bucket_time
    ),
    rounds_numbered AS (
      SELECT
        bucket_time,
        ROW_NUMBER() OVER (ORDER BY bucket_time) AS round_num
      FROM rounds
    )
    SELECT
      rn.round_num::INTEGER,
      ad.agent_name,
      ad.total_value,
      rn.bucket_time
    FROM agent_data ad
    JOIN rounds_numbered rn ON ad.bucket_time = rn.bucket_time
    ORDER BY rn.round_num, ad.agent_name;
  END;
$function$;

-- 3. 30天历史：每天的00:15点附近
CREATE OR REPLACE FUNCTION public.get_stock_portfolio_history_30d()
 RETURNS TABLE(round_number integer, agent_name text, total_value numeric, sample_time timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
  BEGIN
    RETURN QUERY
    WITH daily_samples AS (
      -- 每天的00:15点附近
      SELECT DISTINCT ON (DATE(created_at))
        DATE_TRUNC('hour', created_at) + INTERVAL '15 minutes' AS bucket_time
      FROM stock_trading_portfolios
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND EXTRACT(HOUR FROM created_at) = 0
      ORDER BY DATE(created_at) DESC, created_at DESC
    ),
    agent_data AS (
      SELECT DISTINCT ON (ds.bucket_time, p.agent_name)
        p.agent_name,
        p.total_value,
        ds.bucket_time
      FROM daily_samples ds
      JOIN stock_trading_portfolios p ON
        p.created_at >= ds.bucket_time - INTERVAL '5 minutes' AND
        p.created_at <= ds.bucket_time + INTERVAL '5 minutes'
      ORDER BY ds.bucket_time, p.agent_name, p.created_at DESC
    ),
    rounds AS (
      SELECT DISTINCT bucket_time
      FROM agent_data
      ORDER BY bucket_time
    ),
    rounds_numbered AS (
      SELECT
        bucket_time,
        ROW_NUMBER() OVER (ORDER BY bucket_time) AS round_num
      FROM rounds
    )
    SELECT
      rn.round_num::INTEGER,
      ad.agent_name,
      ad.total_value,
      rn.bucket_time
    FROM agent_data ad
    JOIN rounds_numbered rn ON ad.bucket_time = rn.bucket_time
    ORDER BY rn.round_num, ad.agent_name;
  END;
$function$;
