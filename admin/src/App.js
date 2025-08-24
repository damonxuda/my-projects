// admin-permissions/src/App.js
import React, { useState } from 'react';
import { ClerkAuthProvider, useAuth, ModuleAccessGuard, UserManagement, UserProfile } from '../../auth-clerk/src';
import { User, Users, Shield, Settings } from 'lucide-react';

const AdminPermissionsApp = () => {
  const [activeTab, setActiveTab] = useState('users');
  const { user, isSignedIn, isAdmin, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">正在加载权限管理系统...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg">
        {/* 顶部用户信息栏 - 参考quiz模块的实现 */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">权限管理系统</h1>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User size={16} />
                <span>{user?.emailAddresses?.[0]?.emailAddress || user?.firstName}</span>
                {isAdmin && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">管理员</span>
                )}
              </div>
            </div>
            {/* 右上角用户菜单 - 直接使用现有的UserProfile组件 */}
            <UserProfile showWelcome={false} afterSignOutUrl="/" />
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'users' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users size={16} />
              用户管理
            </button>
            
            <button
              onClick={() => setActiveTab('permissions')}
              className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'permissions' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Shield size={16} />
              权限分配
            </button>

            <button
              onClick={() => setActiveTab('system')}
              className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'system' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Settings size={16} />
              系统设置
            </button>
          </nav>
        </div>

        {/* 内容区域 */}
        <div className="p-6">
          {activeTab === 'users' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">用户管理</h2>
                <p className="text-gray-600 mt-2">
                  管理系统用户，审批权限申请，分配模块访问权限
                </p>
              </div>
              
              {/* 使用现有的UserManagement组件 */}
              <UserManagement />
            </div>
          )}

          {activeTab === 'permissions' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">权限分配</h2>
                <p className="text-gray-600 mt-2">
                  批量管理用户权限，模块权限可视化
                </p>
              </div>
              
              {/* 权限分配功能 - 待实现 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <Shield className="text-blue-500" size={24} />
                  <h3 className="text-lg font-semibold text-blue-800 ml-2">权限分配功能</h3>
                </div>
                <p className="text-blue-700 mb-4">
                  这里将显示权限分配界面，包括：
                </p>
                <ul className="text-blue-700 space-y-2">
                  <li>• 可视化权限标签系统</li>
                  <li>• 批量权限分配功能</li>
                  <li>• 模块访问权限管理</li>
                  <li>• 权限变更历史记录</li>
                </ul>
                <div className="mt-4 text-sm text-blue-600">
                  功能开发中...
                </div>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">系统设置</h2>
                <p className="text-gray-600 mt-2">
                  系统配置，环境变量管理，日志查看
                </p>
              </div>
              
              {/* 系统信息 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">系统信息</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">当前用户</span>
                      <span className="font-medium">{user?.emailAddresses?.[0]?.emailAddress}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">用户角色</span>
                      <span className="font-medium">{isAdmin ? '管理员' : '普通用户'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">认证状态</span>
                      <span className="font-medium text-green-600">已认证</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">环境配置</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">管理员邮箱配置</span>
                      <span className="font-medium text-sm">
                        {process.env.REACT_APP_ADMIN_EMAILS ? '已配置' : '未配置'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Clerk认证</span>
                      <span className="font-medium text-green-600">正常</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">API连接</span>
                      <span className="font-medium text-green-600">正常</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 管理员提示 */}
              {process.env.REACT_APP_ADMIN_EMAILS && (
                <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-2">管理员配置</h4>
                  <p className="text-sm text-green-700">
                    管理员邮箱列表：{process.env.REACT_APP_ADMIN_EMAILS}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 主应用组件 - 包装Clerk认证和权限保护
const App = () => {
  return (
    <ClerkAuthProvider publishableKey={process.env.REACT_APP_CLERK_PUBLISHABLE_KEY}>
      <ModuleAccessGuard module="admin-permissions">
        <AdminPermissionsApp />
      </ModuleAccessGuard>
    </ClerkAuthProvider>
  );
};

export default App;