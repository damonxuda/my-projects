// admin-permissions/src/App.js
import React, { useState, useEffect } from 'react';
import { ClerkAuthProvider, useAuth, UserManagement, UserProfile, ModuleAccessGuard } from '../../auth-clerk/src';
import { User, Users, Shield, Settings } from 'lucide-react';

const AdminPermissionsApp = () => {
  const [activeTab, setActiveTab] = useState('users');
  const { user, isAdmin, getCachedToken } = useAuth();

  // 跨模块导航功能
  const handleCrossModuleNavigation = async (targetUrl) => {
    try {
      // 获取当前session token
      const token = await getCachedToken();
      if (token) {
        // 带token跳转到目标模块
        const urlWithSession = `${targetUrl}?session=${encodeURIComponent(token)}`;
        console.log('🚀 Admin跨模块认证跳转:', urlWithSession);
        window.location.href = urlWithSession;
      } else {
        console.warn('⚠️ 无法获取session token，使用普通跳转');
        window.location.href = targetUrl;
      }
    } catch (error) {
      console.error('❌ 跨模块跳转失败:', error);
      window.location.href = targetUrl;
    }
  };

  // SSO入口：检测跨模块认证token并解析
  useEffect(() => {
    const handleCrossModuleAuth = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionToken = urlParams.get('session');

      if (sessionToken) {
        console.log('🔗 Admin检测到跨模块认证token，处理中...');

        try {
          // 🔥 手动解析JWT token并设置localStorage (Clerk官方推荐的跨应用认证方案)
          const tokenParts = sessionToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log('🔄 Admin: 解析JWT token并设置localStorage');

            const clerkData = {
              user: {
                id: payload.sub,
                emailAddresses: [{ emailAddress: payload.email || 'user@crossmodule.auth' }],
                firstName: payload.given_name || 'Cross',
                lastName: payload.family_name || 'Module'
              },
              session: {
                id: payload.sid,
                status: 'active'
              }
            };

            localStorage.setItem('__clerk_environment', JSON.stringify(clerkData));
            console.log('✅ Admin localStorage设置完成，即将刷新页面');

            setTimeout(() => {
              window.location.reload();
            }, 100);
          }
        } catch (error) {
          console.error('❌ Admin JWT解析失败:', error);
        }

        // 清理URL参数，避免token暴露
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    };

    handleCrossModuleAuth();
  }, []); // 只在组件挂载时执行一次

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
            <div className="flex items-center space-x-3">
              {/* 回首页按钮 */}
              <button
                onClick={() => handleCrossModuleNavigation("/")}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors"
              >
                🏠 首页
              </button>
              {/* 右上角用户菜单 - 直接使用现有的UserProfile组件 */}
              <UserProfile showWelcome={false} afterSignOutUrl="/" />
            </div>
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

// 主应用组件 - 包装Clerk认证和管理员权限保护
const App = () => {
  return (
    <ClerkAuthProvider publishableKey={process.env.REACT_APP_CLERK_PUBLISHABLE_KEY}>
      <ModuleAccessGuard
        module="admin-permissions"
        noAccessComponent={
          <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen flex items-center justify-center">
            <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-lg">
              <div className="mb-6">
                <svg className="mx-auto h-16 w-16 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">需要管理员权限</h2>
              <p className="text-gray-600 mb-4">
                只有系统管理员可以访问权限管理系统
              </p>
              <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                <p className="text-sm text-yellow-800 mb-2">
                  如需管理员权限，请联系系统管理员
                </p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => window.location.href = '/'}
                  className="w-full px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium transition-colors"
                >
                  返回首页
                </button>
              </div>
            </div>
          </div>
        }
      >
        <AdminPermissionsApp />
      </ModuleAccessGuard>
    </ClerkAuthProvider>
  );
};

export default App;