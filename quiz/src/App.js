// 认证相关从auth-clerk导入
import { ClerkAuthProvider, ModuleAccessGuard } from '../../auth-clerk/src';
import React from 'react';
import QuizMain from './components/QuizMain';

// 主应用组件 - 包装Clerk认证
const App = () => {
  return (
    <ClerkAuthProvider publishableKey={process.env.REACT_APP_CLERK_PUBLISHABLE_KEY}>
      <ModuleAccessGuard module="quiz">
        <QuizMain />
      </ModuleAccessGuard>
    </ClerkAuthProvider>
  );
};

export default App;