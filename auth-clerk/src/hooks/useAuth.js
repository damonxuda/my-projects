// auth-clerk/src/hooks/useAuth.js
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';

export const useAuth = () => {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useClerkAuth();

  // 管理员邮箱列表 - 可以通过环境变量配置
  const getAdminEmails = () => {
    // 优先从环境变量读取，支持多个管理员
    const envAdmins = process.env.REACT_APP_ADMIN_EMAILS;
    if (envAdmins) {
      return envAdmins.split(',').map(email => email.trim());
    }
    
    // 默认管理员（你的邮箱）
    return ['ops@damonxuda.site'];
  };

  // 检查用户是否为管理员
  const isAdmin = () => {
    if (!user) return false;
    
    const adminEmails = getAdminEmails();
    const userEmail = user.emailAddresses[0]?.emailAddress;
    
    return adminEmails.includes(userEmail);
  };

  // 检查用户是否为系统所有者（第一个管理员）
  const isOwner = () => {
    if (!user) return false;
    
    const userEmail = user.emailAddresses[0]?.emailAddress;
    return userEmail === 'ops@damonxuda.site'; // 你的邮箱作为所有者
  };

  return {
    user,
    isSignedIn: !!isSignedIn,
    isLoaded: userLoaded && authLoaded,
    isAdmin: isAdmin(),
    isOwner: isOwner(),
    loading: !userLoaded || !authLoaded,
    // 导出函数供其他组件使用
    getAdminEmails,
  };
};