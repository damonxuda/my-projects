import { ClerkAuthProvider, useAuth, UserProfile } from '../../auth-clerk/src';
import React from 'react';
import TradingDashboard from './components/TradingDashboard';
import { User, Lock } from 'lucide-react';
import './App.css';

// 交易观察系统主组件
const TradingApp = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();

  // 用户显示信息生成函数
  const getUserDisplayInfo = () => {
    if (!user) return { display: "未登录", avatar: null };

    if (user.firstName || user.lastName) {
      const firstName = user.firstName || '';
      const lastName = user.lastName || '';
      const fullName = (firstName + ' ' + lastName).trim();

      if (fullName) {
        const initials = fullName.split(' ').map(name => name.charAt(0).toUpperCase()).join('');
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&size=32&background=667eea&color=fff&bold=true&rounded=true`;
        return { display: initials, avatar: avatarUrl };
      }
    }

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
      <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">正在加载量化交易系统...</p>
        </div>
      </div>
    );
  }

  // ⚠️ 重要：只有管理员能访问此模块
  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <Lock className="mx-auto mb-4 text-red-500" size={64} />
          <h1 className="text-2xl font-bold text-gray-900 mb-4">访问受限</h1>
          <p className="text-gray-600 mb-6">
            量化交易观察系统仅限系统管理员访问。
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg">
        {/* 顶部用户信息栏 */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">📊 LLM Trading Observer</h1>
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
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">管理员</span>
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
              观察大语言模型的量化交易决策表现（模拟交易，非真实资金）
            </p>
          </div>
        </div>

        {/* 主内容区域 */}
        <div className="p-6">
          <TradingDashboard />
        </div>
      </div>
    </div>
  );
};

// 主应用组件 - 包装Clerk认证
const App = () => {
  return (
    <ClerkAuthProvider
      publishableKey={process.env.REACT_APP_CLERK_PUBLISHABLE_KEY}
    >
      <TradingApp />
    </ClerkAuthProvider>
  );
};

export default App;
