-- ============================================
-- 数据检查脚本：检查 DeepSeek 数据是否存在重置问题
-- ============================================
-- 用途：在执行合并前，先检查数据的连续性和是否存在重置问题
-- 执行方式：在 Supabase SQL Editor 中手动执行
-- ============================================

-- 1. 查看当前 llm_trading_portfolios 表中的 DeepSeek 相关记录（最新状态）
SELECT
    agent_name,
    total_value,
    cash,
    holdings,
    pnl,
    pnl_percentage,
    created_at
FROM llm_trading_portfolios
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1', 'deepseek')
ORDER BY agent_name, created_at DESC;

-- 2. 查看 llm_trading_portfolios 中 DeepSeek 的所有历史记录（按时间排序）
-- 这可以帮助我们发现是否有突然跳回 $50,000 的异常情况
SELECT
    agent_name,
    total_value,
    pnl,
    created_at
FROM llm_trading_portfolios
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1', 'deepseek')
ORDER BY created_at ASC;

-- 3. 检查是否存在价值突然跳回 $50,000 的异常记录
-- 找出所有等于或接近 $50,000 的记录（允许±100的误差）
SELECT
    agent_name,
    total_value,
    created_at,
    -- 计算与前一条记录的差值
    total_value - LAG(total_value) OVER (PARTITION BY agent_name ORDER BY created_at) as value_change
FROM llm_trading_portfolios
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1', 'deepseek')
ORDER BY created_at ASC;

-- 4. 找出可能的重置记录（价值接近 $50,000 但不是第一条记录）
WITH ranked_records AS (
    SELECT
        agent_name,
        total_value,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY agent_name ORDER BY created_at ASC) as row_num
    FROM llm_trading_portfolios
    WHERE agent_name IN ('deepseek_v3', 'deepseek_r1', 'deepseek')
)
SELECT
    agent_name,
    total_value,
    created_at,
    row_num
FROM ranked_records
WHERE total_value BETWEEN 49900 AND 50100  -- $50,000 ± $100
  AND row_num > 1  -- 不是第一条记录
ORDER BY created_at ASC;

-- 5. 查看 llm_trading_decisions 表中 DeepSeek 的决策历史
-- 可以帮助确认哪个时间点发生了模型切换
SELECT
    agent_name,
    decision,
    portfolio_value,
    created_at
FROM llm_trading_decisions
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1', 'deepseek')
ORDER BY created_at ASC;

-- 6. 统计每个 agent_name 的记录数量
SELECT
    'llm_trading_portfolios' as table_name,
    agent_name,
    COUNT(*) as count
FROM llm_trading_portfolios
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1', 'deepseek')
GROUP BY agent_name

UNION ALL

SELECT
    'llm_trading_decisions' as table_name,
    agent_name,
    COUNT(*) as count
FROM llm_trading_decisions
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1', 'deepseek')
GROUP BY agent_name;
