-- 先删除旧的函数
DROP FUNCTION IF EXISTS get_stock_portfolio_history_24h();
DROP FUNCTION IF EXISTS get_stock_portfolio_history_7d();
DROP FUNCTION IF EXISTS get_stock_portfolio_history_30d();

-- 然后创建新的函数（完全复制数字货币的逻辑）

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

-- 2. 7天历史
CREATE OR REPLACE FUNCTION public.get_stock_portfolio_history_7d()
 RETURNS TABLE(round_number integer, agent_name text, total_value numeric, sample_time timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  cutoff_time TIMESTAMPTZ;
BEGIN
  cutoff_time := NOW() - INTERVAL '7 days';

  RETURN QUERY
  WITH recent_data AS (
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      DATE_TRUNC('hour', p.created_at - INTERVAL '2 hours') + INTERVAL '2 hours' * FLOOR(EXTRACT(HOUR FROM p.created_at)::numeric / 4) AS bucket_4h
    FROM stock_trading_portfolios p
    WHERE p.created_at > cutoff_time
  ),
  buckets_4h AS (
    SELECT DISTINCT bucket_4h
    FROM recent_data
    ORDER BY bucket_4h
  ),
  latest_per_bucket_agent AS (
    SELECT DISTINCT ON (rd.bucket_4h, rd.agent_name)
      rd.agent_name,
      rd.total_value,
      rd.bucket_4h
    FROM recent_data rd
    ORDER BY rd.bucket_4h, rd.agent_name, rd.created_at DESC
  ),
  rounds_numbered AS (
    SELECT
      bucket_4h,
      ROW_NUMBER() OVER (ORDER BY bucket_4h) AS round_num
    FROM buckets_4h
  )
  SELECT
    rn.round_num::INTEGER AS round_number,
    lpba.agent_name,
    lpba.total_value,
    lpba.bucket_4h + INTERVAL '2 hours' AS sample_time
  FROM latest_per_bucket_agent lpba
  JOIN rounds_numbered rn ON lpba.bucket_4h = rn.bucket_4h
  ORDER BY rn.round_num, lpba.agent_name;
END;
$function$;

-- 3. 30天历史
CREATE OR REPLACE FUNCTION public.get_stock_portfolio_history_30d()
 RETURNS TABLE(round_number integer, agent_name text, total_value numeric, sample_time timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  cutoff_time TIMESTAMPTZ;
BEGIN
  cutoff_time := NOW() - INTERVAL '30 days';

  RETURN QUERY
  WITH recent_data AS (
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      DATE_TRUNC('day', p.created_at) AS day_bucket
    FROM stock_trading_portfolios p
    WHERE p.created_at > cutoff_time
  ),
  daily_buckets AS (
    SELECT DISTINCT day_bucket
    FROM recent_data
    ORDER BY day_bucket
  ),
  latest_per_day_agent AS (
    SELECT DISTINCT ON (rd.day_bucket, rd.agent_name)
      rd.agent_name,
      rd.total_value,
      rd.day_bucket
    FROM recent_data rd
    ORDER BY rd.day_bucket, rd.agent_name, rd.created_at DESC
  ),
  rounds_numbered AS (
    SELECT
      day_bucket,
      ROW_NUMBER() OVER (ORDER BY day_bucket) AS round_num
    FROM daily_buckets
  )
  SELECT
    rn.round_num::INTEGER AS round_number,
    lpda.agent_name,
    lpda.total_value,
    lpda.day_bucket + INTERVAL '12 hours' AS sample_time
  FROM latest_per_day_agent lpda
  JOIN rounds_numbered rn ON lpda.day_bucket = rn.day_bucket
  ORDER BY rn.round_num, lpda.agent_name;
END;
$function$;
