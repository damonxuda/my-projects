// src/utils/authHelpers.js

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否为有效邮箱
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 验证密码强度
 * @param {string} password - 密码
 * @returns {object} 验证结果和消息
 */
export const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < 6) {
    errors.push('密码至少需要6个字符');
  }
  
  if (!/[A-Za-z]/.test(password)) {
    errors.push('密码需要包含字母');
  }
  
  if (!/\d/.test(password)) {
    errors.push('密码需要包含数字');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * 格式化认证错误消息
 * @param {object} error - Supabase错误对象
 * @returns {string} 用户友好的错误消息
 */
export const formatAuthError = (error) => {
  if (!error) return '';

  const errorMessages = {
    'Invalid login credentials': '邮箱或密码错误',
    'Email not confirmed': '请先验证您的邮箱',
    'User already registered': '该邮箱已被注册',
    'Password should be at least 6 characters': '密码至少需要6个字符',
    'Unable to validate email address: invalid format': '邮箱格式无效',
    'Email rate limit exceeded': '邮件发送过于频繁，请稍后再试',
    'Invalid email or password': '邮箱或密码错误',
    'Email link is invalid or has expired': '邮箱链接无效或已过期',
    'Token has expired or is invalid': '链接已过期，请重新请求',
    'New password should be different from the old password': '新密码不能与旧密码相同'
  };

  return errorMessages[error.message] || error.message || '发生未知错误';
};

/**
 * 检查用户权限
 * @param {object} userProfile - 用户档案
 * @param {string} requiredRole - 需要的角色
 * @returns {boolean} 是否有权限
 */
export const hasPermission = (userProfile, requiredRole = 'approved') => {
  if (!userProfile) return false;

  const roleHierarchy = {
    'pending': 0,
    'approved': 1,
    'admin': 2
  };

  const userLevel = roleHierarchy[userProfile.status] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
};

/**
 * 生成安全的重定向URL
 * @param {string} baseUrl - 基础URL
 * @param {string} path - 路径
 * @returns {string} 完整的重定向URL
 */
export const generateRedirectUrl = (baseUrl, path) => {
  const url = new URL(baseUrl);
  url.pathname = path;
  return url.toString();
};

/**
 * 从URL中提取认证参数
 * @returns {object} 认证相关的URL参数
 */
export const extractAuthParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.substring(1));
  
  return {
    access_token: urlParams.get('access_token') || hash.get('access_token'),
    refresh_token: urlParams.get('refresh_token') || hash.get('refresh_token'),
    error: urlParams.get('error') || hash.get('error'),
    error_description: urlParams.get('error_description') || hash.get('error_description'),
  };
};