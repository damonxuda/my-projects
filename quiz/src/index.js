import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './TestApp';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 如果你需要测量性能，可以传递一个函数来记录结果
// (比如: reportWebVitals(console.log))
// 或者发送到分析端点。了解更多: https://bit.ly/CRA-vitals