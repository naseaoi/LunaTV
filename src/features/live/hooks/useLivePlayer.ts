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
  ensureVideoSource,
  createHlsConfig,
  createArtPlayerConfig,
  configureArtplayerStatics,
} from '@/lib/player-utils';

// ----- 播放器工具函数 -----

/** 清理播放器资源 */
function cleanupPlayer(artPlayerRef: MutableRefObject<ArtplayerType | null>) {
  if (!artPlayerRef.current) return;
  try {
    const video = artPlayerRef.current.video;
    if (video) {
      video.pause();
      video.src = '';
      video.load();
    }
    if (video?.hls) {
      video.hls.destroy();
      video.hls = null;
    }
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

  /** 外部可调用的清理方法 */
  const doCleanup = () => {
    setUnsupportedType(null);
    cleanupPlayer(artPlayerRef);
  };

  // ----- 播放器初始化 Effect -----
  useEffect(() => {
    let cancelled = false;

    const preload = async () => {
      if (!videoUrl || !artRef.current || !currentChannel) {
        return;
      }

      // 动态导入 artplayer 和 hls.js，避免在非直播页面打包
      const [{ default: Artplayer }, { default: Hls }] = await Promise.all([
        import('artplayer'),
        import('hls.js'),
      ]);

      if (cancelled || !artRef.current) return;

      if (artPlayerRef.current) {
        cleanupPlayer(artPlayerRef);
      }

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

      if (type !== 'm3u8') {
        setUnsupportedType(type);
        setIsVideoLoading(false);
        return;
      }

      setUnsupportedType(null);

      // HLS 自定义 Loader（为请求注入 icetv-source 参数）
      const CustomHlsJsLoader = class extends (Hls.DefaultConfig
        .loader as unknown as {
        new (config: unknown): { load: (...args: unknown[]) => void };
      }) {
        constructor(config: unknown) {
          super(config);
          const load = this.load.bind(this);

          this.load = function (context: any, cfg: any, callbacks: any) {
            try {
              const url = new URL(context.url);
              url.searchParams.set(
                'icetv-source',
                currentSourceRef.current?.key || '',
              );
              context.url = url.toString();
            } catch {
              // ignore
            }
            if (context.type === 'manifest' || context.type === 'level') {
              const isLiveDirectConnect =
                localStorage.getItem('liveDirectConnect') === 'true';
              if (isLiveDirectConnect) {
                try {
                  const url = new URL(context.url);
                  url.searchParams.set('allowCORS', 'true');
                  context.url = url.toString();
                } catch {
                  context.url = context.url + '&allowCORS=true';
                }
              }
            }
            load(context, cfg, callbacks);
          };
        }
      };

      function m3u8Loader(video: HTMLVideoElement, url: string) {
        if (video.hls) {
          try {
            video.hls.destroy();
            video.hls = null;
          } catch (err) {
            console.warn('清理 HLS 实例时出错:', err);
          }
        }
        const hls = new Hls({
          ...createHlsConfig({
            lowLatencyMode: true,
            maxBufferLength: 30,
            backBufferLength: 30,
          }),
          loader:
            CustomHlsJsLoader as unknown as typeof Hls.DefaultConfig.loader,
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        video.hls = hls;

        hls.on(Hls.Events.ERROR, function (_event: any, data: any) {
          console.error('HLS Error:', _event, data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                break;
              default:
                hls.destroy();
                break;
            }
          }
        });
      }

      const customType = { m3u8: m3u8Loader };
      const targetUrl = `/api/proxy/m3u8?url=${encodeURIComponent(videoUrl)}&icetv-source=${currentSourceRef.current?.key || ''}`;
      try {
        configureArtplayerStatics(Artplayer);

        artPlayerRef.current = new Artplayer({
          container: artRef.current,
          url: targetUrl,
          ...createArtPlayerConfig({
            isLive: true,
            moreVideoAttr: { preload: 'metadata' },
          }),
          type: type,
          customType: customType,
        });

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
      cleanupPlayer(artPlayerRef);
    };
  }, []);

  // ----- 页面卸载清理 -----
  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupPlayer(artPlayerRef);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupPlayer(artPlayerRef);
    };
  }, []);

  return { artPlayerRef, cleanupPlayer: doCleanup };
}
