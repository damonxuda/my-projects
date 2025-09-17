// Satellite模式配置示例（备选方案）

// 1. React应用配置（Quiz/Admin/Videos）
const SatelliteClerkProvider = ({ children, publishableKey }) => {
  const clerkConfig = {
    publishableKey,
    // 设置为satellite模式
    isSatellite: true,
    // 指向主站的登录页面
    signInUrl: `${window.location.protocol}//${window.location.hostname}/`,
    signUpUrl: `${window.location.protocol}//${window.location.hostname}/`,
    // 设置正确的domain
    domain: window.location.hostname
  };

  return (
    <ClerkProvider {...clerkConfig}>
      {children}
    </ClerkProvider>
  );
};

// 2. JS应用配置（Games等）
const satelliteJSConfig = {
  isSatellite: true,
  domain: window.location.hostname,
  signInUrl: `${window.location.protocol}//${window.location.hostname}/`,
  signUpUrl: `${window.location.protocol}//${window.location.hostname}/`
};

await window.Clerk.load(satelliteJSConfig);

// 3. 环境变量配置（对于React应用）
// REACT_APP_CLERK_IS_SATELLITE=true
// REACT_APP_CLERK_SIGN_IN_URL=http://localhost:3000/
// REACT_APP_CLERK_SIGN_UP_URL=http://localhost:3000/