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
      domain: domain
      // 卫星应用不需要配置signInUrl/signUpUrl，Clerk会自动处理
    })
  };

  return (
    <ClerkProvider {...clerkConfig}>
      {children}
    </ClerkProvider>
  );
};

export default ClerkAuthProvider;