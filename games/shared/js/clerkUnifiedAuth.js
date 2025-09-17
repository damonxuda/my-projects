// 游戏模块统一认证初始化脚本
// 解决Clerk跨应用认证问题，确保与React应用的认证状态同步

(function() {
  'use strict';

  console.log('🎮 游戏模块统一认证系统开始初始化');

  // ===========================================
  // 1. 统一的token获取机制
  // ===========================================

  class GameUnifiedAuth {
    constructor() {
      this.tokenCache = null;
      this.userCache = null;
      this.sessionCache = null;
      this.initialized = false;
      this.listeners = [];
    }

    // 获取JWT token (优先使用React应用的token获取方式)
    async getToken() {
      try {
        // 策略1: 从活跃的Clerk session获取JWT token
        if (window.Clerk && window.Clerk.session) {
          try {
            const token = await window.Clerk.session.getToken();
            if (token) {
              console.log('🎟️ [Games] 从Clerk session获取JWT token成功');
              this.tokenCache = token;
              return token;
            }
          } catch (error) {
            console.warn('⚠️ [Games] 从Clerk session获取token失败:', error);
          }
        }

        // 策略2: 从缓存的mockClerkUser获取
        if (window.mockClerkUser && window.mockClerkUser.originalSessionToken) {
          console.log('🎟️ [Games] 从mockClerkUser获取缓存token');
          return window.mockClerkUser.originalSessionToken;
        }

        // 策略3: 尝试从localStorage解析session并获取token
        const clerkEnv = localStorage.getItem('__clerk_environment');
        if (clerkEnv) {
          const envData = JSON.parse(clerkEnv);
          if (envData.session && envData.session.id) {
            // 这里不能直接使用session ID，需要获取JWT
            console.log('⚠️ [Games] 检测到session ID，但需要转换为JWT token');

            // 尝试使用session ID获取JWT
            if (window.Clerk && window.Clerk.session && window.Clerk.session.id === envData.session.id) {
              try {
                const token = await window.Clerk.session.getToken();
                if (token) {
                  console.log('🎟️ [Games] 通过localStorage session获取JWT token成功');
                  this.tokenCache = token;
                  return token;
                }
              } catch (error) {
                console.warn('⚠️ [Games] 通过localStorage session获取JWT token失败:', error);
              }
            }
          }
        }

        console.log('❌ [Games] 无法获取JWT token');
        return null;

      } catch (error) {
        console.error('❌ [Games] 获取token异常:', error);
        return null;
      }
    }

    // 获取用户信息
    async getUser() {
      try {
        // 策略1: 从Clerk直接获取
        if (window.Clerk && window.Clerk.user) {
          this.userCache = window.Clerk.user;
          return window.Clerk.user;
        }

        // 策略2: 从mockClerkUser获取
        if (window.mockClerkUser && window.mockClerkUser.isAuthenticated) {
          this.userCache = window.mockClerkUser;
          return window.mockClerkUser;
        }

        // 策略3: 从localStorage获取
        const clerkEnv = localStorage.getItem('__clerk_environment');
        if (clerkEnv) {
          const envData = JSON.parse(clerkEnv);
          if (envData.user) {
            this.userCache = envData.user;
            return envData.user;
          }
        }

        return null;
      } catch (error) {
        console.error('❌ [Games] 获取用户信息失败:', error);
        return null;
      }
    }

    // 检查是否已登录
    async isSignedIn() {
      const user = await this.getUser();
      const token = await this.getToken();

      return !!(user && token);
    }

    // 获取用户ID
    async getUserId() {
      const user = await this.getUser();
      return user?.id || null;
    }

    // 添加认证状态监听器
    addListener(callback) {
      this.listeners.push(callback);
    }

    // 通知所有监听器
    notifyListeners(authState) {
      this.listeners.forEach(listener => {
        try {
          listener(authState);
        } catch (error) {
          console.error('❌ [Games] 认证状态监听器执行失败:', error);
        }
      });
    }

    // 刷新认证状态
    async refresh() {
      this.tokenCache = null;
      this.userCache = null;
      this.sessionCache = null;

      const user = await this.getUser();
      const token = await this.getToken();

      this.notifyListeners({ user, token, isSignedIn: !!(user && token) });

      return { user, token };
    }
  }

  // ===========================================
  // 2. 修复Clerk配置以匹配React应用
  // ===========================================

  function getCorrectCookieDomain() {
    const hostname = window.location.hostname;

    // 本地开发环境
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'localhost';
    }

    // 生产环境 - 使用点前缀确保子域名共享
    return `.${hostname}`;
  }

  function generateClerkConfig() {
    const cookieDomain = getCorrectCookieDomain();

    return {
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
      isSatellite: true, // 游戏模块作为satellite模式
      crossOrigin: true,
      signInUrl: '/',
      signUpUrl: '/'
    };
  }

  // ===========================================
  // 3. 初始化统一认证系统
  // ===========================================

  async function initializeUnifiedAuth() {
    try {
      console.log('🔧 [Games] 开始初始化统一认证系统');

      // 创建认证管理器
      const gameAuth = new GameUnifiedAuth();

      // 等待Clerk加载
      if (!window.Clerk) {
        console.log('⏳ [Games] 等待Clerk加载...');
        await waitForClerk();
      }

      // 使用修复后的配置重新初始化Clerk
      const config = generateClerkConfig();
      console.log('🔧 [Games] 使用修复后的配置初始化Clerk:', config);

      try {
        await window.Clerk.load(config);
        console.log('✅ [Games] Clerk重新初始化成功');
      } catch (error) {
        console.warn('⚠️ [Games] Clerk重新初始化失败，继续使用现有实例:', error);
      }

      // 设置全局认证接口
      window.gameAuth = gameAuth;

      // 设置兼容性接口（为SmartGameStorage等现有代码提供支持）
      window.getGameToken = () => gameAuth.getToken();
      window.getGameUser = () => gameAuth.getUser();
      window.isGameUserSignedIn = () => gameAuth.isSignedIn();

      // 初始化认证状态
      await gameAuth.refresh();

      // 设置认证状态监听
      if (window.Clerk) {
        window.Clerk.addListener(async ({ user, session }) => {
          console.log('🔄 [Games] 检测到Clerk认证状态变化');

          // 更新mockClerkUser
          if (user && session) {
            try {
              const token = await session.getToken();
              window.mockClerkUser = {
                ...user,
                isAuthenticated: true,
                sessionId: session.id,
                originalSessionToken: token,
                authSource: 'games-unified-auth'
              };
              console.log('✅ [Games] 已更新mockClerkUser');
            } catch (error) {
              console.warn('⚠️ [Games] 更新mockClerkUser失败:', error);
            }
          } else {
            window.mockClerkUser = null;
          }

          // 通知游戏认证管理器
          gameAuth.notifyListeners({ user, session });
        });
      }

      // 监听跨应用认证状态变化
      window.addEventListener('unifiedAuthStateChange', (event) => {
        console.log('📡 [Games] 收到跨应用认证状态变化:', event.detail);
        gameAuth.refresh();
      });

      console.log('✅ [Games] 统一认证系统初始化完成');

      // 输出当前认证状态
      const isSignedIn = await gameAuth.isSignedIn();
      const user = await gameAuth.getUser();
      console.log('👤 [Games] 当前认证状态:', {
        isSignedIn,
        userId: user?.id,
        email: user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress
      });

      return gameAuth;

    } catch (error) {
      console.error('❌ [Games] 统一认证系统初始化失败:', error);
      return null;
    }
  }

  // 等待Clerk加载
  function waitForClerk(maxWait = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkClerk = () => {
        if (window.Clerk) {
          resolve(true);
        } else if (Date.now() - startTime > maxWait) {
          reject(new Error('Clerk加载超时'));
        } else {
          setTimeout(checkClerk, 100);
        }
      };

      checkClerk();
    });
  }

  // ===========================================
  // 4. 自动初始化
  // ===========================================

  // 等待DOM和Clerk加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeUnifiedAuth, 1000); // 延迟1秒确保Clerk加载完成
    });
  } else {
    setTimeout(initializeUnifiedAuth, 1000);
  }

  // 导出工具函数
  window.GameUnifiedAuth = GameUnifiedAuth;
  window.generateGameClerkConfig = generateClerkConfig;
  window.getCorrectCookieDomain = getCorrectCookieDomain;

  console.log('🎮 游戏模块统一认证脚本已加载');

})();