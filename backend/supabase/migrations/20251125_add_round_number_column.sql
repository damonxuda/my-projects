-- 添加 round_number 列到 stock_trading_portfolios 表
-- 用于存储固定的交易轮次（从1开始递增）

-- 1. 添加列（如果不存在）
ALTER TABLE stock_trading_portfolios
ADD COLUMN IF NOT EXISTS round_number INT;

-- 2. 为现有数据分配轮次
-- 基于 created_at 时间顺序，按30分钟分组后从小到大编号
WITH project_start AS (
  -- 获取项目开始时间
  SELECT MIN(created_at) as start_time
  FROM stock_trading_portfolios
),
bucketed_data AS (
  -- 按30分钟bucket分组
  SELECT DISTINCT
    FLOOR(EXTRACT(EPOCH FROM (p.created_at - ps.start_time)) / 1800) AS bucket_index
  FROM stock_trading_portfolios p, project_start ps
  ORDER BY bucket_index
),
round_mapping AS (
  -- 给每个bucket分配连续的轮次（从1开始）
  SELECT
    bucket_index,
    ROW_NUMBER() OVER (ORDER BY bucket_index) AS assigned_round
  FROM bucketed_data
)
-- 更新所有记录的轮次
UPDATE stock_trading_portfolios p
SET round_number = rm.assigned_round
FROM project_start ps, round_mapping rm
WHERE FLOOR(EXTRACT(EPOCH FROM (p.created_at - ps.start_time)) / 1800) = rm.bucket_index
  AND p.round_number IS NULL;

-- 3. 添加索引以优化查询
CREATE INDEX IF NOT EXISTS idx_stock_portfolios_round_number
ON stock_trading_portfolios(round_number);

-- 4. 验证更新结果
DO $$
DECLARE
  total_rounds INT;
  agents_per_round INT;
BEGIN
  SELECT COUNT(DISTINCT round_number) INTO total_rounds
  FROM stock_trading_portfolios;

  SELECT COUNT(DISTINCT agent_name) INTO agents_per_round
  FROM stock_trading_portfolios
  WHERE round_number = 1;

  RAISE NOTICE '✅ 轮次分配完成: 总共 % 轮, 第1轮有 % 个agents', total_rounds, agents_per_round;
END $$;
