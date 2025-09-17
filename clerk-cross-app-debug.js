// Clerk跨应用认证状态全面调试工具
// 基于前次修复总结文档的深入分析

(function() {
  'use strict';

  console.log('🔍 启动Clerk跨应用认证全面诊断...');

  const clerkDebug = {
    // 运行完整诊断
    async runFullDiagnostic() {
      console.log('\n=== 🎯 Clerk跨应用认证诊断报告 ===');

      this.checkEnvironment();
      this.checkClerkInstances();
      await this.checkAuthenticationState();
      this.checkCookies();
      this.checkLocalStorage();
      await this.checkTokenMechanisms();

      console.log('\n=== 🔍 诊断完成 ===');
      return this.generateRecommendations();
    },

    // 1. 环境检查
    checkEnvironment() {
      console.log('\n1. 🌍 环境信息:');
      console.log(`   域名: ${window.location.hostname}`);
      console.log(`   完整URL: ${window.location.href}`);
      console.log(`   协议: ${window.location.protocol}`);
      console.log(`   是否HTTPS: ${window.location.protocol === 'https:'}`);

      // 检测当前是哪个模块
      const path = window.location.pathname;
      let module = 'unknown';
      if (path === '/' || path.includes('index')) module = 'main';
      else if (path.includes('/quiz')) module = 'quiz';
      else if (path.includes('/admin')) module = 'admin';
      else if (path.includes('/videos')) module = 'videos';
      else if (path.includes('/games')) module = 'games';

      console.log(`   当前模块: ${module}`);
      console.log(`   预期认证类型: ${['quiz', 'admin', 'videos'].includes(module) ? 'React' : 'JS'}`);
    },

    // 2. Clerk实例检查
    checkClerkInstances() {
      console.log('\n2. 🏗️ Clerk实例状态:');

      // 检查全局Clerk对象
      if (window.Clerk) {
        console.log('   ✅ window.Clerk 存在');
        console.log(`   版本: ${window.Clerk.version || 'unknown'}`);
        console.log(`   已加载: ${window.Clerk.loaded || false}`);
        console.log(`   用户状态: ${!!window.Clerk.user}`);
        console.log(`   会话状态: ${!!window.Clerk.session}`);

        if (window.Clerk.user) {
          console.log(`   用户ID: ${window.Clerk.user.id}`);
          console.log(`   邮箱: ${window.Clerk.user.primaryEmailAddress?.emailAddress || 'N/A'}`);
        }
      } else {
        console.log('   ❌ window.Clerk 不存在');
      }

      // 检查React Clerk hooks
      if (window.React) {
        console.log('   ✅ React环境检测到');
        // 注意：这里只能检测React是否存在，无法直接调用hooks
      }

      // 检查自定义认证接口
      if (window.gameAuth) {
        console.log('   ✅ window.gameAuth 存在（游戏模块统一认证）');
      }

      if (window.mockClerkUser) {
        console.log('   ⚠️ window.mockClerkUser 存在（可能是调试残留）');
      }
    },

    // 3. 认证状态检查
    async checkAuthenticationState() {
      console.log('\n3. 🔐 认证状态分析:');

      let clerkUser = null;
      let clerkSession = null;

      // 从Clerk获取状态
      if (window.Clerk) {
        clerkUser = window.Clerk.user;
        clerkSession = window.Clerk.session;

        if (clerkUser && clerkSession) {
          console.log('   ✅ Clerk认证状态: 已登录');
          console.log(`   用户: ${clerkUser.id}`);
          console.log(`   会话: ${clerkSession.id}`);

          // 尝试获取JWT token
          try {
            const jwtToken = await clerkSession.getToken();
            if (jwtToken) {
              console.log(`   JWT Token: ${jwtToken.substring(0, 50)}...`);

              // 解析JWT payload
              try {
                const payload = JSON.parse(atob(jwtToken.split('.')[1]));
                console.log(`   Token用户ID: ${payload.sub}`);
                console.log(`   Token过期时间: ${new Date(payload.exp * 1000).toLocaleString()}`);
              } catch (e) {
                console.log('   ⚠️ JWT解析失败');
              }
            } else {
              console.log('   ❌ JWT Token获取失败');
            }
          } catch (error) {
            console.log(`   ❌ JWT Token获取异常: ${error.message}`);
          }

        } else {
          console.log('   ❌ Clerk认证状态: 未登录');
        }
      }

      // 检查游戏认证状态
      if (window.gameAuth) {
        try {
          const isSignedIn = await window.gameAuth.isSignedIn();
          const user = await window.gameAuth.getUser();
          const token = await window.gameAuth.getToken();

          console.log(`   游戏认证状态: ${isSignedIn ? '已登录' : '未登录'}`);
          if (user) {
            console.log(`   游戏用户ID: ${user.id}`);
          }
          if (token) {
            console.log(`   游戏Token: ${token.substring(0, 50)}...`);
          }
        } catch (error) {
          console.log(`   ❌ 游戏认证检查失败: ${error.message}`);
        }
      }
    },

    // 4. Cookie分析
    checkCookies() {
      console.log('\n4. 🍪 Cookie分析:');

      const cookies = document.cookie.split(';').map(c => c.trim());
      const clerkCookies = cookies.filter(c =>
        c.includes('__session') ||
        c.includes('clerk') ||
        c.includes('__clerk')
      );

      if (clerkCookies.length === 0) {
        console.log('   ❌ 没有找到Clerk相关cookies');
        return;
      }

      console.log(`   找到${clerkCookies.length}个Clerk相关cookies:`);
      clerkCookies.forEach((cookie, index) => {
        const [name, value] = cookie.split('=');
        console.log(`   [${index + 1}] ${name}: ${value ? value.substring(0, 30) + '...' : 'empty'}`);

        // 特别关注__session cookie
        if (name === '__session') {
          console.log(`       🎯 关键认证Cookie发现`);
          // 尝试解析JWT
          if (value && value.includes('.')) {
            try {
              const payload = JSON.parse(atob(value.split('.')[1]));
              console.log(`       Token用户: ${payload.sub}`);
            } catch (e) {
              console.log(`       ⚠️ 不是有效的JWT格式`);
            }
          }
        }
      });

      // 检查cookie域名设置
      console.log('\n   Cookie域名分析:');
      const hostname = window.location.hostname;
      console.log(`   当前域名: ${hostname}`);
      console.log(`   期望cookie域名: ${hostname === 'localhost' ? 'localhost' : '.' + hostname}`);
    },

    // 5. localStorage检查
    checkLocalStorage() {
      console.log('\n5. 💾 localStorage分析:');

      const clerkEnvKey = '__clerk_environment';
      const clerkEnvData = localStorage.getItem(clerkEnvKey);

      if (!clerkEnvData) {
        console.log('   ❌ __clerk_environment 不存在');
        return;
      }

      try {
        const envData = JSON.parse(clerkEnvData);
        console.log('   ✅ __clerk_environment 解析成功');

        if (envData.user) {
          console.log(`   用户ID: ${envData.user.id}`);
          console.log(`   用户邮箱: ${envData.user.primaryEmailAddress?.emailAddress || 'N/A'}`);
        } else {
          console.log('   ❌ localStorage中无用户信息');
        }

        if (envData.session) {
          console.log(`   会话ID: ${envData.session.id}`);
          console.log(`   会话状态: ${envData.session.status || 'N/A'}`);
        } else {
          console.log('   ❌ localStorage中无会话信息');
        }

        // 检查token相关数据
        if (envData.token) {
          console.log('   ⚠️ localStorage包含token数据');
        }

      } catch (error) {
        console.log(`   ❌ __clerk_environment 解析失败: ${error.message}`);
      }

      // 检查其他Clerk相关localStorage
      const clerkKeys = Object.keys(localStorage).filter(key => key.includes('clerk'));
      if (clerkKeys.length > 1) {
        console.log(`\n   其他Clerk keys (${clerkKeys.length - 1}个):`);
        clerkKeys.filter(k => k !== clerkEnvKey).forEach(key => {
          console.log(`   - ${key}`);
        });
      }
    },

    // 6. Token机制深度分析
    async checkTokenMechanisms() {
      console.log('\n6. 🎫 Token机制分析:');

      const results = {
        clerkJWT: null,
        sessionID: null,
        gameAuthToken: null,
        mockUserToken: null
      };

      // 1. Clerk JWT token
      if (window.Clerk && window.Clerk.session) {
        try {
          results.clerkJWT = await window.Clerk.session.getToken();
          console.log(`   Clerk JWT: ${results.clerkJWT ? '✅ 获取成功' : '❌ 获取失败'}`);
        } catch (error) {
          console.log(`   Clerk JWT: ❌ 获取异常 - ${error.message}`);
        }
      }

      // 2. Session ID from localStorage
      try {
        const clerkEnv = localStorage.getItem('__clerk_environment');
        if (clerkEnv) {
          const envData = JSON.parse(clerkEnv);
          results.sessionID = envData.session?.id || null;
          console.log(`   Session ID: ${results.sessionID ? '✅ 存在' : '❌ 不存在'}`);
        }
      } catch (error) {
        console.log(`   Session ID: ❌ 获取异常 - ${error.message}`);
      }

      // 3. GameAuth token
      if (window.gameAuth) {
        try {
          results.gameAuthToken = await window.gameAuth.getToken();
          console.log(`   GameAuth Token: ${results.gameAuthToken ? '✅ 获取成功' : '❌ 获取失败'}`);
        } catch (error) {
          console.log(`   GameAuth Token: ❌ 获取异常 - ${error.message}`);
        }
      }

      // 4. MockUser token
      if (window.mockClerkUser && window.mockClerkUser.originalSessionToken) {
        results.mockUserToken = window.mockClerkUser.originalSessionToken;
        console.log(`   MockUser Token: ✅ 存在`);
      } else {
        console.log(`   MockUser Token: ❌ 不存在`);
      }

      // 分析token一致性
      console.log('\n   Token一致性分析:');
      const tokens = Object.values(results).filter(t => t);

      if (tokens.length === 0) {
        console.log('   ❌ 没有任何token可用');
      } else if (tokens.length === 1) {
        console.log('   ⚠️ 只有一种token类型可用');
      } else {
        // 检查token是否相同
        const uniqueTokens = [...new Set(tokens)];
        if (uniqueTokens.length === 1) {
          console.log('   ✅ 所有token都相同 - 认证状态一致');
        } else {
          console.log('   ❌ 存在不同的token - 认证状态不一致');
          console.log('   这是认证隔离的直接原因！');
        }
      }

      return results;
    },

    // 生成修复建议
    generateRecommendations() {
      console.log('\n🎯 修复建议:');

      const recommendations = [];

      // 检查基础问题
      if (!window.Clerk) {
        recommendations.push('❌ Clerk未加载 - 检查SDK引入');
      }

      if (!document.cookie.includes('__session')) {
        recommendations.push('🍪 缺少__session cookie - 需要配置正确的cookieDomain');
      }

      if (!localStorage.getItem('__clerk_environment')) {
        recommendations.push('💾 缺少localStorage认证数据 - 认证状态未保存');
      }

      // 根据当前模块给出具体建议
      const path = window.location.pathname;
      if (path.includes('/quiz') || path.includes('/admin') || path.includes('/videos')) {
        recommendations.push('🔧 React应用 - 确保使用统一的ClerkProvider配置');
      } else {
        recommendations.push('🔧 JS应用 - 确保使用统一的clerkUnifiedAuth.js');
      }

      recommendations.push('🔄 运行自动修复工具进行深度修复');

      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });

      return recommendations;
    },

    // 快速修复尝试
    async quickFix() {
      console.log('\n🚀 尝试快速修复...');

      if (window.Clerk && window.Clerk.session) {
        try {
          // 强制刷新认证状态
          await window.Clerk.session.touch();
          console.log('✅ 刷新Clerk会话成功');

          // 更新localStorage
          const user = window.Clerk.user;
          const session = window.Clerk.session;

          if (user && session) {
            const envData = {
              user: user,
              session: session,
              lastUpdated: Date.now()
            };
            localStorage.setItem('__clerk_environment', JSON.stringify(envData));
            console.log('✅ 更新localStorage成功');
          }

          return true;
        } catch (error) {
          console.log(`❌ 快速修复失败: ${error.message}`);
          return false;
        }
      }

      return false;
    }
  };

  // 导出到全局作用域
  window.clerkDebug = clerkDebug;

  console.log('✅ Clerk跨应用调试工具已加载');
  console.log('💡 使用方法: clerkDebug.runFullDiagnostic()');

})();