// 创建 quiz/src/TestApp.js
import React from 'react';
import SimpleLogin from './SimpleLogin';

const TestApp = () => {
  console.log('=== TestApp component rendering ===');
  return (
    <div className="App">
      <SimpleLogin />
    </div>
  );
};

export default TestApp;

// 然后修改 quiz/src/index.js，临时改成：
// import App from './TestApp';  // 而不是 './App'