-- ============================================
-- 检查所有 Agent 在 11月7日 的重置情况
-- ============================================
-- 检查是否所有 agent 在同一时间都重置到了 $50,000
-- ============================================

-- 查看所有 agent 在 11月7日 的第一条记录
SELECT
    agent_name,
    total_value,
    pnl,
    created_at
FROM llm_trading_portfolios
WHERE created_at >= '2025-11-07 00:00:00+00'
  AND created_at <= '2025-11-07 23:59:59+00'
ORDER BY agent_name, created_at ASC;

-- 查看所有 agent 的最早记录（找出系统重置时间点）
WITH first_records AS (
    SELECT
        agent_name,
        MIN(created_at) as first_time
    FROM llm_trading_portfolios
    GROUP BY agent_name
)
SELECT
    p.agent_name,
    p.total_value,
    p.pnl,
    p.created_at,
    '第一条记录' as note
FROM llm_trading_portfolios p
INNER JOIN first_records f ON p.agent_name = f.agent_name AND p.created_at = f.first_time
ORDER BY p.created_at;

-- 查看所有 agent 接近 $50,000 的记录（可能的重置点）
SELECT
    agent_name,
    COUNT(*) as reset_count,
    MIN(created_at) as first_reset,
    MAX(created_at) as last_reset
FROM llm_trading_portfolios
WHERE total_value BETWEEN 49900 AND 50100
GROUP BY agent_name
ORDER BY agent_name;

-- 详细查看每个 agent 在 $50,000 附近的记录（按时间分组）
SELECT
    agent_name,
    total_value,
    pnl,
    created_at
FROM llm_trading_portfolios
WHERE total_value BETWEEN 49900 AND 50100
ORDER BY created_at, agent_name;
