// 简单的.env文件加载器，用于在浏览器中读取环境变量
// 这个脚本会将.env文件中的变量设置到window对象上

(async function() {
  try {
    const response = await fetch('/.env');
    if (response.ok) {
      const text = await response.text();
      const lines = text.split('\n');

      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, value] = trimmed.split('=', 2);
          if (key && value) {
            window[key.trim()] = value.trim();
          }
        }
      });

      console.log('✅ 环境变量已从.env文件加载');
    } else {
      console.warn('⚠️ 无法加载.env文件');
    }
  } catch (error) {
    console.error('❌ 加载环境变量失败:', error);
  }
})();