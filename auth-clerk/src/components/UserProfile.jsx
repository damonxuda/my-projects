// auth-clerk/src/components/UserProfile.jsx
import React from 'react';
import { UserButton, useUser } from '@clerk/clerk-react';

const UserProfile = ({ showWelcome = true, afterSignOutUrl = "/" }) => {
  const { user } = useUser();

  if (!user) {
    return null;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {showWelcome && (
        <span>
          欢迎, {user.firstName || user.emailAddresses[0]?.emailAddress}!
        </span>
      )}
      <UserButton
        afterSignOutUrl={afterSignOutUrl}
        // 卫星应用中UserButton会自动处理跨域跳转
      />
    </div>
  );
};

export default UserProfile;