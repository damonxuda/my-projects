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

  // 同域名多应用配置：使用Clerk 2024年新的多应用支持
  const clerkConfig = {
    publishableKey,
    // 显式设置domain以启用同域名下的认证状态共享
    domain: window.location.hostname
  };

  return (
    <ClerkProvider {...clerkConfig}>
      {children}
    </ClerkProvider>
  );
};

export default ClerkAuthProvider;