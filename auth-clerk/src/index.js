// auth-clerk/src/index.js - 统一导出认证模块功能

// 核心Provider
export { default as ClerkAuthProvider } from './ClerkProvider';

// 认证组件  
export { default as UserProfile } from './components/UserProfile';

// 认证hooks
export { useAuth } from './hooks/useAuth';

// 新增：权限管理组件
export { default as ModuleAccessGuard } from './components/ModuleAccessGuard.jsx';
export { default as UserManagement } from './components/UserManagement.jsx';

// Clerk组件直接导出（方便使用）
export { 
  SignedIn, 
  SignedOut, 
  SignInButton, 
  SignUpButton,
  UserButton,
  RedirectToSignIn 
} from '@clerk/clerk-react';