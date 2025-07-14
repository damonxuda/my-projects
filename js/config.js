// ================================
// 暑假课程表 - 配置文件（支持测试/生产环境）
// ================================

// 环境开关：改这一行就能切换整个环境
const isProduction = true; // false=测试环境, true=生产环境

console.log('当前环境:', isProduction ? '生产环境' : '测试环境');
console.log('当前域名:', window.location.hostname);

// Supabase 配置
const supabaseUrl = 'https://wytqlpwelznkoxhygfc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5dHFscHdsZWx6bmtveGh5Z2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1Mzk4NDAsImV4cCI6MjA2NzExNTg0MH0.bMPiovIGFAqdC-BQwozDBN9FhbCPwszwG9gUJ-oc7Ok'; // 请填入你的API Key

// 表名配置：根据环境使用不同的表名
const tableConfig = {
  schedules: isProduction ? 'schedules' : 'schedules_test',
  app_config: isProduction ? 'app_config' : 'app_config_test',
  password_resets: isProduction ? 'password_resets' : 'password_resets_test',
  users: isProduction ? 'users' : 'users_test'
};

console.log('使用的表配置:', tableConfig);

// 是否启用 Supabase
window.useSupabase = true;

// 将配置设置为全局变量，供初始化使用
window.supabaseUrl = supabaseUrl;
window.supabaseKey = supabaseKey;

// 等 DOM 加载完成后再初始化 Supabase 客户端
document.addEventListener('DOMContentLoaded', function() {
    if (supabase && supabase.createClient) {
        window.supabase = supabase.createClient(window.supabaseUrl, window.supabaseKey);
        console.log('✅ Supabase 客户端初始化成功');
    } else {
        console.error('❌ Supabase 库未加载');
    }
});

// 导出配置给其他模块使用
window.appConfig = {
  isProduction,
  tableConfig,
  supabaseUrl,
  supabaseKey
};

// 调试信息
console.log('🔧 应用配置:', {
  环境: isProduction ? '生产' : '测试',
  课程表: tableConfig.schedules,
  配置表: tableConfig.app_config,
  域名: window.location.hostname
});