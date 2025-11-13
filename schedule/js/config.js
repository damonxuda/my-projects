// ================================
// 暑假课程表 - 配置文件（支持测试/生产环境）
// ================================

// 环境开关：改这一行就能切换整个环境
const isProduction = true; // false=测试环境, true=生产环境

console.log('当前环境:', isProduction ? '生产环境' : '测试环境');
console.log('当前域名:', window.location.hostname);

// Supabase 配置 - 从环境变量获取
const supabaseUrl = window.REACT_APP_SUPABASE_URL || '${REACT_APP_SUPABASE_URL}';
const supabaseKey = window.REACT_APP_SUPABASE_ANON_KEY || '${REACT_APP_SUPABASE_ANON_KEY}';

console.log('🔧 Supabase配置检查:');
console.log('  - URL (环境变量):', window.REACT_APP_SUPABASE_URL);
console.log('  - Key (环境变量存在):', !!window.REACT_APP_SUPABASE_ANON_KEY);
console.log('  - 最终使用URL:', supabaseUrl);
console.log('  - 最终使用Key存在:', !!supabaseKey);

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