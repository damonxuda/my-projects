-- 查看qwen3_235b缺失的是哪一轮

-- 1. 查看最近4轮的时间点（基于所有agent）
SELECT DISTINCT
    DATE_TRUNC('hour', created_at) +
    INTERVAL '1 minute' * (FLOOR(EXTRACT(MINUTE FROM created_at) / 15) * 15) as round_time
FROM llm_trading_portfolios
WHERE created_at > NOW() - INTERVAL '3 hours'
ORDER BY round_time DESC
LIMIT 4;

-- 2. 查看qwen3_235b在这些轮次中的记录
SELECT
    DATE_TRUNC('hour', created_at) +
    INTERVAL '1 minute' * (FLOOR(EXTRACT(MINUTE FROM created_at) / 15) * 15) as round_time,
    created_at,
    action,
    asset
FROM llm_trading_decisions
WHERE agent_name = 'qwen3_235b'
    AND created_at > NOW() - INTERVAL '3 hours'
ORDER BY created_at DESC;

-- 3. 对比：查看每轮有哪些agent（找出qwen缺失的那一轮）
SELECT
    DATE_TRUNC('hour', created_at) +
    INTERVAL '1 minute' * (FLOOR(EXTRACT(MINUTE FROM created_at) / 15) * 15) as round_time,
    COUNT(DISTINCT agent_name) as agent_count,
    STRING_AGG(DISTINCT agent_name, ', ' ORDER BY agent_name) as agents
FROM llm_trading_decisions
WHERE created_at > NOW() - INTERVAL '3 hours'
GROUP BY round_time
ORDER BY round_time DESC;
