/**
 * Add proxy to local mock server or production server.
 */
import { ClientRequest, IncomingMessage } from 'http';
import { Config as ProxyOptions } from 'http-proxy-middleware';
import storage from './cookieStorage';
import { parse as parseCookies, serialize as serializeCookie } from 'cookie';
import * as inquirer from 'inquirer';

type Cookies = { [key: string]: string };

/**
 * Serialize cookies object to the cookie string as seen in request headers.
 */
function toCookieString(cookies: Cookies) {
  return Object.entries(cookies)
    .map(([key, value]) => serializeCookie(key, value))
    .join('; ');
}

/**
 * Parse the `Set-Cookie` header from remote servers.
 */
function parseSetCookie(
  cookieHeaders?: string | number | string[],
): [string[], Cookies] {
  if (!cookieHeaders) return [[], {}];
  const cookieArray = Array.isArray(cookieHeaders)
    ? cookieHeaders
    : [String(cookieHeaders)];
  const cookies: Cookies = {};
  return [
    cookieArray,
    cookieArray
      .map((x) => x.split(';', 1)[0].split('=', 2))
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, cookies),
  ];
}

let waitingForInput = false;

export interface SecureCookieProxyOptions extends ProxyOptions {
  /**
   * Target proxy destination.
   */
  target: string; // make proxy target a required option
  /**
   * HTTP status code indicating when auth cookies are needed (default: 401).
   */
  unauthorizedStatusCode?: number | number[];
  /**
   * The account name used to save cookies in system keychain or a local file.
   */
  keychainAccount?: string;
  /**
   * Additional processing on secure cookies before setting them to the client.
   */
  cookieRewrite?: (cookies: Cookies) => Cookies;
}

/**
 * Generate a proxy config that points to a remote host.
 */
export function secureCookieProxy(
  options: string | SecureCookieProxyOptions,
): ProxyOptions {
  const {
    target,
    keychainAccount,
    secure = false,
    changeOrigin = true,
    unauthorizedStatusCode = [401],
    cookiePathRewrite,
    cookieRewrite,
    onProxyReq,
    onProxyReqWs,
    onProxyRes,
    ...restOptions
  }: SecureCookieProxyOptions =
    typeof options === 'string' ? { target: options } : options;
  // default account is the target sans protocol
  const account = keychainAccount || target.split('://')[1];
  const unauthroizedCode = new Set(
    Array.isArray(unauthorizedStatusCode)
      ? unauthorizedStatusCode
      : [unauthorizedStatusCode],
  );

  let secureCookies: Cookies | undefined;

  async function getFromKeyChain() {
    return storage.get(account);
  }

  async function askForUserInput(message: string): Promise<string | null> {
    // waitingForInput flag is global as it is a little confusing if there are
    // two ongoing prompts.
    waitingForInput = true;
    const { cookieString } = await inquirer.prompt<{ cookieString: string }>([
      {
        type: 'password',
        name: 'cookieString',
        message,
      },
    ]);
    const cleanCookieString = cookieString.replace(/^\s*Cookie:\s*/i, '');

    if (cleanCookieString) {
      // clean up the typical header name when copying directly from Chrome DevTools
      await storage.set(account, cleanCookieString);
      console.log('\nSuccessfully saved your cookie. Please refresh.\n');
    } else {
      console.log('\nNo cookies provided.');
    }
    waitingForInput = false;
    return cleanCookieString;
  }

  /**
   * Read cookies from keychain or user input.
   */
  async function getCookies(message?: string) {
    if (waitingForInput) return null;
    try {
      secureCookies = parseCookies(
        (message ? await askForUserInput(message) : await getFromKeyChain()) ||
          '',
      );
    } catch (error) {
      console.error('Failed to get valid cookies.');
      console.error(error);
    }
    return secureCookies;
  }

  /**
   * Add secure cookies to proxy request header.
   */
  function addCookie(proxyReq: ClientRequest, req: IncomingMessage) {
    // if not cookies found, ask for user input
    if (!secureCookies || Object.keys(secureCookies).length === 0) {
      getCookies(`
No stored cookies found for proxy target ${keychainAccount}.
Copy and paste your cookies to get authenticated:`);
    } else {
      proxyReq.setHeader(
        'cookie',
        toCookieString({
          ...secureCookies,
          ...parseCookies(req.headers.cookie || ''),
        }),
      );
    }
  }

  // quitely get initial cookies
  getCookies();

  return {
    secure,
    changeOrigin,
    target,
    ws: target.startsWith('ws'),
    cookiePathRewrite,
    ...restOptions,
    onProxyReq(proxyReq, req, res) {
      addCookie(proxyReq, req);
      if (onProxyReq) {
        onProxyReq(proxyReq, req, res);
      }
    },
    onProxyReqWs(proxyReq, req, socket, options, head) {
      addCookie(proxyReq, req);
      if (onProxyReqWs) {
        onProxyReqWs(proxyReq, req, socket, options, head);
      }
    },
    onProxyRes(proxyRes, req, res) {
      // update cookies if API returns 401
      if (proxyRes.statusCode && unauthroizedCode.has(proxyRes.statusCode)) {
        getCookies(`
Authentication failed for ${target}${req.url}

You either haven't provide an auth cookie or it expired.
Please login to ${target} and copy the HTTP cookie string here.

It will be securely stored in system keychain:`);
      }
      // add missing cookies to the response so they can be used on the client
      // side as well.
      if (secureCookies) {
        const reqCookies = parseCookies(req.headers.cookie || '');
        const [cookieHeaders, resCookies] = parseSetCookie(
          res.getHeader('set-cookie'),
        );
        const clientCookies = cookieRewrite
          ? cookieRewrite(secureCookies)
          : secureCookies;
        // by default rewrite cookie to root path
        const cookiePath =
          typeof cookiePathRewrite === 'string' ? cookiePathRewrite : '/';

        let hasMissingCookie = false;

        Object.keys(clientCookies).forEach((key) => {
          if (!(key in reqCookies) && !(key in resCookies)) {
            // set all secure cookie to the root path
            cookieHeaders.push(
              serializeCookie(key, clientCookies[key], {
                path: cookiePath,
              }),
            );
            hasMissingCookie = true;
          }
        });
        if (hasMissingCookie) {
          res.setHeader('Set-Cookie', cookieHeaders);
        }
      }
      if (onProxyRes) {
        onProxyRes(proxyRes, req, res);
      }
    },
  };
}

export default secureCookieProxy;
