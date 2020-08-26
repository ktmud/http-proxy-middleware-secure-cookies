const { secureCookieProxy } = require('../dist/lib/secureCookieProxy');

const googleStaticProxy = secureCookieProxy({
  target: 'https://www.google.com',
  keychainAccount: 'google',
});

module.exports = {
  entry: `${__dirname}/src/index.js`,
  devServer: {
    contentBase: __dirname,
    stats: 'minimal',
    clientLogLevel: 'debug',
    proxy: {
      '/google': secureCookieProxy({
        target: 'https://www.google.com',
        keychainAccount: 'google',
        pathRewrite: {
          '^/google': '/',
        },
        cookiePathRewrite: '/google',
      }),
      '/images': googleStaticProxy,
      '/xjs': googleStaticProxy,
      '/facebook': secureCookieProxy({
        target: 'https://www.facebook.com',
        pathRewrite: {
          '^/facebook': '/',
        },
        cookiePathRewrite: '/facebook',
      }),
    },
  },
};
