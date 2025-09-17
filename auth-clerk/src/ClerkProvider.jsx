// auth-clerk/src/ClerkProvider.jsx
import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';

const ClerkAuthProvider = ({
  children,
  publishableKey
}) => {
  if (!publishableKey) {
    throw new Error('ClerkAuthProvider requires publishableKey prop');
  }

  // 同域名多应用配置：完整的跨应用认证共享设置
  const clerkConfig = {
    publishableKey,
    // 核心同域名共享配置
    domain: window.location.hostname,
    // Cookie配置：确保认证状态在整个域名下共享
    cookieDomain: window.location.hostname.startsWith('localhost')
      ? 'localhost'
      : `.${window.location.hostname}`, // 注意：生产环境使用.开头的域名
    cookiePath: '/',
    // 允许跨应用状态同步 - 包含所有可能的路径
    allowOrigins: [
      window.location.origin,
      `${window.location.protocol}//${window.location.hostname}`,
      `${window.location.protocol}//${window.location.hostname}/quiz`,
      `${window.location.protocol}//${window.location.hostname}/admin`,
      `${window.location.protocol}//${window.location.hostname}/videos`,
      `${window.location.protocol}//${window.location.hostname}/games`
    ],
    // 启用跨应用session同步
    sessionSyncing: true
  };

  return (
    <ClerkProvider {...clerkConfig}>
      {children}
    </ClerkProvider>
  );
};

export default ClerkAuthProvider;