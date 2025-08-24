import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  Settings, 
  BarChart3, 
  Clock, 
  Shield,
  Home
} from 'lucide-react';
import { useAuth } from '../../../auth-clerk/src';
import UserApproval from './UserApproval';
import UserPermissions from './UserPermissions';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    pendingUsers: 0,
    totalUsers: 0,
    activeUsers: 0
  });
  
  const { user, isSignedIn, isAdmin, fetchAllUsers } = useAuth();

  // 加载统计数据
  useEffect(() => {
    const loadStats = async () => {
      if (isAdmin && isSignedIn) {
        try {
          const users = await fetchAllUsers();
          setStats({
            pendingUsers: users.filter(u => !u.hasAccess).length,
            totalUsers: users.length,
            activeUsers: users.filter(u => u.hasAccess).length
          });
        } catch (error) {
          console.error('加载统计数据失败:', error);
        }
      }
    };

    loadStats();
  }, [isAdmin, isSignedIn, fetchAllUsers]);

  // 权限检查
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="loading-spinner h-12 w-12 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">访问受限</h2>
          <p className="text-gray-600">您没有访问权限审批系统的权限</p>
          <p className="text-sm text-gray-500 mt-2">
            当前用户: {user?.emailAddresses?.[0]?.emailAddress}
          </p>
        </div>
      </div>
    );
  }

  // 导航菜单
  const menuItems = [
    { id: 'dashboard', label: '概览', icon: Home },
    { id: 'approval', label: '用户审批', icon: UserCheck },
    { id: 'permissions', label: '权限管理', icon: Settings },
  ];

  // 渲染仪表板概览
  const renderDashboard = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">权限审批系统</h2>
        <p className="text-gray-600">管理用户权限和审批新用户访问</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">待审批用户</p>
              <p className="text-3xl font-bold text-orange-600">{stats.pendingUsers}</p>
            </div>
            <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">活跃用户</p>
              <p className="text-3xl font-bold text-green-600">{stats.activeUsers}</p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">总用户数</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalUsers}</p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 快速操作 */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">快速操作</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setActiveTab('approval')}
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <UserCheck className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-gray-800">审批新用户</p>
              <p className="text-sm text-gray-600">处理待审批的用户申请</p>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('permissions')}
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <Settings className="h-5 w-5 text-purple-600" />
            <div>
              <p className="font-medium text-gray-800">管理权限</p>
              <p className="text-sm text-gray-600">分配和调整用户模块权限</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Shield className="h-8 w-8 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-800">权限审批系统</h1>
              </div>
              
              <div className="flex space-x-6">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        activeTab === item.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={16} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-800">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-600">管理员</p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto p-6">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'approval' && <UserApproval />}
        {activeTab === 'permissions' && <UserPermissions />}
      </main>
    </div>
  );
};

export default AdminDashboard;