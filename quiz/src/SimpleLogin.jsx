// 创建 quiz/src/SimpleLogin.jsx
// 绕过跨模块导入，直接在quiz中测试基本功能

import React, { useState } from 'react';

const SimpleLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    alert(`登录测试 - 邮箱: ${email}, 密码: ${password}`);
  };

  return (
    <div style={{
      maxWidth: '400px',
      margin: '50px auto',
      padding: '20px',
      border: '2px solid #007bff',
      borderRadius: '8px',
      backgroundColor: '#f8f9fa'
    }}>
      <h2 style={{ textAlign: 'center', color: '#007bff' }}>
        🚀 Login 测试组件
      </h2>
      
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            邮箱:
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
            placeholder="请输入邮箱"
            required
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            密码:
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
            placeholder="请输入密码"
            required
          />
        </div>

        <button 
          type="submit"
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          登录
        </button>
      </form>

      <div style={{ 
        marginTop: '20px', 
        padding: '10px', 
        backgroundColor: '#d4edda',
        border: '1px solid #c3e6cb',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <strong>测试说明:</strong>
        <br />
        ✅ 如果你看到这个界面，说明React组件渲染正常
        <br />
        ✅ 如果能填写表单并弹出alert，说明交互功能正常
        <br />
        ✅ 这确认了基本的Login界面是可以工作的
      </div>
    </div>
  );
};

export default SimpleLogin;