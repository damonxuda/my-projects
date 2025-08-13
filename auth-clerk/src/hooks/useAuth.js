// auth-clerk/src/hooks/useAuth.js
import { useUser, useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react';
import { useState, useEffect, useCallback } from 'react';

export const useAuth = () => {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useClerkAuth();
  const clerk = useClerk();
  
  // 用户管理相关状态
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

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
    if (!isAdmin()) return;
    
    setLoadingUsers(true);
    try {
      // 使用 Clerk 的 users API 获取所有用户
      const response = await clerk.users?.getUserList({
        limit: 100,
        orderBy: '-created_at'
      });
      setUsers(response?.data || []);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [clerk, isAdmin]);

  // 为用户分配模块权限（管理员功能）
  const assignModuleAccess = async (userId, modules) => {
    if (!isAdmin()) {
      throw new Error('只有管理员可以分配权限');
    }

    try {
      // 获取目标用户
      const targetUser = await clerk.users?.getUser(userId);
      if (!targetUser) {
        throw new Error('用户不存在');
      }

      // 更新用户的 publicMetadata
      const updatedMetadata = {
        ...targetUser.publicMetadata,
        authorized_modules: modules,
        approved_by: user.emailAddresses[0].emailAddress,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await targetUser.update({
        publicMetadata: updatedMetadata
      });

      // 刷新用户列表
      await fetchAllUsers();
      
      return { success: true };
    } catch (error) {
      console.error('分配权限失败:', error);
      return { success: false, error: error.message };
    }
  };

  // 撤销用户的模块权限（管理员功能）
  const revokeModuleAccess = async (userId, moduleToRemove) => {
    if (!isAdmin()) {
      throw new Error('只有管理员可以撤销权限');
    }

    try {
      const targetUser = await clerk.users?.getUser(userId);
      if (!targetUser) {
        throw new Error('用户不存在');
      }

      const currentModules = targetUser.publicMetadata?.authorized_modules || [];
      const updatedModules = currentModules.filter(module => module !== moduleToRemove);

      const updatedMetadata = {
        ...targetUser.publicMetadata,
        authorized_modules: updatedModules,
        updated_by: user.emailAddresses[0].emailAddress,
        updated_at: new Date().toISOString()
      };

      await targetUser.update({
        publicMetadata: updatedMetadata
      });

      await fetchAllUsers();
      
      return { success: true };
    } catch (error) {
      console.error('撤销权限失败:', error);
      return { success: false, error: error.message };
    }
  };

  // 获取用户的权限信息（为UserManagement组件使用）
  const getUserPermissions = (targetUser) => {
    if (!targetUser) return { modules: [], approvedBy: null, approvedAt: null };
    
    return {
      modules: targetUser.publicMetadata?.authorized_modules || [],
      approvedBy: targetUser.publicMetadata?.approved_by || null,
      approvedAt: targetUser.publicMetadata?.approved_at || null
    };
  };

  // 自动加载用户列表（如果是管理员）
  useEffect(() => {
    if (userLoaded && isSignedIn && isAdmin()) {
      fetchAllUsers();
    }
  }, [userLoaded, isSignedIn, fetchAllUsers]);

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
    loadingUsers,
    fetchAllUsers,
    assignModuleAccess,
    revokeModuleAccess,
    getUserPermissions
  };
};