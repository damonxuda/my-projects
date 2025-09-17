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
      // 对于同域名子目录结构，不设置signInUrl以避免same-origin错误
      // Clerk会自动处理域内的认证状态同步
      ...(window.location.hostname !== domain && {
        // 只有在不同域名时才设置signInUrl
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