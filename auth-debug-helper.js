// 认证状态调试工具
// 在浏览器控制台运行以下代码来检查认证状态

// 1. 检查Clerk实例状态
console.log('=== Clerk状态检查 ===');
console.log('Clerk实例:', window.Clerk);
console.log('用户状态:', window.Clerk?.user);
console.log('会话状态:', window.Clerk?.session);

// 2. 检查Cookie
console.log('=== Cookie检查 ===');
document.cookie.split(';').forEach(cookie => {
  if (cookie.includes('clerk') || cookie.includes('session')) {
    console.log('认证相关Cookie:', cookie.trim());
  }
});

// 3. 检查LocalStorage
console.log('=== LocalStorage检查 ===');
Object.keys(localStorage).forEach(key => {
  if (key.includes('clerk')) {
    console.log(`LocalStorage ${key}:`, localStorage.getItem(key));
  }
});

// 4. 检查当前域名配置
console.log('=== 域名配置检查 ===');
console.log('当前域名:', window.location.hostname);
console.log('当前协议:', window.location.protocol);
console.log('完整URL:', window.location.href);

// 5. 获取Clerk配置信息
if (window.Clerk) {
  console.log('=== Clerk配置信息 ===');
  console.log('Frontend API:', window.Clerk.frontendApi);
  console.log('公钥:', window.Clerk.publishableKey);
}

// 6. 测试认证状态变化监听
if (window.Clerk) {
  window.Clerk.addListener(({ user, session }) => {
    console.log('🔄 认证状态变化:', {
      用户: user?.primaryEmailAddress?.emailAddress || '未登录',
      会话ID: session?.id || '无会话'
    });
  });
}