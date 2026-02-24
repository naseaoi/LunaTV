/**
 * db.client.ts 的内部基础设施：
 * - 存储/网络工具函数
 * - HybridCacheManager
 * - 两个泛型工厂函数（createCacheFirstReader / createOptimisticWriter）
 *
 * 该文件不包含 'use client' 指令，由 db.client.ts 统一声明。
 */

import { getAuthInfoFromBrowserCookie } from './auth';
import type { SkipConfig } from './types';
import type { PlayRecord, Favorite, CacheUpdateEvent } from './db.client';

// ================================================================
// 会话探针 & 认证恢复
// ================================================================

type SessionProbeResult = {
  authenticated: boolean;
  reason:
    | 'ok'
    | 'missing_cookie'
    | 'invalid_local_password'
    | 'session_expired'
    | 'invalid_signature'
    | 'missing_signature'
    | 'missing_username'
    | 'user_not_found'
    | 'user_banned'
    | 'no_password_config'
    | 'server_error';
  username?: string | null;
};

type SessionLostDetail = {
  reason: SessionProbeResult['reason'];
  sourceUrl: string;
  loginUrl: string;
  inPlayerPage: boolean;
};

let authLossHandling = false;

const AUTH_SOFT_RECOVERY_EVENT = 'auth:session-lost';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeSession(): Promise<SessionProbeResult> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 401) {
        return {
          authenticated: false,
          reason: 'missing_cookie',
          username: null,
        };
      }
      return {
        authenticated: false,
        reason: 'server_error',
        username: null,
      };
    }

    return (await res.json()) as SessionProbeResult;
  } catch (error) {
    console.error('会话探针请求失败:', error);
    return {
      authenticated: false,
      reason: 'server_error',
      username: null,
    };
  }
}

function buildLoginUrl(): string {
  const currentUrl = window.location.pathname + window.location.search;
  const loginUrl = new URL('/login', window.location.origin);
  loginUrl.searchParams.set('redirect', currentUrl);
  return loginUrl.toString();
}

function notifySessionLost(
  reason: SessionProbeResult['reason'],
  sourceUrl: string,
) {
  if (authLossHandling) {
    return;
  }

  authLossHandling = true;
  const loginUrl = buildLoginUrl();
  const inPlayerPage = window.location.pathname.startsWith('/play');

  window.dispatchEvent(
    new CustomEvent<SessionLostDetail>(AUTH_SOFT_RECOVERY_EVENT, {
      detail: {
        reason,
        sourceUrl,
        loginUrl,
        inPlayerPage,
      },
    }),
  );

  if (!inPlayerPage) {
    window.location.href = loginUrl;
  }
}

function resetAuthLossHandlingFlag() {
  setTimeout(() => {
    authLossHandling = false;
  }, 3000);
}

// ================================================================
// 全局错误触发
// ================================================================

export function triggerGlobalError(message: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('globalError', {
        detail: { message },
      }),
    );
  }
}

// ================================================================
// localStorage 工具
// ================================================================

export function getStorageValueWithLegacy(
  key: string,
  legacyKey?: string,
): string | null {
  const raw = localStorage.getItem(key);
  if (raw !== null) {
    return raw;
  }
  if (!legacyKey) {
    return null;
  }
  const legacyRaw = localStorage.getItem(legacyKey);
  if (legacyRaw !== null) {
    localStorage.setItem(key, legacyRaw);
  }
  return legacyRaw;
}

export function setStorageValueWithLegacyCleanup(
  key: string,
  value: string,
  legacyKey?: string,
): void {
  localStorage.setItem(key, value);
  if (legacyKey) {
    localStorage.removeItem(legacyKey);
  }
}

// ================================================================
// 环境变量
// ================================================================

export const STORAGE_TYPE = (() => {
  const raw =
    (typeof window !== 'undefined' && window.RUNTIME_CONFIG?.STORAGE_TYPE) ||
    (process.env.STORAGE_TYPE as 'localstorage' | 'localdb' | undefined) ||
    'localstorage';
  return raw;
})();

// ================================================================
// fetch 工具
// ================================================================

export async function fetchWithAuth(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const initialRes = await fetch(url, options);

  if (initialRes.ok) {
    return initialRes;
  }

  if (initialRes.status !== 401) {
    throw new Error(`请求 ${url} 失败: ${initialRes.status}`);
  }

  await wait(500);
  const retryRes = await fetch(url, options);
  if (retryRes.ok) {
    return retryRes;
  }

  if (retryRes.status !== 401) {
    throw new Error(`请求 ${url} 失败: ${retryRes.status}`);
  }

  const session = await probeSession();

  if (session.authenticated) {
    triggerGlobalError('请求暂时失败，已自动重试，请稍后继续操作');
    throw new Error(`请求 ${url} 失败: 会话有效但接口返回未授权`);
  }

  if (session.reason === 'user_banned') {
    triggerGlobalError('账号已被封禁，请联系管理员');
  } else if (session.reason === 'user_not_found') {
    triggerGlobalError('账号不存在，请重新登录');
  } else {
    triggerGlobalError('登录状态已失效，请重新登录');
  }

  notifySessionLost(session.reason, url);
  resetAuthLossHandlingFlag();
  throw new Error(`登录状态失效: ${session.reason}`);
}

export async function fetchFromApi<T>(path: string): Promise<T> {
  const res = await fetchWithAuth(path);
  return (await res.json()) as T;
}

// ================================================================
// HybridCacheManager
// ================================================================

interface CacheData<T> {
  data: T;
  timestamp: number;
  version: string;
}

interface UserCacheStore {
  playRecords?: CacheData<Record<string, PlayRecord>>;
  favorites?: CacheData<Record<string, Favorite>>;
  searchHistory?: CacheData<string[]>;
  skipConfigs?: CacheData<Record<string, SkipConfig>>;
}

const CACHE_PREFIX = 'icetv_cache_';
const LEGACY_CACHE_PREFIX = 'moontv_cache_';
const CACHE_VERSION = '1.0.0';
const CACHE_EXPIRE_TIME = 60 * 60 * 1000; // 一小时缓存过期

export class HybridCacheManager {
  private static instance: HybridCacheManager;

  static getInstance(): HybridCacheManager {
    if (!HybridCacheManager.instance) {
      HybridCacheManager.instance = new HybridCacheManager();
    }
    return HybridCacheManager.instance;
  }

  private getCurrentUsername(): string | null {
    const authInfo = getAuthInfoFromBrowserCookie();
    return authInfo?.username || null;
  }

  private getUserCacheKey(username: string): string {
    return `${CACHE_PREFIX}${username}`;
  }

  private getUserCache(username: string): UserCacheStore {
    if (typeof window === 'undefined') return {};

    try {
      const cacheKey = this.getUserCacheKey(username);
      const legacyCacheKey = cacheKey.replace(
        CACHE_PREFIX,
        LEGACY_CACHE_PREFIX,
      );
      const cached = getStorageValueWithLegacy(cacheKey, legacyCacheKey);
      return cached ? JSON.parse(cached) : {};
    } catch (error) {
      console.warn('获取用户缓存失败:', error);
      return {};
    }
  }

  private saveUserCache(username: string, cache: UserCacheStore): void {
    if (typeof window === 'undefined') return;

    try {
      const cacheSize = JSON.stringify(cache).length;
      if (cacheSize > 15 * 1024 * 1024) {
        console.warn('缓存过大，清理旧数据');
        this.cleanOldCache(cache);
      }

      const cacheKey = this.getUserCacheKey(username);
      localStorage.setItem(cacheKey, JSON.stringify(cache));
    } catch (error) {
      console.warn('保存用户缓存失败:', error);
      if (
        error instanceof DOMException &&
        error.name === 'QuotaExceededError'
      ) {
        this.clearAllCache();
        try {
          const cacheKey = this.getUserCacheKey(username);
          localStorage.setItem(cacheKey, JSON.stringify(cache));
        } catch (retryError) {
          console.error('重试保存缓存仍然失败:', retryError);
        }
      }
    }
  }

  private cleanOldCache(cache: UserCacheStore): void {
    const now = Date.now();
    const maxAge = 60 * 24 * 60 * 60 * 1000; // 两个月

    if (cache.playRecords && now - cache.playRecords.timestamp > maxAge) {
      delete cache.playRecords;
    }

    if (cache.favorites && now - cache.favorites.timestamp > maxAge) {
      delete cache.favorites;
    }
  }

  private clearAllCache(): void {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_PREFIX) || key.startsWith(LEGACY_CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }

  private isCacheValid<T>(cache: CacheData<T>): boolean {
    const now = Date.now();
    return (
      cache.version === CACHE_VERSION &&
      now - cache.timestamp < CACHE_EXPIRE_TIME
    );
  }

  private createCacheData<T>(data: T): CacheData<T> {
    return {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
  }

  // ---- 播放记录 ----
  getCachedPlayRecords(): Record<string, PlayRecord> | null {
    const username = this.getCurrentUsername();
    if (!username) return null;
    const userCache = this.getUserCache(username);
    const cached = userCache.playRecords;
    if (cached && this.isCacheValid(cached)) return cached.data;
    return null;
  }

  cachePlayRecords(data: Record<string, PlayRecord>): void {
    const username = this.getCurrentUsername();
    if (!username) return;
    const userCache = this.getUserCache(username);
    userCache.playRecords = this.createCacheData(data);
    this.saveUserCache(username, userCache);
  }

  // ---- 收藏 ----
  getCachedFavorites(): Record<string, Favorite> | null {
    const username = this.getCurrentUsername();
    if (!username) return null;
    const userCache = this.getUserCache(username);
    const cached = userCache.favorites;
    if (cached && this.isCacheValid(cached)) return cached.data;
    return null;
  }

  cacheFavorites(data: Record<string, Favorite>): void {
    const username = this.getCurrentUsername();
    if (!username) return;
    const userCache = this.getUserCache(username);
    userCache.favorites = this.createCacheData(data);
    this.saveUserCache(username, userCache);
  }

  // ---- 搜索历史 ----
  getCachedSearchHistory(): string[] | null {
    const username = this.getCurrentUsername();
    if (!username) return null;
    const userCache = this.getUserCache(username);
    const cached = userCache.searchHistory;
    if (cached && this.isCacheValid(cached)) return cached.data;
    return null;
  }

  cacheSearchHistory(data: string[]): void {
    const username = this.getCurrentUsername();
    if (!username) return;
    const userCache = this.getUserCache(username);
    userCache.searchHistory = this.createCacheData(data);
    this.saveUserCache(username, userCache);
  }

  // ---- 跳过片头片尾 ----
  getCachedSkipConfigs(): Record<string, SkipConfig> | null {
    const username = this.getCurrentUsername();
    if (!username) return null;
    const userCache = this.getUserCache(username);
    const cached = userCache.skipConfigs;
    if (cached && this.isCacheValid(cached)) return cached.data;
    return null;
  }

  cacheSkipConfigs(data: Record<string, SkipConfig>): void {
    const username = this.getCurrentUsername();
    if (!username) return;
    const userCache = this.getUserCache(username);
    userCache.skipConfigs = this.createCacheData(data);
    this.saveUserCache(username, userCache);
  }

  // ---- 缓存管理 ----
  clearUserCache(username?: string): void {
    const targetUsername = username || this.getCurrentUsername();
    if (!targetUsername) return;
    try {
      const cacheKey = this.getUserCacheKey(targetUsername);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn('清除用户缓存失败:', error);
    }
  }

  clearExpiredCaches(): void {
    if (typeof window === 'undefined') return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          try {
            const cache = JSON.parse(localStorage.getItem(key) || '{}');
            let hasValidData = false;
            for (const [, cacheData] of Object.entries(cache)) {
              if (
                cacheData &&
                this.isCacheValid(cacheData as CacheData<unknown>)
              ) {
                hasValidData = true;
                break;
              }
            }
            if (!hasValidData) {
              keysToRemove.push(key);
            }
          } catch {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.warn('清除过期缓存失败:', error);
    }
  }
}

export const cacheManager = HybridCacheManager.getInstance();

// 页面加载时清理过期缓存
if (typeof window !== 'undefined') {
  setTimeout(() => cacheManager.clearExpiredCaches(), 1000);
}

// ================================================================
// 错误处理辅助
// ================================================================

export async function handleDatabaseOperationFailure(
  dataType: 'playRecords' | 'favorites' | 'searchHistory',
  error: unknown,
): Promise<void> {
  console.error(`数据库操作失败 (${dataType}):`, error);
  triggerGlobalError(`数据库操作失败`);

  try {
    let freshData: unknown;
    let eventName: string;

    switch (dataType) {
      case 'playRecords':
        freshData =
          await fetchFromApi<Record<string, PlayRecord>>(`/api/playrecords`);
        cacheManager.cachePlayRecords(freshData as Record<string, PlayRecord>);
        eventName = 'playRecordsUpdated';
        break;
      case 'favorites':
        freshData =
          await fetchFromApi<Record<string, Favorite>>(`/api/favorites`);
        cacheManager.cacheFavorites(freshData as Record<string, Favorite>);
        eventName = 'favoritesUpdated';
        break;
      case 'searchHistory':
        freshData = await fetchFromApi<string[]>(`/api/searchhistory`);
        cacheManager.cacheSearchHistory(freshData as string[]);
        eventName = 'searchHistoryUpdated';
        break;
    }

    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: freshData,
      }),
    );
  } catch (refreshErr) {
    console.error(`刷新${dataType}缓存失败:`, refreshErr);
    triggerGlobalError(`刷新${dataType}缓存失败`);
  }
}

// ================================================================
// 泛型工厂函数
// ================================================================

/**
 * 模式A：缓存优先+后台同步（读操作）
 *
 * 流程：
 * 1. SSR 环境 → 返回 fallback
 * 2. 非 localstorage 模式：
 *    a. 有缓存 → 返回缓存，后台 fetchApi，有差异则更新缓存+dispatch
 *    b. 无缓存 → await fetchApi → 缓存 → 返回
 * 3. localstorage 模式 → 从 localStorage 读取
 */
export function createCacheFirstReader<T>(options: {
  getCached: () => T | null;
  setCached: (data: T) => void;
  fetchApi: () => Promise<T>;
  eventName: CacheUpdateEvent;
  localStorageKey: string;
  legacyKey?: string;
  fallback: T;
  /** 可选：自定义后台同步失败时是否调用 triggerGlobalError，默认 true */
  bgSyncErrorNotify?: boolean;
}): () => Promise<T> {
  const {
    getCached,
    setCached,
    fetchApi,
    eventName,
    localStorageKey,
    legacyKey,
    fallback,
    bgSyncErrorNotify = true,
  } = options;

  return async (): Promise<T> => {
    if (typeof window === 'undefined') {
      return fallback;
    }

    if (STORAGE_TYPE !== 'localstorage') {
      const cachedData = getCached();

      if (cachedData) {
        // 后台异步同步
        fetchApi()
          .then((freshData) => {
            if (JSON.stringify(cachedData) !== JSON.stringify(freshData)) {
              setCached(freshData);
              window.dispatchEvent(
                new CustomEvent(eventName, { detail: freshData }),
              );
            }
          })
          .catch((err) => {
            console.warn(`后台同步${eventName}失败:`, err);
            if (bgSyncErrorNotify) {
              triggerGlobalError(`后台同步${eventName}失败`);
            }
          });

        return cachedData;
      } else {
        try {
          const freshData = await fetchApi();
          setCached(freshData);
          return freshData;
        } catch (err) {
          console.error(`获取${eventName}失败:`, err);
          triggerGlobalError(`获取${eventName}失败`);
          return fallback;
        }
      }
    }

    // localStorage 模式
    try {
      const raw = getStorageValueWithLegacy(localStorageKey, legacyKey);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(`读取${eventName}失败:`, err);
      triggerGlobalError(`读取${eventName}失败`);
      return fallback;
    }
  };
}

/**
 * 模式B：乐观更新（写/删操作）
 *
 * 流程：
 * 1. 非 localstorage 模式：
 *    a. 读缓存 → mutateCached → 写回缓存 → dispatch → syncToServer
 *    b. 失败时由调用方决定是否 handleDatabaseOperationFailure
 * 2. localstorage 模式：
 *    a. 读 localStorage → mutateLocal → 写回 → dispatch
 */
export function createOptimisticWriter<TCache>(options: {
  getCached: () => TCache | null;
  setCached: (data: TCache) => void;
  eventName: CacheUpdateEvent;
  localStorageKey: string;
  legacyKey?: string;
  emptyCacheFactory: () => TCache;
}): (mutation: {
  mutateCached: (cached: TCache) => TCache;
  mutateLocal: (stored: TCache) => TCache;
  syncToServer: () => Promise<void>;
  eventDetail?: unknown;
  onServerError?: (err: unknown) => Promise<void>;
}) => Promise<void> {
  const {
    getCached,
    setCached,
    eventName,
    localStorageKey,
    legacyKey,
    emptyCacheFactory,
  } = options;

  return async (mutation): Promise<void> => {
    const {
      mutateCached,
      mutateLocal,
      syncToServer,
      eventDetail,
      onServerError,
    } = mutation;

    if (STORAGE_TYPE !== 'localstorage') {
      const cached = getCached() || emptyCacheFactory();
      const updated = mutateCached(cached);
      setCached(updated);

      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: eventDetail !== undefined ? eventDetail : updated,
        }),
      );

      try {
        await syncToServer();
      } catch (err) {
        if (onServerError) {
          await onServerError(err);
        }
        throw err;
      }
      return;
    }

    // localStorage 模式
    if (typeof window === 'undefined') return;

    try {
      const raw = getStorageValueWithLegacy(localStorageKey, legacyKey);
      const stored: TCache = raw
        ? (JSON.parse(raw) as TCache)
        : emptyCacheFactory();
      const updated = mutateLocal(stored);
      setStorageValueWithLegacyCleanup(
        localStorageKey,
        JSON.stringify(updated),
        legacyKey,
      );
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: eventDetail !== undefined ? eventDetail : updated,
        }),
      );
    } catch (err) {
      console.error(`${eventName}操作失败:`, err);
      triggerGlobalError(`${eventName}操作失败`);
      throw err;
    }
  };
}
