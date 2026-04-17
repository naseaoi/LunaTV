/**
 * 源站流量路由查询（客户端）
 * 从 /api/proxy-modes 动态获取，内存缓存 30 秒。
 */

let cachedModes: Record<string, string> | null = null;
let cacheExpiry = 0;
let inflightPromise: Promise<Record<string, string>> | null = null;

const CACHE_TTL_MS = 30_000;
const OVERRIDE_STORAGE_KEY = 'icetv_proxy_mode_overrides';
const OVERRIDE_TTL_MS = 30 * 60 * 1000;

type ProxyOverrideMap = Record<string, { mode: 'server'; at: number }>;

function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.sessionStorage;
}

function readOverrides(): ProxyOverrideMap {
  if (!isStorageAvailable()) return {};
  try {
    const raw = window.sessionStorage.getItem(OVERRIDE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeOverrides(data: ProxyOverrideMap): void {
  if (!isStorageAvailable()) return;
  try {
    const now = Date.now();
    for (const key of Object.keys(data)) {
      const entry = data[key];
      if (!entry || now - entry.at > OVERRIDE_TTL_MS) {
        delete data[key];
      }
    }
    window.sessionStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 隐私模式 / 存储受限时静默忽略
  }
}

function getRuntimeProxyOverride(sourceKey: string): 'server' | undefined {
  if (!sourceKey) return undefined;
  const data = readOverrides();
  const entry = data[sourceKey];
  if (!entry) return undefined;
  if (Date.now() - entry.at > OVERRIDE_TTL_MS) {
    delete data[sourceKey];
    writeOverrides(data);
    return undefined;
  }
  return entry.mode;
}

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
  const runtimeOverride = getRuntimeProxyOverride(sourceKey);
  if (runtimeOverride) return runtimeOverride;
  if (!cachedModes) return undefined;
  return cachedModes[sourceKey] as 'server' | 'browser' | undefined;
}

/**
 * 根据 admin 配置 + 会话期失败记忆，推导当前应否走服务端代理。
 * 会话记忆只做 browser -> server 的短期提升，不覆盖 admin 显式的 server 配置。
 */
export function shouldUseServerProxy(
  sourceKey: string,
  modes?: Record<string, string>,
): boolean {
  if (getRuntimeProxyOverride(sourceKey) === 'server') {
    return true;
  }
  const resolvedModes = modes || cachedModes || {};
  return resolvedModes[sourceKey] === 'server';
}

/** 判断指定源站是否走服务端代理（同步，缓存未就绪时默认 false） */
export function isServerProxy(sourceKey: string): boolean {
  return shouldUseServerProxy(sourceKey);
}

/**
 * 记录本次会话里某源的 browser 路由已失效，后续短时间直接走 server。
 * 只缓存到 sessionStorage，避免把短时 token/网络抖动带到未来会话。
 */
export function rememberSourceServerProxy(sourceKey: string): void {
  if (!sourceKey) return;
  const data = readOverrides();
  data[sourceKey] = {
    mode: 'server',
    at: Date.now(),
  };
  writeOverrides(data);
}

/** 浏览器直连成功后清除短期兜底记忆，恢复按 admin 路由决策。 */
export function clearSourceProxyOverride(sourceKey: string): void {
  if (!sourceKey) return;
  const data = readOverrides();
  if (data[sourceKey]) {
    delete data[sourceKey];
    writeOverrides(data);
  }
}

/** 预热缓存（页面加载时调用一次） */
export function preloadProxyModes(): void {
  getProxyModes().catch(() => {});
}
