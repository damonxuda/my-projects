// auth-clerk/src/components/UserManagement.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const UserManagement = () => {
  const {
    isAdmin,
    isSignedIn,
    users,
    loading,
    fetchAllUsers,
    assignModuleAccess,
    revokeModuleAccess
  } = useAuth();

  const [processingUser, setProcessingUser] = useState(null);
  const [filter, setFilter] = useState('pending'); // pending, approved, all
  const [availableModules] = useState(['schedule', 'quiz', 'videos', 'future1', 'future2']);

  useEffect(() => {
    if (isAdmin && isSignedIn) {
      // 延迟执行，确保认证状态已完全同步
      const timer = setTimeout(() => {
        fetchAllUsers();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isAdmin, isSignedIn, fetchAllUsers]);

  // 获取用户权限信息
  const getUserPermissions = (user) => {
    return {
      modules: user.modules || [],
      approvedBy: user.approved_by || null,
      approvedAt: user.approved_at || null,
      lastUpdated: user.updated_at || null
    };
  };

  // 检查用户状态
  const getUserStatus = (user) => {
    const permissions = getUserPermissions(user);
    if (permissions.modules.length > 0) {
      return 'approved';
    }
    return 'pending';
  };

  // 为用户分配模块权限
  const assignModulePermission = async (userId, modules) => {
    try {
      setProcessingUser(userId);
      await assignModuleAccess(userId, modules);
      
      // 刷新用户列表
      await fetchAllUsers();
      alert('权限分配成功！');
    } catch (error) {
      console.error('权限分配失败:', error);
      alert('权限分配失败：' + error.message);
    } finally {
      setProcessingUser(null);
    }
  };

  // 撤销用户权限
  const revokeAllPermissions = async (userId) => {
    if (!window.confirm('确定要撤销该用户的所有权限吗？')) {
      return;
    }

    try {
      setProcessingUser(userId);
      await revokeModuleAccess(userId);
      await fetchAllUsers();
      alert('权限已撤销！');
    } catch (error) {
      console.error('撤销权限失败:', error);
      alert('撤销权限失败：' + error.message);
    } finally {
      setProcessingUser(null);
    }
  };

  // 处理快速批准（给予quiz权限）
  const handleQuickApprove = async (userId) => {
    await assignModulePermission(userId, ['quiz']);
  };

  // 处理自定义权限分配
  const handleCustomPermission = (userId) => {
    const user = users.find(u => u.id === userId);
    const currentPermissions = getUserPermissions(user);
    
    const moduleCheckboxes = availableModules.map(module => 
      `${module}: ${currentPermissions.modules.includes(module) ? '✓' : '✗'}`
    ).join('\n');
    
    const selectedModules = prompt(
      `为用户分配权限：\n当前权限：\n${moduleCheckboxes}\n\n请输入要授权的模块（用逗号分隔）：\n可选模块：${availableModules.join(', ')}`,
      currentPermissions.modules.join(', ')
    );
    
    if (selectedModules !== null) {
      const modules = selectedModules.split(',').map(m => m.trim()).filter(m => availableModules.includes(m));
      if (modules.length > 0) {
        assignModulePermission(userId, modules);
      } else {
        alert('请输入有效的模块名称');
      }
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
    };

    const labels = {
      pending: '待审批',
      approved: '已批准',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  // 过滤用户
  const filteredUsers = users.filter(user => {
    const status = getUserStatus(user);
    if (filter === 'all') return true;
    return status === filter;
  });

  // 统计数据
  const stats = {
    pending: users.filter(u => getUserStatus(u) === 'pending').length,
    approved: users.filter(u => getUserStatus(u) === 'approved').length,
    total: users.length
  };

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">访问被拒绝</h1>
          <p className="mt-2 text-gray-600">只有管理员可以访问用户管理功能</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">加载用户列表中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">用户权限管理</h1>
        <p className="mt-2 text-gray-600">管理用户模块访问权限</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-8.8a.999.999 0 00-.02.022M7.5 19.5h3v-5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v5h3" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">总用户数</h3>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">待审批</h3>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">已授权</h3>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg max-w-md">
          {[
            { key: 'pending', label: '待审批', count: stats.pending },
            { key: 'approved', label: '已授权', count: stats.approved },
            { key: 'all', label: '全部', count: stats.total },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* 用户列表 */}
      {filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {filter === 'all' ? '暂无用户' : `暂无${filter === 'pending' ? '待审批' : '已授权'}用户`}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredUsers.map((user) => {
              const status = getUserStatus(user);
              const permissions = getUserPermissions(user);
              const userEmail = user.email || user.emailAddresses?.[0]?.emailAddress || '无邮箱';
              
              return (
                <li key={user.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {userEmail.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : userEmail}
                            </p>
                            {getStatusBadge(status)}
                          </div>
                          <p className="text-sm text-gray-600 truncate">{userEmail}</p>
                          
                          {/* 显示权限信息 */}
                          {permissions.modules.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">已授权模块：</p>
                              <div className="flex flex-wrap gap-1">
                                {permissions.modules.map(module => (
                                  <span key={module} className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                    {module}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500">
                            <span>注册时间：{new Date(user.createdAt).toLocaleString('zh-CN')}</span>
                            {permissions.approvedAt && (
                              <span>• 审批时间：{new Date(permissions.approvedAt).toLocaleString('zh-CN')}</span>
                            )}
                          </div>
                          
                          {permissions.approvedBy && (
                            <p className="mt-1 text-xs text-gray-500">
                              审批人：{permissions.approvedBy}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center space-x-2">
                      {status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleQuickApprove(user.id)}
                            disabled={processingUser === user.id}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                          >
                            {processingUser === user.id ? '处理中...' : '快速批准'}
                          </button>
                          <button
                            onClick={() => handleCustomPermission(user.id)}
                            disabled={processingUser === user.id}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                          >
                            自定义权限
                          </button>
                        </>
                      )}
                      
                      {status === 'approved' && (
                        <>
                          <button
                            onClick={() => handleCustomPermission(user.id)}
                            disabled={processingUser === user.id}
                            className="inline-flex items-center px-3 py-1 border border-blue-300 text-xs font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                          >
                            修改权限
                          </button>
                          <button
                            onClick={() => revokeAllPermissions(user.id)}
                            disabled={processingUser === user.id}
                            className="inline-flex items-center px-3 py-1 border border-red-300 text-xs font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                          >
                            撤销权限
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 刷新按钮 */}
      <div className="mt-6 flex justify-between items-center">
        <button
          onClick={fetchAllUsers}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? '刷新中...' : '刷新列表'}
        </button>
        
        <div className="text-sm text-gray-500">
          共 {users.length} 个用户，{stats.pending} 个待审批
        </div>
      </div>
    </div>
  );
};

export default UserManagement;