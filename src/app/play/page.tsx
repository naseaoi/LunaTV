'use client';

import type Artplayer from 'artplayer';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import {
  deletePlayRecord,
  deleteSkipConfig,
  getSkipConfig,
  saveSkipConfig,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';
import { preloadProxyModes } from '@/lib/proxy-modes';

import { PlayMainContent } from '@/features/play/components/PlayMainContent';
import {
  PlayErrorView,
  PlayLoadingView,
} from '@/features/play/components/PlayStateViews';
import { useArtPlayer } from '@/features/play/hooks/useArtPlayer';
import { useKeyboardShortcuts } from '@/features/play/hooks/useKeyboardShortcuts';
import { usePlayFavorite } from '@/features/play/hooks/usePlayFavorite';
import { usePlayInit, updateVideoUrl } from '@/features/play/hooks/usePlayInit';
import { usePlayProgress } from '@/features/play/hooks/usePlayProgress';
import {
  AUTH_LOST_EVENT,
  SessionLostDetail,
  SessionLostReason,
  WakeLockSentinel,
} from '@/features/play/lib/playTypes';

function PlayPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 预热源站流量路由缓存
  useEffect(() => {
    preloadProxyModes();
  }, []);

  // ---------------------------------------------------------------------------
  // 状态变量
  // ---------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<
    'searching' | 'preferring' | 'fetching' | 'ready'
  >('searching');
  const [loadingMessage, setLoadingMessage] = useState('正在搜索播放源...');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SearchResult | null>(null);

  // 收藏状态
  const [favorited, setFavorited] = useState(false);

  // 跳过片头片尾配置
  const [skipConfig, setSkipConfig] = useState<{
    enable: boolean;
    intro_time: number;
    outro_time: number;
  }>({ enable: false, intro_time: 0, outro_time: 0 });
  const skipConfigRef = useRef(skipConfig);
  useEffect(() => {
    skipConfigRef.current = skipConfig;
  }, [
    skipConfig,
    skipConfig.enable,
    skipConfig.intro_time,
    skipConfig.outro_time,
  ]);

  // 跳过检查时间间隔控制
  const lastSkipCheckRef = useRef(0);

  // 去广告开关
  const [blockAdEnabled, setBlockAdEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('enable_blockad');
      if (v !== null) return v === 'true';
    }
    return true;
  });
  const blockAdEnabledRef = useRef(blockAdEnabled);
  useEffect(() => {
    blockAdEnabledRef.current = blockAdEnabled;
  }, [blockAdEnabled]);

  // 视频基本信息
  const [videoTitle, setVideoTitle] = useState(searchParams.get('title') || '');
  const [videoYear, setVideoYear] = useState(searchParams.get('year') || '');
  const [videoCover, setVideoCover] = useState('');
  const [videoDoubanId, setVideoDoubanId] = useState(0);
  const [currentSource, setCurrentSource] = useState(
    searchParams.get('source') || '',
  );
  const [currentId, setCurrentId] = useState(searchParams.get('id') || '');

  const [searchTitle] = useState(searchParams.get('stitle') || '');
  const [searchType] = useState(searchParams.get('stype') || '');

  const [needPrefer, setNeedPrefer] = useState(
    searchParams.get('prefer') === 'true',
  );
  const needPreferRef = useRef(needPrefer);
  useEffect(() => {
    needPreferRef.current = needPrefer;
  }, [needPrefer]);

  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);

  // Refs
  const currentSourceRef = useRef(currentSource);
  const currentIdRef = useRef(currentId);
  const videoTitleRef = useRef(videoTitle);
  const videoYearRef = useRef(videoYear);
  const detailRef = useRef<SearchResult | null>(detail);
  const currentEpisodeIndexRef = useRef(currentEpisodeIndex);

  useEffect(() => {
    currentSourceRef.current = currentSource;
    currentIdRef.current = currentId;
    detailRef.current = detail;
    currentEpisodeIndexRef.current = currentEpisodeIndex;
    videoTitleRef.current = videoTitle;
    videoYearRef.current = videoYear;
  }, [
    currentSource,
    currentId,
    detail,
    currentEpisodeIndex,
    videoTitle,
    videoYear,
  ]);

  // 视频播放地址
  const [videoUrl, setVideoUrl] = useState('');
  const totalEpisodes = detail?.episodes?.length || 0;

  // 播放恢复相关
  const resumeTimeRef = useRef<number | null>(null);
  const lastVolumeRef = useRef<number>(0.7);
  const lastPlaybackRateRef = useRef<number>(1.0);

  // 换源相关状态
  const [availableSources, setAvailableSources] = useState<SearchResult[]>([]);
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [sourceSearchError, setSourceSearchError] = useState<string | null>(
    null,
  );

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

  const [precomputedVideoInfo, setPrecomputedVideoInfo] = useState<
    Map<string, { quality: string; loadSpeed: string; pingTime: number }>
  >(new Map());

  const [isEpisodeSelectorCollapsed, setIsEpisodeSelectorCollapsed] =
    useState(false);

  // 换源加载状态
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoLoadingStage, setVideoLoadingStage] = useState<
    'initing' | 'sourceChanging'
  >('initing');
  const [realtimeLoadSpeed, setRealtimeLoadSpeed] =
    useState<string>('测速中...');
  const [authRecoveryVisible, setAuthRecoveryVisible] = useState(false);
  const [authRecoveryReason, setAuthRecoveryReason] =
    useState<SessionLostReason>('missing_cookie');
  const [authRecoveryLoginUrl, setAuthRecoveryLoginUrl] = useState('');

  // 播放进度保存相关
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);

  const artPlayerRef = useRef<Artplayer | null>(null);
  const artRef = useRef<HTMLDivElement | null>(null);

  // Wake Lock 相关
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // ---------------------------------------------------------------------------
  // 工具函数
  // ---------------------------------------------------------------------------

  // 清理播放器资源
  const cleanupPlayer = useCallback(() => {
    const player = artPlayerRef.current;
    artPlayerRef.current = null;
    if (player) {
      requestAnimationFrame(() => {
        try {
          if (player.video && player.video.hls) {
            player.video.hls.destroy();
          }
          player.destroy();
        } catch (err) {
          console.warn('清理播放器资源时出错:', err);
        }
      });
    }
  }, []);

  // 跳过片头片尾配置相关函数
  const handleSkipConfigChange = useCallback(
    async (newConfig: {
      enable: boolean;
      intro_time: number;
      outro_time: number;
    }) => {
      if (!currentSourceRef.current || !currentIdRef.current) return;

      try {
        setSkipConfig(newConfig);
        if (
          !newConfig.enable &&
          !newConfig.intro_time &&
          !newConfig.outro_time
        ) {
          await deleteSkipConfig(
            currentSourceRef.current,
            currentIdRef.current,
          );
          // Artplayer 的 setting.update 类型声明中 onSwitch 回调签名过于严格，
          // 但运行时只需读取 item.switch，使用类型断言以匹配 Setting 接口
          const updateSetting = artPlayerRef.current?.setting.update.bind(
            artPlayerRef.current.setting,
          );
          if (updateSetting) {
            updateSetting({
              name: '跳过片头片尾',
              html: '跳过片头片尾',
              switch: skipConfigRef.current.enable,
              onSwitch(item: { switch?: boolean }) {
                const cfg = { ...skipConfigRef.current, enable: !item.switch };
                handleSkipConfigChange(cfg);
                return !item.switch;
              },
            } as Parameters<typeof updateSetting>[0]);
            updateSetting({
              name: '设置片头',
              html: '设置片头',
              icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2" fill="#ffffff"/><path d="M9 12L17 12" stroke="#ffffff" stroke-width="2"/><path d="M17 6L17 18" stroke="#ffffff" stroke-width="2"/></svg>',
              tooltip:
                skipConfigRef.current.intro_time === 0
                  ? '设置片头时间'
                  : `${formatTimeSimple(skipConfigRef.current.intro_time)}`,
              onClick: function () {
                const currentTime = artPlayerRef.current?.currentTime || 0;
                if (currentTime > 0) {
                  const cfg = {
                    ...skipConfigRef.current,
                    intro_time: currentTime,
                  };
                  handleSkipConfigChange(cfg);
                  return `${formatTimeSimple(currentTime)}`;
                }
              },
            } as Parameters<typeof updateSetting>[0]);
            updateSetting({
              name: '设置片尾',
              html: '设置片尾',
              icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 6L7 18" stroke="#ffffff" stroke-width="2"/><path d="M7 12L15 12" stroke="#ffffff" stroke-width="2"/><circle cx="19" cy="12" r="2" fill="#ffffff"/></svg>',
              tooltip:
                skipConfigRef.current.outro_time >= 0
                  ? '设置片尾时间'
                  : `-${formatTimeSimple(-skipConfigRef.current.outro_time)}`,
              onClick: function () {
                const outroTime =
                  -(
                    (artPlayerRef.current?.duration ?? 0) -
                    (artPlayerRef.current?.currentTime ?? 0)
                  ) || 0;
                if (outroTime < 0) {
                  const cfg = {
                    ...skipConfigRef.current,
                    outro_time: outroTime,
                  };
                  handleSkipConfigChange(cfg);
                  return `-${formatTimeSimple(-outroTime)}`;
                }
              },
            } as Parameters<typeof updateSetting>[0]);
          }
        } else {
          await saveSkipConfig(
            currentSourceRef.current,
            currentIdRef.current,
            newConfig,
          );
        }
      } catch (err) {
        console.error('保存跳过片头片尾配置失败:', err);
      }
    },
    [],
  );

  // 当集数索引变化时自动更新视频地址
  useEffect(() => {
    updateVideoUrl(detail, currentEpisodeIndex, videoUrl, setVideoUrl);
  }, [detail, currentEpisodeIndex]);

  // ---------------------------------------------------------------------------
  // 初始化 hook
  // ---------------------------------------------------------------------------

  usePlayInit({
    currentSource,
    currentId,
    videoTitle,
    searchTitle,
    searchType,
    needPreferRef,
    videoTitleRef,
    videoYearRef,
    currentEpisodeIndex,
    optimizationEnabled,
    setLoading,
    setLoadingStage,
    setLoadingMessage,
    setError,
    setDetail,
    setCurrentSource,
    setCurrentId,
    setVideoTitle,
    setVideoYear,
    setVideoCover,
    setVideoDoubanId,
    setCurrentEpisodeIndex,
    setNeedPrefer,
    setAvailableSources,
    setSourceSearchLoading,
    setSourceSearchError,
    setPrecomputedVideoInfo,
  });

  // 跳过片头片尾配置处理
  useEffect(() => {
    const initSkipConfig = async () => {
      if (!currentSource || !currentId) return;
      try {
        const config = await getSkipConfig(currentSource, currentId);
        if (config) setSkipConfig(config);
      } catch (err) {
        console.error('读取跳过片头片尾配置失败:', err);
      }
    };
    initSkipConfig();
  }, []);

  // ---------------------------------------------------------------------------
  // 播放进度 hook
  // ---------------------------------------------------------------------------

  const {
    saveCurrentPlayProgress: doSaveCurrentProgress,
    savePlaybackCheckpoint: doSaveCheckpoint,
    requestWakeLock,
    releaseWakeLock,
  } = usePlayProgress({
    artPlayerRef,
    currentSourceRef,
    currentIdRef,
    videoTitleRef,
    detailRef,
    currentEpisodeIndexRef,
    resumeTimeRef,
    lastSaveTimeRef,
    saveIntervalRef,
    wakeLockRef,
    searchTitle,
    currentSource,
    currentId,
    currentEpisodeIndex,
    detail,
    setCurrentEpisodeIndex,
    cleanupPlayer,
  });

  // ---------------------------------------------------------------------------
  // 集数切换
  // ---------------------------------------------------------------------------

  const handleEpisodeChange = (episodeNumber: number) => {
    if (episodeNumber >= 0 && episodeNumber < totalEpisodes) {
      if (artPlayerRef.current && !artPlayerRef.current.playing) {
        doSaveCurrentProgress();
      }
      setIsVideoLoading(true);
      setVideoLoadingStage('sourceChanging');
      setCurrentEpisodeIndex(episodeNumber);
    }
  };

  const handlePreviousEpisode = useCallback(() => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx > 0) {
      if (artPlayerRef.current && artPlayerRef.current.playing) {
        doSaveCurrentProgress();
      }
      setCurrentEpisodeIndex(idx - 1);
    }
  }, [doSaveCurrentProgress]);

  const handleNextEpisode = useCallback(() => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx < d.episodes.length - 1) {
      if (artPlayerRef.current && artPlayerRef.current.playing) {
        doSaveCurrentProgress();
      }
      setCurrentEpisodeIndex(idx + 1);
    }
  }, [doSaveCurrentProgress]);

  // ---------------------------------------------------------------------------
  // 键盘快捷键 hook
  // ---------------------------------------------------------------------------

  useKeyboardShortcuts({
    artPlayerRef,
    detailRef,
    currentEpisodeIndexRef,
    handlePreviousEpisode,
    handleNextEpisode,
  });

  // ---------------------------------------------------------------------------
  // 收藏 hook
  // ---------------------------------------------------------------------------

  const { handleToggleFavorite } = usePlayFavorite({
    currentSource,
    currentId,
    searchTitle,
    videoTitleRef,
    detailRef,
    currentSourceRef,
    currentIdRef,
    favorited,
    setFavorited,
  });

  // ---------------------------------------------------------------------------
  // 认证恢复
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const onSessionLost = (event: Event) => {
      const customEvent = event as CustomEvent<SessionLostDetail>;
      const sessionDetail = customEvent.detail;
      if (!sessionDetail?.inPlayerPage) return;

      doSaveCheckpoint(sessionDetail.reason);

      setAuthRecoveryReason(sessionDetail.reason);
      setAuthRecoveryLoginUrl(sessionDetail.loginUrl);
      setAuthRecoveryVisible(true);
      setIsVideoLoading(false);
      setRealtimeLoadSpeed('');
    };

    window.addEventListener(AUTH_LOST_EVENT, onSessionLost as EventListener);
    return () => {
      window.removeEventListener(
        AUTH_LOST_EVENT,
        onSessionLost as EventListener,
      );
    };
  }, []);

  const getAuthRecoveryMessage = (reason: SessionLostReason) => {
    if (reason === 'user_banned')
      return '账号已被封禁，当前播放已保护。请联系管理员处理后重新登录。';
    if (reason === 'user_not_found')
      return '账号信息失效，当前播放已保护。请重新登录恢复观看。';
    return '登录状态已失效，当前播放进度已保护。重新登录后可自动回到当前位置。';
  };

  const handleReloginAndRecover = () => {
    const target =
      authRecoveryLoginUrl ||
      `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    window.location.href = target;
  };

  // ---------------------------------------------------------------------------
  // 换源
  // ---------------------------------------------------------------------------

  const handleSourceChange = async (
    newSource: string,
    newId: string,
    newTitle: string,
  ) => {
    try {
      setVideoLoadingStage('sourceChanging');
      setIsVideoLoading(true);
      setRealtimeLoadSpeed('测速中...');

      const currentPlayTime = artPlayerRef.current?.currentTime || 0;

      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deletePlayRecord(
            currentSourceRef.current,
            currentIdRef.current,
          );
        } catch (err) {
          console.error('清除播放记录失败:', err);
        }
      }

      if (currentSourceRef.current && currentIdRef.current) {
        try {
          await deleteSkipConfig(
            currentSourceRef.current,
            currentIdRef.current,
          );
          await saveSkipConfig(newSource, newId, skipConfigRef.current);
        } catch (err) {
          console.error('清除跳过片头片尾配置失败:', err);
        }
      }

      let newDetail = availableSources.find(
        (source) => source.source === newSource && source.id === newId,
      );
      if (!newDetail) {
        setError('未找到匹配结果');
        return;
      }

      // episodes 为空（如 giri 搜索阶段的残缺数据），补调 detail 获取完整信息
      if (!newDetail.episodes || newDetail.episodes.length === 0) {
        try {
          const detailRes = await fetch(
            `/api/detail?source=${newSource}&id=${newId}`,
          );
          if (detailRes.ok) {
            const fullDetail = (await detailRes.json()) as SearchResult;
            if (fullDetail.episodes && fullDetail.episodes.length > 0) {
              newDetail = fullDetail;
              // 同步更新 availableSources，后续切换/测速不再重复请求
              setAvailableSources((prev) =>
                prev.map((s) =>
                  s.source === newSource && s.id === newId ? fullDetail : s,
                ),
              );
            }
          }
        } catch (err) {
          console.error('换源补全详情失败:', err);
        }
      }

      // 使用 ref 获取最新集数索引，避免闭包捕获到过期的 state 值
      const latestEpisodeIndex = currentEpisodeIndexRef.current;
      let targetIndex = latestEpisodeIndex;
      if (!newDetail.episodes || targetIndex >= newDetail.episodes.length) {
        targetIndex = 0;
      }

      if (targetIndex !== latestEpisodeIndex) {
        resumeTimeRef.current = 0;
      } else if (
        (!resumeTimeRef.current || resumeTimeRef.current === 0) &&
        currentPlayTime > 1
      ) {
        resumeTimeRef.current = currentPlayTime;
      }

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', newSource);
      newUrl.searchParams.set('id', newId);
      newUrl.searchParams.set('year', newDetail.year);
      window.history.replaceState({}, '', newUrl.toString());

      setVideoTitle(newDetail.title || newTitle);
      setVideoYear(newDetail.year);
      setVideoCover(newDetail.poster);
      setVideoDoubanId(newDetail.douban_id || 0);
      setCurrentSource(newSource);
      setCurrentId(newId);
      setDetail(newDetail);
      setCurrentEpisodeIndex(targetIndex);
    } catch (err) {
      setIsVideoLoading(false);
      setRealtimeLoadSpeed('');
      setError(err instanceof Error ? err.message : '换源失败');
    }
  };

  // 测速补全 detail 后，同步更新 availableSources 中对应条目
  const handleSourceDetailFetched = useCallback((updated: SearchResult) => {
    setAvailableSources((prev) =>
      prev.map((s) =>
        s.source === updated.source && s.id === updated.id ? updated : s,
      ),
    );
  }, []);

  // 搜索更多源站后，追加到 availableSources（去重）
  const handleAddSources = useCallback((newSources: SearchResult[]) => {
    setAvailableSources((prev) => {
      const existingKeys = new Set(prev.map((s) => `${s.source}-${s.id}`));
      const unique = newSources.filter(
        (s) => !existingKeys.has(`${s.source}-${s.id}`),
      );
      return unique.length > 0 ? [...prev, ...unique] : prev;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Artplayer hook
  // ---------------------------------------------------------------------------

  useArtPlayer({
    artRef,
    artPlayerRef,
    videoUrl,
    videoCover,
    videoTitle,
    loading,
    detail,
    currentEpisodeIndex,
    totalEpisodes,
    blockAdEnabled,
    blockAdEnabledRef,
    skipConfigRef,
    resumeTimeRef,
    lastVolumeRef,
    lastPlaybackRateRef,
    lastSkipCheckRef,
    lastSaveTimeRef,
    detailRef,
    currentEpisodeIndexRef,
    wakeLockRef,
    setError,
    setIsVideoLoading,
    setIsPlaying,
    setRealtimeLoadSpeed,
    setBlockAdEnabled,
    setCurrentEpisodeIndex,
    handleNextEpisode,
    handleSkipConfigChange,
    saveCurrentPlayProgress: doSaveCurrentProgress,
    requestWakeLock,
    releaseWakeLock,
    cleanupPlayer,
    onCurrentSourceVideoInfo: useCallback(
      (info: { quality: string; loadSpeed: string; pingTime: number }) => {
        const src = currentSourceRef.current;
        const id = currentIdRef.current;
        if (!src || !id) return;
        const key = `${src}-${id}`;
        setPrecomputedVideoInfo((prev) => {
          const next = new Map(prev);
          next.set(key, info);
          return next;
        });
      },
      [],
    ),
  });

  // ---------------------------------------------------------------------------
  // 渲染
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <PlayLoadingView
        loadingStage={loadingStage}
        loadingMessage={loadingMessage}
        onBack={() => router.back()}
      />
    );
  }

  if (error) {
    return (
      <PlayErrorView
        error={error}
        videoTitle={videoTitle}
        onBack={() => window.history.back()}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <PlayMainContent
      videoTitle={videoTitle}
      totalEpisodes={totalEpisodes}
      detail={detail}
      currentEpisodeIndex={currentEpisodeIndex}
      isEpisodeSelectorCollapsed={isEpisodeSelectorCollapsed}
      setIsEpisodeSelectorCollapsed={setIsEpisodeSelectorCollapsed}
      artRef={artRef}
      isVideoLoading={isVideoLoading}
      isPlaying={isPlaying}
      videoLoadingStage={videoLoadingStage}
      realtimeLoadSpeed={realtimeLoadSpeed}
      authRecoveryVisible={authRecoveryVisible}
      authRecoveryReasonMessage={getAuthRecoveryMessage(authRecoveryReason)}
      onReloginAndRecover={handleReloginAndRecover}
      onDismissAuthRecovery={() => setAuthRecoveryVisible(false)}
      onEpisodeChange={handleEpisodeChange}
      onSourceChange={handleSourceChange}
      currentSource={currentSource}
      currentId={currentId}
      searchTitle={searchTitle}
      availableSources={availableSources}
      sourceSearchLoading={sourceSearchLoading}
      sourceSearchError={sourceSearchError}
      precomputedVideoInfo={precomputedVideoInfo}
      videoYear={videoYear}
      favorited={favorited}
      onToggleFavorite={handleToggleFavorite}
      videoCover={videoCover}
      videoDoubanId={videoDoubanId}
      onSourceDetailFetched={handleSourceDetailFetched}
      onAddSources={handleAddSources}
    />
  );
}

// 内部辅助函数（非 export，仅用于 handleSkipConfigChange 回调）
function formatTimeSimple(seconds: number): string {
  if (seconds === 0) return '00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (hours === 0) {
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlayPageClient />
    </Suspense>
  );
}
