// 游戏模块认证系统 - 基于 auth-clerk 和 Supabase
// 提供轻量级的认证接口给游戏使用

class GameAuth {
  constructor() {
    this.isInitialized = false;
    this.auth = null;
    this.supabase = null;
    this.user = null;
    this.isSignedIn = false;
    this.isLoading = true;
    this.callbacks = {
      onAuthChange: [],
      onUserChange: []
    };
  }

  // 初始化认证系统
  async initialize() {
    try {
      // 动态导入 auth-clerk 模块
      const authModule = await this.loadAuthModule();
      if (!authModule) {
        console.warn('Auth module not available, running in offline mode');
        this.isLoading = false;
        return false;
      }

      this.auth = authModule.useAuth();
      this.supabase = authModule.supabase;

      // 监听认证状态变化
      this.startAuthMonitoring();
      
      this.isInitialized = true;
      this.isLoading = false;
      
      console.log('✅ GameAuth initialized successfully');
      return true;
    } catch (error) {
      console.error('GameAuth initialization failed:', error);
      this.isLoading = false;
      return false;
    }
  }

  // 动态加载认证模块
  async loadAuthModule() {
    try {
      // 尝试从全局变量获取（如果已经加载）
      if (window.useAuth && window.createSupabaseClient) {
        return {
          useAuth: () => window.useAuth(),
          supabase: window.createSupabaseClient()
        };
      }

      // 尝试通过模块路径导入
      const authPath = '/auth-clerk/src/index.js';
      const supabasePath = '/shared/supabase/index.js';
      
      // 这里需要根据实际的模块加载方式调整
      // 在生产环境中，这些模块应该已经通过构建工具打包
      console.warn('Auth modules should be pre-loaded in production');
      return null;
    } catch (error) {
      console.error('Failed to load auth module:', error);
      return null;
    }
  }

  // 开始监听认证状态
  startAuthMonitoring() {
    // 创建一个轮询检查认证状态的机制
    const checkAuthStatus = () => {
      if (this.auth) {
        const wasSignedIn = this.isSignedIn;
        const oldUser = this.user;
        
        this.isSignedIn = this.auth.isSignedIn;
        this.user = this.auth.user;
        
        // 如果认证状态发生变化
        if (wasSignedIn !== this.isSignedIn) {
          this.notifyAuthChange(this.isSignedIn);
        }
        
        // 如果用户信息发生变化
        if (oldUser?.id !== this.user?.id) {
          this.notifyUserChange(this.user);
        }
      }
    };

    // 每3秒检查一次认证状态
    setInterval(checkAuthStatus, 3000);
    
    // 立即执行一次检查
    checkAuthStatus();
  }

  // 通知认证状态变化
  notifyAuthChange(isSignedIn) {
    this.callbacks.onAuthChange.forEach(callback => {
      try {
        callback(isSignedIn);
      } catch (error) {
        console.error('Auth change callback error:', error);
      }
    });
  }

  // 通知用户信息变化
  notifyUserChange(user) {
    this.callbacks.onUserChange.forEach(callback => {
      try {
        callback(user);
      } catch (error) {
        console.error('User change callback error:', error);
      }
    });
  }

  // 注册认证状态变化回调
  onAuthChange(callback) {
    if (typeof callback === 'function') {
      this.callbacks.onAuthChange.push(callback);
    }
  }

  // 注册用户信息变化回调
  onUserChange(callback) {
    if (typeof callback === 'function') {
      this.callbacks.onUserChange.push(callback);
    }
  }

  // 获取当前认证状态
  getAuthStatus() {
    return {
      isInitialized: this.isInitialized,
      isSignedIn: this.isSignedIn,
      isLoading: this.isLoading,
      user: this.user,
      hasModuleAccess: this.hasModuleAccess('quiz') // 默认检查quiz模块权限
    };
  }

  // 检查模块访问权限
  hasModuleAccess(moduleName) {
    if (!this.auth || !this.isSignedIn) return false;
    
    try {
      return this.auth.hasModuleAccess ? this.auth.hasModuleAccess(moduleName) : true;
    } catch (error) {
      console.error('Error checking module access:', error);
      return false;
    }
  }

  // 获取用户信息
  getUser() {
    return this.user;
  }

  // 获取用户ID
  getUserId() {
    return this.user?.id || null;
  }

  // 获取用户邮箱
  getUserEmail() {
    return this.user?.emailAddresses?.[0]?.emailAddress || null;
  }

  // 检查是否为管理员
  isAdmin() {
    if (!this.auth || !this.isSignedIn) return false;
    
    try {
      return this.auth.isAdmin ? this.auth.isAdmin : false;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  // 获取认证token（用于API调用）
  async getToken() {
    if (!this.auth || !this.isSignedIn) return null;
    
    try {
      return this.auth.getCachedToken ? await this.auth.getCachedToken() : null;
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  // 登出
  signOut() {
    if (this.auth && this.auth.signOut) {
      this.auth.signOut();
    } else {
      // 如果没有认证模块，清空本地状态
      this.isSignedIn = false;
      this.user = null;
      this.notifyAuthChange(false);
      this.notifyUserChange(null);
    }
  }

  // 获取Supabase客户端
  getSupabaseClient() {
    return this.supabase;
  }

  // 创建认证头（用于API请求）
  async createAuthHeaders() {
    const token = await this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
}

// 创建全局单例
const gameAuth = new GameAuth();

// 自动初始化（延迟执行，确保DOM加载完成）
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => gameAuth.initialize(), 100);
    });
  } else {
    setTimeout(() => gameAuth.initialize(), 100);
  }
}

// Web环境下的导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameAuth, gameAuth };
} else if (typeof window !== 'undefined') {
  window.GameAuth = GameAuth;
  window.gameAuth = gameAuth;
}