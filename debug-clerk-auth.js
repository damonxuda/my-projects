// Clerk认证状态调试工具
console.log('🔍 开始调试Clerk认证状态...');

// 检查Clerk全局对象
if (typeof window !== 'undefined') {
  console.log('📊 Clerk调试报告：');

  // 1. 检查Clerk对象
  console.log('1. 🌐 Clerk全局对象:');
  console.log('   - window.Clerk:', !!window.Clerk);
  if (window.Clerk) {
    console.log('   - Clerk.user:', window.Clerk.user);
    console.log('   - Clerk.session:', window.Clerk.session);
  }

  // 2. 检查localStorage
  console.log('2. 💾 localStorage:');
  const clerkEnv = localStorage.getItem('__clerk_environment');
  console.log('   - __clerk_environment:', clerkEnv ? 'EXISTS' : 'MISSING');
  if (clerkEnv) {
    try {
      const parsed = JSON.parse(clerkEnv);
      console.log('   - user:', parsed.user?.id || 'NO USER');
      console.log('   - session:', parsed.session?.id || 'NO SESSION');
    } catch (e) {
      console.log('   - Parse error:', e.message);
    }
  }

  // 3. 检查Cookies
  console.log('3. 🍪 Cookies:');
  const cookies = document.cookie.split(';').map(c => c.trim());
  const clerkCookies = cookies.filter(c => c.includes('__session') || c.includes('clerk'));
  console.log('   - Clerk相关cookies:', clerkCookies.length);
  clerkCookies.forEach(cookie => {
    console.log('   -', cookie.substring(0, 50) + '...');
  });

  // 4. 检查域名配置
  console.log('4. 🌍 域名信息:');
  console.log('   - hostname:', window.location.hostname);
  console.log('   - origin:', window.location.origin);
  console.log('   - protocol:', window.location.protocol);

  // 5. 尝试获取不同类型的token
  console.log('5. 🎫 Token获取测试:');

  // 如果是React环境，检查useAuth
  if (window.React && window.useAuth) {
    console.log('   - React环境检测到');
    // 这里需要在React组件中调用
  }

  // 如果有window.Clerk，尝试获取session token
  if (window.Clerk && window.Clerk.session) {
    try {
      console.log('   - Clerk session ID:', window.Clerk.session.id);
      // 尝试获取JWT token
      window.Clerk.session.getToken().then(token => {
        console.log('   - JWT token (前50字符):', token ? token.substring(0, 50) + '...' : 'NULL');
      }).catch(e => {
        console.log('   - JWT token获取失败:', e.message);
      });
    } catch (e) {
      console.log('   - Session token获取出错:', e.message);
    }
  }

  console.log('🔍 调试报告完成');
}