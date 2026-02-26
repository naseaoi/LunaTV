/**
 * 源站流量路由查询（客户端）
 * 从 /api/proxy-modes 动态获取，内存缓存 30 秒。
 */

let cachedModes: Record<string, string> | null = null;
let cacheExpiry = 0;
let inflightPromise: Promise<Record<string, string>> | null = null;

const CACHE_TTL_MS = 30_000;

async function fetchProxyModes(): Promise<Record<string, string>> {
  try {
    const res = await fetch('/api/proxy-modes');
    if (res.ok) {
      const data = (await res.json()) as Record<string, string>;
      cachedModes = data;
      cacheExpiry = Date.now() + CACHE_TTL_MS;
      return data;
    }
  } catch {
    // 网络失败，返回空映射
  }
  return cachedModes || {};
}

/** 异步获取源站流量路由映射（带缓存） */
export async function getProxyModes(): Promise<Record<string, string>> {
  if (cachedModes && Date.now() < cacheExpiry) {
    return cachedModes;
  }
  // 防止并发重复请求
  if (!inflightPromise) {
    inflightPromise = fetchProxyModes().finally(() => {
      inflightPromise = null;
    });
  }
  return inflightPromise;
}

/** 同步读取缓存中的 proxyMode（缓存未就绪时返回 undefined） */
export function getSourceProxyModeSync(
  sourceKey: string,
): 'server' | 'browser' | undefined {
  if (!cachedModes) return undefined;
  return cachedModes[sourceKey] as 'server' | 'browser' | undefined;
}

/** 判断指定源站是否走服务端代理（同步，缓存未就绪时默认 false） */
export function isServerProxy(sourceKey: string): boolean {
  return getSourceProxyModeSync(sourceKey) === 'server';
}

/** 预热缓存（页面加载时调用一次） */
export function preloadProxyModes(): void {
  getProxyModes().catch(() => {});
}
