// shared/supabase/index.js - 导出公共Supabase服务（非认证相关）

// 只导出Supabase服务相关功能
export { 
  createSupabaseClient, 
  createSupabaseClientFromEnv,
  createSupabaseHelpers,
  SUPABASE_CONFIG 
} from './client';