// Videos项目应该改为：
import { ClerkAuthProvider, useAuth, ModuleAccessGuard } from '../../auth-clerk/src';
import React from 'react';
import VideoLibrary from './components/VideoLibrary';
import './App.css';

const App = () => {
  return (
    <ClerkAuthProvider publishableKey={process.env.REACT_APP_CLERK_PUBLISHABLE_KEY}>
      <ModuleAccessGuard module="videos">
        <VideoLibrary />
      </ModuleAccessGuard>
    </ClerkAuthProvider>
  );
};

export default App;