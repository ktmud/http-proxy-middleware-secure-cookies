# http-proxy-middleware-secure-cookies

Securely make authenticated requests to a remote server inside Webpack Dev Server proxies.

This library helps you create an [http-proxy-middleware](https://www.npmjs.com/package/http-proxy-middleware) that securly makes proxy requests with cookies. It will prompt you to enter auth cookies at initial start or when authentication failed.

## Problem Statement

Imagine you have an API backend and a totally separate frontend. The dev environment for the backend is very complex to setup so sometimes you'd prefer to let local frontend dev server make direct requests to the production services or some shared environment.

Now the tricky thing is the production service may require authentication. You local proxy has to bear the authentication headers or cookies in order to make requests to the API service. This package allows you to more easily manage and securely store the credentials needed for making these requests.

## Usage

In `webpack.config.js`, add `devServer` proxy rules like below:

```ts
const { secureCookieProxy } = require('http-proxy-middleware-secure-cookies');

module.exports = {
  // ...
  devServer: {
    // ...
    proxy: {
      // use the default options to proxy /api/* to https://foo.example.com/api/*
      '/api/*': secureCookieProxy('https://api.example.com'),

      // different endpoints share the same account
      '/proxy/fiz': secureCookieProxy({
        target: 'https://bar.example.com',
        keychainAccount: 'example.com',
      });
      '/proxy/buz': secureCookieProxy({
        target: 'https://buz.example.com',
        keychainAccount: 'example.com',
      });
  }
}

module.exports = config;
```

This will automatically proxy local requests for `http://locahost:$PORT/proxy/*` to `https://proxy-target.example.com`. If the server returns a `401` HTTP status code, the dev server will automatically prompt you to enter a cookie string, store it in file system or the system keychain (when available), then use the cookies to authenticate future requests.

### Secure Cookie Storage

By default, the package will try to install `node-keytar` to store the cookies in system keychain, if for some reason the installation failed (e.g., [libsecret](https://github.com/atom/node-keytar#on-linux) not pre-installed on Linux), we will fallback to using local files. By default the local file used is `${process.cwd()}/.proxy-cookies/[keychainAccount]`. You can change the storage directory with following code (not recommended):

```js
const os = require('os');
const { setCookieDirectory } = require('http-proxy-middleware-secure-cookies/dist/storage');

// change it to home directory so cookies can be shared across apps
setCookieDirectory(`${os.homedir()}/.proxy-cookies`);
```

## Options

Pass options via `secureCookieProxy(options)`.

## License

The MIT License.
