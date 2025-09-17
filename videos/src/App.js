import { ClerkAuthProvider, useAuth, ModuleAccessGuard, UserProfile } from '../../auth-clerk/src';
import React from 'react';
import VideoLibrary from './components/VideoLibrary';
import { User } from 'lucide-react';
import './App.css';

// 视频应用主组件
const VideoApp = () => {
  const { user, loading: authLoading } = useAuth();

  // 用户显示信息生成函数 - 匹配games模块的显示逻辑
  const getUserDisplayInfo = () => {
    if (!user) return { display: "未登录", avatar: null };

    // 优先显示姓名首字母（如DX for Damon XU）
    if (user.firstName || user.lastName) {
      const firstName = user.firstName || '';
      const lastName = user.lastName || '';
      const fullName = (firstName + ' ' + lastName).trim();

      if (fullName) {
        // 生成首字母显示和头像
        const initials = fullName.split(' ').map(name => name.charAt(0).toUpperCase()).join('');
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=32&background=667eea&color=fff&bold=true&rounded=true`;
        return { display: initials, avatar: avatarUrl };
      }
    }

    // Fallback到邮箱
    if (user.emailAddresses?.[0]?.emailAddress) {
      const email = user.emailAddresses[0].emailAddress;
      const emailPrefix = email.split('@')[0];
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(emailPrefix)}&size=32&background=764ba2&color=fff&bold=true&rounded=true&length=1`;
      return { display: email, avatar: avatarUrl };
    }

    return { display: "用户", avatar: null };
  };

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">正在加载视频中心...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg">
        {/* 顶部用户信息栏 - 参考admin模块的样式 */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">视频中心</h1>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                {getUserDisplayInfo().avatar ? (
                  <img
                    src={getUserDisplayInfo().avatar}
                    alt="用户头像"
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <User size={16} />
                )}
                <span>{getUserDisplayInfo().display}</span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* 返回主页按钮 */}
              <button
                onClick={() => window.location.href = '/'}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors"
              >
                🏠 首页
              </button>
              {/* 右上角登出按钮 */}
              <UserProfile showWelcome={false} afterSignOutUrl="/" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-600">
              请先登录以访问视频中心
            </p>
          </div>
        </div>

        {/* 视频内容区域 */}
        <div className="p-6">
          <VideoLibrary />
        </div>
      </div>
    </div>
  );
};

// 主应用组件 - 包装Clerk认证和权限保护（卫星模式）
const App = () => {
  return (
    <ClerkAuthProvider
      publishableKey={process.env.REACT_APP_CLERK_PUBLISHABLE_KEY}
    >
      <ModuleAccessGuard module="videos">
        <VideoApp />
      </ModuleAccessGuard>
    </ClerkAuthProvider>
  );
};

export default App;