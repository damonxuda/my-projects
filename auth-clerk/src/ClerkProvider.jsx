// auth-clerk/src/ClerkProvider.jsx
import React, { useEffect } from 'react';
import { ClerkProvider } from '@clerk/clerk-react';

// 生成正确的Cookie域名配置
function getCorrectCookieDomain() {
  const hostname = window.location.hostname;

  // 本地开发环境
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
    return 'localhost';
  }

  // 生产环境 - 使用点前缀确保同域名下所有路径共享
  return `.${hostname}`;
}

// 获取统一的Clerk配置
function getUnifiedClerkConfig(publishableKey) {
  const cookieDomain = getCorrectCookieDomain();

  return {
    publishableKey,
    // 核心配置：实现同域名多应用认证共享
    domain: window.location.hostname,
    cookieDomain: cookieDomain,
    cookiePath: '/',
    // 跨应用来源配置
    allowOrigins: [
      window.location.origin,
      `${window.location.protocol}//${window.location.hostname}`,
      `${window.location.protocol}//${window.location.hostname}/quiz`,
      `${window.location.protocol}//${window.location.hostname}/admin`,
      `${window.location.protocol}//${window.location.hostname}/videos`,
      `${window.location.protocol}//${window.location.hostname}/games`
    ],
    // 关键修复：启用会话同步
    sessionSyncing: true,
    crossOrigin: true,
    // 重要：移除satellite模式，使用统一认证架构
    // satellite模式会导致认证隔离，这里使用标准同域名配置
    signInUrl: '/',
    signUpUrl: '/',
    fallbackRedirectUrl: window.location.pathname
  };
}

const ClerkAuthProvider = ({
  children,
  publishableKey
}) => {
  if (!publishableKey) {
    throw new Error('ClerkAuthProvider requires publishableKey prop');
  }

  // 使用统一配置生成器
  const clerkConfig = getUnifiedClerkConfig(publishableKey);

  useEffect(() => {
    console.log('🔧 React应用Clerk配置 (统一认证版):', {
      domain: clerkConfig.domain,
      cookieDomain: clerkConfig.cookieDomain,
      sessionSyncing: clerkConfig.sessionSyncing,
      currentPath: window.location.pathname,
      allowOrigins: clerkConfig.allowOrigins.length
    });

    // 设置全局配置访问器，供统一认证解决方案使用
    window.getReactClerkConfig = () => clerkConfig;
  }, []);

  return (
    <ClerkProvider {...clerkConfig}>
      {children}
    </ClerkProvider>
  );
};

export default ClerkAuthProvider;