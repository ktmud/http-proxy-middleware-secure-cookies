const secureCookieProxy = require('../dist/lib/secureCookieProxy').default;

module.exports = {
  entry: `${__dirname}/src/index.js`,
  devServer: {
    stats: 'minimal',
    proxy: {
      '/': secureCookieProxy('https://www.google.com'),
    },
  },
};
