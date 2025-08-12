// src/services/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

/**
 * 创建Supabase客户端实例
 * @param {string} supabaseUrl - Supabase项目URL
 * @param {string} supabaseAnonKey - Supabase匿名密钥
 * @param {object} options - 额外的配置选项
 * @returns {object} Supabase客户端实例
 */
export const createSupabaseClient = (supabaseUrl, supabaseAnonKey, options = {}) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and Anonymous Key are required');
  }

  const defaultOptions = {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
    ...options
  };

  console.log('✅ Supabase Client Created - URL:', supabaseUrl);
  return createClient(supabaseUrl, supabaseAnonKey, defaultOptions);
};

/**
 * 使用环境变量创建Supabase客户端
 * 需要在使用的项目中设置以下环境变量：
 * - REACT_APP_SUPABASE_URL
 * - REACT_APP_SUPABASE_ANON_KEY
 */
export const createSupabaseClientFromEnv = (options = {}) => {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing environment variables. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY'
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, options);
};

/**
 * 数据库表配置
 */
export const SUPABASE_CONFIG = {
  // Table names
  tables: {
    user_profiles: 'user_profiles',
    questions: 'questions',
    attempts: 'attempts',
    tags: 'tags',
    question_tags: 'question_tags'
  },
  
  // Storage buckets
  buckets: {
    images: 'question-images'
  }
};

/**
 * Supabase Helper Functions
 * @param {object} supabaseClient - Supabase客户端实例
 */
export const createSupabaseHelpers = (supabaseClient) => ({
  // Check if user is authenticated
  isAuthenticated: async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user !== null;
  },
  
  // Get current user
  getCurrentUser: async () => {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
  },
  
  // Sign out user
  signOut: async () => {
    const { error } = await supabaseClient.auth.signOut();
    return { error };
  }
});