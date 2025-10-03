-- 锁定 game_progress 表的 RLS 策略
-- 运行此SQL后，game_progress 表只能通过 Edge Function（service_role）访问
-- 前端直接用 anon key 访问会被拒绝（403 Forbidden）

-- ==========================================
-- 1. 启用 RLS（Row Level Security）
-- ==========================================

ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 2. 删除所有现有的宽松策略（如果有）
-- ==========================================

DROP POLICY IF EXISTS "Allow anon access" ON public.game_progress;
DROP POLICY IF EXISTS "Allow public read access" ON public.game_progress;
DROP POLICY IF EXISTS "Allow public write access" ON public.game_progress;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.game_progress;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.game_progress;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.game_progress;

-- ==========================================
-- 3. 创建严格的 service_role 专用策略
-- ==========================================

-- game_progress 表：只允许 service_role 访问
CREATE POLICY "Service role only" ON public.game_progress
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
  AND tablename = 'game_progress'
ORDER BY tablename, policyname;

-- ==========================================
-- 注意事项：
-- ==========================================
-- 1. 运行此SQL后，前端直接访问 game_progress 表会失败
-- 2. 必须通过 game-progress Edge Function 访问数据
-- 3. 如果需要临时回滚，可以运行：
--    DROP POLICY "Service role only" ON public.game_progress;
--    然后重新创建允许访问的策略
-- ==========================================
