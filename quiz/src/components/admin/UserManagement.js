// src/components/admin/UserManagement.js
import React, { useState, useEffect } from 'react';
import { useAuth, createSupabaseClientFromEnv } from '../../../../auth/src';
import LoadingSpinner from '../common/LoadingSpinner';

// 创建supabase客户端实例
const supabase = createSupabaseClientFromEnv();

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingUser, setProcessingUser] = useState(null);
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected, all
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('user_profiles')
        .select('*')
        .order('requested_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (userId, action, notes = '') => {
    if (!window.confirm(`确定要${action === 'approved' ? '批准' : '拒绝'}这个用户吗？`)) {
      return;
    }

    try {
      setProcessingUser(userId);
      
      const updateData = {
        status: action,
        approved_at: action === 'approved' ? new Date().toISOString() : null,
        approved_by: currentUser.id,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;

      alert(`用户已${action === 'approved' ? '批准' : '拒绝'}`);
      await fetchUsers(); // 刷新列表
    } catch (error) {
      console.error('Error updating user:', error);
      alert('操作失败');
    } finally {
      setProcessingUser(null);
    }
  };

  const handleNotesSubmit = (userId, action) => {
    const notes = prompt(`请输入${action === 'approved' ? '批准' : '拒绝'}理由（可选）：`);
    if (notes !== null) { // 用户没有取消
      handleUserAction(userId, action, notes);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };

    const labels = {
      pending: '待审批',
      approved: '已批准',
      rejected: '已拒绝',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return <LoadingSpinner message="加载用户列表中..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
        <p className="mt-2 text-gray-600">管理用户注册申请和权限</p>
      </div>

      {/* 筛选器 */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg max-w-md">
          {[
            { key: 'pending', label: '待审批', count: users.filter(u => u.status === 'pending').length },
            { key: 'approved', label: '已批准', count: users.filter(u => u.status === 'approved').length },
            { key: 'rejected', label: '已拒绝', count: users.filter(u => u.status === 'rejected').length },
            { key: 'all', label: '全部', count: users.length },
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
      {users.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {filter === 'all' ? '暂无用户' : `暂无${filter === 'pending' ? '待审批' : filter === 'approved' ? '已批准' : '已拒绝'}用户`}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {users.map((userProfile) => (
              <li key={userProfile.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {userProfile.email?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {userProfile.email}
                        </p>
                        <div className="mt-1 flex items-center space-x-2">
                          {getStatusBadge(userProfile.status)}
                          <span className="text-xs text-gray-500">
                            申请时间：{new Date(userProfile.requested_at).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        {userProfile.notes && (
                          <p className="mt-1 text-sm text-gray-600">
                            备注：{userProfile.notes}
                          </p>
                        )}
                        {userProfile.approved_at && (
                          <p className="mt-1 text-xs text-gray-500">
                            处理时间：{new Date(userProfile.approved_at).toLocaleString('zh-CN')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center space-x-2">
                    {userProfile.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleNotesSubmit(userProfile.id, 'approved')}
                          disabled={processingUser === userProfile.id}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                          {processingUser === userProfile.id ? '处理中...' : '批准'}
                        </button>
                        <button
                          onClick={() => handleNotesSubmit(userProfile.id, 'rejected')}
                          disabled={processingUser === userProfile.id}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        >
                          {processingUser === userProfile.id ? '处理中...' : '拒绝'}
                        </button>
                      </>
                    )}
                    
                    {userProfile.status === 'approved' && (
                      <button
                        onClick={() => handleUserAction(userProfile.id, 'rejected', '管理员撤销批准')}
                        disabled={processingUser === userProfile.id}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        撤销
                      </button>
                    )}

                    {userProfile.status === 'rejected' && (
                      <button
                        onClick={() => handleUserAction(userProfile.id, 'approved', '重新批准')}
                        disabled={processingUser === userProfile.id}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                      >
                        重新批准
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 刷新按钮 */}
      <div className="mt-6 text-center">
        <button
          onClick={fetchUsers}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          刷新列表
        </button>
      </div>
    </div>
  );
};

export default UserManagement;