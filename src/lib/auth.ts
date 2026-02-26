import { NextRequest } from 'next/server';

export type AuthRole = 'owner' | 'admin' | 'user';

export type AuthCookiePayload = {
  username?: string;
  signature?: string;
  expiresAt?: number;
  role?: AuthRole;
  sessionType?: 'localstorage' | 'account';
};

export type AuthMetaPayload = {
  username?: string;
  role?: AuthRole;
};

// 从cookie获取认证信息 (服务端使用)
export function getAuthInfoFromCookie(
  request: NextRequest,
): AuthCookiePayload | null {
  const authCookie = request.cookies.get('auth');

  if (!authCookie) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(authCookie.value);
    const authData = JSON.parse(decoded);
    return authData;
  } catch (error) {
    return null;
  }
}

// 从cookie获取认证信息 (客户端使用)
export function getAuthInfoFromBrowserCookie(): AuthMetaPayload | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const parseCookieJson = <T>(value: string): T | null => {
      try {
        return JSON.parse(value) as T;
      } catch (_) {
        // continue fallback decoding
      }

      try {
        return JSON.parse(decodeURIComponent(value)) as T;
      } catch (_) {
        // continue fallback decoding
      }

      try {
        return JSON.parse(decodeURIComponent(decodeURIComponent(value))) as T;
      } catch (_) {
        return null;
      }
    };

    // 解析 document.cookie
    const cookies = document.cookie.split(';').reduce(
      (acc, cookie) => {
        const trimmed = cookie.trim();
        const firstEqualIndex = trimmed.indexOf('=');

        if (firstEqualIndex > 0) {
          const key = trimmed.substring(0, firstEqualIndex);
          const value = trimmed.substring(firstEqualIndex + 1);
          if (key && value) {
            acc[key] = value;
          }
        }

        return acc;
      },
      {} as Record<string, string>,
    );

    const authMetaCookie = cookies['auth_meta'];
    if (authMetaCookie) {
      const authMeta = parseCookieJson<AuthMetaPayload>(authMetaCookie);
      if (authMeta) {
        return authMeta;
      }
    }

    const authCookie = cookies['auth'];
    if (!authCookie) {
      return null;
    }

    const authData = parseCookieJson<AuthCookiePayload>(authCookie);
    if (!authData) {
      return null;
    }

    return {
      username: authData.username,
      role: authData.role,
    };
  } catch (error) {
    return null;
  }
}

// CryptoKey 缓存：secret 在应用生命周期内不变，避免每次请求都 importKey
let _cachedSecret: string | null = null;
let _cachedKey: CryptoKey | null = null;

async function getCachedKey(secret: string): Promise<CryptoKey> {
  if (_cachedKey && _cachedSecret === secret) {
    return _cachedKey;
  }
  const keyData = new TextEncoder().encode(secret);
  _cachedKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  _cachedSecret = secret;
  return _cachedKey;
}

/**
 * 使用 HMAC-SHA256 验证签名。
 * 用于 session 校验和 middleware 认证。
 */
export async function verifySignature(
  data: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const messageData = new TextEncoder().encode(data);

  try {
    const key = await getCachedKey(secret);

    const signatureBuffer = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
    );

    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      messageData,
    );
  } catch {
    return false;
  }
}
