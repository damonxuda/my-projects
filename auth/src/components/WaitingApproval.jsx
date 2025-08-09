// src/components/WaitingApproval.jsx
import React from 'react';
import { useAuth } from '../contexts/AuthProvider';

const WaitingApproval = ({ 
  userProfile,
  onSignOut,
  className = ""
}) => {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    if (onSignOut) {
      await onSignOut();
    } else {
      await signOut();
    }
  };

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
    <div className={`min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 ${className}`}>
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
                onClick={handleSignOut}
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

export default WaitingApproval;