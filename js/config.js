// js/config.js
window.supabaseUrl = 'https://exnfrclagndigmdybicg.supabase.co';
window.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzIwMDAwMDAwLCJleHAiOjIwNDAwMDAwMDB9.bI6czDaKgprMQVt2PlsT_M77m-4zHjWstdrWc3Rif7E';
// 确保Supabase库加载完成后再初始化客户端
document.addEventListener('DOMContentLoaded', function() {
  // 等待Supabase库加载
  const initSupabase = () => {
    if (window.supabase && window.supabase.createClient) {
      console.log('正在初始化Supabase客户端...');
      window.supabase = window.supabase.createClient(window.supabaseUrl, window.supabaseKey);
      console.log('Supabase客户端初始化完成');
      
      // 触发应用初始化
      if (typeof initApp === 'function') {
        initApp();
      }
    } else {
      console.log('等待Supabase库加载...');
      setTimeout(initSupabase, 100);
    }
  };
  
  initSupabase();
});
