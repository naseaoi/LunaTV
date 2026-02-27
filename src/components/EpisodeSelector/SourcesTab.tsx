import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8 } from '@/lib/hls-utils';
import { getProxyModes } from '@/lib/proxy-modes';
import { normalizeTitleForSourceMatch } from '@/lib/source_match';

interface VideoInfo {
  quality: string;
  loadSpeed: string;
  pingTime: number;
  hasError?: boolean;
}

const VIDEO_INFO_TTL_MS = 10 * 60_000;
const videoInfoCache = new Map<string, { info: VideoInfo; ts: number }>();
const inFlightVideoInfo = new Map<string, Promise<VideoInfo>>();

interface SourcesTabProps {
  availableSources: SearchResult[];
  sourceSearchLoading: boolean;
  sourceSearchError: string | null;
  isActive?: boolean;
  currentSource?: string;
  currentId?: string;
  videoTitle?: string;
  /** 搜索关键词（来自聚合搜索的原始关键词），用于"搜索更多源站"时扩大搜索范围 */
  searchKeyword?: string;
  onSourceChange?: (source: string, id: string, title: string) => void;
  precomputedVideoInfo?: Map<string, VideoInfo>;
  /** 测速前补全 detail 后，通知父组件更新 availableSources 中对应条目 */
  onSourceDetailFetched?: (updated: SearchResult) => void;
  /** 搜索到新源后，通知父组件追加到 availableSources */
  onAddSources?: (newSources: SearchResult[]) => void;
}

export const SourcesTab: React.FC<SourcesTabProps> = ({
  availableSources,
  sourceSearchLoading,
  sourceSearchError,
  isActive = false,
  currentSource,
  currentId,
  videoTitle,
  searchKeyword,
  onSourceChange,
  precomputedVideoInfo,
  onSourceDetailFetched,
  onAddSources,
}) => {
  const [videoInfoMap, setVideoInfoMap] = useState<Map<string, VideoInfo>>(
    new Map(),
  );
  const [attemptedSources, setAttemptedSources] = useState<Set<string>>(
    new Set(),
  );
  const attemptedSourcesRef = useRef<Set<string>>(new Set());
  const testingSourcesRef = useRef<Set<string>>(new Set());
  const currentItemRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    attemptedSourcesRef.current = attemptedSources;
  }, [attemptedSources]);

  const [optimizationEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('enableOptimization');
      if (saved !== null) {
        try {
          return JSON.parse(saved);
        } catch {
          /* ignore */
        }
      }
    }
    return true;
  });

  // 搜索更多源站
  const [isSearchingMore, setIsSearchingMore] = useState(false);
  const [searchMoreDone, setSearchMoreDone] = useState(false);
  // 检验全部
  const [isRetestingAll, setIsRetestingAll] = useState(false);

  // 进入换源 Tab 时：用缓存快速回填，确保立即显示已有测速结果
  useEffect(() => {
    if (!isActive || availableSources.length === 0) return;

    const now = Date.now();
    const cachedEntries: Array<[string, VideoInfo]> = [];
    const cachedKeys = new Set<string>();

    for (const source of availableSources) {
      const sourceKey = `${source.source}-${source.id}`;
      const cached = videoInfoCache.get(sourceKey);
      if (cached && now - cached.ts < VIDEO_INFO_TTL_MS) {
        cachedEntries.push([sourceKey, cached.info]);
        cachedKeys.add(sourceKey);
      }
    }

    if (cachedEntries.length === 0) return;

    setVideoInfoMap((prev) => {
      const next = new Map(prev);
      for (const [k, v] of cachedEntries) next.set(k, v);
      return next;
    });
    setAttemptedSources((prev) => {
      const next = new Set(prev);
      cachedKeys.forEach((k) => next.add(k));
      return next;
    });
    cachedKeys.forEach((k) => attemptedSourcesRef.current.add(k));
  }, [availableSources, isActive]);

  const getVideoInfo = useCallback(
    async (source: SearchResult, options?: { force?: boolean }) => {
      const sourceKey = `${source.source}-${source.id}`;
      const force = options?.force === true;

      if (force) {
        videoInfoCache.delete(sourceKey);
        attemptedSourcesRef.current.delete(sourceKey);
        setAttemptedSources((prev) => {
          const next = new Set(prev);
          next.delete(sourceKey);
          return next;
        });
      }

      const now = Date.now();
      const cached = force ? undefined : videoInfoCache.get(sourceKey);
      if (cached && now - cached.ts < VIDEO_INFO_TTL_MS) {
        setVideoInfoMap((prev) => new Map(prev).set(sourceKey, cached.info));
        setAttemptedSources((prev) => new Set(prev).add(sourceKey));
        attemptedSourcesRef.current.add(sourceKey);
        return;
      }

      if (!force && attemptedSourcesRef.current.has(sourceKey)) return;
      if (testingSourcesRef.current.has(sourceKey)) return;

      testingSourcesRef.current.add(sourceKey);

      // 立即写入"测量中..."临时状态，让 UI 显示"检测中"
      setVideoInfoMap((prev) =>
        new Map(prev).set(sourceKey, {
          quality: '未知',
          loadSpeed: '测量中...',
          pingTime: 0,
        }),
      );

      // episodes 为空（如 giri 搜索阶段的残缺数据），先调 detail 补全
      let resolvedSource = source;
      if (!source.episodes || source.episodes.length === 0) {
        try {
          const res = await fetch(
            `/api/detail?source=${source.source}&id=${source.id}`,
          );
          if (res.ok) {
            const full = (await res.json()) as SearchResult;
            if (full.episodes && full.episodes.length > 0) {
              resolvedSource = full;
              onSourceDetailFetched?.(full);
            }
          }
        } catch {
          // 补全失败
        }
        if (!resolvedSource.episodes || resolvedSource.episodes.length === 0) {
          // detail 补全失败，标记为已尝试并写入错误状态
          const info: VideoInfo = {
            quality: '未知',
            loadSpeed: '未知',
            pingTime: 0,
            hasError: true,
          };
          videoInfoCache.set(sourceKey, { info, ts: Date.now() });
          setVideoInfoMap((prev) => new Map(prev).set(sourceKey, info));
          setAttemptedSources((prev) => new Set(prev).add(sourceKey));
          attemptedSourcesRef.current.add(sourceKey);
          testingSourcesRef.current.delete(sourceKey);
          return;
        }
      }

      const episodeUrl = resolvedSource.episodes[0];

      try {
        const inflight = inFlightVideoInfo.get(sourceKey);
        if (inflight) {
          const info = await inflight;
          videoInfoCache.set(sourceKey, { info, ts: Date.now() });
          setVideoInfoMap((prev) => new Map(prev).set(sourceKey, info));
          setAttemptedSources((prev) => new Set(prev).add(sourceKey));
          attemptedSourcesRef.current.add(sourceKey);
          return;
        }

        const proxyModes = await getProxyModes();
        const useProxy = proxyModes[source.source] === 'server';
        const probePromise = getVideoResolutionFromM3u8(episodeUrl, useProxy);
        inFlightVideoInfo.set(sourceKey, probePromise);

        const info = await probePromise;
        videoInfoCache.set(sourceKey, { info, ts: Date.now() });
        setVideoInfoMap((prev) => new Map(prev).set(sourceKey, info));
        setAttemptedSources((prev) => new Set(prev).add(sourceKey));
        attemptedSourcesRef.current.add(sourceKey);
      } catch {
        const info: VideoInfo = {
          quality: '错误',
          loadSpeed: '未知',
          pingTime: 0,
          hasError: true,
        };
        videoInfoCache.set(sourceKey, { info, ts: Date.now() });
        setVideoInfoMap((prev) => new Map(prev).set(sourceKey, info));
        setAttemptedSources((prev) => new Set(prev).add(sourceKey));
        attemptedSourcesRef.current.add(sourceKey);
      } finally {
        inFlightVideoInfo.delete(sourceKey);
        testingSourcesRef.current.delete(sourceKey);
      }
    },
    [onSourceDetailFetched],
  );

  // 合并预计算结果
  useEffect(() => {
    if (precomputedVideoInfo && precomputedVideoInfo.size > 0) {
      setVideoInfoMap((prev) => {
        const newMap = new Map(prev);
        precomputedVideoInfo.forEach((v, k) => {
          newMap.set(k, v);
          videoInfoCache.set(k, { info: v, ts: Date.now() });
        });
        return newMap;
      });
      // 只把测速成功的标记为已尝试；hasError 的不标记，让后台测速 effect 自动重测
      setAttemptedSources((prev) => {
        const newSet = new Set(prev);
        precomputedVideoInfo.forEach((v, key) => {
          if (!v.hasError) {
            newSet.add(key);
            attemptedSourcesRef.current.add(key);
          }
        });
        return newSet;
      });
    }
  }, [precomputedVideoInfo]);

  // 异步获取视频信息（后台预检测，不依赖 Tab 是否激活）
  useEffect(() => {
    const fetchVideoInfosInBatches = async () => {
      if (availableSources.length === 0) return;

      const now = Date.now();
      for (const source of availableSources) {
        const sourceKey = `${source.source}-${source.id}`;
        const cached = videoInfoCache.get(sourceKey);
        if (cached && now - cached.ts < VIDEO_INFO_TTL_MS) {
          attemptedSourcesRef.current.add(sourceKey);
        }
      }

      // 当前正在播放的源跳过后台测速（播放器会通过 precomputedVideoInfo 回填真实数据）
      const currentKey =
        currentSource && currentId ? `${currentSource}-${currentId}` : '';
      if (currentKey) {
        attemptedSourcesRef.current.add(currentKey);
      }

      const pendingSources = availableSources.filter((source) => {
        const sourceKey = `${source.source}-${source.id}`;
        return !attemptedSourcesRef.current.has(sourceKey);
      });
      if (pendingSources.length === 0) return;

      const batchSize = Math.ceil(pendingSources.length / 2);
      for (let start = 0; start < pendingSources.length; start += batchSize) {
        const batch = pendingSources.slice(start, start + batchSize);
        await Promise.all(batch.map((source) => getVideoInfo(source)));
      }
    };
    fetchVideoInfosInBatches();
  }, [availableSources, getVideoInfo, currentSource, currentId]);

  const handleSourceClick = useCallback(
    (source: SearchResult) => {
      onSourceChange?.(source.source, source.id, source.title);
    },
    [onSourceChange],
  );

  const parseSpeedToKBps = (loadSpeed?: string): number => {
    if (!loadSpeed || loadSpeed === '未知' || loadSpeed === '测量中...') {
      return 0;
    }

    const match = loadSpeed.match(/^([\d.]+)\s*(Mbps|Mb\/s|KB\/s|MB\/s)$/);
    if (!match) {
      return 0;
    }

    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }

    const unit = match[2];
    if (unit === 'Mbps' || unit === 'Mb/s') {
      return (value * 1024) / 8;
    }
    if (unit === 'MB/s') {
      return value * 1024;
    }
    return value;
  };

  const getQualityRank = (quality?: string): number => {
    if (!quality || quality === '未知' || quality === '错误') {
      return 0;
    }

    const normalized = quality.toUpperCase();
    if (normalized.includes('4K') || normalized.includes('2160')) {
      return 5;
    }
    if (normalized.includes('2K') || normalized.includes('1440')) {
      return 4;
    }
    if (normalized.includes('1080')) {
      return 3;
    }
    if (normalized.includes('720')) {
      return 2;
    }
    if (normalized.includes('480')) {
      return 1;
    }
    return 0;
  };

  const sortedSources = useMemo(() => {
    return availableSources
      .map((source, index) => {
        const sourceKey = `${source.source}-${source.id}`;
        const videoInfo = videoInfoMap.get(sourceKey);
        const hasValidInfo = !!videoInfo && !videoInfo.hasError;

        return {
          source,
          index,
          qualityRank: hasValidInfo ? getQualityRank(videoInfo.quality) : 0,
          speedKBps: hasValidInfo ? parseSpeedToKBps(videoInfo.loadSpeed) : 0,
          pingTime:
            hasValidInfo && Number.isFinite(videoInfo.pingTime)
              ? videoInfo.pingTime
              : Number.MAX_SAFE_INTEGER,
          hasValidInfo,
        };
      })
      .sort((a, b) => {
        // 有有效数据的源优先于无数据的，但测速失败的不过度降权
        if (a.hasValidInfo !== b.hasValidInfo) {
          return a.hasValidInfo ? -1 : 1;
        }
        // 同为有效数据时，按速度 > 延迟 > 分辨率排序
        if (a.hasValidInfo && b.hasValidInfo) {
          if (a.speedKBps !== b.speedKBps) {
            return b.speedKBps - a.speedKBps;
          }
          if (a.pingTime !== b.pingTime) {
            return a.pingTime - b.pingTime;
          }
          if (a.qualityRank !== b.qualityRank) {
            return b.qualityRank - a.qualityRank;
          }
        }
        // 同组内保持原始顺序
        return a.index - b.index;
      })
      .map((item) => item.source);
  }, [availableSources, videoInfoMap]);

  useEffect(() => {
    if (!isActive) return;
    const listContainer = listContainerRef.current;
    const currentItem = currentItemRef.current;
    if (!listContainer || !currentItem) return;

    requestAnimationFrame(() => {
      const containerRect = listContainer.getBoundingClientRect();
      const itemRect = currentItem.getBoundingClientRect();
      const targetScrollTop =
        listContainer.scrollTop +
        (itemRect.top - containerRect.top) -
        listContainer.clientHeight / 2 +
        currentItem.clientHeight / 2;

      const maxScrollTop =
        listContainer.scrollHeight - listContainer.clientHeight;
      const nextScrollTop = Math.max(
        0,
        Math.min(targetScrollTop, maxScrollTop),
      );

      listContainer.scrollTo({
        top: nextScrollTop,
        behavior: 'smooth',
      });
    });
  }, [isActive, currentSource, currentId, sortedSources]);

  if (sourceSearchLoading) {
    return (
      <div className='flex flex-1 items-center justify-center py-8'>
        <div className='h-7 w-7 animate-spin rounded-full border-2 border-green-500 border-t-transparent'></div>
        <span className='ml-2.5 text-sm text-gray-500 dark:text-gray-400'>
          搜索中...
        </span>
      </div>
    );
  }

  if (sourceSearchError) {
    return (
      <div className='flex flex-1 items-center justify-center py-8'>
        <div className='text-center'>
          <div className='mb-2 text-2xl text-red-400'>⚠️</div>
          <p className='text-sm text-red-500 dark:text-red-400'>
            {sourceSearchError}
          </p>
        </div>
      </div>
    );
  }

  if (availableSources.length === 0) {
    return (
      <div className='flex flex-1 items-center justify-center py-8'>
        <div className='text-center'>
          <div className='mb-2 text-2xl text-gray-300 dark:text-gray-600'>
            📺
          </div>
          <p className='text-sm text-gray-500 dark:text-gray-400'>
            暂无可用的换源
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={listContainerRef}
      className='flex-1 overflow-y-auto p-5 pb-20 sm:p-6'
    >
      <div className='grid grid-cols-2 gap-2'>
        {sortedSources.map((source, index) => {
          const isCurrentSource =
            source.source?.toString() === currentSource?.toString() &&
            source.id?.toString() === currentId?.toString();
          const sourceKey = `${source.source}-${source.id}`;
          const videoInfo = videoInfoMap.get(sourceKey);
          const isTesting = videoInfo?.loadSpeed === '测量中...';

          return (
            <div
              key={sourceKey}
              ref={isCurrentSource ? currentItemRef : null}
              onClick={() => {
                if (!isCurrentSource) {
                  handleSourceClick(source);
                }
              }}
              className={`relative flex select-none flex-col gap-1.5 rounded-lg px-2.5 py-2 transition-all duration-150
                  ${
                    isCurrentSource
                      ? 'bg-green-50 ring-1 ring-green-500/30 dark:bg-green-500/10'
                      : 'cursor-pointer bg-gray-50/80 ring-1 ring-gray-200/60 hover:bg-gray-100/80 hover:ring-gray-300/60 dark:bg-white/[0.04] dark:ring-white/[0.06] dark:hover:bg-white/[0.08] dark:hover:ring-white/[0.1]'
                  }`.trim()}
            >
              {/* 标题行 */}
              <div className='flex min-w-0 items-center justify-between gap-1'>
                <div className='group/title relative min-w-0 flex-1'>
                  <h3 className='truncate text-xs font-medium leading-tight text-gray-900 dark:text-gray-100'>
                    {source.title}
                  </h3>
                  {index !== 0 && (
                    <div className='pointer-events-none invisible absolute bottom-full left-1/2 z-[500] mb-2 -translate-x-1/2 transform whitespace-nowrap rounded-md bg-gray-800 px-3 py-1 text-xs text-white opacity-0 shadow-lg transition-all delay-100 duration-200 ease-out group-hover/title:visible group-hover/title:opacity-100'>
                      {source.title}
                      <div className='absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 transform border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800'></div>
                    </div>
                  )}
                </div>
                {/* 分辨率徽章（含占位，保持高度一致） */}
                {videoInfo && videoInfo.quality !== '未知' ? (
                  videoInfo.hasError ? (
                    <span className='inline-flex flex-shrink-0 items-center rounded bg-red-50 px-1 py-0.5 text-[9px] font-medium text-red-500 dark:bg-red-900/20 dark:text-red-400'>
                      失败
                    </span>
                  ) : (
                    (() => {
                      const isUltraHigh = ['4K', '2K'].includes(
                        videoInfo.quality,
                      );
                      const isHigh = ['1080p', '720p'].includes(
                        videoInfo.quality,
                      );
                      const colorClasses = isUltraHigh
                        ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                        : isHigh
                          ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
                      return (
                        <span
                          className={`inline-flex flex-shrink-0 items-center rounded px-1 py-0.5 text-[9px] font-semibold ${colorClasses}`}
                        >
                          {videoInfo.quality}
                        </span>
                      );
                    })()
                  )
                ) : optimizationEnabled ? (
                  <span className='inline-flex flex-shrink-0 items-center rounded px-1 py-0.5 text-[9px] font-medium text-transparent'>
                    --
                  </span>
                ) : null}
              </div>

              {/* 源名称 + 集数 */}
              <div className='flex items-center justify-between gap-1'>
                <span className='truncate rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-white/[0.08] dark:text-gray-400'>
                  {source.source_name}
                </span>
                {source.episodes.length > 1 && (
                  <span className='flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500'>
                    {source.episodes.length}集
                  </span>
                )}
              </div>

              {/* 网络信息（固定占位，避免测速前后高度跳变） */}
              <div className='flex min-h-[16px] items-center gap-2'>
                {videoInfo && isTesting ? (
                  <div className='flex items-center gap-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400'>
                    <span className='inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-green-500 dark:border-gray-700 dark:border-t-green-400' />
                    检测中
                  </div>
                ) : videoInfo && !videoInfo.hasError ? (
                  <div className='flex items-center gap-1.5 text-[10px]'>
                    <span className='font-medium text-green-600 dark:text-green-400'>
                      {videoInfo.loadSpeed}
                    </span>
                    <span className='font-medium text-orange-500 dark:text-orange-400'>
                      {videoInfo.pingTime}ms
                    </span>
                  </div>
                ) : videoInfo && videoInfo.hasError ? (
                  <span
                    className='cursor-pointer text-[10px] text-blue-400 hover:underline dark:text-blue-400'
                    onClick={(e) => {
                      e.stopPropagation();

                      // 先给用户即时反馈：进入检测中态
                      setVideoInfoMap((prev) => {
                        const newMap = new Map(prev);
                        newMap.set(sourceKey, {
                          quality: '未知',
                          loadSpeed: '测量中...',
                          pingTime: 0,
                          hasError: true,
                        });
                        return newMap;
                      });
                      getVideoInfo(source, { force: true });
                    }}
                  >
                    {videoInfo.quality === '错误'
                      ? '检测失败 · 重试'
                      : '开始测速'}
                  </span>
                ) : optimizationEnabled ? (
                  <div className='flex items-center gap-1.5 text-[10px]'>
                    <span className='font-medium text-gray-300 dark:text-gray-600'>
                      --
                    </span>
                    <span className='font-medium text-gray-300 dark:text-gray-600'>
                      --
                    </span>
                  </div>
                ) : null}
              </div>

              {/* 当前源标记 */}
              {isCurrentSource && (
                <div className='absolute right-1.5 top-1.5'>
                  <div className='h-1.5 w-1.5 rounded-full bg-green-500'></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className='mt-6 flex-shrink-0 border-t border-gray-100 pt-4 dark:border-white/[0.06]'>
        <div className='flex gap-2'>
          <button
            disabled={isRetestingAll}
            onClick={async () => {
              setIsRetestingAll(true);
              // 清除所有缓存和已尝试标记
              for (const source of availableSources) {
                const key = `${source.source}-${source.id}`;
                videoInfoCache.delete(key);
                attemptedSourcesRef.current.delete(key);
              }
              setAttemptedSources(new Set());
              setVideoInfoMap(new Map());

              // 当前播放源标记为"播放中"
              const curKey =
                currentSource && currentId
                  ? `${currentSource}-${currentId}`
                  : '';
              if (curKey) {
                const playingInfo: VideoInfo = {
                  quality: '播放中',
                  loadSpeed: '播放中',
                  pingTime: 0,
                };
                videoInfoCache.set(curKey, {
                  info: playingInfo,
                  ts: Date.now(),
                });
                setVideoInfoMap((prev) =>
                  new Map(prev).set(curKey, playingInfo),
                );
                setAttemptedSources((prev) => new Set(prev).add(curKey));
                attemptedSourcesRef.current.add(curKey);
              }

              // 逐批重测（排除当前源）
              const toTest = availableSources.filter((s) => {
                const key = `${s.source}-${s.id}`;
                return key !== curKey;
              });
              const batchSize = Math.ceil(toTest.length / 2);
              for (let start = 0; start < toTest.length; start += batchSize) {
                const batch = toTest.slice(start, start + batchSize);
                await Promise.all(
                  batch.map((s) => getVideoInfo(s, { force: true })),
                );
              }
              setIsRetestingAll(false);
            }}
            className='flex-1 rounded-lg py-2 text-center text-xs font-medium text-gray-500 ring-1 ring-gray-200/60 transition-colors hover:text-green-600 hover:ring-green-300 disabled:opacity-50 dark:text-gray-400 dark:ring-white/[0.08] dark:hover:text-green-400 dark:hover:ring-green-500/30'
          >
            {isRetestingAll ? '检验中...' : '检验全部'}
          </button>
          <button
            disabled={isSearchingMore}
            onClick={async () => {
              if (!videoTitle) return;
              setIsSearchingMore(true);
              setSearchMoreDone(false);
              try {
                // 搜索时用 searchKeyword 扩大范围（如聚合搜索的原始关键词），
                // 过滤时始终用 videoTitle 精确匹配，避免混入同系列其他作品
                const query = searchKeyword || videoTitle;
                const res = await fetch(
                  `/api/search?q=${encodeURIComponent(query.trim())}`,
                );
                if (!res.ok) throw new Error('搜索失败');
                const data = await res.json();
                if (Array.isArray(data.results)) {
                  const existingKeys = new Set(
                    availableSources.map((s) => `${s.source}-${s.id}`),
                  );
                  const normalizedTitle = normalizeTitleForSourceMatch(
                    videoTitle || '',
                  );
                  const newSources = (data.results as SearchResult[]).filter(
                    (s) => {
                      if (existingKeys.has(`${s.source}-${s.id}`)) return false;
                      // 标题匹配过滤，避免追加无关结果
                      if (!normalizedTitle) return true;
                      const t = normalizeTitleForSourceMatch(s.title);
                      return t.length > 0 && t === normalizedTitle;
                    },
                  );
                  if (newSources.length > 0) {
                    onAddSources?.(newSources);
                  }
                  setSearchMoreDone(true);
                }
              } catch {
                // 静默失败
              } finally {
                setIsSearchingMore(false);
              }
            }}
            className='flex-1 rounded-lg py-2 text-center text-xs font-medium text-gray-500 ring-1 ring-gray-200/60 transition-colors hover:text-green-600 hover:ring-green-300 disabled:opacity-50 dark:text-gray-400 dark:ring-white/[0.08] dark:hover:text-green-400 dark:hover:ring-green-500/30'
          >
            {isSearchingMore
              ? '搜索中...'
              : searchMoreDone
                ? '搜索完成'
                : '搜索更多源站'}
          </button>
        </div>
      </div>
    </div>
  );
};
