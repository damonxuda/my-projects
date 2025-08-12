// src/contexts/AuthProvider.js
import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ 
  children, 
  supabaseClient,
  redirectTo = `${window.location.origin}/reset-password`
}) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  if (!supabaseClient) {
    throw new Error('AuthProvider requires supabaseClient prop');
  }

  useEffect(() => {
    // 获取当前用户会话
    const getSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      }
      setLoading(false);
    };

    getSession();

    // 监听认证状态变化
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.email);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('👤 User logged in, fetching profile...');
          await fetchUserProfile(session.user.id);
          
          // 如果是新用户登录且没有 profile，创建一个
          if (event === 'SIGNED_IN') {
            await ensureUserProfile(session.user);
          }
        } else {
          setUserProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabaseClient]);

  // 获取用户档案信息 - 关键调试版本
  const fetchUserProfile = async (userId) => {
    console.log('\n🚀 === FETCHUSERPROFILE START ===');
    console.log('📋 fetchUserProfile called with userId:', userId);
    console.log('🔧 supabaseClient type:', typeof supabaseClient);
    console.log('🔧 supabaseClient methods:', Object.keys(supabaseClient || {}));
    
    try {
      console.log('⚡ Step 1: Creating query builder...');
      const queryBuilder = supabaseClient.from('user_profiles');
      console.log('✅ Query builder created:', !!queryBuilder);
      console.log('🔧 Query builder type:', typeof queryBuilder);
      
      console.log('⚡ Step 2: Adding select...');
      const selectQuery = queryBuilder.select('*');
      console.log('✅ Select added:', !!selectQuery);
      console.log('🔧 Select query type:', typeof selectQuery);
      
      console.log('⚡ Step 3: Adding eq filter...');
      const filteredQuery = selectQuery.eq('id', userId);
      console.log('✅ Filter added:', !!filteredQuery);
      console.log('🔧 Filtered query type:', typeof filteredQuery);
      
      console.log('⚡ Step 4: Adding single...');
      const singleQuery = filteredQuery.single();
      console.log('✅ Single added:', !!singleQuery);
      console.log('🔧 Single query type:', typeof singleQuery);
      
      console.log('⚡ Step 5: Executing query with await...');
      console.log('⏰ Timestamp before query:', new Date().toISOString());
      
      // 分步检查返回值
      console.log('🔍 About to await singleQuery...');
      const result = await singleQuery;
      console.log('🔍 Await completed! Raw result type:', typeof result);
      console.log('🔍 Result is null?', result === null);
      console.log('🔍 Result is undefined?', result === undefined);
      console.log('🔍 Result keys:', result ? Object.keys(result) : 'N/A');
      
      console.log('⏰ Timestamp after query:', new Date().toISOString());
      console.log('🎉 Query executed successfully!');
      console.log('📦 Raw result (full):', JSON.stringify(result, null, 2));
      console.log('📦 Result data:', result?.data);
      console.log('📦 Result error:', result?.error);

      const { data, error } = result;

      if (error && error.code !== 'PGRST116') { 
        console.error('❌ Query error (not PGRST116):', error);
        setUserProfile(null);
        return null;
      } else if (error && error.code === 'PGRST116') {
        console.log('📭 No user profile found (PGRST116)');
        setUserProfile(null);
        return null;
      } else {
        console.log('✅ User profile found:', data);
        setUserProfile(data);
        return data;
      }
      
    } catch (error) {
      console.error('💥 fetchUserProfile catch block error:', error);
      console.error('💥 Error name:', error.name);
      console.error('💥 Error message:', error.message);
      console.error('💥 Error stack:', error.stack);
      setUserProfile(null);
      return null;
    } finally {
      console.log('🏁 === FETCHUSERPROFILE END ===\n');
    }
  };

  // 确保用户有 profile 记录
  const ensureUserProfile = async (user) => {
    if (!user) return;

    try {
      // 先检查是否已存在
      const { data: existing } = await supabaseClient
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existing) {
        // 不存在则创建
        console.log('Creating user profile for:', user.email);
        const { data, error } = await supabaseClient
          .from('user_profiles')
          .insert([
            {
              id: user.id,
              email: user.email,
              status: 'pending',
              requested_at: new Date().toISOString(),
            }
          ])
          .select()
          .single();

        if (error) {
          console.error('Error creating user profile:', error);
        } else {
          console.log('User profile created successfully:', data);
          setUserProfile(data);
        }
      }
    } catch (error) {
      console.error('Error ensuring user profile:', error);
    }
  };

  // 用户注册
  const signUp = async (email, password) => {
    try {
      console.log('Starting signup for:', email);
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      console.log('Signup successful:', data);
      return { data, error: null };
    } catch (error) {
      console.error('Signup error:', error);
      return { data: null, error };
    }
  };

  // 用户登录
  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  };

  // 用户登出
  const signOut = async () => {
    const { error } = await supabaseClient.auth.signOut();
    return { error };
  };

  // 发送密码重置邮件
  const resetPassword = async (email) => {
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  // 检查用户是否已批准
  const isUserApproved = () => {
    return userProfile?.status === 'approved';
  };

  // 检查用户是否为管理员
  const isAdmin = () => {
    return userProfile?.status === 'approved' && userProfile?.role === 'admin';
  };

  const value = {
    user,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    isUserApproved,
    isAdmin,
    fetchUserProfile,
    ensureUserProfile,
    supabaseClient,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};