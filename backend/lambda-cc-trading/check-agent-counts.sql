-- 统计每个agent的决策和portfolio数量（最近2轮）

-- 方法1: 分别统计decisions和portfolios
SELECT
    'decisions' as type,
    agent_name,
    COUNT(*) as count
FROM llm_trading_decisions
WHERE created_at > NOW() - INTERVAL '3 hours'
GROUP BY agent_name
ORDER BY agent_name;

SELECT
    'portfolios' as type,
    agent_name,
    COUNT(*) as count
FROM llm_trading_portfolios
WHERE created_at > NOW() - INTERVAL '3 hours'
GROUP BY agent_name
ORDER BY agent_name;

-- 方法2: 合并显示（推荐）
SELECT
    COALESCE(d.agent_name, p.agent_name) as agent_name,
    COALESCE(d.decision_count, 0) as decisions,
    COALESCE(p.portfolio_count, 0) as portfolios
FROM (
    SELECT agent_name, COUNT(*) as decision_count
    FROM llm_trading_decisions
    WHERE created_at > NOW() - INTERVAL '3 hours'
    GROUP BY agent_name
) d
FULL OUTER JOIN (
    SELECT agent_name, COUNT(*) as portfolio_count
    FROM llm_trading_portfolios
    WHERE created_at > NOW() - INTERVAL '3 hours'
    GROUP BY agent_name
) p ON d.agent_name = p.agent_name
ORDER BY agent_name;

-- 方法3: 查看最近2小时的每轮数据
SELECT
    DATE_TRUNC('hour', created_at) + INTERVAL '15 minutes' * FLOOR(EXTRACT(MINUTE FROM created_at) / 15) as round_time,
    COUNT(DISTINCT agent_name) as agent_count,
    COUNT(*) as decision_count
FROM llm_trading_decisions
WHERE created_at > NOW() - INTERVAL '3 hours'
GROUP BY round_time
ORDER BY round_time DESC;
