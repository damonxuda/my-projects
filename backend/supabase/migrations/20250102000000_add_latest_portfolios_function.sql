-- ============================================
-- 优化查询性能：添加函数获取每个agent的最新portfolio
-- ============================================
-- 该函数解决了Edge Function中的N+1查询问题
-- 使用 PostgreSQL 的 DISTINCT ON 特性，在单次查询中获取所有agent的最新记录

CREATE OR REPLACE FUNCTION public.get_latest_portfolios()
RETURNS TABLE (
    id BIGINT,
    agent_name TEXT,
    cash DECIMAL(12,2),
    holdings JSONB,
    total_value DECIMAL(12,2),
    pnl DECIMAL(12,2),
    pnl_percentage DECIMAL(8,4),
    "timestamp" TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (p.agent_name)
        p.id,
        p.agent_name,
        p.cash,
        p.holdings,
        p.total_value,
        p.pnl,
        p.pnl_percentage,
        p."timestamp",
        p.created_at
    FROM public.llm_trading_portfolios p
    ORDER BY p.agent_name, p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加注释
COMMENT ON FUNCTION public.get_latest_portfolios() IS '获取每个agent的最新portfolio记录 - 单次查询优化版本';

-- 授权给service_role（Edge Function使用）
GRANT EXECUTE ON FUNCTION public.get_latest_portfolios() TO service_role;
