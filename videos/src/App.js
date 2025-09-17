import { ClerkAuthProvider, useAuth, ModuleAccessGuard, UserProfile } from '../../auth-clerk/src';
import React from 'react';
import VideoLibrary from './components/VideoLibrary';
import { User } from 'lucide-react';
import './App.css';

// 视频应用主组件
const VideoApp = () => {
  const { user, loading: authLoading } = useAuth();

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
                <User size={16} />
                <span>{user?.emailAddresses?.[0]?.emailAddress || user?.firstName}</span>
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