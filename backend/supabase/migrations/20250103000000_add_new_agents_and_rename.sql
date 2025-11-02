-- 添加新的AI agents和重命名现有agents
-- 新架构：8个AI模型（每家厂商2个：标准型+轻量级）+ 2个ETF

-- ============================================
-- 1. 重命名现有agents
-- ============================================

-- OpenAI: openai → openai_standard
UPDATE public.llm_trading_portfolios
SET agent_name = 'openai_standard'
WHERE agent_name = 'openai';

UPDATE public.llm_trading_decisions
SET agent_name = 'openai_standard'
WHERE agent_name = 'openai';

-- Gemini: gemini → gemini_flash
UPDATE public.llm_trading_portfolios
SET agent_name = 'gemini_flash'
WHERE agent_name = 'gemini';

UPDATE public.llm_trading_decisions
SET agent_name = 'gemini_flash'
WHERE agent_name = 'gemini';

-- Claude: claude → claude_standard
UPDATE public.llm_trading_portfolios
SET agent_name = 'claude_standard'
WHERE agent_name = 'claude';

UPDATE public.llm_trading_decisions
SET agent_name = 'claude_standard'
WHERE agent_name = 'claude';

-- Grok: grok → grok_standard
UPDATE public.llm_trading_portfolios
SET agent_name = 'grok_standard'
WHERE agent_name = 'grok';

UPDATE public.llm_trading_decisions
SET agent_name = 'grok_standard'
WHERE agent_name = 'grok';

-- ============================================
-- 2. 添加4个新的轻量级模型agents
-- ============================================

-- OpenAI GPT-4o mini (已存在，重命名为 openai_mini)
INSERT INTO public.llm_trading_portfolios (agent_name, cash, holdings, total_value, pnl, pnl_percentage)
VALUES ('openai_mini', 10000.00, '{}'::jsonb, 10000.00, 0.00, 0.00)
ON CONFLICT DO NOTHING;

-- Gemini 2.0 Flash Thinking (新增)
INSERT INTO public.llm_trading_portfolios (agent_name, cash, holdings, total_value, pnl, pnl_percentage)
VALUES ('gemini_thinking', 10000.00, '{}'::jsonb, 10000.00, 0.00, 0.00)
ON CONFLICT DO NOTHING;

-- Claude Haiku 4.5 (新增)
INSERT INTO public.llm_trading_portfolios (agent_name, cash, holdings, total_value, pnl, pnl_percentage)
VALUES ('claude_mini', 10000.00, '{}'::jsonb, 10000.00, 0.00, 0.00)
ON CONFLICT DO NOTHING;

-- Grok 2 mini (新增)
INSERT INTO public.llm_trading_portfolios (agent_name, cash, holdings, total_value, pnl, pnl_percentage)
VALUES ('grok_mini', 10000.00, '{}'::jsonb, 10000.00, 0.00, 0.00)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. 更新 latest_portfolios function 以包含所有agents
-- ============================================

-- 这个function会在另一个migration文件中更新
-- 确保返回所有10个portfolio (8个AI + 2个ETF)
