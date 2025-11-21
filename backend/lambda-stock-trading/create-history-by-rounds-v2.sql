-- 美股交易历史函数：按5分钟窗口分轮次
-- 不做采样，返回所有轮次，由Edge Function根据sample_minutes参数采样

DROP FUNCTION IF EXISTS get_stock_portfolio_history_24h();
DROP FUNCTION IF EXISTS get_stock_portfolio_history_7d();
DROP FUNCTION IF EXISTS get_stock_portfolio_history_30d();

-- 统一的历史查询函数（不再分24h/7d/30d）
CREATE OR REPLACE FUNCTION public.get_stock_portfolio_history(time_range_hours INTEGER DEFAULT 24)
 RETURNS TABLE(round_number integer, agent_name text, total_value numeric, sample_time timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  cutoff_time TIMESTAMPTZ;
BEGIN
  cutoff_time := NOW() - (time_range_hours || ' hours')::INTERVAL;

  RETURN QUERY
  WITH ordered_records AS (
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      EXTRACT(EPOCH FROM p.created_at) AS epoch_time
    FROM stock_trading_portfolios p
    WHERE p.created_at > cutoff_time
    ORDER BY p.created_at ASC
  ),
  rounds_assigned AS (
    SELECT
      agent_name,
      total_value,
      created_at,
      -- 使用5分钟窗口（300秒）分组：相邻记录时间差>5分钟则开始新一轮
      SUM(CASE
        WHEN epoch_time - LAG(epoch_time) OVER (ORDER BY created_at) > 300 THEN 1
        ELSE 0
      END) OVER (ORDER BY created_at) + 1 AS round_num
    FROM ordered_records
  ),
  latest_per_round_agent AS (
    -- 每轮每个agent取最新记录
    SELECT DISTINCT ON (round_num, agent_name)
      agent_name,
      total_value,
      round_num,
      created_at
    FROM rounds_assigned
    ORDER BY round_num, agent_name, created_at DESC
  )
  SELECT
    lpra.round_num::INTEGER AS round_number,
    lpra.agent_name,
    lpra.total_value,
    lpra.created_at AS sample_time
  FROM latest_per_round_agent lpra
  ORDER BY lpra.round_num, lpra.agent_name;
END;
$function$;
