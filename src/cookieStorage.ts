/**
 * Store cookie strings in system keychain (via node-keytar when available)
 * or in filesystem.
 */
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const fileExists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);

const storage: {
  isKeyChain?: boolean;
  get?: (account: string) => Promise<string>;
  set?: (account: string, secrets: string) => Promise<void>;
  setCookieDirectory?: (directory: string) => void;
} = {};

/** * Make sure the cookies folder exist.
 */
async function prepareDirectory(directory: string) {
  if (!(await fileExists(directory))) {
    await mkdir(directory);
  }
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getPassword, setPassword } = require('keytar');

  const SERVICE = 'HttpProxySecureCookies';
  storage.get = async function getCookies(account) {
    return getPassword(SERVICE, account);
  };
  storage.set = async function setCookies(account, secrets) {
    return setPassword(SERVICE, account, secrets);
  };
  storage.isKeyChain = true;
} catch (error) {
  const writeFile = promisify(fs.writeFile);
  const readFile = promisify(fs.readFile);
  let cookieDirectory = path.join(process.cwd(), '.proxy-cookies');
  const getCookieFilePath = (account: string) => {
    return path.join(
      cookieDirectory,
      `${account.replace(/[^a-z0-9\.\-]/gi, '_').toLowerCase()}.txt`,
    );
  };

  storage.setCookieDirectory = (directory: string) => {
    cookieDirectory = directory;
  };

  storage.get = async function getCookies(account) {
    try {
      const cookieFile = getCookieFilePath(account);
      return await readFile(cookieFile, { encoding: 'utf-8' });
    } catch (error) {
      return null;
    }
  };
  storage.set = async function setCookies(account, secrets) {
    await prepareDirectory(cookieDirectory);
    const cookieFile = getCookieFilePath(account);
    return await writeFile(cookieFile, secrets, { encoding: 'utf-8' });
  };
}

export default storage;
