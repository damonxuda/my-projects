// ================================
// Supabase 配置和初始化
// ================================

const supabaseConfig = {
  url: "https://exnfrclagndigmdybicg.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4bmZyY2xhZ25kaWdtZHliaWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyODMzMjUsImV4cCI6MjA2Njg1OTMyNX0.kDPQuEKP6pSAmcbNn2cuUZZDC5fBT_YYdAYAve9qY9w"
};

window.useSupabase = true;

// 初始化Supabase
import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm').then(({ createClient }) => {
  const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);
  window.supabase = supabase;
  
  // 初始化应用
  if (typeof initApp === 'function') {
    initApp();
  }
}).catch(error => {
  console.error('Supabase初始化失败:', error);
  window.useSupabase = false;
  if (typeof initApp === 'function') {
    initApp();
  }
});
