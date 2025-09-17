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

  // 简化配置：使用Clerk默认的同域名认证共享机制
  const clerkConfig = {
    publishableKey
    // 移除isSatellite配置，让Clerk自动处理同域名下的认证状态共享
    // React和JS应用将通过__session cookie自动共享认证状态
  };

  return (
    <ClerkProvider {...clerkConfig}>
      {children}
    </ClerkProvider>
  );
};

export default ClerkAuthProvider;