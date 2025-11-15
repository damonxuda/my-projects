-- ============================================
-- 删除 DeepSeek 重置记录脚本
-- ============================================
-- 根据数据分析，在 2025-11-10 有多条错误的重置记录
-- 这些记录导致账户价值异常地回到 $50,000 附近
-- ============================================

BEGIN;

-- 查看要删除的记录（先确认）
SELECT
    agent_name,
    total_value,
    pnl,
    created_at,
    '将被删除' as action
FROM llm_trading_portfolios
WHERE agent_name = 'deepseek_v3'
  AND created_at IN (
    '2025-11-10 02:16:00.83917+00',
    '2025-11-10 03:15:56.398997+00',
    '2025-11-10 06:15:58.360947+00',
    '2025-11-10 10:15:56.401219+00',
    '2025-11-10 11:15:55.42902+00',
    '2025-11-10 13:15:56.333426+00'
  )
ORDER BY created_at;

-- 删除 llm_trading_portfolios 中的重置记录
DELETE FROM llm_trading_portfolios
WHERE agent_name = 'deepseek_v3'
  AND created_at IN (
    '2025-11-10 02:16:00.83917+00',
    '2025-11-10 03:15:56.398997+00',
    '2025-11-10 06:15:58.360947+00',
    '2025-11-10 10:15:56.401219+00',
    '2025-11-10 11:15:55.42902+00',
    '2025-11-10 13:15:56.333426+00'
  );

-- 删除对应的决策记录
DELETE FROM llm_trading_decisions
WHERE agent_name = 'deepseek_v3'
  AND created_at >= '2025-11-10 02:16:00+00'
  AND created_at <= '2025-11-10 14:00:00+00'
  AND created_at IN (
    SELECT created_at FROM llm_trading_decisions
    WHERE agent_name = 'deepseek_v3'
      AND created_at IN (
        '2025-11-10 02:16:00+00',
        '2025-11-10 03:15:56+00',
        '2025-11-10 06:15:58+00',
        '2025-11-10 10:15:56+00',
        '2025-11-10 11:15:55+00',
        '2025-11-10 13:15:56+00'
      )
  );

-- 验证删除结果
SELECT
    'llm_trading_portfolios' as table_name,
    COUNT(*) as remaining_records
FROM llm_trading_portfolios
WHERE agent_name = 'deepseek_v3'

UNION ALL

SELECT
    'llm_trading_decisions' as table_name,
    COUNT(*) as remaining_records
FROM llm_trading_decisions
WHERE agent_name = 'deepseek_v3';

-- 再次运行重置检查（应该只剩下第2条记录，或者完全没有）
WITH ranked_records AS (
    SELECT
        agent_name,
        total_value,
        created_at,
        ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
    FROM llm_trading_portfolios
    WHERE agent_name = 'deepseek_v3'
)
SELECT
    agent_name,
    total_value,
    created_at,
    row_num,
    CASE
        WHEN row_num <= 2 THEN '✅ 正常（初始记录）'
        ELSE '⚠️ 仍然是重置记录'
    END as status
FROM ranked_records
WHERE total_value BETWEEN 49900 AND 50100
ORDER BY created_at ASC;

COMMIT;

-- ============================================
-- 执行后的预期结果：
-- 1. 删除了 6 条 portfolio 重置记录
-- 2. 删除了对应的 6 条 decision 记录
-- 3. 剩余的 portfolio 记录应该是 184 - 6 = 178 条
-- 4. 最后一个查询应该只显示 row_num = 2 的记录（正常的初始状态）
-- ============================================
