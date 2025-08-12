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

  // 获取用户档案信息 - 简化版本测试
  const fetchUserProfile = async (userId) => {
    console.log('\n🚀 === FETCHUSERPROFILE START ===');
    console.log('📋 fetchUserProfile called with userId:', userId);
    
    try {
      // 先测试最简单的查询
      console.log('🧪 Testing simple count query first...');
      const { count, error: countError } = await supabaseClient
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('❌ Count query failed:', countError);
        return null;
      }
      
      console.log('✅ Count query succeeded. Total rows:', count);
      
      // 然后测试不带 single() 的查询
      console.log('🧪 Testing query without single()...');
      const { data: allData, error: allError } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', userId);
      
      if (allError) {
        console.error('❌ Query without single failed:', allError);
        return null;
      }
      
      console.log('✅ Query without single succeeded:', allData);
      
      if (allData && allData.length > 0) {
        console.log('✅ User profile found:', allData[0]);
        setUserProfile(allData[0]);
        return allData[0];
      } else {
        console.log('📭 No user profile found');
        setUserProfile(null);
        return null;
      }
      
    } catch (error) {
      console.error('💥 fetchUserProfile catch block error:', error);
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