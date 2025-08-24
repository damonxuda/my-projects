import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Settings, 
  CheckCircle, 
  XCircle, 
  User,
  Mail,
  Calendar,
  Shield
} from 'lucide-react';
import { useAuth } from '../../../auth-clerk/src';

const UserPermissions = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModule, setFilterModule] = useState('all');
  const [processing, setProcessing] = useState({});
  
  const { fetchAllUsers, assignModuleAccess } = useAuth();

  // 加载所有用户
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    
    try {
      const allUsers = await fetchAllUsers();
      // 过滤出已经有访问权限的用户
      const activeUsers = allUsers.filter(user => user.hasAccess);
      setUsers(activeUsers);
    } catch (err) {
      console.error('加载用户失败:', err);
      setError('加载用户列表失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  // 切换用户权限
  const toggleModuleAccess = async (userId, email, module, currentAccess) => {
    const actionKey = `${userId}-${module}`;
    setProcessing(prev => ({ ...prev, [actionKey]: true }));
    
    try {
      await assignModuleAccess(email, module, !currentAccess);
      
      // 重新加载用户数据
      await loadUsers();
      
      console.log(`✅ 用户 ${email} 的 ${module} 权限已${!currentAccess ? '授予' : '撤销'}`);
      
    } catch (error) {
      console.error('权限操作失败:', error);
      setError(`操作失败: ${error.message}`);
    } finally {
      setProcessing(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  // 过滤用户
  const filteredUsers = users.filter(user => {
    const email = user.emailAddresses?.[0]?.emailAddress || '';
    const name = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
    
    // 搜索过滤
    const matchesSearch = searchTerm === '' || 
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      name.includes(searchTerm.toLowerCase());
    
    // 模块过滤
    const matchesModule = filterModule === 'all' || 
      (filterModule === 'videos' && user.modules?.videos) ||
      (filterModule === 'quiz' && user.modules?.quiz) ||
      (filterModule === 'no-access' && !user.modules?.videos && !user.modules?.quiz);
    
    return matchesSearch && matchesModule;
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="loading-spinner h-12 w-12 mx-auto mb-4"></div>
        <p className="text-gray-600">正在加载用户权限...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadUsers}
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
      {/* 头部 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">权限管理</h2>
        <p className="text-gray-600">管理现有用户的模块访问权限</p>
      </div>

      {/* 搜索和过滤 */}
      <div className="bg-white p-4 rounded-xl shadow-sm border">
        <div className="flex flex-col md:flex-row gap-4">
          {/* 搜索 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="搜索用户邮箱或姓名..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* 模块过滤 */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="all">所有用户</option>
              <option value="videos">有视频权限</option>
              <option value="quiz">有题库权限</option>
              <option value="no-access">无模块权限</option>
            </select>
          </div>
        </div>
      </div>

      {/* 用户列表 */}
      {filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">没有找到用户</h3>
          <p className="text-gray-600">
            {searchTerm || filterModule !== 'all' 
              ? '尝试调整搜索条件或过滤器' 
              : '暂无活跃用户'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              找到 <span className="font-semibold text-gray-800">{filteredUsers.length}</span> 个用户
            </p>
          </div>
          
          <div className="divide-y divide-gray-200">
            {filteredUsers.map((user) => {
              const email = user.emailAddresses?.[0]?.emailAddress || 'N/A';
              const hasVideos = user.modules?.videos || false;
              const hasQuiz = user.modules?.quiz || false;
              
              return (
                <div key={user.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    {/* 用户信息 */}
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
                            {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* 权限控制 */}
                    <div className="flex items-center gap-4">
                      {/* 当前权限标签 */}
                      <div className="flex gap-2">
                        {hasVideos && (
                          <span className="permission-tag permission-videos">视频</span>
                        )}
                        {hasQuiz && (
                          <span className="permission-tag permission-quiz">题库</span>
                        )}
                        {!hasVideos && !hasQuiz && (
                          <span className="permission-tag bg-gray-100 text-gray-600">无权限</span>
                        )}
                      </div>
                      
                      {/* 权限切换按钮 */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleModuleAccess(user.id, email, 'videos', hasVideos)}
                          disabled={processing[`${user.id}-videos`]}
                          className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            hasVideos 
                              ? 'bg-red-600 text-white hover:bg-red-700' 
                              : 'bg-purple-600 text-white hover:bg-purple-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {processing[`${user.id}-videos`] ? (
                            <div className="h-3 w-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : hasVideos ? (
                            <XCircle size={14} />
                          ) : (
                            <CheckCircle size={14} />
                          )}
                          {hasVideos ? '撤销视频' : '授予视频'}
                        </button>
                        
                        <button
                          onClick={() => toggleModuleAccess(user.id, email, 'quiz', hasQuiz)}
                          disabled={processing[`${user.id}-quiz`]}
                          className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            hasQuiz 
                              ? 'bg-red-600 text-white hover:bg-red-700' 
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {processing[`${user.id}-quiz`] ? (
                            <div className="h-3 w-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : hasQuiz ? (
                            <XCircle size={14} />
                          ) : (
                            <CheckCircle size={14} />
                          )}
                          {hasQuiz ? '撤销题库' : '授予题库'}
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

export default UserPermissions;