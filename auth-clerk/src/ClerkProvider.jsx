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
      // 卫星应用的登录/注册URL指向主应用（绝对URL）
      signInUrl: `https://${domain}/?auth=signin`,
      signUpUrl: `https://${domain}/?auth=signup`,
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