// src/index.js - 统一导出认证模块的所有功能

// 核心认证上下文和Hook
export { AuthProvider, useAuth } from './contexts/AuthProvider';

// 认证组件
export { default as AuthGuard } from './components/AuthGuard';
export { default as Login } from './components/Login';
export { default as WaitingApproval } from './components/WaitingApproval';

// 服务配置和工具
export { 
  createSupabaseClient, 
  createSupabaseClientFromEnv,
  createSupabaseHelpers,
  SUPABASE_CONFIG 
} from './services/supabaseClient';

// 工具函数
export * from './utils/authHelpers';