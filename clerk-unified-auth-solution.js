// Clerk跨应用认证统一解决方案
// 解决React和JS应用认证状态隔离问题的核心实现

(function() {
  'use strict';

  console.log('🚀 启动Clerk跨应用认证统一解决方案...');

  // ===========================================
  // 1. 统一认证配置生成器
  // ===========================================

  const UnifiedAuthConfig = {
    // 获取正确的cookie域名
    getCookieDomain() {
      const hostname = window.location.hostname;

      // 本地开发环境
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
        return 'localhost';
      }

      // 生产环境 - 使用点前缀确保子路径共享
      return `.${hostname}`;
    },

    // 生成统一的Clerk配置
    generateConfig(options = {}) {
      const cookieDomain = this.getCookieDomain();

      const baseConfig = {
        domain: window.location.hostname,
        cookieDomain: cookieDomain,
        cookiePath: '/',
        allowOrigins: [
          window.location.origin,
          `${window.location.protocol}//${window.location.hostname}`,
          `${window.location.protocol}//${window.location.hostname}/quiz`,
          `${window.location.protocol}//${window.location.hostname}/admin`,
          `${window.location.protocol}//${window.location.hostname}/videos`,
          `${window.location.protocol}//${window.location.hostname}/games`
        ],
        sessionSyncing: true,
        crossOrigin: true,
        signInUrl: '/',
        signUpUrl: '/',
        ...options
      };

      console.log('🔧 生成统一Clerk配置:', baseConfig);
      return baseConfig;
    }
  };

  // ===========================================
  // 2. 跨应用认证状态管理器
  // ===========================================

  class CrossAppAuthManager {
    constructor() {
      this.isInitialized = false;
      this.listeners = [];
      this.syncInterval = null;
    }

    // 初始化跨应用认证状态同步
    async initialize() {
      if (this.isInitialized) {
        console.log('⚠️ 跨应用认证管理器已初始化');
        return;
      }

      console.log('🔧 初始化跨应用认证状态管理器...');

      try {
        // 1. 等待Clerk加载
        await this.waitForClerk();

        // 2. 重新配置Clerk以确保正确的cookie设置
        await this.reconfigureClerk();

        // 3. 设置状态监听
        this.setupStateListeners();

        // 4. 启动定期同步
        this.startPeriodicSync();

        // 5. 初始化认证状态
        await this.syncAuthState();

        this.isInitialized = true;
        console.log('✅ 跨应用认证状态管理器初始化完成');

      } catch (error) {
        console.error('❌ 跨应用认证状态管理器初始化失败:', error);
        throw error;
      }
    }

    // 等待Clerk加载
    waitForClerk(maxWait = 10000) {
      return new Promise((resolve, reject) => {
        if (window.Clerk) {
          resolve(window.Clerk);
          return;
        }

        const startTime = Date.now();
        const checkInterval = setInterval(() => {
          if (window.Clerk) {
            clearInterval(checkInterval);
            resolve(window.Clerk);
          } else if (Date.now() - startTime > maxWait) {
            clearInterval(checkInterval);
            reject(new Error('Clerk加载超时'));
          }
        }, 100);
      });
    }

    // 重新配置Clerk
    async reconfigureClerk() {
      if (!window.Clerk) {
        throw new Error('Clerk实例不存在');
      }

      const config = UnifiedAuthConfig.generateConfig();

      try {
        // 使用统一配置重新加载Clerk
        await window.Clerk.load(config);
        console.log('✅ Clerk重新配置成功');
      } catch (error) {
        console.warn('⚠️ Clerk重新配置失败，继续使用现有配置:', error.message);
      }
    }

    // 设置状态监听
    setupStateListeners() {
      if (!window.Clerk) {
        return;
      }

      // 监听Clerk认证状态变化
      window.Clerk.addListener(async ({ user, session }) => {
        console.log('🔄 检测到Clerk认证状态变化');

        // 同步到其他应用
        await this.syncAuthState();

        // 通知监听器
        this.notifyListeners({ user, session, source: 'clerk' });
      });

      // 监听localStorage变化
      window.addEventListener('storage', (event) => {
        if (event.key === '__clerk_environment' || event.key?.includes('clerk')) {
          console.log('🔄 检测到localStorage认证数据变化');
          this.syncAuthState();
        }
      });

      // 监听页面焦点恢复
      window.addEventListener('focus', () => {
        console.log('🔄 页面获得焦点，检查认证状态同步');
        this.syncAuthState();
      });
    }

    // 启动定期同步
    startPeriodicSync() {
      // 每30秒检查一次认证状态同步
      this.syncInterval = setInterval(() => {
        this.syncAuthState();
      }, 30000);

      console.log('✅ 启动定期认证状态同步 (30秒间隔)');
    }

    // 同步认证状态
    async syncAuthState() {
      try {
        const authData = await this.getUnifiedAuthData();

        if (authData.isAuthenticated) {
          console.log('🔄 同步认证状态:', {
            userId: authData.user?.id,
            sessionId: authData.session?.id,
            tokenType: authData.token ? 'JWT' : 'None'
          });

          // 确保所有应用都能访问统一的认证数据
          this.setGlobalAuthData(authData);
        } else {
          console.log('🔄 清除认证状态 - 用户未登录');
          this.clearGlobalAuthData();
        }

        return authData;
      } catch (error) {
        console.error('❌ 同步认证状态失败:', error);
        return { isAuthenticated: false };
      }
    }

    // 获取统一的认证数据
    async getUnifiedAuthData() {
      const result = {
        isAuthenticated: false,
        user: null,
        session: null,
        token: null,
        source: null
      };

      // 1. 优先从Clerk获取最新状态
      if (window.Clerk && window.Clerk.user && window.Clerk.session) {
        try {
          result.user = window.Clerk.user;
          result.session = window.Clerk.session;
          result.token = await window.Clerk.session.getToken();
          result.isAuthenticated = !!(result.user && result.session && result.token);
          result.source = 'clerk-direct';

          console.log('✅ 从Clerk直接获取认证数据');
          return result;
        } catch (error) {
          console.warn('⚠️ 从Clerk获取token失败:', error);
        }
      }

      // 2. 从localStorage获取缓存的认证数据
      try {
        const clerkEnv = localStorage.getItem('__clerk_environment');
        if (clerkEnv) {
          const envData = JSON.parse(clerkEnv);
          if (envData.user && envData.session) {
            result.user = envData.user;
            result.session = envData.session;
            result.isAuthenticated = true;
            result.source = 'localStorage';

            // 尝试获取token（如果Clerk实例可用）
            if (window.Clerk && window.Clerk.session && window.Clerk.session.id === envData.session.id) {
              try {
                result.token = await window.Clerk.session.getToken();
              } catch (error) {
                console.warn('⚠️ 从localStorage session获取token失败');
              }
            }

            console.log('✅ 从localStorage获取认证数据');
            return result;
          }
        }
      } catch (error) {
        console.warn('⚠️ 解析localStorage认证数据失败:', error);
      }

      return result;
    }

    // 设置全局认证数据
    setGlobalAuthData(authData) {
      // 1. 更新全局变量供所有应用使用
      window.unifiedAuth = {
        isAuthenticated: authData.isAuthenticated,
        user: authData.user,
        session: authData.session,
        token: authData.token,
        source: authData.source,
        lastUpdated: Date.now(),

        // 提供统一的接口方法
        async getToken() {
          if (this.token) {
            return this.token;
          }

          // 尝试从当前Clerk会话获取新token
          if (window.Clerk && window.Clerk.session) {
            try {
              const newToken = await window.Clerk.session.getToken();
              this.token = newToken;
              return newToken;
            } catch (error) {
              console.warn('⚠️ 获取新token失败:', error);
            }
          }

          return null;
        },

        getUser() {
          return this.user;
        },

        isSignedIn() {
          return this.isAuthenticated;
        },

        async refresh() {
          const manager = window.CrossAppAuthManager;
          if (manager) {
            const freshData = await manager.syncAuthState();
            return freshData;
          }
          return null;
        }
      };

      // 2. 更新localStorage确保持久化
      if (authData.user && authData.session) {
        const envData = {
          user: authData.user,
          session: authData.session,
          lastUpdated: Date.now(),
          unifiedAuthVersion: '1.0'
        };
        localStorage.setItem('__clerk_environment', JSON.stringify(envData));
      }

      // 3. 设置兼容性接口（为游戏模块等现有代码提供支持）
      if (authData.isAuthenticated) {
        window.mockClerkUser = {
          ...authData.user,
          isAuthenticated: true,
          sessionId: authData.session?.id,
          originalSessionToken: authData.token,
          authSource: 'unified-auth-manager',
          unifiedAuthTimestamp: Date.now()
        };
      }

      // 4. 广播认证状态变化
      this.broadcastAuthChange(authData);
    }

    // 清除全局认证数据
    clearGlobalAuthData() {
      window.unifiedAuth = null;
      window.mockClerkUser = null;

      // 清除localStorage中的认证数据
      localStorage.removeItem('__clerk_environment');

      // 广播登出事件
      this.broadcastAuthChange({ isAuthenticated: false, user: null, session: null, token: null });
    }

    // 广播认证状态变化
    broadcastAuthChange(authData) {
      // 发送自定义事件
      const event = new CustomEvent('unifiedAuthStateChange', {
        detail: authData
      });
      window.dispatchEvent(event);

      // 通知所有监听器
      this.notifyListeners(authData);
    }

    // 添加状态监听器
    addListener(callback) {
      this.listeners.push(callback);
      return () => {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      };
    }

    // 通知所有监听器
    notifyListeners(authData) {
      this.listeners.forEach(callback => {
        try {
          callback(authData);
        } catch (error) {
          console.error('❌ 认证状态监听器执行失败:', error);
        }
      });
    }

    // 销毁管理器
    destroy() {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }

      this.listeners = [];
      this.isInitialized = false;
      window.unifiedAuth = null;
      window.CrossAppAuthManager = null;

      console.log('✅ 跨应用认证管理器已销毁');
    }
  }

  // ===========================================
  // 3. 自动修复器
  // ===========================================

  const ClerkAutoFixer = {
    async runAutoFix() {
      console.log('🛠️ 开始自动修复Clerk跨应用认证问题...');

      const fixes = [];

      try {
        // 1. 初始化跨应用认证管理器
        if (!window.CrossAppAuthManager) {
          const manager = new CrossAppAuthManager();
          window.CrossAppAuthManager = manager;
          await manager.initialize();
          fixes.push('✅ 初始化跨应用认证管理器');
        } else {
          fixes.push('ℹ️ 跨应用认证管理器已存在');
        }

        // 2. 修复cookie域名配置
        await this.fixCookieDomain();
        fixes.push('✅ 修复cookie域名配置');

        // 3. 同步认证状态
        if (window.CrossAppAuthManager) {
          await window.CrossAppAuthManager.syncAuthState();
          fixes.push('✅ 同步跨应用认证状态');
        }

        // 4. 设置游戏模块兼容性
        if (window.location.pathname.includes('/games')) {
          this.setupGameCompatibility();
          fixes.push('✅ 设置游戏模块兼容性');
        }

        console.log('🎉 自动修复完成!');
        return fixes;

      } catch (error) {
        console.error('❌ 自动修复失败:', error);
        fixes.push(`❌ 修复失败: ${error.message}`);
        return fixes;
      }
    },

    async fixCookieDomain() {
      if (!window.Clerk) {
        console.log('⚠️ Clerk未加载，跳过cookie域名修复');
        return;
      }

      const config = UnifiedAuthConfig.generateConfig();

      try {
        await window.Clerk.load(config);
        console.log('✅ Cookie域名配置修复成功');
      } catch (error) {
        console.warn('⚠️ Cookie域名配置修复失败:', error.message);
      }
    },

    setupGameCompatibility() {
      // 为游戏模块提供兼容的认证接口
      window.getGameToken = async () => {
        if (window.unifiedAuth) {
          return await window.unifiedAuth.getToken();
        }
        return null;
      };

      window.getGameUser = () => {
        if (window.unifiedAuth) {
          return window.unifiedAuth.getUser();
        }
        return null;
      };

      window.isGameUserSignedIn = () => {
        return window.unifiedAuth?.isSignedIn() || false;
      };

      console.log('✅ 游戏模块兼容性接口已设置');
    }
  };

  // ===========================================
  // 4. 自动初始化
  // ===========================================

  // 导出到全局作用域
  window.UnifiedAuthConfig = UnifiedAuthConfig;
  window.CrossAppAuthManager = CrossAppAuthManager;
  window.ClerkAutoFixer = ClerkAutoFixer;

  // 等待DOM加载完成后自动运行修复
  const autoInit = async () => {
    try {
      console.log('🚀 开始自动初始化Clerk跨应用认证解决方案...');

      // 稍微延迟以确保Clerk SDK已加载
      await new Promise(resolve => setTimeout(resolve, 2000));

      const fixes = await ClerkAutoFixer.runAutoFix();
      console.log('📋 自动修复结果:', fixes);

      // 触发初始化完成事件
      const event = new CustomEvent('clerkUnifiedAuthReady', {
        detail: { fixes }
      });
      window.dispatchEvent(event);

    } catch (error) {
      console.error('❌ 自动初始化失败:', error);
    }
  };

  // 根据文档状态决定是否自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  console.log('✅ Clerk跨应用认证统一解决方案已加载');

})();