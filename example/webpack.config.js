const { secureCookieProxy } = require('../dist/lib/secureCookieProxy');

module.exports = {
  entry: `${__dirname}/src/index.js`,
  devServer: {
    contentBase: __dirname,
    stats: 'minimal',
    clientLogLevel: 'debug',
    proxy: [
      {
        context: '/google',
        ...secureCookieProxy({
          target: 'https://www.google.com',
          keychainAccount: 'google.com--my-name',
          cookieDomainRewrite: '',
          pathRewrite: {
            '^/google': '/',
          },
          cookiePathRewrite: '/google',
        }),
      },
      {
        context: path => /^\/(complete|logos|images|gen_204|client_204)/.test(path),
        ...secureCookieProxy({
          target: 'https://www.google.com',
          keychainAccount: 'google-static',
        }),
      },
      {
        context: '/facebook',
        ...secureCookieProxy({
          target: 'https://www.facebook.com',
          pathRewrite: {
            '^/facebook': '/',
          },
          cookiePathRewrite: '/facebook',
        }),
      },
    ],
  },
};
