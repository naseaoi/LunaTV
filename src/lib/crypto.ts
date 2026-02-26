import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * 兼容 CryptoJS.AES 的 OpenSSL 格式加解密。
 * 使用 Node.js 原生 crypto 模块，替代 crypto-js (~450KB)。
 *
 * CryptoJS 默认行为：
 *  - 密码 → EvpKDF(MD5 链式哈希) 派生 key+iv
 *  - AES-256-CBC + PKCS7 padding
 *  - 输出格式: "Salted__" + 8-byte salt + ciphertext → Base64
 */

const KEY_SIZE = 32; // AES-256
const IV_SIZE = 16;
const SALT_SIZE = 8;
const OPENSSL_PREFIX = Buffer.from('Salted__');

/** CryptoJS EvpKDF: MD5 链式哈希派生 key + iv */
function evpKDF(
  password: Buffer<ArrayBuffer>,
  salt: Buffer<ArrayBuffer>,
): { key: Buffer<ArrayBuffer>; iv: Buffer<ArrayBuffer> } {
  const parts: Buffer<ArrayBuffer>[] = [];
  let block = Buffer.alloc(0);
  while (Buffer.concat(parts).length < KEY_SIZE + IV_SIZE) {
    const hash = createHash('md5');
    hash.update(block);
    hash.update(password);
    hash.update(salt);
    block = hash.digest() as Buffer<ArrayBuffer>;
    parts.push(block);
  }
  const all = Buffer.concat(parts);
  return {
    key: all.subarray(0, KEY_SIZE) as Buffer<ArrayBuffer>,
    iv: all.subarray(KEY_SIZE, KEY_SIZE + IV_SIZE) as Buffer<ArrayBuffer>,
  };
}

export class SimpleCrypto {
  static encrypt(data: string, password: string): string {
    try {
      const salt = randomBytes(SALT_SIZE) as Buffer<ArrayBuffer>;
      const passBuffer = Buffer.from(password, 'utf8') as Buffer<ArrayBuffer>;
      const { key, iv } = evpKDF(passBuffer, salt);

      const cipher = createCipheriv('aes-256-cbc', key, iv);
      const encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final(),
      ]);

      // OpenSSL 格式: "Salted__" + salt + ciphertext
      const result = Buffer.concat([OPENSSL_PREFIX, salt, encrypted]);
      return result.toString('base64');
    } catch {
      throw new Error('加密失败');
    }
  }

  static decrypt(encryptedData: string, password: string): string {
    try {
      const raw = Buffer.from(encryptedData, 'base64');

      // 验证 OpenSSL 前缀
      if (raw.length < 16 || !raw.subarray(0, 8).equals(OPENSSL_PREFIX)) {
        throw new Error('无效的加密数据格式');
      }

      const salt = raw.subarray(8, 16) as Buffer<ArrayBuffer>;
      const ciphertext = raw.subarray(16);
      const passBuffer = Buffer.from(password, 'utf8') as Buffer<ArrayBuffer>;
      const { key, iv } = evpKDF(passBuffer, salt);

      const decipher = createDecipheriv('aes-256-cbc', key, iv);
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');

      if (!decrypted) {
        throw new Error('解密失败，请检查密码是否正确');
      }

      return decrypted;
    } catch {
      throw new Error('解密失败，请检查密码是否正确');
    }
  }

  static canDecrypt(encryptedData: string, password: string): boolean {
    try {
      const decrypted = this.decrypt(encryptedData, password);
      return decrypted.length > 0;
    } catch {
      return false;
    }
  }
}
