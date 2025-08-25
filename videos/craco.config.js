const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // 保留你原来的webpack配置
      const scopePluginIndex = webpackConfig.resolve.plugins.findIndex(
        ({ constructor }) => constructor && constructor.name === 'ModuleScopePlugin'
      );
      webpackConfig.resolve.plugins.splice(scopePluginIndex, 1);
      
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      };

      webpackConfig.resolve.symlinks = false;
      
      const oneOfRules = webpackConfig.module.rules.find(rule => rule.oneOf);
      if (oneOfRules) {
        const babelLoader = oneOfRules.oneOf.find(
          rule => rule.test && rule.test.toString().includes('js|jsx')
        );
        
        if (babelLoader) {
          const authPath = path.resolve(__dirname, '../auth-clerk');
          
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
  // 删除这整个style部分
};