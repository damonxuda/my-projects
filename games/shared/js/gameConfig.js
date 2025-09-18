// 游戏配置 - 用于在游戏中设置认证和数据库连接
// 这个文件需要在游戏页面中引入，并在其他模块加载之前设置全局变量

window.GAME_CONFIG = {
  // Supabase 配置 - 从全局环境变量获取
  SUPABASE_URL: window.REACT_APP_SUPABASE_URL,
  SUPABASE_ANON_KEY: window.REACT_APP_SUPABASE_ANON_KEY,
  
  // 认证相关配置
  ENABLE_CLOUD_SYNC: true, // 是否启用云端同步
  
  // 游戏特定配置
  GAMES: {
    sudoku: {
      name: '数独',
      version: '1.0.0'
    },
    nonogram: {
      name: '数织',  
      version: '1.0.0'
    }
  }
};

// 将配置暴露到全局
window.SUPABASE_URL = window.GAME_CONFIG.SUPABASE_URL;
window.SUPABASE_ANON_KEY = window.GAME_CONFIG.SUPABASE_ANON_KEY;

// 简单的Supabase客户端创建函数
window.createGameSupabaseClient = function() {
  try {
    console.log('🔧 尝试创建Supabase客户端...');
    console.log('  - SUPABASE_URL:', window.GAME_CONFIG.SUPABASE_URL);
    console.log('  - SUPABASE_ANON_KEY存在:', !!window.GAME_CONFIG.SUPABASE_ANON_KEY);

    // 检查环境变量
    if (!window.GAME_CONFIG.SUPABASE_URL || !window.GAME_CONFIG.SUPABASE_ANON_KEY) {
      console.error('❌ Supabase 配置缺失');
      console.log('  - URL:', window.GAME_CONFIG.SUPABASE_URL);
      console.log('  - Key存在:', !!window.GAME_CONFIG.SUPABASE_ANON_KEY);
      return null;
    }

    // 检查是否有@supabase/supabase-js库 (CDN版本)
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      console.log('✅ 使用window.supabase.createClient');
      return window.supabase.createClient(
        window.GAME_CONFIG.SUPABASE_URL,
        window.GAME_CONFIG.SUPABASE_ANON_KEY
      );
    }

    // 检查全局的createClient函数
    if (typeof window.createClient !== 'undefined') {
      console.log('✅ 使用window.createClient');
      return window.createClient(
        window.GAME_CONFIG.SUPABASE_URL,
        window.GAME_CONFIG.SUPABASE_ANON_KEY
      );
    }

    console.warn('⚠️ Supabase library not loaded. Please include @supabase/supabase-js');
    console.log('Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('supabase')));
    return null;
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
    return null;
  }
};

// 检查用户认证状态的简单函数
window.checkGameAuth = function() {
  try {
    // 检查Clerk认证
    if (window.Clerk && window.Clerk.user) {
      return {
        isSignedIn: true,
        user: window.Clerk.user,
        userId: window.Clerk.user.id,
        email: window.Clerk.user.primaryEmailAddress?.emailAddress,
        provider: 'clerk'
      };
    }
    
    // 可以扩展支持其他认证提供商
    return {
      isSignedIn: false,
      user: null,
      userId: null,
      email: null,
      provider: null
    };
  } catch (error) {
    console.error('Failed to check auth status:', error);
    return {
      isSignedIn: false,
      user: null,
      userId: null,
      email: null,
      provider: null,
      error: error.message
    };
  }
};

console.log('🎮 Game config loaded - Cloud sync:', window.GAME_CONFIG.ENABLE_CLOUD_SYNC);