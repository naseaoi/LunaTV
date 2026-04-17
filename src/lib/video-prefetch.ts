/**
 * 视频卡片 hover 预热工具
 *
 * 目的：用户在列表中悬停卡片时，提前加载进入播放页所需的资源：
 * - 视频详情 API（命中 SW json-api-cache，进入播放页秒开）
 * - 播放器模块 artplayer / hls.js（动态 import 预热）
 *
 * 去重：相同 source+id 只触发一次 detail 预取；播放器模块懒加载本身幂等。
 * 静默：所有失败都吞掉，不影响用户操作。
 */

import { preloadPlayerModules } from '@/lib/player-runtime';

// 已触发过 detail 预取的 key 集合（进程内）
const prefetchedDetails = new Set<string>();
const PREFETCH_DETAIL_MAX = 200;

// 超出上限时清理最早的一半，防内存无限膨胀
function trimIfNeeded() {
  if (prefetchedDetails.size <= PREFETCH_DETAIL_MAX) return;
  const iter = prefetchedDetails.values();
  const toRemove = Math.floor(PREFETCH_DETAIL_MAX / 2);
  for (let i = 0; i < toRemove; i++) {
    const next = iter.next();
    if (next.done) break;
    prefetchedDetails.delete(next.value);
  }
}

/**
 * 预取视频详情（仅非聚合、非直播、拥有 source+id 的卡片触发）
 */
export function prefetchVideoDetail(
  source: string | undefined,
  id: string | undefined,
): void {
  if (!source || !id) return;
  const key = `${source}::${id}`;
  if (prefetchedDetails.has(key)) return;
  prefetchedDetails.add(key);
  trimIfNeeded();

  // fire-and-forget；任何失败都不影响 UI
  fetch(
    `/api/detail?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`,
    { credentials: 'same-origin' },
  ).catch(() => {
    // 失败时移除标记，允许下次再试
    prefetchedDetails.delete(key);
  });
}

/**
 * 卡片 hover / focus 时调用：同时预取 detail 和预热播放器模块。
 */
export function warmupForPlayback(
  source: string | undefined,
  id: string | undefined,
): void {
  preloadPlayerModules();
  prefetchVideoDetail(source, id);
}
