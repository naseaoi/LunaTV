import { Dispatch, MutableRefObject, SetStateAction, useEffect } from 'react';

import { SearchResult } from '@/lib/types';
import { isServerProxy } from '@/lib/proxy-modes';
import {
  assignManagedVideoCleanup,
  createHlsLoaderClass,
  destroyManagedHls,
  getManagedVideo,
  getPlayerModules,
  prefetchM3U8,
  runManagedVideoCleanup,
} from '@/lib/player-runtime';
import {
  ensureVideoSource,
  formatTime,
  formatBytesPerSecond,
  createHlsConfig,
  createArtPlayerConfig,
  configureArtplayerStatics,
  handleHlsFatalError,
} from '@/lib/player-utils';

import { shouldDismissLoadingFromCanPlay } from '@/features/play/lib/playerLoading';
import { WakeLockSentinel } from '@/features/play/lib/playTypes';
import { filterAdsFromM3U8 } from '@/features/play/lib/playUtils';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface SkipConfig {
  enable: boolean;
  intro_time: number;
  outro_time: number;
}

export interface UseArtPlayerParams {
  artRef: MutableRefObject<HTMLDivElement | null>;
  artPlayerRef: MutableRefObject<Artplayer | null>;
  videoUrl: string;
  videoCover: string;
  videoTitle: string;
  loading: boolean;
  detail: SearchResult | null;
  currentEpisodeIndex: number;
  totalEpisodes: number;
  blockAdEnabled: boolean;
  blockAdEnabledRef: MutableRefObject<boolean>;
  skipConfigRef: MutableRefObject<SkipConfig>;
  resumeTimeRef: MutableRefObject<number | null>;
  lastVolumeRef: MutableRefObject<number>;
  lastPlaybackRateRef: MutableRefObject<number>;
  lastSkipCheckRef: MutableRefObject<number>;
  lastSaveTimeRef: MutableRefObject<number>;
  detailRef: MutableRefObject<SearchResult | null>;
  currentEpisodeIndexRef: MutableRefObject<number>;
  wakeLockRef: MutableRefObject<WakeLockSentinel | null>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsVideoLoading: Dispatch<SetStateAction<boolean>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setRealtimeLoadSpeed: Dispatch<SetStateAction<string>>;
  setBlockAdEnabled: Dispatch<SetStateAction<boolean>>;
  setCurrentEpisodeIndex: Dispatch<SetStateAction<number>>;
  handleNextEpisode: () => void;
  handleSkipConfigChange: (newConfig: SkipConfig) => Promise<void>;
  saveCurrentPlayProgress: () => void;
  requestWakeLock: () => Promise<void>;
  releaseWakeLock: () => Promise<void>;
  cleanupPlayer: () => void;
  onPlaybackStarted?: () => void;
  /** 播放器收集到当前源的测速数据后回调（速度+分辨率+延迟） */
  onCurrentSourceVideoInfo?: (info: {
    quality: string;
    loadSpeed: string;
    pingTime: number;
  }) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useArtPlayer(params: UseArtPlayerParams) {
  const {
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
    setError,
    setIsVideoLoading,
    setIsPlaying,
    setRealtimeLoadSpeed,
    setBlockAdEnabled,
    setCurrentEpisodeIndex,
    handleNextEpisode,
    handleSkipConfigChange,
    saveCurrentPlayProgress,
    requestWakeLock,
    releaseWakeLock,
    cleanupPlayer,
    onPlaybackStarted,
    onCurrentSourceVideoInfo,
  } = params;

  // --- 主 useEffect ---

  useEffect(() => {
    if (
      !videoUrl ||
      loading ||
      currentEpisodeIndex === null ||
      !artRef.current
    ) {
      return;
    }

    if (
      !detail ||
      !detail.episodes ||
      currentEpisodeIndex >= detail.episodes.length ||
      currentEpisodeIndex < 0
    ) {
      setError(`选集索引无效，当前共 ${totalEpisodes} 集`);
      return;
    }

    if (!videoUrl) {
      setError('视频地址无效');
      return;
    }

    let cancelled = false;

    const initPlayer = async () => {
      try {
        // 预取 m3u8 清单（与模块加载并行），填充服务端缓存
        const preSourceKey = detailRef.current?.source || '';
        const preUseProxy = isServerProxy(preSourceKey);
        const preM3u8Url = preUseProxy
          ? `/api/proxy/m3u8?url=${encodeURIComponent(videoUrl)}`
          : `/api/proxy/m3u8?url=${encodeURIComponent(videoUrl)}&allowCORS=true`;
        prefetchM3U8(preM3u8Url);

        const { Artplayer, Hls } = await getPlayerModules();
        if (cancelled || !artRef.current) return;

        const isWebkit =
          typeof window !== 'undefined' &&
          typeof (window as unknown as Record<string, unknown>)
            .webkitConvertPointFromNodeToPage === 'function';

        // 非WebKit浏览器且播放器已存在，使用switch方法切换
        if (!isWebkit && artPlayerRef.current) {
          artPlayerRef.current.switch = videoUrl;
          artPlayerRef.current.title = `${videoTitle} - 第${currentEpisodeIndex + 1}集`;
          if (artPlayerRef.current?.video) {
            ensureVideoSource(
              artPlayerRef.current.video as HTMLVideoElement,
              videoUrl,
            );
          }
          return;
        }

        // WebKit浏览器或首次创建
        if (artPlayerRef.current) {
          cleanupPlayer();
        }

        const AdBlockingHlsLoader = createHlsLoaderClass(
          Hls.DefaultConfig.loader as unknown as new (config: unknown) => {
            load: (...args: unknown[]) => void;
          },
          {
            transformManifestText: (content) => filterAdsFromM3U8(content),
          },
        );

        configureArtplayerStatics(Artplayer);
        Artplayer.PLAYBACK_RATE = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

        artPlayerRef.current = new Artplayer({
          container: artRef.current,
          url: videoUrl,
          ...createArtPlayerConfig({
            isLive: false,
            setting: true,
            playbackRate: true,
            fastForward: true,
          }),
          customType: {
            m3u8: function (video: HTMLVideoElement, url: string) {
              if (!Hls) {
                console.error('HLS.js 未加载');
                return;
              }

              const managedVideo = getManagedVideo(video);

              runManagedVideoCleanup(managedVideo);

              // 切集复用：loader 配置未变时跳过 HLS 销毁重建，直接切换源
              const currentBlockAd = blockAdEnabledRef.current;
              const existingHls = managedVideo.hls;
              const canReuseHls =
                !!existingHls && managedVideo.__icetvBlockAd === currentBlockAd;

              let hls: any;
              if (canReuseHls) {
                hls = existingHls;
                // 移除旧的 HLS 事件监听器，后续重新绑定新的
                const oldHandlers = managedVideo.__icetvHlsHandlers;
                if (oldHandlers) {
                  hls.off(Hls.Events.ERROR, oldHandlers.onError);
                  hls.off(Hls.Events.FRAG_LOADED, oldHandlers.onFragLoaded);
                }
              } else {
                destroyManagedHls(managedVideo);
                hls = new Hls({
                  ...createHlsConfig({
                    maxBufferLength: 30,
                    maxMaxBufferLength: 120,
                    backBufferLength: 30,
                  }),
                  loader: currentBlockAd
                    ? (AdBlockingHlsLoader as unknown as typeof Hls.DefaultConfig.loader)
                    : Hls.DefaultConfig.loader,
                });
              }
              managedVideo.__icetvBlockAd = currentBlockAd;

              // 根据源站流量路由配置决定是否走服务端代理
              const sourceKey = detailRef.current?.source || '';
              const useServerProxy = isServerProxy(sourceKey);
              const targetUrl = useServerProxy
                ? `/api/proxy/m3u8?url=${encodeURIComponent(url)}`
                : `/api/proxy/m3u8?url=${encodeURIComponent(url)}&allowCORS=true`;

              setRealtimeLoadSpeed('测速中...');

              // 收集首分片测速数据，回填给 SourcesTab
              let firstFragSpeed = '';
              let firstFragPing = 0;
              let videoInfoReported = false;
              const fragLoadStart = performance.now();

              const speedFallbackTimer = setTimeout(() => {
                setRealtimeLoadSpeed((prev) =>
                  prev === '测速中...' ? '0 KB/s' : prev,
                );
              }, 5000);

              let lastStallRecoveryAt = 0;

              const getBufferedRanges = () => {
                const ranges: Array<[number, number]> = [];
                for (let i = 0; i < video.buffered.length; i += 1) {
                  ranges.push([video.buffered.start(i), video.buffered.end(i)]);
                }
                return ranges;
              };

              const tryRecoverPlaybackStall = (
                reason: 'waiting' | 'stalled',
              ) => {
                if (video.paused || video.ended) {
                  return;
                }

                const currentTime = video.currentTime || 0;
                const ranges = getBufferedRanges();
                const activeRange = ranges.find(
                  ([start, end]) => currentTime >= start && currentTime < end,
                );
                const nextRange = ranges.find(([start]) => start > currentTime);
                const bufferedAhead = activeRange
                  ? activeRange[1] - currentTime
                  : 0;
                const gapToNext = nextRange
                  ? nextRange[0] - (activeRange ? activeRange[1] : currentTime)
                  : null;

                console.warn('检测到点播播放卡顿，尝试恢复', {
                  reason,
                  currentTime: Number(currentTime.toFixed(2)),
                  readyState: video.readyState,
                  networkState: video.networkState,
                  bufferedAhead: Number(bufferedAhead.toFixed(2)),
                  gapToNext:
                    gapToNext === null ? null : Number(gapToNext.toFixed(2)),
                  bufferedRanges: ranges.map(([start, end]) => [
                    Number(start.toFixed(2)),
                    Number(end.toFixed(2)),
                  ]),
                });

                const now = Date.now();
                if (now - lastStallRecoveryAt < 1500) {
                  return;
                }
                lastStallRecoveryAt = now;

                if (bufferedAhead > 1.5) {
                  video.currentTime = Math.min(
                    currentTime + 0.1,
                    activeRange ? activeRange[1] - 0.05 : currentTime + 0.1,
                  );
                  return;
                }

                if (
                  nextRange &&
                  gapToNext !== null &&
                  gapToNext > 0 &&
                  gapToNext <= 1
                ) {
                  video.currentTime = nextRange[0] + 0.05;
                  return;
                }

                hls.startLoad();
              };

              const onWaiting = () => {
                tryRecoverPlaybackStall('waiting');
              };
              const onStalled = () => {
                tryRecoverPlaybackStall('stalled');
              };

              let videoRuntimeCleaned = false;
              const cleanupVideoRuntime = () => {
                if (videoRuntimeCleaned) return;
                videoRuntimeCleaned = true;
                clearTimeout(speedFallbackTimer);
                video.removeEventListener('waiting', onWaiting);
                video.removeEventListener('stalled', onStalled);
                video.removeEventListener('loadeddata', tryReportVideoInfo);
              };

              assignManagedVideoCleanup(video, cleanupVideoRuntime);
              video.addEventListener('waiting', onWaiting);
              video.addEventListener('stalled', onStalled);

              // 首帧解码后收集分辨率，与首分片速度合并回填
              const tryReportVideoInfo = () => {
                if (videoInfoReported || !firstFragSpeed) return;
                const w = video.videoWidth;
                if (!w || w <= 0) return;
                videoInfoReported = true;
                const quality =
                  w >= 3840
                    ? '4K'
                    : w >= 2560
                      ? '2K'
                      : w >= 1920
                        ? '1080p'
                        : w >= 1280
                          ? '720p'
                          : w >= 854
                            ? '480p'
                            : 'SD';
                onCurrentSourceVideoInfo?.({
                  quality,
                  loadSpeed: firstFragSpeed,
                  pingTime: firstFragPing,
                });
              };

              const onHlsError = function (_event: unknown, data: any) {
                console.error('HLS Error:', _event, data);
                if (data.fatal) {
                  handleHlsFatalError(
                    {
                      startLoad: () => hls.startLoad(),
                      recoverMediaError: () => hls.recoverMediaError(),
                      destroy: () => {
                        cleanupVideoRuntime();
                        hls.destroy();
                        if (managedVideo.hls === hls) {
                          managedVideo.hls = null;
                          managedVideo.__icetvHlsHandlers = null;
                        }
                      },
                    },
                    data.type,
                    Hls.ErrorTypes,
                  );
                }
              };
              const onHlsFragLoaded = function (_: unknown, data: any) {
                clearTimeout(speedFallbackTimer);
                const stats = data.frag.stats;
                const loadedBytes = stats.loaded ?? stats.total ?? 0;
                const startTime = stats.loading.first ?? 0;
                const endTime = stats.loading.end ?? 0;
                const elapsedMs = endTime > startTime ? endTime - startTime : 0;
                if (loadedBytes > 0 && elapsedMs > 0) {
                  const bytesPerSecond = loadedBytes / (elapsedMs / 1000);
                  const speedStr = formatBytesPerSecond(bytesPerSecond);
                  setRealtimeLoadSpeed(speedStr);
                  // 收集首分片速度用于回填 SourcesTab
                  if (!firstFragSpeed) {
                    firstFragSpeed = speedStr;
                    firstFragPing = Math.round(
                      performance.now() - fragLoadStart,
                    );
                    tryReportVideoInfo();
                  }
                } else if (loadedBytes > 0) {
                  setRealtimeLoadSpeed('0 KB/s');
                }
              };

              hls.on(Hls.Events.ERROR, onHlsError);
              hls.on(Hls.Events.FRAG_LOADED, onHlsFragLoaded);
              // 保存处理器引用，复用时移除
              managedVideo.__icetvHlsHandlers = {
                onError: onHlsError,
                onFragLoaded: onHlsFragLoaded,
              };

              video.addEventListener('loadeddata', tryReportVideoInfo);

              hls.loadSource(targetUrl);
              if (!canReuseHls) {
                hls.attachMedia(video);
              }
              managedVideo.hls = hls;
              ensureVideoSource(video, targetUrl);
            },
          },
          settings: [
            {
              html: '去广告',
              icon: '<text x="50%" y="50%" font-size="20" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="#ffffff">AD</text>',
              tooltip: blockAdEnabled ? '已开启' : '已关闭',
              onClick() {
                const newVal = !blockAdEnabled;
                try {
                  localStorage.setItem('enable_blockad', String(newVal));
                  if (artPlayerRef.current) {
                    resumeTimeRef.current = artPlayerRef.current.currentTime;
                    const managedVideo = artPlayerRef.current.video;
                    runManagedVideoCleanup(managedVideo);
                    destroyManagedHls(managedVideo);
                    artPlayerRef.current.destroy();
                    artPlayerRef.current = null;
                  }
                  setBlockAdEnabled(newVal);
                } catch (_) {
                  // ignore
                }
                return newVal ? '当前开启' : '当前关闭';
              },
            },
            {
              name: '跳过片头片尾',
              html: '跳过片头片尾',
              switch: skipConfigRef.current.enable,
              onSwitch: function (item: { switch?: boolean }) {
                const newConfig = {
                  ...skipConfigRef.current,
                  enable: !item.switch,
                };
                handleSkipConfigChange(newConfig);
                return !item.switch;
              },
            },
            {
              html: '删除跳过配置',
              onClick: function () {
                handleSkipConfigChange({
                  enable: false,
                  intro_time: 0,
                  outro_time: 0,
                });
                return '';
              },
            },
            {
              name: '设置片头',
              html: '设置片头',
              icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="12" r="2" fill="#ffffff"/><path d="M9 12L17 12" stroke="#ffffff" stroke-width="2"/><path d="M17 6L17 18" stroke="#ffffff" stroke-width="2"/></svg>',
              tooltip:
                skipConfigRef.current.intro_time === 0
                  ? '设置片头时间'
                  : `${formatTime(skipConfigRef.current.intro_time)}`,
              onClick: function () {
                const currentTime = artPlayerRef.current?.currentTime || 0;
                if (currentTime > 0) {
                  const newConfig = {
                    ...skipConfigRef.current,
                    intro_time: currentTime,
                  };
                  handleSkipConfigChange(newConfig);
                  return `${formatTime(currentTime)}`;
                }
              },
            },
            {
              name: '设置片尾',
              html: '设置片尾',
              icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 6L7 18" stroke="#ffffff" stroke-width="2"/><path d="M7 12L15 12" stroke="#ffffff" stroke-width="2"/><circle cx="19" cy="12" r="2" fill="#ffffff"/></svg>',
              tooltip:
                skipConfigRef.current.outro_time >= 0
                  ? '设置片尾时间'
                  : `-${formatTime(-skipConfigRef.current.outro_time)}`,
              onClick: function () {
                const outroTime =
                  -(
                    (artPlayerRef.current?.duration ?? 0) -
                    (artPlayerRef.current?.currentTime ?? 0)
                  ) || 0;
                if (outroTime < 0) {
                  const newConfig = {
                    ...skipConfigRef.current,
                    outro_time: outroTime,
                  };
                  handleSkipConfigChange(newConfig);
                  return `-${formatTime(-outroTime)}`;
                }
              },
            },
          ],
          controls: [
            {
              position: 'left',
              index: 13,
              html: '<i class="art-icon flex"><svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" fill="currentColor"/></svg></i>',
              tooltip: '播放下一集',
              click: function () {
                handleNextEpisode();
              },
            },
          ],
        });

        const player = artPlayerRef.current;
        if (!player) {
          return;
        }

        // --- 播放器事件 ---

        player.on('ready', () => {
          setError(null);
          if (player.playing) {
            requestWakeLock();
          }
        });

        player.on('play', () => {
          requestWakeLock();
          setIsPlaying(true);
        });

        // 备用：playing 事件表示视频已真正开始渲染帧，
        // 某些 HLS 流 canplay 可能不触发，用 playing 兜底清除 loading
        player.on('video:playing', () => {
          setIsVideoLoading(false);
          setRealtimeLoadSpeed('');
          onPlaybackStarted?.();
        });

        player.on('pause', () => {
          releaseWakeLock();
          saveCurrentPlayProgress();
          setIsPlaying(false);
        });

        player.on('video:ended', () => {
          releaseWakeLock();
          setIsPlaying(false);
        });

        if (player.playing) {
          requestWakeLock();
        }

        player.on('video:volumechange', () => {
          lastVolumeRef.current = player.volume;
        });

        player.on('video:ratechange', () => {
          lastPlaybackRateRef.current = player.playbackRate as number;
        });

        player.on('video:canplay', () => {
          if (resumeTimeRef.current && resumeTimeRef.current > 0) {
            try {
              const duration = player.duration || 0;
              let target = resumeTimeRef.current;
              if (duration && target >= duration - 2)
                target = Math.max(0, duration - 5);
              player.currentTime = target;
            } catch (err) {
              console.warn('恢复播放进度失败:', err);
            }
          }
          resumeTimeRef.current = null;

          setTimeout(() => {
            if (Math.abs(player.volume - lastVolumeRef.current) > 0.01) {
              player.volume = lastVolumeRef.current;
            }
            if (
              Math.abs(
                (player.playbackRate as number) - lastPlaybackRateRef.current,
              ) > 0.01 &&
              isWebkit
            ) {
              player.playbackRate = lastPlaybackRateRef.current as
                | 0.5
                | 0.75
                | 1
                | 1.25
                | 1.5
                | 1.75
                | 2;
            }
            player.notice.show = '';
          }, 0);

          if (shouldDismissLoadingFromCanPlay(player.video)) {
            setIsVideoLoading(false);
            setRealtimeLoadSpeed('');
            onPlaybackStarted?.();
          }
        });

        // 跳过片头片尾
        player.on('video:timeupdate', () => {
          if (!skipConfigRef.current.enable) return;

          const currentTime = player.currentTime || 0;
          const duration = player.duration || 0;
          const now = Date.now();

          if (now - lastSkipCheckRef.current < 1500) return;
          lastSkipCheckRef.current = now;

          if (
            skipConfigRef.current.intro_time > 0 &&
            currentTime < skipConfigRef.current.intro_time
          ) {
            player.currentTime = skipConfigRef.current.intro_time;
            player.notice.show = `已跳过片头 (${formatTime(skipConfigRef.current.intro_time)})`;
          }

          if (
            skipConfigRef.current.outro_time < 0 &&
            duration > 0 &&
            currentTime > player.duration + skipConfigRef.current.outro_time
          ) {
            if (
              currentEpisodeIndexRef.current <
              (detailRef.current?.episodes?.length || 1) - 1
            ) {
              handleNextEpisode();
            } else {
              player.pause();
            }
            player.notice.show = `已跳过片尾 (${formatTime(skipConfigRef.current.outro_time)})`;
          }
        });

        player.on('error', (err: Error) => {
          console.error('播放器错误:', err);
          if (player.currentTime > 0) return;
        });

        // 自动播放下一集
        player.on('video:ended', () => {
          const d = detailRef.current;
          const idx = currentEpisodeIndexRef.current;
          if (d && d.episodes && idx < d.episodes.length - 1) {
            setTimeout(() => {
              setCurrentEpisodeIndex(idx + 1);
            }, 300);
          }
        });

        // 定时保存进度
        player.on('video:timeupdate', () => {
          const now = Date.now();
          if (now - lastSaveTimeRef.current > 5000) {
            saveCurrentPlayProgress();
          }
        });

        if (player.video) {
          ensureVideoSource(player.video as HTMLVideoElement, videoUrl);
        }
      } catch (err) {
        console.error('创建播放器失败:', err);
        setError('播放器初始化失败');
      }
    };

    void initPlayer();

    return () => {
      cancelled = true;
    };
  }, [videoUrl, loading, blockAdEnabled, onPlaybackStarted]);
}
