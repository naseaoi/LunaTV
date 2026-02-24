'use client';

/**
 * 仅在浏览器端使用的数据库工具，目前基于 localStorage 实现。
 * 之所以单独拆分文件，是为了避免在客户端 bundle 中引入 `fs`, `path` 等 Node.js 内置模块，
 * 从而解决诸如 "Module not found: Can't resolve 'fs'" 的问题。
 *
 * 功能：
 * 1. 获取全部播放记录（getAllPlayRecords）。
 * 2. 保存播放记录（savePlayRecord）。
 * 3. 数据库存储模式下的混合缓存策略，提升用户体验。
 *
 * 如后续需要在客户端读取收藏等其它数据，可按同样方式在此文件中补充实现。
 */

import { getAuthInfoFromBrowserCookie } from './auth';
import { SkipConfig } from './types';

import {
  STORAGE_TYPE,
  cacheManager,
  fetchFromApi,
  fetchWithAuth,
  handleDatabaseOperationFailure,
  triggerGlobalError,
  getStorageValueWithLegacy,
  setStorageValueWithLegacyCleanup,
  createCacheFirstReader,
  createOptimisticWriter,
} from './db.client.helpers';

// ---- 类型 ----
export interface PlayRecord {
  title: string;
  source_name: string;
  year: string;
  cover: string;
  index: number; // 第几集
  total_episodes: number; // 总集数
  play_time: number; // 播放进度（秒）
  total_time: number; // 总进度（秒）
  save_time: number; // 记录保存时间（时间戳）
  search_title?: string; // 搜索时使用的标题
}

// ---- 收藏类型 ----
export interface Favorite {
  title: string;
  source_name: string;
  year: string;
  cover: string;
  total_episodes: number;
  save_time: number;
  search_title?: string;
  origin?: 'vod' | 'live';
}

// ---- 常量 ----
const PLAY_RECORDS_KEY = 'icetv_play_records';
const LEGACY_PLAY_RECORDS_KEY = 'moontv_play_records';
const FAVORITES_KEY = 'icetv_favorites';
const LEGACY_FAVORITES_KEY = 'moontv_favorites';
const SEARCH_HISTORY_KEY = 'icetv_search_history';
const LEGACY_SEARCH_HISTORY_KEY = 'moontv_search_history';
const SKIP_CONFIGS_KEY = 'icetv_skip_configs';
const LEGACY_SKIP_CONFIGS_KEY = 'moontv_skip_configs';

// 搜索历史最大保存条数
const SEARCH_HISTORY_LIMIT = 20;

/**
 * 生成存储key
 */
export function generateStorageKey(source: string, id: string): string {
  return `${source}+${id}`;
}

// ================================================================
// 模式A工厂实例：缓存优先+后台同步（读操作）
// ================================================================

const _getAllPlayRecords = createCacheFirstReader<Record<string, PlayRecord>>({
  getCached: () => cacheManager.getCachedPlayRecords(),
  setCached: (data) => cacheManager.cachePlayRecords(data),
  fetchApi: () => fetchFromApi<Record<string, PlayRecord>>(`/api/playrecords`),
  eventName: 'playRecordsUpdated',
  localStorageKey: PLAY_RECORDS_KEY,
  legacyKey: LEGACY_PLAY_RECORDS_KEY,
  fallback: {},
});

const _getSearchHistory = createCacheFirstReader<string[]>({
  getCached: () => cacheManager.getCachedSearchHistory(),
  setCached: (data) => cacheManager.cacheSearchHistory(data),
  fetchApi: () => fetchFromApi<string[]>(`/api/searchhistory`),
  eventName: 'searchHistoryUpdated',
  localStorageKey: SEARCH_HISTORY_KEY,
  legacyKey: LEGACY_SEARCH_HISTORY_KEY,
  fallback: [],
});

const _getAllFavorites = createCacheFirstReader<Record<string, Favorite>>({
  getCached: () => cacheManager.getCachedFavorites(),
  setCached: (data) => cacheManager.cacheFavorites(data),
  fetchApi: () => fetchFromApi<Record<string, Favorite>>(`/api/favorites`),
  eventName: 'favoritesUpdated',
  localStorageKey: FAVORITES_KEY,
  legacyKey: LEGACY_FAVORITES_KEY,
  fallback: {},
});

const _getAllSkipConfigs = createCacheFirstReader<Record<string, SkipConfig>>({
  getCached: () => cacheManager.getCachedSkipConfigs(),
  setCached: (data) => cacheManager.cacheSkipConfigs(data),
  fetchApi: () => fetchFromApi<Record<string, SkipConfig>>(`/api/skipconfigs`),
  eventName: 'skipConfigsUpdated',
  localStorageKey: SKIP_CONFIGS_KEY,
  legacyKey: LEGACY_SKIP_CONFIGS_KEY,
  fallback: {},
  bgSyncErrorNotify: false,
});

// ================================================================
// 模式B工厂实例：乐观更新（写/删操作）
// ================================================================

const _writePlayRecords = createOptimisticWriter<Record<string, PlayRecord>>({
  getCached: () => cacheManager.getCachedPlayRecords(),
  setCached: (data) => cacheManager.cachePlayRecords(data),
  eventName: 'playRecordsUpdated',
  localStorageKey: PLAY_RECORDS_KEY,
  legacyKey: LEGACY_PLAY_RECORDS_KEY,
  emptyCacheFactory: () => ({}),
});

const _writeFavorites = createOptimisticWriter<Record<string, Favorite>>({
  getCached: () => cacheManager.getCachedFavorites(),
  setCached: (data) => cacheManager.cacheFavorites(data),
  eventName: 'favoritesUpdated',
  localStorageKey: FAVORITES_KEY,
  legacyKey: LEGACY_FAVORITES_KEY,
  emptyCacheFactory: () => ({}),
});

const _writeSearchHistory = createOptimisticWriter<string[]>({
  getCached: () => cacheManager.getCachedSearchHistory(),
  setCached: (data) => cacheManager.cacheSearchHistory(data),
  eventName: 'searchHistoryUpdated',
  localStorageKey: SEARCH_HISTORY_KEY,
  legacyKey: LEGACY_SEARCH_HISTORY_KEY,
  emptyCacheFactory: () => [],
});

const _writeSkipConfigs = createOptimisticWriter<Record<string, SkipConfig>>({
  getCached: () => cacheManager.getCachedSkipConfigs(),
  setCached: (data) => cacheManager.cacheSkipConfigs(data),
  eventName: 'skipConfigsUpdated',
  localStorageKey: SKIP_CONFIGS_KEY,
  legacyKey: LEGACY_SKIP_CONFIGS_KEY,
  emptyCacheFactory: () => ({}),
});

// ================================================================
// 导出的业务函数
// ================================================================

// ---- 播放记录 ----

export async function getAllPlayRecords(): Promise<Record<string, PlayRecord>> {
  return _getAllPlayRecords();
}

export async function savePlayRecord(
  source: string,
  id: string,
  record: PlayRecord,
): Promise<void> {
  const key = generateStorageKey(source, id);
  return _writePlayRecords({
    mutateCached: (cached) => {
      cached[key] = record;
      return cached;
    },
    mutateLocal: (stored) => {
      stored[key] = record;
      return stored;
    },
    syncToServer: () =>
      fetchWithAuth('/api/playrecords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, record }),
      }).then(() => {}),
    onServerError: async (err) => {
      await handleDatabaseOperationFailure('playRecords', err);
      triggerGlobalError('保存播放记录失败');
    },
  });
}

export async function deletePlayRecord(
  source: string,
  id: string,
): Promise<void> {
  const key = generateStorageKey(source, id);
  return _writePlayRecords({
    mutateCached: (cached) => {
      delete cached[key];
      return cached;
    },
    mutateLocal: (stored) => {
      delete stored[key];
      return stored;
    },
    syncToServer: () =>
      fetchWithAuth(`/api/playrecords?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      }).then(() => {}),
    onServerError: async (err) => {
      await handleDatabaseOperationFailure('playRecords', err);
      triggerGlobalError('删除播放记录失败');
    },
  });
}

export async function clearAllPlayRecords(): Promise<void> {
  // 数据库模式
  if (STORAGE_TYPE !== 'localstorage') {
    cacheManager.cachePlayRecords({});
    window.dispatchEvent(new CustomEvent('playRecordsUpdated', { detail: {} }));
    try {
      await fetchWithAuth(`/api/playrecords`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      await handleDatabaseOperationFailure('playRecords', err);
      triggerGlobalError('清空播放记录失败');
      throw err;
    }
    return;
  }
  // localStorage 模式
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PLAY_RECORDS_KEY);
  localStorage.removeItem(LEGACY_PLAY_RECORDS_KEY);
  window.dispatchEvent(new CustomEvent('playRecordsUpdated', { detail: {} }));
}

// ---- 搜索历史 ----

export async function getSearchHistory(): Promise<string[]> {
  return _getSearchHistory();
}

export async function addSearchHistory(keyword: string): Promise<void> {
  const trimmed = keyword.trim();
  if (!trimmed) return;

  const buildNewHistory = (arr: string[]): string[] => {
    const newHistory = [trimmed, ...arr.filter((k) => k !== trimmed)];
    if (newHistory.length > SEARCH_HISTORY_LIMIT) {
      newHistory.length = SEARCH_HISTORY_LIMIT;
    }
    return newHistory;
  };

  // 数据库模式
  if (STORAGE_TYPE !== 'localstorage') {
    const cachedHistory = cacheManager.getCachedSearchHistory() || [];
    const newHistory = buildNewHistory(cachedHistory);
    cacheManager.cacheSearchHistory(newHistory);
    window.dispatchEvent(
      new CustomEvent('searchHistoryUpdated', { detail: newHistory }),
    );
    try {
      await fetchWithAuth('/api/searchhistory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: trimmed }),
      });
    } catch (err) {
      await handleDatabaseOperationFailure('searchHistory', err);
    }
    return;
  }

  // localStorage 模式
  if (typeof window === 'undefined') return;
  try {
    const history = await getSearchHistory();
    const newHistory = buildNewHistory(history);
    setStorageValueWithLegacyCleanup(
      SEARCH_HISTORY_KEY,
      JSON.stringify(newHistory),
      LEGACY_SEARCH_HISTORY_KEY,
    );
    window.dispatchEvent(
      new CustomEvent('searchHistoryUpdated', { detail: newHistory }),
    );
  } catch (err) {
    console.error('保存搜索历史失败:', err);
    triggerGlobalError('保存搜索历史失败');
  }
}

export async function clearSearchHistory(): Promise<void> {
  // 数据库模式
  if (STORAGE_TYPE !== 'localstorage') {
    cacheManager.cacheSearchHistory([]);
    window.dispatchEvent(
      new CustomEvent('searchHistoryUpdated', { detail: [] }),
    );
    try {
      await fetchWithAuth(`/api/searchhistory`, { method: 'DELETE' });
    } catch (err) {
      await handleDatabaseOperationFailure('searchHistory', err);
    }
    return;
  }
  // localStorage 模式
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SEARCH_HISTORY_KEY);
  localStorage.removeItem(LEGACY_SEARCH_HISTORY_KEY);
  window.dispatchEvent(new CustomEvent('searchHistoryUpdated', { detail: [] }));
}

export async function deleteSearchHistory(keyword: string): Promise<void> {
  const trimmed = keyword.trim();
  if (!trimmed) return;

  return _writeSearchHistory({
    mutateCached: (cached) => cached.filter((k) => k !== trimmed),
    mutateLocal: (stored) => stored.filter((k) => k !== trimmed),
    syncToServer: () =>
      fetchWithAuth(
        `/api/searchhistory?keyword=${encodeURIComponent(trimmed)}`,
        { method: 'DELETE' },
      ).then(() => {}),
    onServerError: async (err) => {
      await handleDatabaseOperationFailure('searchHistory', err);
    },
  });
}

// ---- 收藏 ----

export async function getAllFavorites(): Promise<Record<string, Favorite>> {
  return _getAllFavorites();
}

export async function saveFavorite(
  source: string,
  id: string,
  favorite: Favorite,
): Promise<void> {
  const key = generateStorageKey(source, id);
  return _writeFavorites({
    mutateCached: (cached) => {
      cached[key] = favorite;
      return cached;
    },
    mutateLocal: (stored) => {
      stored[key] = favorite;
      return stored;
    },
    syncToServer: () =>
      fetchWithAuth('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, favorite }),
      }).then(() => {}),
    onServerError: async (err) => {
      await handleDatabaseOperationFailure('favorites', err);
      triggerGlobalError('保存收藏失败');
    },
  });
}

export async function deleteFavorite(
  source: string,
  id: string,
): Promise<void> {
  const key = generateStorageKey(source, id);
  return _writeFavorites({
    mutateCached: (cached) => {
      delete cached[key];
      return cached;
    },
    mutateLocal: (stored) => {
      delete stored[key];
      return stored;
    },
    syncToServer: () =>
      fetchWithAuth(`/api/favorites?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      }).then(() => {}),
    onServerError: async (err) => {
      await handleDatabaseOperationFailure('favorites', err);
      triggerGlobalError('删除收藏失败');
    },
  });
}

export async function isFavorited(
  source: string,
  id: string,
): Promise<boolean> {
  const key = generateStorageKey(source, id);

  // 数据库模式：复用 getAllFavorites 的缓存优先逻辑（拉取全部再判断）
  if (STORAGE_TYPE !== 'localstorage') {
    const cachedFavorites = cacheManager.getCachedFavorites();

    if (cachedFavorites) {
      // 后台异步同步
      fetchFromApi<Record<string, Favorite>>(`/api/favorites`)
        .then((freshData) => {
          if (JSON.stringify(cachedFavorites) !== JSON.stringify(freshData)) {
            cacheManager.cacheFavorites(freshData);
            window.dispatchEvent(
              new CustomEvent('favoritesUpdated', { detail: freshData }),
            );
          }
        })
        .catch((err) => {
          console.warn('后台同步收藏失败:', err);
          triggerGlobalError('后台同步收藏失败');
        });

      return !!cachedFavorites[key];
    } else {
      try {
        const freshData =
          await fetchFromApi<Record<string, Favorite>>(`/api/favorites`);
        cacheManager.cacheFavorites(freshData);
        return !!freshData[key];
      } catch (err) {
        console.error('检查收藏状态失败:', err);
        triggerGlobalError('检查收藏状态失败');
        return false;
      }
    }
  }

  // localStorage 模式
  const allFavorites = await getAllFavorites();
  return !!allFavorites[key];
}

export async function clearAllFavorites(): Promise<void> {
  // 数据库模式
  if (STORAGE_TYPE !== 'localstorage') {
    cacheManager.cacheFavorites({});
    window.dispatchEvent(new CustomEvent('favoritesUpdated', { detail: {} }));
    try {
      await fetchWithAuth(`/api/favorites`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      await handleDatabaseOperationFailure('favorites', err);
      triggerGlobalError('清空收藏失败');
      throw err;
    }
    return;
  }
  // localStorage 模式
  if (typeof window === 'undefined') return;
  localStorage.removeItem(FAVORITES_KEY);
  localStorage.removeItem(LEGACY_FAVORITES_KEY);
  window.dispatchEvent(new CustomEvent('favoritesUpdated', { detail: {} }));
}

// ---- 跳过片头片尾配置 ----

export async function getSkipConfig(
  source: string,
  id: string,
): Promise<SkipConfig | null> {
  if (typeof window === 'undefined') return null;
  const key = generateStorageKey(source, id);
  const allConfigs = await _getAllSkipConfigs();
  return allConfigs[key] || null;
}

export async function getAllSkipConfigs(): Promise<Record<string, SkipConfig>> {
  return _getAllSkipConfigs();
}

export async function saveSkipConfig(
  source: string,
  id: string,
  config: SkipConfig,
): Promise<void> {
  const key = generateStorageKey(source, id);
  return _writeSkipConfigs({
    mutateCached: (cached) => {
      cached[key] = config;
      return cached;
    },
    mutateLocal: (stored) => {
      stored[key] = config;
      return stored;
    },
    syncToServer: () =>
      fetchWithAuth('/api/skipconfigs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, config }),
      }).then(() => {}),
    onServerError: async (err) => {
      console.error('保存跳过片头片尾配置失败:', err);
      triggerGlobalError('保存跳过片头片尾配置失败');
    },
  });
}

export async function deleteSkipConfig(
  source: string,
  id: string,
): Promise<void> {
  const key = generateStorageKey(source, id);
  return _writeSkipConfigs({
    mutateCached: (cached) => {
      delete cached[key];
      return cached;
    },
    mutateLocal: (stored) => {
      delete stored[key];
      return stored;
    },
    syncToServer: () =>
      fetchWithAuth(`/api/skipconfigs?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      }).then(() => {}),
    onServerError: async (err) => {
      console.error('删除跳过片头片尾配置失败:', err);
      triggerGlobalError('删除跳过片头片尾配置失败');
    },
  });
}

// ================================================================
// 混合缓存辅助函数
// ================================================================

export function clearUserCache(): void {
  if (STORAGE_TYPE !== 'localstorage') {
    cacheManager.clearUserCache();
  }
}

export async function refreshAllCache(): Promise<void> {
  if (STORAGE_TYPE === 'localstorage') return;

  try {
    const [playRecords, favorites, searchHistory, skipConfigs] =
      await Promise.allSettled([
        fetchFromApi<Record<string, PlayRecord>>(`/api/playrecords`),
        fetchFromApi<Record<string, Favorite>>(`/api/favorites`),
        fetchFromApi<string[]>(`/api/searchhistory`),
        fetchFromApi<Record<string, SkipConfig>>(`/api/skipconfigs`),
      ]);

    if (playRecords.status === 'fulfilled') {
      cacheManager.cachePlayRecords(playRecords.value);
      window.dispatchEvent(
        new CustomEvent('playRecordsUpdated', { detail: playRecords.value }),
      );
    }

    if (favorites.status === 'fulfilled') {
      cacheManager.cacheFavorites(favorites.value);
      window.dispatchEvent(
        new CustomEvent('favoritesUpdated', { detail: favorites.value }),
      );
    }

    if (searchHistory.status === 'fulfilled') {
      cacheManager.cacheSearchHistory(searchHistory.value);
      window.dispatchEvent(
        new CustomEvent('searchHistoryUpdated', {
          detail: searchHistory.value,
        }),
      );
    }

    if (skipConfigs.status === 'fulfilled') {
      cacheManager.cacheSkipConfigs(skipConfigs.value);
      window.dispatchEvent(
        new CustomEvent('skipConfigsUpdated', { detail: skipConfigs.value }),
      );
    }
  } catch (err) {
    console.error('刷新缓存失败:', err);
    triggerGlobalError('刷新缓存失败');
  }
}

export function getCacheStatus(): {
  hasPlayRecords: boolean;
  hasFavorites: boolean;
  hasSearchHistory: boolean;
  hasSkipConfigs: boolean;
  username: string | null;
} {
  if (STORAGE_TYPE === 'localstorage') {
    return {
      hasPlayRecords: false,
      hasFavorites: false,
      hasSearchHistory: false,
      hasSkipConfigs: false,
      username: null,
    };
  }

  const authInfo = getAuthInfoFromBrowserCookie();
  return {
    hasPlayRecords: !!cacheManager.getCachedPlayRecords(),
    hasFavorites: !!cacheManager.getCachedFavorites(),
    hasSearchHistory: !!cacheManager.getCachedSearchHistory(),
    hasSkipConfigs: !!cacheManager.getCachedSkipConfigs(),
    username: authInfo?.username || null,
  };
}

// ---- React Hook 辅助类型 ----

export type CacheUpdateEvent =
  | 'playRecordsUpdated'
  | 'favoritesUpdated'
  | 'searchHistoryUpdated'
  | 'skipConfigsUpdated';

export function subscribeToDataUpdates<T>(
  eventType: CacheUpdateEvent,
  callback: (data: T) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleUpdate = (event: CustomEvent) => {
    callback(event.detail);
  };

  window.addEventListener(eventType, handleUpdate as EventListener);

  return () => {
    window.removeEventListener(eventType, handleUpdate as EventListener);
  };
}

export async function preloadUserData(): Promise<void> {
  if (STORAGE_TYPE === 'localstorage') return;

  const status = getCacheStatus();
  if (
    status.hasPlayRecords &&
    status.hasFavorites &&
    status.hasSearchHistory &&
    status.hasSkipConfigs
  ) {
    return;
  }

  refreshAllCache().catch((err) => {
    console.warn('预加载用户数据失败:', err);
    triggerGlobalError('预加载用户数据失败');
  });
}
