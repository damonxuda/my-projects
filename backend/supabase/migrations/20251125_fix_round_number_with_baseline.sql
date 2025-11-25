-- 使用固定时间基线重新分配 round_number
-- 美东时间：10:00(第1轮), 10:30(第2轮), ..., 16:00(第13轮)

-- 1. 清除现有的 round_number
UPDATE stock_trading_portfolios
SET round_number = NULL;

-- 2. 基于固定时间基线分配轮次
-- 美东时间 = UTC - 5小时（或 - 4小时，取决于夏令时）
-- 这里使用 AT TIME ZONE 处理时区转换
WITH trading_rounds AS (
  -- 定义13个固定的交易时间点（美东时间）
  SELECT generate_series(
    -- 从 10:00 ET 开始
    '10:00:00'::time,
    -- 到 16:00 ET 结束
    '16:00:00'::time,
    -- 每 30 分钟一轮
    '30 minutes'::interval
  ) as baseline_time,
  -- 生成轮次编号（1-13）
  generate_series(1, 13) as round_num
),
portfolio_with_et AS (
  -- 将每条记录的 UTC 时间转换为美东时间
  SELECT
    id,
    created_at,
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::time as et_time,
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date as et_date
  FROM stock_trading_portfolios
),
matched_rounds AS (
  -- 为每条记录匹配最近的基线时间点（±10分钟内）
  SELECT DISTINCT ON (p.id)
    p.id,
    tr.round_num,
    tr.baseline_time,
    p.et_time,
    ABS(EXTRACT(EPOCH FROM (p.et_time - tr.baseline_time))) as time_diff_seconds
  FROM portfolio_with_et p
  CROSS JOIN trading_rounds tr
  WHERE ABS(EXTRACT(EPOCH FROM (p.et_time - tr.baseline_time))) <= 600  -- ±10分钟 = 600秒
  ORDER BY p.id, time_diff_seconds ASC
)
-- 更新 round_number
UPDATE stock_trading_portfolios p
SET round_number = mr.round_num
FROM matched_rounds mr
WHERE p.id = mr.id;

-- 3. 验证结果
DO $$
DECLARE
  total_assigned INT;
  total_records INT;
  round_distribution TEXT;
BEGIN
  -- 统计总记录数
  SELECT COUNT(*) INTO total_records
  FROM stock_trading_portfolios;

  -- 统计分配了轮次的记录数
  SELECT COUNT(*) INTO total_assigned
  FROM stock_trading_portfolios
  WHERE round_number IS NOT NULL;

  -- 统计每轮的数量
  SELECT string_agg(
    'Round ' || round_number || ': ' || cnt || ' records',
    ', '
    ORDER BY round_number
  ) INTO round_distribution
  FROM (
    SELECT round_number, COUNT(*) as cnt
    FROM stock_trading_portfolios
    WHERE round_number IS NOT NULL
    GROUP BY round_number
  ) sub;

  RAISE NOTICE '✅ 轮次分配完成';
  RAISE NOTICE '总记录数: %, 已分配: %, 未分配: %',
    total_records, total_assigned, total_records - total_assigned;
  RAISE NOTICE '分布: %', round_distribution;
END $$;
