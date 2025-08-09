// src/components/Login.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthProvider';
import { isValidEmail, validatePassword, formatAuthError } from '../utils/authHelpers';

const Login = ({ 
  onSuccess,
  redirectTo,
  className = "",
  showTitle = true 
}) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  const { signIn, signUp, resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // 表单验证
    if (!email || !password) {
      setMessage('请填写所有必填字段');
      setLoading(false);
      return;
    }

    if (!isValidEmail(email)) {
      setMessage('请输入有效的邮箱地址');
      setLoading(false);
      return;
    }

    if (!isLogin) {
      if (password !== confirmPassword) {
        setMessage('两次输入的密码不一致');
        setLoading(false);
        return;
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        setMessage(passwordValidation.errors.join('、'));
        setLoading(false);
        return;
      }
    }

    try {
      if (isLogin) {
        // 登录
        const { error } = await signIn(email, password);
        if (error) {
          setMessage(formatAuthError(error));
        } else {
          onSuccess?.();
        }
      } else {
        // 注册
        const { data, error } = await signUp(email, password);
        if (error) {
          setMessage(formatAuthError(error));
        } else if (data.user) {
          setMessage('注册成功！请检查您的邮箱并点击验证链接。');
        }
      }
    } catch (error) {
      setMessage(`操作失败: ${error.message}`);
    }

    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setMessage('请输入您的邮箱地址');
      return;
    }

    if (!isValidEmail(email)) {
      setMessage('请输入有效的邮箱地址');
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email);
    
    if (error) {
      setMessage(formatAuthError(error));
    } else {
      setMessage('密码重置邮件已发送，请检查您的邮箱');
    }
    
    setLoading(false);
    setShowResetPassword(false);
  };

  return (
    <div className={`min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 ${className}`}>
      {showTitle && (
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {showResetPassword ? '重置密码' : isLogin ? '登录到系统' : '注册新账户'}
          </h2>
          {!showResetPassword && (
            <p className="mt-2 text-center text-sm text-gray-600">
              {isLogin ? '还没有账户？' : '已有账户？'}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setMessage('');
                }}
                className="font-medium text-blue-600 hover:text-blue-500 ml-1"
              >
                {isLogin ? '立即注册' : '立即登录'}
              </button>
            </p>
          )}
        </div>
      )}

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {showResetPassword ? (
            // 密码重置表单
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  邮箱地址
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="输入您的邮箱地址"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? '发送中...' : '发送重置邮件'}
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPassword(false);
                    setMessage('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  返回登录
                </button>
              </div>
            </form>
          ) : (
            // 登录/注册表单
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  邮箱地址 *
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="输入您的邮箱地址"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  密码 *
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder={isLogin ? "输入密码" : "设置密码（至少6位）"}
                  />
                </div>
              </div>

              {!isLogin && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    确认密码 *
                  </label>
                  <div className="mt-1">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="再次输入密码"
                    />
                  </div>
                </div>
              )}

              {message && (
                <div className={`text-sm p-3 rounded ${message.includes('成功') || message.includes('已发送') 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
                }`}>
                  {message}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? (isLogin ? '登录中...' : '注册中...') : (isLogin ? '登录' : '注册')}
                </button>
              </div>

              {isLogin && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetPassword(true);
                      setMessage('');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    忘记密码？
                  </button>
                </div>
              )}

              {!isLogin && (
                <div className="text-xs text-gray-500 text-center">
                  注册即表示您同意我们的服务条款。<br />
                  注册后需要管理员审批才能使用系统。
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;