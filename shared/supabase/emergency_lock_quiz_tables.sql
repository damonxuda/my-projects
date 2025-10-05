-- 紧急锁定Quiz模块表
-- 运行此SQL后，Quiz相关表只能通过Edge Function（service_role）访问
-- 前端直接用anon key访问会被拒绝（403 Forbidden）

-- ==========================================
-- 1. 启用RLS（Row Level Security）
-- ==========================================

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 2. 删除所有现有的宽松策略（如果有）
-- ==========================================

DROP POLICY IF EXISTS "Allow anon access" ON public.attempts;
DROP POLICY IF EXISTS "Allow public read access" ON public.attempts;
DROP POLICY IF EXISTS "Allow public write access" ON public.attempts;

DROP POLICY IF EXISTS "Allow anon access" ON public.papers;
DROP POLICY IF EXISTS "Allow public read access" ON public.papers;
DROP POLICY IF EXISTS "Allow public write access" ON public.papers;

DROP POLICY IF EXISTS "Allow anon access" ON public.questions;
DROP POLICY IF EXISTS "Allow public read access" ON public.questions;
DROP POLICY IF EXISTS "Allow public write access" ON public.questions;

-- ==========================================
-- 3. 创建严格的service_role专用策略
-- ==========================================

-- attempts表：只允许service_role访问
CREATE POLICY "Service role only" ON public.attempts
    FOR ALL
    USING (auth.role() = 'service_role');

-- papers表：只允许service_role访问
CREATE POLICY "Service role only" ON public.papers
    FOR ALL
    USING (auth.role() = 'service_role');

-- questions表：只允许service_role访问
CREATE POLICY "Service role only" ON public.questions
    FOR ALL
    USING (auth.role() = 'service_role');

-- ==========================================
-- 验证：查看新策略
-- ==========================================

SELECT
    tablename AS "表名",
    policyname AS "策略名称",
    CASE
        WHEN cmd = 'ALL' THEN '所有操作'
        ELSE cmd
    END AS "操作类型",
    qual AS "USING条件"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('attempts', 'papers', 'questions')
ORDER BY tablename, policyname;

-- ==========================================
-- 注意事项：
-- ==========================================
-- 1. 运行此SQL后，Quiz前端功能会立即中断（无法直接访问数据）
-- 2. 需要创建Quiz的Edge Function才能恢复功能
-- 3. 如果需要临时回滚，可以运行：
--    DROP POLICY "Service role only" ON public.attempts;
--    DROP POLICY "Service role only" ON public.papers;
--    DROP POLICY "Service role only" ON public.questions;
--    然后重新创建允许访问的策略
-- ==========================================
