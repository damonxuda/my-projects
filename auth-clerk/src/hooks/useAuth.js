// auth-clerk/src/hooks/useAuth.js
import { useUser, useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react';
import { useState, useEffect, useCallback } from 'react';

// ✅ 用户管理API URL（权限管理Lambda）
const LAMBDA_API_URL = process.env.REACT_APP_USER_MANAGEMENT_API_URL;

// ✅ 视频API URL
const VIDEO_API_URL = process.env.REACT_APP_VIDEO_API_URL;

export const useAuth = () => {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded, getToken } = useClerkAuth(); // ✅ 新增getToken
  const clerk = useClerk();
  
  // 用户管理相关状态
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // ✅ Token缓存机制 - 避免频繁调用getToken造成403错误
  const [cachedToken, setCachedToken] = useState(null);
  const [tokenExpiry, setTokenExpiry] = useState(null);

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

  // ✅ 获取缓存的Token - 避免频繁调用导致403错误，支持并发保护
  let tokenPromise = null;
  const getCachedToken = async () => {
    const now = Date.now();
    
    // 如果token还在有效期内，直接返回缓存的token
    if (cachedToken && tokenExpiry && now < tokenExpiry) {
      return cachedToken;
    }
    
    // 如果已经有正在进行的token请求，等待它完成
    if (tokenPromise) {
      return await tokenPromise;
    }
    
    // 创建新的token请求
    tokenPromise = (async () => {
      try {
        // 获取新的token
        const freshToken = await getToken();
        if (freshToken) {
          setCachedToken(freshToken);
          // 设置过期时间为45秒后（根据Clerk rate limit策略和实际观测，平衡刷新频率和缓存效果）
          setTokenExpiry(now + 45 * 1000);
          return freshToken;
        }
        throw new Error('无法获取token');
      } catch (error) {
        // 如果获取失败但有缓存token，尝试使用缓存token
        if (cachedToken) {
          return cachedToken;
        }
        throw error;
      } finally {
        // 请求完成后清除promise
        tokenPromise = null;
      }
    })();
    
    return await tokenPromise;
  };

  // ✅ 智能清除token缓存 - 避免频繁清除影响其他组件
  const clearTokenCache = () => {
    const now = Date.now();
    const timeSinceLastClear = now - (window.lastTokenClear || 0);
    
    // 如果距离上次清除不足10秒，跳过清除（防止连锁反应）
    if (timeSinceLastClear < 10000) {
      console.log('🛑 跳过token清除（距离上次清除不足10秒，防止连锁反应）');
      return;
    }
    
    console.log('🗑️ 智能清除token缓存');
    setCachedToken(null);
    setTokenExpiry(null);
    tokenPromise = null;
    window.lastTokenClear = now;
  };

  // 获取所有用户（管理员功能）- 保持原有逻辑不变
  const fetchAllUsers = useCallback(async () => {
    if (!isAdmin()) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(LAMBDA_API_URL);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setUsers(data.users || []);

    } catch (error) {
      console.error('获取用户列表失败:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  // ✅ 为用户分配模块权限（通过Lambda API）- 保持原有逻辑不变
  const assignModuleAccess = async (userEmailOrId, moduleOrModules, isGranting = true) => {
    if (!isAdmin()) {
      throw new Error('只有管理员可以分配权限');
    }

    try {
      // 如果是单模块开关操作
      if (typeof moduleOrModules === 'string' && typeof isGranting === 'boolean') {
        console.log(`🔧 单模块操作开始:`);
        console.log(`   - 用户: ${userEmailOrId}`);
        console.log(`   - 模块: ${moduleOrModules}`);
        console.log(`   - 操作: ${isGranting ? '授予' : '撤销'}`);
        
        // 1. 获取所有用户
        console.log(`📡 正在获取所有用户...`);
        const allUsers = await fetchAllUsers();
        console.log(`📡 获取到 ${allUsers.length} 个用户`);
        
        // 2. 查找目标用户 - 增强查找逻辑
        console.log(`🔍 查找目标用户: ${userEmailOrId}`);
        const targetUser = allUsers.find(u => {
          const userEmail = u.email || u.emailAddresses?.[0]?.emailAddress || 'no-email';
          const match = u.email === userEmailOrId || 
                      u.id === userEmailOrId ||
                      userEmail === userEmailOrId;
          
          if (match) {
            console.log(`✅ 找到匹配用户:`, {
              id: u.id,
              email: userEmail,
              currentModules: u.modules
            });
          }
          
          return match;
        });
        
        if (!targetUser) {
          console.error(`❌ 用户查找失败!`);
          console.log(`可用用户列表:`, allUsers.map(u => ({
            id: u.id,
            email: u.email || u.emailAddresses?.[0]?.emailAddress,
            modules: u.modules
          })));
          throw new Error(`找不到用户: ${userEmailOrId}`);
        }
        
        // 3. 获取当前模块权限
        const currentModules = targetUser.modules || [];
        console.log(`📋 用户当前模块:`, currentModules);
        console.log(`📋 模块类型:`, typeof currentModules, Array.isArray(currentModules));
        
        // 4. 计算新的模块列表
        let newModules;
        if (isGranting) {
          // 添加模块
          if (currentModules.includes(moduleOrModules)) {
            console.log(`⚠️  模块 ${moduleOrModules} 已存在，无需添加`);
            newModules = [...currentModules];
          } else {
            newModules = [...currentModules, moduleOrModules];
            console.log(`➕ 添加模块 ${moduleOrModules}`);
          }
        } else {
          // 移除模块
          newModules = currentModules.filter(m => m !== moduleOrModules);
          console.log(`➖ 移除模块 ${moduleOrModules}`);
        }
        
        console.log(`🔄 模块变更:`);
        console.log(`   - 原模块: [${currentModules.join(', ')}]`);
        console.log(`   - 新模块: [${newModules.join(', ')}]`);
        
        // 5. 检查是否真的有变更
        const hasChanges = JSON.stringify(currentModules.sort()) !== JSON.stringify(newModules.sort());
        console.log(`🔍 是否有变更: ${hasChanges}`);
        
        if (!hasChanges) {
          console.log(`⚠️  无变更，跳过API调用`);
          return { success: true, message: '无需更新' };
        }
        
        // 6. 调用API更新
        const requestBody = {
          action: 'assign_modules',
          userId: targetUser.id,
          modules: newModules,
          approvedBy: user.emailAddresses[0].emailAddress
        };
        
        console.log(`📤 发送API请求:`, requestBody);
        
        const response = await fetch(LAMBDA_API_URL, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        console.log(`📡 API响应状态: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ API调用失败:`, errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        console.log(`📥 API响应结果:`, result);
        
        if (!result.success) {
          console.error(`❌ API返回失败:`, result);
          throw new Error(result.error || '权限操作失败');
        }

        console.log(`✅ 权限操作成功完成`);
        
        // 7. 重新加载用户数据以验证更新
        console.log(`🔄 重新加载用户数据进行验证...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
        
        try {
          await fetchAllUsers(); // 触发重新加载
          console.log(`✅ 用户数据已重新加载`);
        } catch (reloadError) {
          console.warn(`⚠️  重新加载用户数据失败:`, reloadError);
        }

        return { 
          success: true, 
          message: `模块 ${moduleOrModules} 已${isGranting ? '授予' : '撤销'}`,
          details: {
            userId: targetUser.id,
            email: userEmailOrId,
            oldModules: currentModules,
            newModules: newModules
          }
        };
        
      } else {
        // 原有的批量分配逻辑保持不变
        const modules = Array.isArray(moduleOrModules) ? moduleOrModules : [moduleOrModules];
        
        const requestBody = {
          action: 'assign_modules',
          userId: userEmailOrId,
          modules: modules,
          approvedBy: user.emailAddresses[0].emailAddress
        };
        
        const response = await fetch(LAMBDA_API_URL, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || '分配权限失败');
        }

        return { success: true };
      }
      
    } catch (error) {
      console.error('❌ 权限操作失败:', error);
      console.error('❌ 错误堆栈:', error.stack);
      throw error;
    }
  };

  // ✅ 撤销用户权限（通过Lambda API）- 保持原有逻辑不变
  const revokeModuleAccess = async (userId) => {
    if (!isAdmin()) {
      throw new Error('只有管理员可以撤销权限');
    }

    try {
      const response = await fetch(LAMBDA_API_URL, {
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

  // 获取用户的权限信息（为UserManagement组件使用）- 保持原有逻辑不变
  const getUserPermissions = (targetUser) => {
    if (!targetUser) return { modules: [], approvedBy: null, approvedAt: null };
    
    return {
      modules: targetUser.modules || targetUser.publicMetadata?.authorized_modules || [],
      approvedBy: targetUser.approved_by || targetUser.publicMetadata?.approved_by || null,
      approvedAt: targetUser.approved_at || targetUser.publicMetadata?.approved_at || null
    };
  };

  // ===== ✅ 新增：视频相关API方法 =====
  
  // 获取视频列表（带token认证）
  const fetchVideoList = async (path = '') => {
    try {
      const token = await getCachedToken();
      console.log('🎫 getCachedToken result:', token ? `${token.substring(0, 20)}...` : 'null/undefined');
      console.log('🎫 Token type:', typeof token);
      console.log('🎫 Token length:', token ? token.length : 'N/A');
      
      if (!token) {
        console.error('❌ Token is falsy:', token);
        throw new Error('无法获取认证token');
      }
      
      const requestUrl = `${VIDEO_API_URL}/videos/list?path=${encodeURIComponent(path)}`;
      console.log('🔍 fetchVideoList - Request URL:', requestUrl);
      console.log('🔍 fetchVideoList - VIDEO_API_URL:', VIDEO_API_URL);
      
      const response = await fetch(requestUrl, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('📡 fetchVideoList - Response status:', response.status);
      console.log('📡 fetchVideoList - Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ fetchVideoList - Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const responseText = await response.text();
      console.log('📄 fetchVideoList - Raw response (first 200 chars):', responseText.substring(0, 200));
      
      // 检查响应是否是HTML而不是JSON
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        console.error('❌ fetchVideoList - 收到HTML响应而非JSON:', responseText.substring(0, 500));
        throw new Error('服务器返回HTML页面而非JSON数据，请检查API端点配置');
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ fetchVideoList - JSON解析失败:', parseError);
        console.error('❌ fetchVideoList - 原始响应:', responseText);
        throw new Error(`JSON解析失败: ${parseError.message}. 响应内容: ${responseText.substring(0, 200)}`);
      }
      
      return data;
      
    } catch (error) {
      throw error;
    }
  };

  // 获取视频播放URL（带token认证）
  const getVideoUrl = async (videoKey) => {
    try {
      const token = await getCachedToken();
      
      const response = await fetch(
        `${VIDEO_API_URL}/videos/url/${encodeURIComponent(videoKey)}`,
        {
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const responseText = await response.text();
      
      // 检查响应是否是HTML而不是JSON
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        console.error('❌ getVideoUrl - 收到HTML响应而非JSON:', responseText.substring(0, 500));
        throw new Error('服务器返回HTML页面而非JSON数据，请检查API端点配置');
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ getVideoUrl - JSON解析失败:', parseError);
        console.error('❌ getVideoUrl - 原始响应:', responseText);
        throw new Error(`JSON解析失败: ${parseError.message}. 响应内容: ${responseText.substring(0, 200)}`);
      }
      
      return data;
      
    } catch (error) {
      throw error;
    }
  };

  // 自动加载用户列表（如果是管理员）- 保持原有逻辑不变
  useEffect(() => {
    if (userLoaded && isSignedIn && isAdmin()) {
      fetchAllUsers();
    }
  }, [userLoaded, isSignedIn, user]);

  // ✅ 用户变更时清空缓存的token
  useEffect(() => {
    setCachedToken(null);
    setTokenExpiry(null);
  }, [user?.id, isSignedIn]);

  return {
    // 原有功能 - 完全不变
    user,
    isSignedIn: !!isSignedIn,
    isLoaded: userLoaded && authLoaded,
    isAdmin: isAdmin(),
    isOwner: isOwner(),
    authLoading: !userLoaded || !authLoaded,
    // 导出函数供其他组件使用
    getAdminEmails,
    // 新增的模块权限功能
    hasModuleAccess,
    getUserModules,
    getUserPermissionInfo,
    // 管理员功能 - 完全不变
    users,
    loading: loading,
    fetchAllUsers,
    assignModuleAccess,
    revokeModuleAccess,
    getUserPermissions,
    
    // ✅ 新增：视频相关方法
    fetchVideoList,
    getVideoUrl,
    getToken,
    getCachedToken,
    clearTokenCache
  };
};