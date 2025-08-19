const path = require('path');

module.exports = {
  style: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
      ],
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'auth-clerk': path.resolve(__dirname, '../auth-clerk'),
      'shared': path.resolve(__dirname, '../shared'),
    },
  },
};