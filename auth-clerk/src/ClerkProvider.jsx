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

  // isSatellite模式配置
  const clerkConfig = {
    publishableKey,
    ...(isSatellite && {
      isSatellite: true,
      domain: domain,
      // 开发环境需要明确的signInUrl（生产环境Clerk会自动处理）
      signInUrl: `https://${domain}/`,
      signUpUrl: `https://${domain}/`,
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