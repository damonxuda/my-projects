const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // 移除ModuleScopePlugin限制
      const scopePluginIndex = webpackConfig.resolve.plugins.findIndex(
        ({ constructor }) => constructor && constructor.name === 'ModuleScopePlugin'
      );
      webpackConfig.resolve.plugins.splice(scopePluginIndex, 1);
      
      // 找到babel-loader配置并扩展include路径
      const oneOfRules = webpackConfig.module.rules.find(rule => rule.oneOf);
      if (oneOfRules) {
        const babelLoader = oneOfRules.oneOf.find(
          rule => rule.test && rule.test.toString().includes('js|jsx')
        );
        
        if (babelLoader) {
          // 扩展babel-loader的include范围，包含auth文件夹
          const authPath = path.resolve(__dirname, '../auth');
          if (Array.isArray(babelLoader.include)) {
            babelLoader.include.push(authPath);
          } else {
            babelLoader.include = [babelLoader.include, authPath];
          }
        }
      }
      
      return webpackConfig;
    },
  },
};