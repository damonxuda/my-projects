import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Mail, Calendar } from 'lucide-react';
import { useAuth } from '../../../auth-clerk/src';

const UserApproval = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState({});
  
  const { fetchAllUsers, assignModuleAccess } = useAuth();

  // 加载待审批用户
  useEffect(() => {
    loadPendingUsers();
  }, []);

  const loadPendingUsers = async () => {
    setLoading(true);
    setError('');
    
    try {
      const allUsers = await fetchAllUsers();
      // 筛选出没有任何模块访问权限的用户（待审批用户）
      const pending = allUsers.filter(user => 
        !user.hasAccess || 
        (!user.modules?.videos && !user.modules?.quiz)
      );
      setPendingUsers(pending);
    } catch (err) {
      console.error('加载待审批用户失败:', err);
      setError('加载用户列表失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  // 批准用户
  const approveUser = async (userId, email, modules = ['videos']) => {
    setProcessing(prev => ({ ...prev, [userId]: 'approving' }));
    
    try {
      // 为用户分配指定模块的访问权限
      for (const module of modules) {
        await assignModuleAccess(email, module, true);
      }
      
      // 重新加载用户列表
      await loadPendingUsers();
      
      console.log(`✅ 用户 ${email} 已获得 ${modules.join(', ')} 模块访问权限`);
      
    } catch (error) {
      console.error('批准用户失败:', error);
      setError(`批准用户 ${email} 失败: ${error.message}`);
    } finally {
      setProcessing(prev => ({ ...prev, [userId]: null }));
    }
  };

  // 拒绝用户（暂时不实现实际的拒绝逻辑，只是从列表中移除）
  const rejectUser = async (userId, email) => {
    setProcessing(prev => ({ ...prev, [userId]: 'rejecting' }));
    
    try {
      // 这里可以实现实际的拒绝逻辑，比如发送拒绝邮件
      // 暂时只是从待审批列表中移除
      setPendingUsers(prev => prev.filter(user => user.id !== userId));
      
      console.log(`❌ 用户 ${email} 的申请已被拒绝`);
      
    } catch (error) {
      console.error('拒绝用户失败:', error);
      setError(`拒绝用户 ${email} 失败: ${error.message}`);
    } finally {
      setProcessing(prev => ({ ...prev, [userId]: null }));
    }
  };

  // 批量批准
  const batchApprove = async (userEmails, modules = ['videos']) => {
    setLoading(true);
    try {
      for (const email of userEmails) {
        for (const module of modules) {
          await assignModuleAccess(email, module, true);
        }
      }
      await loadPendingUsers();
      console.log(`✅ 批量批准了 ${userEmails.length} 个用户`);
    } catch (error) {
      setError(`批量批准失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="loading-spinner h-12 w-12 mx-auto mb-4"></div>
        <p className="text-gray-600">正在加载待审批用户...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadPendingUsers}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">用户审批</h2>
          <p className="text-gray-600">审批新用户的访问申请</p>
        </div>
        
        {pendingUsers.length > 0 && (
          <button
            onClick={() => batchApprove(pendingUsers.map(u => u.emailAddresses[0]?.emailAddress).filter(Boolean))}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <CheckCircle size={16} />
            批量批准全部
          </button>
        )}
      </div>

      {pendingUsers.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">暂无待审批用户</h3>
          <p className="text-gray-600">所有用户申请都已处理完毕</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              找到 <span className="font-semibold text-gray-800">{pendingUsers.length}</span> 个待审批用户
            </p>
          </div>
          
          <div className="divide-y divide-gray-200">
            {pendingUsers.map((user) => {
              const email = user.emailAddresses?.[0]?.emailAddress || 'N/A';
              const isProcessing = processing[user.id];
              
              return (
                <div key={user.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-lg font-semibold text-gray-600">
                          {user.firstName?.[0] || email[0].toUpperCase()}
                        </span>
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-gray-800">
                          {user.firstName} {user.lastName}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Mail size={14} />
                            {email}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            注册于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full status-pending border">
                        <Clock size={12} />
                        待审批
                      </span>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveUser(user.id, email, ['videos'])}
                          disabled={isProcessing}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isProcessing === 'approving' ? (
                            <>
                              <div className="h-3 w-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                              处理中...
                            </>
                          ) : (
                            <>
                              <CheckCircle size={14} />
                              批准
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => rejectUser(user.id, email)}
                          disabled={isProcessing}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isProcessing === 'rejecting' ? (
                            <>
                              <div className="h-3 w-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                              处理中...
                            </>
                          ) : (
                            <>
                              <XCircle size={14} />
                              拒绝
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserApproval;