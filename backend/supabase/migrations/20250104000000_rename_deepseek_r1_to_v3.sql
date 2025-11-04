-- 迁移历史数据：将 deepseek_r1 改名为 deepseek_v3
-- 原因：从代理商 DeepSeek R1 API 切换到 AWS Bedrock DeepSeek V3 API

-- 更新 portfolios 表
UPDATE portfolios
SET agent_name = 'deepseek_v3'
WHERE agent_name = 'deepseek_r1';

-- 更新 decisions 表
UPDATE decisions
SET agent_name = 'deepseek_v3'
WHERE agent_name = 'deepseek_r1';

-- 验证结果
SELECT 'portfolios' as table_name, COUNT(*) as count FROM portfolios WHERE agent_name = 'deepseek_v3'
UNION ALL
SELECT 'decisions' as table_name, COUNT(*) as count FROM decisions WHERE agent_name = 'deepseek_v3';
