// src/components/AuthGuard.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthProvider';

/**
 * 内置的加载组件
 */
const DefaultLoadingSpinner = () => (
  <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div className="sm:mx-auto sm:w-full sm:max-w-md">
      <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        <p className="text-center text-gray-600 mt-4">正在验证用户身份...</p>
      </div>
    </div>
  </div>
);

/**
 * 内置的等待审批组件
 */
const WaitingApproval = ({ userProfile, onSignOut }) => {
  const getStatusMessage = () => {
    switch (userProfile?.status) {
      case 'pending':
        return {
          title: '等待审批',
          message: '您的账户正在等待管理员审批，审批通过后即可使用系统。',
          icon: '⏳',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
        };
      case 'rejected':
        return {
          title: '审批被拒绝',
          message: '很抱歉，您的账户申请被拒绝。如有疑问，请联系管理员。',
          icon: '❌',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
        };
      default:
        return {
          title: '状态未知',
          message: '无法确定您的账户状态，请联系管理员。',
          icon: '❓',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
        };
    }
  };

  const statusInfo = getStatusMessage();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full ${statusInfo.bgColor} mb-4`}>
              <span className="text-2xl">{statusInfo.icon}</span>
            </div>
            
            <h2 className={`text-2xl font-bold ${statusInfo.color} mb-4`}>
              {statusInfo.title}
            </h2>
            
            <p className="text-gray-600 mb-6">
              {statusInfo.message}
            </p>

            {userProfile && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-medium text-gray-900 mb-2">账户信息</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>邮箱：</strong>{userProfile.email}</p>
                  <p><strong>申请时间：</strong>{new Date(userProfile.requested_at).toLocaleString('zh-CN')}</p>
                  <p><strong>当前状态：</strong>
                    <span className={`ml-1 px-2 py-1 rounded text-xs ${
                      userProfile.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      userProfile.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {userProfile.status === 'pending' ? '待审批' :
                       userProfile.status === 'rejected' ? '已拒绝' : '未知'}
                    </span>
                  </p>
                  {userProfile.notes && (
                    <p><strong>备注：</strong>{userProfile.notes}</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                刷新状态
              </button>
              
              <button
                onClick={onSignOut}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                退出登录
              </button>
            </div>

            {userProfile?.status === 'pending' && (
              <div className="mt-6 text-xs text-gray-500">
                <p>审批通常在1-2个工作日内完成</p>
                <p>如有紧急需求，请联系管理员</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 邮箱验证提醒组件
 */
const EmailVerificationRequired = ({ user }) => (
  <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div className="sm:mx-auto sm:w-full sm:max-w-md">
      <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-50 mb-4">
            <span className="text-2xl">📧</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">验证邮箱</h2>
          <p className="text-gray-600 mb-4">
            我们已向您的邮箱发送了验证链接，请点击邮件中的链接完成验证。
          </p>
          <p className="text-sm text-gray-500 mb-6">
            邮箱：{user.email}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            我已验证，刷新页面
          </button>
        </div>
      </div>
    </div>
  </div>
);

/**
 * 权限不足提醒组件
 */
const AccessDenied = () => (
  <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div className="sm:mx-auto sm:w-full sm:max-w-md">
      <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-50 mb-4">
            <span className="text-2xl">🚫</span>
          </div>
          <h2 className="text-2xl font-bold text-red-600 mb-4">访问被拒绝</h2>
          <p className="text-gray-600">
            您没有权限访问此页面。请联系管理员。
          </p>
        </div>
      </div>
    </div>
  </div>
);

/**
 * 认证路由守卫组件 - 整合了ProtectedRoute和WaitingApproval的功能
 * @param {ReactNode} children - 需要保护的子组件
 * @param {ReactNode} fallback - 未认证时显示的组件
 * @param {boolean} requireApproval - 是否需要管理员审批
 * @param {boolean} requireAdmin - 是否需要管理员权限
 * @param {ReactNode} loadingComponent - 加载时显示的组件
 * @param {boolean} checkEmailVerification - 是否检查邮箱验证状态
 */
const AuthGuard = ({ 
  children, 
  fallback = <div>请登录后访问此页面</div>,
  requireApproval = true,
  requireAdmin = false,
  loadingComponent,
  checkEmailVerification = true
}) => {
  const { user, userProfile, loading, isUserApproved, isAdmin, signOut } = useAuth();

  // 显示加载状态
  if (loading) {
    return loadingComponent || <DefaultLoadingSpinner />;
  }

  // 用户未登录
  if (!user) {
    return fallback;
  }

  // 检查邮箱验证状态（如果启用）
  if (checkEmailVerification && !user.email_confirmed_at) {
    return <EmailVerificationRequired user={user} />;
  }

  // 需要管理员权限但用户不是管理员
  if (requireAdmin && !isAdmin()) {
    return <AccessDenied />;
  }

  // 需要审批但用户未被审批
  if (requireApproval && !isUserApproved()) {
    return <WaitingApproval userProfile={userProfile} onSignOut={signOut} />;
  }

  // 通过所有检查，显示受保护的内容
  return children;
};

export default AuthGuard;