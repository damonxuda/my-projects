-- LLM Trading Observer Database Schema
-- 量化交易观察系统数据库设计

-- ============================================
-- 1. 交易决策记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.llm_trading_decisions (
    id BIGSERIAL PRIMARY KEY,
    agent_name TEXT NOT NULL,              -- 'gemini', 'gpt4', 'claude' 等
    decision JSONB NOT NULL,               -- 决策详情 {"action": "buy", "asset": "BTC", "amount": 0.05, "reason": "..."}
    market_data JSONB,                     -- 市场数据快照
    portfolio_value DECIMAL(12,2),         -- 决策时的账户价值
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 虚拟账户状态历史表
-- ============================================
CREATE TABLE IF NOT EXISTS public.llm_trading_portfolios (
    id BIGSERIAL PRIMARY KEY,
    agent_name TEXT NOT NULL,
    cash DECIMAL(12,2) NOT NULL,          -- 现金余额 (USD)
    holdings JSONB NOT NULL,               -- 持仓 {"BTC": 0.15, "ETH": 2.5}
    total_value DECIMAL(12,2),             -- 总资产价值 (USD)
    pnl DECIMAL(12,2),                     -- 盈亏 (相对初始10000)
    pnl_percentage DECIMAL(8,4),           -- 盈亏百分比
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. 市场数据缓存表（可选，减少外部API调用）
-- ============================================
CREATE TABLE IF NOT EXISTS public.llm_market_data_cache (
    id BIGSERIAL PRIMARY KEY,
    asset TEXT NOT NULL,                   -- 'BTC', 'ETH' 等
    price DECIMAL(12,2),
    change_24h DECIMAL(8,4),
    volume_24h BIGINT,
    market_cap BIGINT,
    data JSONB,                            -- 完整数据
    source TEXT,                           -- 'coingecko', 'alphavantage'
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 创建索引（提高查询性能）
-- ============================================
CREATE INDEX IF NOT EXISTS idx_decisions_agent_time
    ON public.llm_trading_decisions(agent_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolios_agent_time
    ON public.llm_trading_portfolios(agent_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_cache_asset_time
    ON public.llm_market_data_cache(asset, created_at DESC);

-- ============================================
-- 行级安全策略 (RLS) - 重要！
-- ============================================

-- 启用 RLS
ALTER TABLE public.llm_trading_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_trading_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_market_data_cache ENABLE ROW LEVEL SECURITY;

-- ⚠️ 策略 1: 只允许系统管理员读取数据
-- 通过 auth-clerk 的 ADMIN_EMAILS 环境变量判断
-- 注意：这个策略比较简单，假设前端会传递用户邮箱

-- 创建辅助函数：检查用户是否为管理员
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
    -- 这个函数会在 Edge Function 中通过 JWT token 验证
    -- 这里只是占位，实际验证在 Edge Function 层
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 策略：允许通过认证的服务角色（Edge Function）读写
CREATE POLICY "Allow service role full access to decisions"
    ON public.llm_trading_decisions
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to portfolios"
    ON public.llm_trading_portfolios
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to market cache"
    ON public.llm_market_data_cache
    FOR ALL
    USING (auth.role() = 'service_role');

-- 策略：Lambda函数可以写入（通过 service_role key）
-- 前端只能通过 Edge Function 读取（Edge Function 会验证管理员权限）

-- ============================================
-- 初始化数据（可选）
-- ============================================

-- 为 Gemini 创建初始账户
INSERT INTO public.llm_trading_portfolios (agent_name, cash, holdings, total_value, pnl, pnl_percentage)
VALUES ('gemini', 10000.00, '{}'::jsonb, 10000.00, 0.00, 0.00)
ON CONFLICT DO NOTHING;

-- 添加注释
COMMENT ON TABLE public.llm_trading_decisions IS 'LLM交易决策记录 - 存储每次AI决策的详细信息';
COMMENT ON TABLE public.llm_trading_portfolios IS 'LLM虚拟账户状态 - 追踪每个AI agent的资产变化';
COMMENT ON TABLE public.llm_market_data_cache IS '市场数据缓存 - 减少外部API调用频率';
