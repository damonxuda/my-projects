// auth-clerk/src/components/ModuleAccessGuard.js
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { SignInButton } from '@clerk/clerk-react';

const ModuleAccessGuard = ({ 
  module, 
  children, 
  loadingComponent = null, 
  noAccessComponent = null 
}) => {
  const { isLoaded, isSignedIn, hasModuleAccess, user } = useAuth();

  // 显示加载状态
  if (!isLoaded) {
    return loadingComponent || (
      <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证权限...</p>
        </div>
      </div>
    );
  }

  // 用户未登录
  if (!isSignedIn) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-lg">
          <div className="mb-6">
            <svg className="mx-auto h-16 w-16 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">需要登录</h2>
          <p className="text-gray-600 mb-6">请先登录以访问{module}模块</p>
          <SignInButton mode="modal">
            <button className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors">
              登录
            </button>
          </SignInButton>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full mt-3 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  // 检查模块访问权限
  if (!hasModuleAccess(module)) {
    return noAccessComponent || (
      <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-lg">
          <div className="mb-6">
            <svg className="mx-auto h-16 w-16 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">等待权限审批</h2>
          <p className="text-gray-600 mb-4">
            您还没有访问 <span className="font-medium text-gray-900">{module}</span> 模块的权限
          </p>
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <p className="text-sm text-blue-800 mb-2">
              <strong>您的账号信息：</strong>
            </p>
            <p className="text-sm text-blue-700">
              邮箱: {user?.emailAddresses?.[0]?.emailAddress}
            </p>
            <p className="text-sm text-blue-700 mt-2">
              管理员会在 1-2 个工作日内审批您的权限申请
            </p>
          </div>
          <div className="space-y-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors"
            >
              重新检查权限
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 有权限，显示子组件
  return <>{children}</>;
};

export default ModuleAccessGuard;