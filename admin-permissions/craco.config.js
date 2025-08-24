const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // 移除ModuleScopePlugin限制
      const scopePluginIndex = webpackConfig.resolve.plugins.findIndex(
        ({ constructor }) => constructor && constructor.name === 'ModuleScopePlugin'
      );
      if (scopePluginIndex !== -1) {
        webpackConfig.resolve.plugins.splice(scopePluginIndex, 1);
      }
      
      // ✨ 添加 resolve alias 确保只有一个React实例
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      };

      // ✨ 确保 resolve.symlinks 为 false
      webpackConfig.resolve.symlinks = false;
      
      // 更直接的方法：添加专门的babel规则处理auth-clerk
      const authClerkPath = path.resolve(__dirname, '../auth-clerk/src');
      
      webpackConfig.module.rules.push({
        test: /\.(js|jsx)$/,
        include: authClerkPath,
        use: {
          loader: require.resolve('babel-loader'),
          options: {
            presets: [
              [require.resolve('babel-preset-react-app'), {
                runtime: 'automatic'
              }]
            ],
            cacheDirectory: true,
            cacheCompression: false,
          },
        },
      });
      
      return webpackConfig;
    },
  },
};