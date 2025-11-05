-- 优化历史数据查询：在数据库层面做聚合，支持长期数据展示
-- 用途：支持60天+的数据展示，自适应采样密度

-- 创建函数：按时间窗口聚合portfolio数据
-- 参数：
--   hours_back: 查询最近多少小时的数据（默认240小时=10天）
--   sample_hours: 采样间隔（小时），默认1小时。可以设置4或24来降低数据密度
CREATE OR REPLACE FUNCTION get_portfolio_history(
  hours_back INTEGER DEFAULT 240,
  sample_hours INTEGER DEFAULT 1
)
RETURNS TABLE (
  round_number INTEGER,
  agent_name TEXT,
  total_value NUMERIC,
  sample_time TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH time_bucketed AS (
    -- 按指定小时间隔分桶
    SELECT
      p.agent_name,
      p.total_value,
      p.created_at,
      -- 时间分桶：将时间向下取整到最近的sample_hours小时
      DATE_TRUNC('hour', p.created_at) +
        (EXTRACT(HOUR FROM p.created_at)::INTEGER / sample_hours * sample_hours) * INTERVAL '1 hour' AS bucket_time,
      -- 在每个bucket内按时间倒序排列，取最新的记录
      ROW_NUMBER() OVER (
        PARTITION BY
          p.agent_name,
          DATE_TRUNC('hour', p.created_at) +
            (EXTRACT(HOUR FROM p.created_at)::INTEGER / sample_hours * sample_hours) * INTERVAL '1 hour'
        ORDER BY p.created_at DESC
      ) AS rn
    FROM llm_trading_portfolios p
    WHERE p.created_at >= NOW() - (hours_back || ' hours')::INTERVAL
  ),
  latest_per_bucket AS (
    -- 只取每个bucket的最新记录
    SELECT
      agent_name,
      total_value,
      bucket_time
    FROM time_bucketed
    WHERE rn = 1
  ),
  rounds AS (
    -- 为每个时间桶分配round编号
    SELECT DISTINCT bucket_time
    FROM latest_per_bucket
    ORDER BY bucket_time
  ),
  rounds_numbered AS (
    SELECT
      bucket_time,
      ROW_NUMBER() OVER (ORDER BY bucket_time) AS round_num
    FROM rounds
  )
  -- 最终输出
  SELECT
    rn.round_num::INTEGER AS round_number,
    lpb.agent_name,
    lpb.total_value,
    lpb.bucket_time AS sample_time
  FROM latest_per_bucket lpb
  JOIN rounds_numbered rn ON lpb.bucket_time = rn.bucket_time
  ORDER BY rn.round_num, lpb.agent_name;
END;
$$ LANGUAGE plpgsql;

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_portfolios_created_at_agent
ON llm_trading_portfolios(created_at DESC, agent_name);

-- 测试查询（获取最近48小时，每小时一个采样点）
-- SELECT * FROM get_portfolio_history(48, 1);

-- 长期查询示例（获取最近60天，每4小时一个采样点）
-- SELECT * FROM get_portfolio_history(1440, 4);
