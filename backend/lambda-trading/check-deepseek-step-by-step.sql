-- ============================================
-- 数据检查脚本：逐步检查 DeepSeek 数据
-- ============================================
-- 请逐个复制执行以下查询，检查每个查询的结果
-- ============================================

-- ========== 第 1 步：查看最新状态 ==========
-- 复制以下查询并执行：

SELECT
    agent_name,
    total_value,
    cash,
    pnl,
    pnl_percentage,
    created_at
FROM llm_trading_portfolios
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1', 'deepseek')
ORDER BY created_at DESC
LIMIT 5;

-- ========== 第 2 步：查看所有历史记录 ==========
-- 复制以下查询并执行（会看到完整的时间序列）：

SELECT
    agent_name,
    total_value,
    pnl,
    created_at
FROM llm_trading_portfolios
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1', 'deepseek')
ORDER BY created_at ASC;

-- ========== 第 3 步：检查价值跳变 ==========
-- 复制以下查询并执行（查看 value_change 列，如果有大幅负值说明可能重置了）：

SELECT
    agent_name,
    total_value,
    created_at,
    total_value - LAG(total_value) OVER (ORDER BY created_at) as value_change
FROM llm_trading_portfolios
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1', 'deepseek')
ORDER BY created_at ASC;

-- ========== 第 4 步：查找重置记录（最重要！）==========
-- 复制以下查询并执行
-- 如果返回任何行，说明存在重置问题！

WITH ranked_records AS (
    SELECT
        agent_name,
        total_value,
        created_at,
        ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
    FROM llm_trading_portfolios
    WHERE agent_name IN ('deepseek_v3', 'deepseek_r1', 'deepseek')
)
SELECT
    agent_name,
    total_value,
    created_at,
    row_num,
    '⚠️ 这是一个重置记录！' as alert
FROM ranked_records
WHERE total_value BETWEEN 49900 AND 50100
  AND row_num > 1
ORDER BY created_at ASC;

-- ========== 第 5 步：查看决策历史 ==========
-- 复制以下查询并执行（可以看到每次决策的账户价值）：

SELECT
    agent_name,
    decision->>'action' as action,
    portfolio_value,
    created_at
FROM llm_trading_decisions
WHERE agent_name IN ('deepseek_v3', 'deepseek_r1', 'deepseek')
ORDER BY created_at ASC
LIMIT 20;
