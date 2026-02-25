import { Dispatch, MutableRefObject, SetStateAction, useEffect } from 'react';

import Artplayer from 'artplayer';
import Hls from 'hls.js';

import { SearchResult } from '@/lib/types';

import { WakeLockSentinel } from '@/features/play/lib/playTypes';

// ---------------------------------------------------------------------------
// 内部工具函数
// ---------------------------------------------------------------------------

function ensureVideoSource(video: HTMLVideoElement | null, url: string) {
  if (!video || !url) return;
  const sources = Array.from(video.getElementsByTagName('source'));
  const existed = sources.some((s) => s.src === url);
  if (!existed) {
    sources.forEach((s) => s.remove());
    const sourceEl = document.createElement('source');
    sourceEl.src = url;
    video.appendChild(sourceEl);
  }
  video.disableRemotePlayback = false;
  if (video.hasAttribute('disableRemotePlayback')) {
    video.removeAttribute('disableRemotePlayback');
  }
}

function formatTime(seconds: number): string {
  if (seconds === 0) return '00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (hours === 0) {
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatBytesPerSecond(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 KB/s';
  const kb = bytesPerSecond / 1024;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB/s`;
  return `${kb.toFixed(1)} KB/s`;
}

function filterAdsFromM3U8(m3u8Content: string): string {
  if (!m3u8Content) return '';
  const lines = m3u8Content.split('\n');
  const filteredLines: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.includes('#EXT-X-DISCONTINUITY')) {
      filteredLines.push(line);
    }
  }
  return filteredLines.join('\n');
}

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
  adBlockMode: 'player' | 'server';
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
    adBlockMode,
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
  } = params;

  // --- 主 useEffect ---

  useEffect(() => {
    if (
      !Artplayer ||
      !Hls ||
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

    const isWebkit =
      typeof window !== 'undefined' &&
      typeof (window as unknown as Record<string, unknown>)
        .webkitConvertPointFromNodeToPage === 'function';

    // 非WebKit浏览器且播放器已存在，使用switch方法切换
    if (!isWebkit && artPlayerRef.current) {
      artPlayerRef.current.switch = videoUrl;
      artPlayerRef.current.title = `${videoTitle} - 第${currentEpisodeIndex + 1}集`;
      artPlayerRef.current.poster = videoCover;
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

    class CustomHlsJsLoader extends (Hls.DefaultConfig.loader as unknown as {
      new (config: unknown): { load: (...args: unknown[]) => void };
    }) {
      constructor(config: unknown) {
        super(config);
        const load = this.load.bind(this);
        this.load = function (
          context: unknown,
          loadConfig: unknown,
          callbacks: unknown,
        ) {
          const ctx = context as { type?: string };
          const cbs = callbacks as {
            onSuccess: (...args: unknown[]) => unknown;
          };
          if (ctx.type === 'manifest' || ctx.type === 'level') {
            const onSuccess = cbs.onSuccess;
            cbs.onSuccess = function (
              response: unknown,
              stats: unknown,
              cbCtx: unknown,
            ) {
              const resp = response as { data?: unknown };
              if (resp.data && typeof resp.data === 'string') {
                resp.data = filterAdsFromM3U8(resp.data);
              }
              return onSuccess(response, stats, cbCtx, null);
            };
          }
          load(context, loadConfig, callbacks);
        };
      }
    }

    try {
      Artplayer.PLAYBACK_RATE = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
      Artplayer.USE_RAF = false;
      Artplayer.FULLSCREEN_WEB_IN_BODY = true;

      artPlayerRef.current = new Artplayer({
        container: artRef.current,
        url: videoUrl,
        poster: videoCover,
        volume: 0.7,
        isLive: false,
        muted: false,
        autoplay: true,
        pip: true,
        autoSize: false,
        autoMini: false,
        screenshot: false,
        setting: true,
        loop: false,
        flip: false,
        playbackRate: true,
        aspectRatio: false,
        fullscreen: true,
        fullscreenWeb: true,
        subtitleOffset: false,
        miniProgressBar: false,
        mutex: true,
        playsInline: true,
        autoPlayback: false,
        airplay: true,
        theme: '#3b82f6',
        lang: 'zh-cn',
        hotkey: false,
        fastForward: true,
        autoOrientation: true,
        lock: true,
        moreVideoAttr: { crossOrigin: 'anonymous' },
        customType: {
          m3u8: function (video: HTMLVideoElement, url: string) {
            if (!Hls) {
              console.error('HLS.js 未加载');
              return;
            }

            if (video.hls) {
              video.hls.destroy();
            }
            const hls = new Hls({
              debug: false,
              enableWorker: true,
              lowLatencyMode: true,
              maxBufferLength: 30,
              backBufferLength: 30,
              maxBufferSize: 60 * 1000 * 1000,
              loader:
                blockAdEnabledRef.current && adBlockMode === 'player'
                  ? (CustomHlsJsLoader as unknown as typeof Hls.DefaultConfig.loader)
                  : Hls.DefaultConfig.loader,
            });

            const targetUrl =
              blockAdEnabledRef.current && adBlockMode === 'server'
                ? `/api/proxy/m3u8?url=${encodeURIComponent(url)}&removeAds=true`
                : url;

            setRealtimeLoadSpeed('测速中...');

            const speedFallbackTimer = setTimeout(() => {
              setRealtimeLoadSpeed((prev) =>
                prev === '测速中...' ? '0 KB/s' : prev,
              );
            }, 5000);

            hls.on(Hls.Events.ERROR, function (_event, data) {
              console.error('HLS Error:', _event, data);
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    hls.destroy();
                    break;
                }
              }
            });

            hls.on(Hls.Events.FRAG_LOADED, function (_, data) {
              clearTimeout(speedFallbackTimer);
              const stats = data.frag.stats;
              const loadedBytes = stats.loaded ?? stats.total ?? 0;
              const startTime = stats.loading.first ?? 0;
              const endTime = stats.loading.end ?? 0;
              const elapsedMs = endTime > startTime ? endTime - startTime : 0;
              if (loadedBytes > 0 && elapsedMs > 0) {
                const bytesPerSecond = loadedBytes / (elapsedMs / 1000);
                setRealtimeLoadSpeed(formatBytesPerSecond(bytesPerSecond));
              } else if (loadedBytes > 0) {
                setRealtimeLoadSpeed('0 KB/s');
              }
            });

            hls.loadSource(targetUrl);
            hls.attachMedia(video);
            video.hls = hls;
            ensureVideoSource(video, targetUrl);
          },
        },
        icons: {
          loading:
            '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDUwIDUwIj48cGF0aCBkPSJNMjUuMjUxIDYuNDYxYy0xMC4zMTggMC0xOC42ODMgOC4zNjUtMTguNjgzIDE4LjY4M2g0LjA2OGMwLTguMDcgNi41NDUtMTQuNjE1IDE0LjYxNS0xNC42MTVWNi40NjF6IiBmaWxsPSIjMDA5Njg4Ij48YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIGF0dHJpYnV0ZVR5cGU9IlhNTCIgZHVyPSIxcyIgZnJvbT0iMCAyNSAyNSIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIHRvPSIzNjAgMjUgMjUiIHR5cGU9InJvdGF0ZSIvPjwvcGF0aD48L3N2Zz4=">',
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
                  if (
                    artPlayerRef.current.video &&
                    artPlayerRef.current.video.hls
                  ) {
                    artPlayerRef.current.video.hls.destroy();
                  }
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
            onSwitch: function (item) {
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

      // --- 播放器事件 ---

      artPlayerRef.current.on('ready', () => {
        setError(null);
        if (artPlayerRef.current && artPlayerRef.current.playing) {
          requestWakeLock();
        }
      });

      artPlayerRef.current.on('play', () => {
        requestWakeLock();
        setIsPlaying(true);
      });

      artPlayerRef.current.on('pause', () => {
        releaseWakeLock();
        saveCurrentPlayProgress();
        setIsPlaying(false);
      });

      artPlayerRef.current.on('video:ended', () => {
        releaseWakeLock();
        setIsPlaying(false);
      });

      if (artPlayerRef.current && artPlayerRef.current.playing) {
        requestWakeLock();
      }

      artPlayerRef.current.on('video:volumechange', () => {
        if (artPlayerRef.current)
          lastVolumeRef.current = artPlayerRef.current.volume;
      });

      artPlayerRef.current.on('video:ratechange', () => {
        if (artPlayerRef.current)
          lastPlaybackRateRef.current = artPlayerRef.current
            .playbackRate as number;
      });

      artPlayerRef.current.on('video:canplay', () => {
        if (resumeTimeRef.current && resumeTimeRef.current > 0) {
          try {
            const duration = artPlayerRef.current?.duration || 0;
            let target = resumeTimeRef.current;
            if (duration && target >= duration - 2)
              target = Math.max(0, duration - 5);
            if (artPlayerRef.current) artPlayerRef.current.currentTime = target;
          } catch (err) {
            console.warn('恢复播放进度失败:', err);
          }
        }
        resumeTimeRef.current = null;

        setTimeout(() => {
          if (!artPlayerRef.current) return;
          if (
            Math.abs(artPlayerRef.current.volume - lastVolumeRef.current) > 0.01
          ) {
            artPlayerRef.current.volume = lastVolumeRef.current;
          }
          if (
            Math.abs(
              (artPlayerRef.current.playbackRate as number) -
                lastPlaybackRateRef.current,
            ) > 0.01 &&
            isWebkit
          ) {
            artPlayerRef.current.playbackRate = lastPlaybackRateRef.current as
              | 0.5
              | 0.75
              | 1
              | 1.25
              | 1.5
              | 1.75
              | 2;
          }
          artPlayerRef.current.notice.show = '';
        }, 0);

        setIsVideoLoading(false);
        setRealtimeLoadSpeed('');
      });

      // 跳过片头片尾
      artPlayerRef.current.on('video:timeupdate', () => {
        if (!skipConfigRef.current.enable) return;
        if (!artPlayerRef.current) return;

        const currentTime = artPlayerRef.current.currentTime || 0;
        const duration = artPlayerRef.current.duration || 0;
        const now = Date.now();

        if (now - lastSkipCheckRef.current < 1500) return;
        lastSkipCheckRef.current = now;

        if (
          skipConfigRef.current.intro_time > 0 &&
          currentTime < skipConfigRef.current.intro_time
        ) {
          artPlayerRef.current.currentTime = skipConfigRef.current.intro_time;
          artPlayerRef.current.notice.show = `已跳过片头 (${formatTime(skipConfigRef.current.intro_time)})`;
        }

        if (
          skipConfigRef.current.outro_time < 0 &&
          duration > 0 &&
          currentTime >
            artPlayerRef.current.duration + skipConfigRef.current.outro_time
        ) {
          if (
            currentEpisodeIndexRef.current <
            (detailRef.current?.episodes?.length || 1) - 1
          ) {
            handleNextEpisode();
          } else {
            artPlayerRef.current.pause();
          }
          artPlayerRef.current.notice.show = `已跳过片尾 (${formatTime(skipConfigRef.current.outro_time)})`;
        }
      });

      artPlayerRef.current.on('error', (err: Error) => {
        console.error('播放器错误:', err);
        if (artPlayerRef.current && artPlayerRef.current.currentTime > 0)
          return;
      });

      // 自动播放下一集
      artPlayerRef.current.on('video:ended', () => {
        const d = detailRef.current;
        const idx = currentEpisodeIndexRef.current;
        if (d && d.episodes && idx < d.episodes.length - 1) {
          setTimeout(() => {
            setCurrentEpisodeIndex(idx + 1);
          }, 1000);
        }
      });

      // 定时保存进度
      artPlayerRef.current.on('video:timeupdate', () => {
        const now = Date.now();
        if (now - lastSaveTimeRef.current > 5000) {
          saveCurrentPlayProgress();
          lastSaveTimeRef.current = now;
        }
      });

      artPlayerRef.current.on('pause', () => {
        saveCurrentPlayProgress();
      });

      if (artPlayerRef.current?.video) {
        ensureVideoSource(
          artPlayerRef.current.video as HTMLVideoElement,
          videoUrl,
        );
      }
    } catch (err) {
      console.error('创建播放器失败:', err);
      setError('播放器初始化失败');
    }
  }, [Artplayer, Hls, videoUrl, loading, blockAdEnabled, adBlockMode]);
}
