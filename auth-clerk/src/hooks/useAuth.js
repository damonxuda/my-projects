// auth-clerk/src/hooks/useAuth.js
import { useUser, useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react';
import { useState, useEffect, useCallback } from 'react';

export const useAuth = () => {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useClerkAuth();
  const clerk = useClerk();
  
  // 用户管理相关状态
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false); // ✅ 改名为 loading

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

  // 新增：检查用户是否有指定模块的访问权限
  const hasModuleAccess = (moduleName) => {
    // 如果用户未加载完成或未登录，返回 false
    if (!userLoaded || !isSignedIn || !user) return false;
    
    // 管理员默认有所有模块访问权限
    if (isAdmin()) return true;
    
    // 检查用户的 publicMetadata 中的授权模块
    const authorizedModules = user.publicMetadata?.authorized_modules || [];
    return authorizedModules.includes(moduleName);
  };

  // 新增：获取用户的所有授权模块
  const getUserModules = () => {
    if (!user) return [];
    
    // 管理员有所有模块权限（这里可以根据需要调整）
    if (isAdmin()) return ['quiz', 'future1', 'future2'];
    
    return user.publicMetadata?.authorized_modules || [];
  };

  // 新增：获取用户权限相关信息
  const getUserPermissionInfo = () => {
    if (!user) return null;
    
    return {
      modules: getUserModules(),
      approvedBy: user.publicMetadata?.approved_by || null,
      approvedAt: user.publicMetadata?.approved_at || null,
      lastUpdated: user.publicMetadata?.updated_at || null
    };
  };

  // 获取所有用户（管理员功能）
  const fetchAllUsers = useCallback(async () => {
    if (!isAdmin()) {
      return;
    }
    
    setLoading(true); // ✅ 使用 loading
    try {
      const response = await fetch('https://58mcnl40hj.execute-api.ap-northeast-1.amazonaws.com/user_management');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 根据你的Lambda返回格式调整
      setUsers(data.users || []);

    } catch (error) {
      console.error('获取用户列表失败:', error);
      setUsers([]);
    } finally {
      setLoading(false); // ✅ 使用 loading
    }
  }, [isAdmin]);

  // ✅ 新增：为用户分配模块权限（通过Lambda API）
  const assignModuleAccess = async (userId, modules) => {
    if (!isAdmin()) {
      throw new Error('只有管理员可以分配权限');
    }

    try {
      const response = await fetch('https://58mcnl40hj.execute-api.ap-northeast-1.amazonaws.com/user_management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'assign_modules',
          userId: userId,
          modules: modules,
          approvedBy: user.emailAddresses[0].emailAddress
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '分配权限失败');
      }

      return { success: true };
    } catch (error) {
      console.error('分配权限失败:', error);
      throw error;
    }
  };

  // ✅ 新增：撤销用户权限（通过Lambda API）
  const revokeModuleAccess = async (userId) => {
    if (!isAdmin()) {
      throw new Error('只有管理员可以撤销权限');
    }

    try {
      const response = await fetch('https://58mcnl40hj.execute-api.ap-northeast-1.amazonaws.com/user_management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'revoke_modules',
          userId: userId,
          revokedBy: user.emailAddresses[0].emailAddress
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '撤销权限失败');
      }

      return { success: true };
    } catch (error) {
      console.error('撤销权限失败:', error);
      throw error;
    }
  };

  // 获取用户的权限信息（为UserManagement组件使用）
  const getUserPermissions = (targetUser) => {
    if (!targetUser) return { modules: [], approvedBy: null, approvedAt: null };
    
    return {
      modules: targetUser.modules || targetUser.publicMetadata?.authorized_modules || [],
      approvedBy: targetUser.approved_by || targetUser.publicMetadata?.approved_by || null,
      approvedAt: targetUser.approved_at || targetUser.publicMetadata?.approved_at || null
    };
  };

  // 自动加载用户列表（如果是管理员）
  useEffect(() => {
    if (userLoaded && isSignedIn && isAdmin()) {
      fetchAllUsers();
    }
  }, [userLoaded, isSignedIn, user]);

  return {
    // 原有功能
    user,
    isSignedIn: !!isSignedIn,
    isLoaded: userLoaded && authLoaded,
    isAdmin: isAdmin(),
    isOwner: isOwner(),
    loading: !userLoaded || !authLoaded,
    // 导出函数供其他组件使用
    getAdminEmails,
    // 新增的模块权限功能
    hasModuleAccess,
    getUserModules,
    getUserPermissionInfo,
    // 管理员功能
    users,
    loading: loading, // ✅ 导出 loading 而不是 loadingUsers
    fetchAllUsers,
    assignModuleAccess,
    revokeModuleAccess,
    getUserPermissions
  };
};