import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useEffect,
  useRef,
} from 'react';

import type ArtplayerType from 'artplayer';

import type { LiveChannel, LiveSource } from '../types';
import {
  createHlsLoaderClass,
  destroyManagedHls,
  getManagedVideo,
  getPlayerModules,
  runManagedVideoCleanup,
} from '@/lib/player-runtime';
import {
  ensureVideoSource,
  createHlsConfig,
  createArtPlayerConfig,
  configureArtplayerStatics,
  handleHlsFatalError,
} from '@/lib/player-utils';

// ----- 播放器工具函数 -----

/** 清理播放器资源 */
function cleanupPlayer(artPlayerRef: MutableRefObject<ArtplayerType | null>) {
  if (!artPlayerRef.current) return;
  try {
    const video = artPlayerRef.current.video;
    if (video) {
      runManagedVideoCleanup(video);
      video.pause();
      video.src = '';
      video.load();
    }
    destroyManagedHls(video);
    if (video?.flv) {
      try {
        video.flv.unload?.();
        video.flv.destroy();
        video.flv = null;
      } catch (flvError) {
        console.warn('FLV实例销毁时出错:', flvError);
        video.flv = null;
      }
    }

    const player = artPlayerRef.current as unknown as {
      off(event: string): void;
      destroy(): void;
      video: HTMLVideoElement;
    };
    player.off('ready');
    player.off('loadstart');
    player.off('loadeddata');
    player.off('canplay');
    player.off('waiting');
    player.off('error');
    artPlayerRef.current.destroy();
    artPlayerRef.current = null;
  } catch (err) {
    console.warn('清理播放器资源时出错:', err);
    artPlayerRef.current = null;
  }
}

// ----- Hook 参数接口 -----
interface UseLivePlayerParams {
  videoUrl: string;
  currentChannel: LiveChannel | null;
  currentSourceRef: MutableRefObject<LiveSource | null>;
  loading: boolean;
  artRef: MutableRefObject<HTMLDivElement | null>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsVideoLoading: Dispatch<SetStateAction<boolean>>;
  setUnsupportedType: Dispatch<SetStateAction<string | null>>;
}

export function useLivePlayer({
  videoUrl,
  currentChannel,
  currentSourceRef,
  loading,
  artRef,
  setError,
  setIsVideoLoading,
  setUnsupportedType,
}: UseLivePlayerParams) {
  const artPlayerRef = useRef<ArtplayerType | null>(null);
  const loadedUrlRef = useRef('');

  /** 外部可调用的清理方法 */
  const doCleanup = () => {
    setUnsupportedType(null);
    loadedUrlRef.current = '';
    cleanupPlayer(artPlayerRef);
  };

  // ----- 播放器初始化 Effect -----
  useEffect(() => {
    let cancelled = false;

    const preload = async () => {
      if (!videoUrl || !artRef.current || !currentChannel) {
        return;
      }

      try {
        const { Artplayer, Hls } = await getPlayerModules();

        if (cancelled || !artRef.current) return;

        // precheck type
        let type = 'm3u8';
        const precheckUrl = `/api/live/precheck?url=${encodeURIComponent(videoUrl)}&icetv-source=${currentSourceRef.current?.key || ''}`;
        const precheckResponse = await fetch(precheckUrl);
        if (!precheckResponse.ok) {
          console.error('预检查失败:', precheckResponse.statusText);
          return;
        }
        const precheckResult = await precheckResponse.json();
        if (precheckResult.success) {
          type = precheckResult.type;
        }

        const targetUrl = `/api/proxy/m3u8?url=${encodeURIComponent(videoUrl)}&icetv-source=${currentSourceRef.current?.key || ''}&icetv-live=1`;

        if (type !== 'm3u8') {
          loadedUrlRef.current = '';
          cleanupPlayer(artPlayerRef);
          setUnsupportedType(type);
          setIsVideoLoading(false);
          return;
        }

        setUnsupportedType(null);

        if (artPlayerRef.current && loadedUrlRef.current === targetUrl) {
          return;
        }

        const LiveHlsLoader = createHlsLoaderClass(
          Hls.DefaultConfig.loader as unknown as new (config: unknown) => {
            load: (...args: unknown[]) => void;
          },
          {
            rewriteContext: (context) => {
              const currentUrl = context.url;
              if (!currentUrl) return;

              const isLiveDirectConnect =
                typeof window !== 'undefined' &&
                localStorage.getItem('liveDirectConnect') === 'true';

              try {
                const nextUrl = new URL(currentUrl, window.location.origin);
                nextUrl.searchParams.set(
                  'icetv-source',
                  currentSourceRef.current?.key || '',
                );
                if (
                  isLiveDirectConnect &&
                  (context.type === 'manifest' || context.type === 'level')
                ) {
                  nextUrl.searchParams.set('allowCORS', 'true');
                }
                context.url = nextUrl.toString();
              } catch {
                const separator = currentUrl.includes('?') ? '&' : '?';
                let nextUrl = `${currentUrl}${separator}icetv-source=${encodeURIComponent(currentSourceRef.current?.key || '')}`;
                if (
                  isLiveDirectConnect &&
                  (context.type === 'manifest' || context.type === 'level')
                ) {
                  nextUrl = `${nextUrl}&allowCORS=true`;
                }
                context.url = nextUrl;
              }
            },
          },
        );

        const m3u8Loader = (video: HTMLVideoElement, url: string) => {
          const managedVideo = getManagedVideo(video);
          runManagedVideoCleanup(managedVideo);
          destroyManagedHls(managedVideo);

          const hls = new Hls({
            ...createHlsConfig({
              lowLatencyMode: true,
              maxBufferLength: 30,
              backBufferLength: 30,
            }),
            loader: LiveHlsLoader as unknown as typeof Hls.DefaultConfig.loader,
          });
          hls.loadSource(url);
          hls.attachMedia(video);
          managedVideo.hls = hls;

          hls.on(Hls.Events.ERROR, function (_event: any, data: any) {
            console.error('HLS Error:', _event, data);
            if (data.fatal) {
              handleHlsFatalError(hls, data.type, Hls.ErrorTypes);
            }
          });
        };

        if (artPlayerRef.current) {
          setIsVideoLoading(true);
          artPlayerRef.current.switch = targetUrl;
          if (artPlayerRef.current.video) {
            ensureVideoSource(artPlayerRef.current.video, targetUrl);
          }
          loadedUrlRef.current = targetUrl;
          return;
        }

        const customType = { m3u8: m3u8Loader };
        configureArtplayerStatics(Artplayer);

        artPlayerRef.current = new Artplayer({
          container: artRef.current,
          url: targetUrl,
          ...createArtPlayerConfig({
            isLive: true,
            moreVideoAttr: { preload: 'metadata' },
          }),
          type: type,
          customType,
        });
        loadedUrlRef.current = targetUrl;

        // Artplayer 运行时支持这些事件名，但 TS 类型定义未包含
        const ap = artPlayerRef.current as unknown as {
          on(event: string, callback: (...args: unknown[]) => void): void;
          video: HTMLVideoElement;
        };
        ap.on('ready', () => {
          setError(null);
          setIsVideoLoading(false);
        });
        ap.on('loadstart', () => {
          setIsVideoLoading(true);
        });
        ap.on('loadeddata', () => {
          setIsVideoLoading(false);
        });
        ap.on('canplay', () => {
          setIsVideoLoading(false);
        });
        ap.on('waiting', () => {
          setIsVideoLoading(true);
        });
        ap.on('error', (err: unknown) => {
          console.error('播放器错误:', err);
        });

        if (artPlayerRef.current?.video) {
          ensureVideoSource(
            artPlayerRef.current.video as HTMLVideoElement,
            targetUrl,
          );
        }
      } catch (err) {
        console.error('创建播放器失败:', err);
      }
    };
    preload();

    return () => {
      cancelled = true;
    };
  }, [videoUrl, currentChannel, loading]);

  // ----- 组件卸载清理 -----
  useEffect(() => {
    return () => {
      loadedUrlRef.current = '';
      cleanupPlayer(artPlayerRef);
    };
  }, []);

  // ----- 页面卸载清理 -----
  useEffect(() => {
    const handleBeforeUnload = () => {
      loadedUrlRef.current = '';
      cleanupPlayer(artPlayerRef);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      loadedUrlRef.current = '';
      cleanupPlayer(artPlayerRef);
    };
  }, []);

  return { artPlayerRef, cleanupPlayer: doCleanup };
}
