import { useRouter } from 'next/navigation';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8 } from '@/lib/hls-utils';

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
  onSourceChange?: (source: string, id: string, title: string) => void;
  precomputedVideoInfo?: Map<string, VideoInfo>;
}

export const SourcesTab: React.FC<SourcesTabProps> = ({
  availableSources,
  sourceSearchLoading,
  sourceSearchError,
  isActive = false,
  currentSource,
  currentId,
  videoTitle,
  onSourceChange,
  precomputedVideoInfo,
}) => {
  const router = useRouter();

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
      if (!source.episodes || source.episodes.length === 0) return;

      const episodeUrl = source.episodes[0];
      testingSourcesRef.current.add(sourceKey);

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

        const probePromise = getVideoResolutionFromM3u8(episodeUrl);
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
    [],
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
      // 无论成功或失败，都标记为已尝试，避免重复测速
      setAttemptedSources((prev) => {
        const newSet = new Set(prev);
        precomputedVideoInfo.forEach((_, key) => {
          newSet.add(key);
        });
        return newSet;
      });
      precomputedVideoInfo.forEach((_, key) => {
        attemptedSourcesRef.current.add(key);
      });
    }
  }, [precomputedVideoInfo]);

  // 异步获取视频信息
  useEffect(() => {
    const fetchVideoInfosInBatches = async () => {
      if (!isActive) return;
      if (availableSources.length === 0) return;

      const now = Date.now();
      for (const source of availableSources) {
        const sourceKey = `${source.source}-${source.id}`;
        const cached = videoInfoCache.get(sourceKey);
        if (cached && now - cached.ts < VIDEO_INFO_TTL_MS) {
          attemptedSourcesRef.current.add(sourceKey);
        }
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
  }, [availableSources, getVideoInfo, isActive]);

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

    const match = loadSpeed.match(/^([\d.]+)\s*(Mbps|KB\/s|MB\/s)$/i);
    if (!match) {
      return 0;
    }

    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }

    const unit = match[2].toLowerCase();
    if (unit === 'mbps') {
      return (value * 1024) / 8;
    }
    if (unit === 'mb/s') {
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
      <div className='flex items-center justify-center py-8 flex-1'>
        <div className='animate-spin rounded-full h-7 w-7 border-2 border-green-500 border-t-transparent'></div>
        <span className='ml-2.5 text-sm text-gray-500 dark:text-gray-400'>
          搜索中...
        </span>
      </div>
    );
  }

  if (sourceSearchError) {
    return (
      <div className='flex items-center justify-center py-8 flex-1'>
        <div className='text-center'>
          <div className='text-red-400 text-2xl mb-2'>⚠️</div>
          <p className='text-sm text-red-500 dark:text-red-400'>
            {sourceSearchError}
          </p>
        </div>
      </div>
    );
  }

  if (availableSources.length === 0) {
    return (
      <div className='flex items-center justify-center py-8 flex-1'>
        <div className='text-center'>
          <div className='text-gray-300 dark:text-gray-600 text-2xl mb-2'>
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
      className='flex-1 overflow-y-auto p-5 sm:p-6 pb-20'
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
              className={`flex flex-col gap-1.5 px-2.5 py-2 rounded-lg transition-all select-none duration-150 relative
                  ${
                    isCurrentSource
                      ? 'bg-green-50 dark:bg-green-500/10 ring-1 ring-green-500/30'
                      : 'bg-gray-50/80 dark:bg-white/[0.04] ring-1 ring-gray-200/60 dark:ring-white/[0.06] hover:bg-gray-100/80 dark:hover:bg-white/[0.08] hover:ring-gray-300/60 dark:hover:ring-white/[0.1] cursor-pointer'
                  }`.trim()}
            >
              {/* 标题行 */}
              <div className='flex items-center justify-between gap-1 min-w-0'>
                <div className='flex-1 min-w-0 relative group/title'>
                  <h3 className='font-medium text-xs truncate text-gray-900 dark:text-gray-100 leading-tight'>
                    {source.title}
                  </h3>
                  {index !== 0 && (
                    <div className='absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover/title:opacity-100 group-hover/title:visible transition-all duration-200 ease-out delay-100 whitespace-nowrap z-[500] pointer-events-none'>
                      {source.title}
                      <div className='absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800'></div>
                    </div>
                  )}
                </div>
                {/* 分辨率徽章（含占位，保持高度一致） */}
                {videoInfo && videoInfo.quality !== '未知' ? (
                  videoInfo.hasError ? (
                    <span className='inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400 flex-shrink-0'>
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
                          className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold flex-shrink-0 ${colorClasses}`}
                        >
                          {videoInfo.quality}
                        </span>
                      );
                    })()
                  )
                ) : optimizationEnabled ? (
                  <span className='inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium text-transparent flex-shrink-0'>
                    --
                  </span>
                ) : null}
              </div>

              {/* 源名称 + 集数 */}
              <div className='flex items-center justify-between gap-1'>
                <span className='text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400 font-medium truncate'>
                  {source.source_name}
                </span>
                {source.episodes.length > 1 && (
                  <span className='text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0'>
                    {source.episodes.length}集
                  </span>
                )}
              </div>

              {/* 网络信息（固定占位，避免测速前后高度跳变） */}
              <div className='flex items-center gap-2 min-h-[16px]'>
                {videoInfo && isTesting ? (
                  <div className='flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-medium'>
                    <span className='inline-block h-3 w-3 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin dark:border-gray-700 dark:border-t-green-400' />
                    检测中
                  </div>
                ) : videoInfo && !videoInfo.hasError ? (
                  <div className='flex items-center gap-1.5 text-[10px]'>
                    <span className='text-green-600 dark:text-green-400 font-medium'>
                      {videoInfo.loadSpeed}
                    </span>
                    <span className='text-orange-500 dark:text-orange-400 font-medium'>
                      {videoInfo.pingTime}ms
                    </span>
                  </div>
                ) : videoInfo && videoInfo.hasError ? (
                  <span
                    className='text-[10px] text-blue-400 dark:text-blue-400 cursor-pointer hover:underline'
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
                      : '未测速 · 重试'}
                  </span>
                ) : optimizationEnabled ? (
                  <div className='flex items-center gap-1.5 text-[10px]'>
                    <span className='text-gray-300 dark:text-gray-600 font-medium'>
                      --
                    </span>
                    <span className='text-gray-300 dark:text-gray-600 font-medium'>
                      --
                    </span>
                  </div>
                ) : null}
              </div>

              {/* 当前源标记 */}
              {isCurrentSource && (
                <div className='absolute top-1.5 right-1.5'>
                  <div className='w-1.5 h-1.5 rounded-full bg-green-500'></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className='flex-shrink-0 mt-6 pt-4 border-t border-gray-100 dark:border-white/[0.06]'>
        <button
          onClick={() => {
            if (videoTitle) {
              router.push(`/search?q=${encodeURIComponent(videoTitle)}`);
            }
          }}
          className='w-full text-center text-xs text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-green-400 transition-colors py-2'
        >
          影片匹配有误？点击去搜索
        </button>
      </div>
    </div>
  );
};
