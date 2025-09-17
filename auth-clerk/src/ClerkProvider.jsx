// auth-clerk/src/ClerkProvider.jsx
import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';

const ClerkAuthProvider = ({
  children,
  publishableKey,
  isSatellite = false,
  domain = 'damonxuda.site'
}) => {
  if (!publishableKey) {
    throw new Error('ClerkAuthProvider requires publishableKey prop');
  }

  // 检测是否是开发环境 (based on Clerk key)
  const isDevelopmentInstance = publishableKey && publishableKey.includes('_test_');

  // isSatellite模式配置
  const clerkConfig = {
    publishableKey,
    ...(isSatellite && {
      isSatellite: true,
      domain: domain,
      // 开发实例必须设置signInUrl，生产实例在同域名下不设置
      ...(isDevelopmentInstance && {
        signInUrl: `https://${domain}/`,
        signUpUrl: `https://${domain}/`
      }),
      afterSignInUrl: window.location.href,
      afterSignUpUrl: window.location.href
    })
  };

  return (
    <ClerkProvider {...clerkConfig}>
      {children}
    </ClerkProvider>
  );
};

export default ClerkAuthProvider;