/**
 * 播放器公共工具模块
 * 提取 useArtPlayer / useLivePlayer 中共用的函数和配置
 */

// ---------------------------------------------------------------------------
// 视频源管理
// ---------------------------------------------------------------------------

/** 确保 <video> 下有正确的 <source> 子元素，并解除 remotePlayback 限制 */
export function ensureVideoSource(video: HTMLVideoElement | null, url: string) {
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

// ---------------------------------------------------------------------------
// 时间/速度格式化
// ---------------------------------------------------------------------------

export function formatTime(seconds: number): string {
  if (seconds === 0) return '00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (hours === 0) {
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatBytesPerSecond(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 KB/s';
  const kb = bytesPerSecond / 1024;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB/s`;
  return `${kb.toFixed(1)} KB/s`;
}

// ---------------------------------------------------------------------------
// HLS 配置工厂
// ---------------------------------------------------------------------------

export interface HlsConfigOverrides {
  debug?: boolean;
  enableWorker?: boolean;
  lowLatencyMode?: boolean;
  maxBufferLength?: number;
  backBufferLength?: number;
  maxBufferSize?: number;
  maxBufferHole?: number;
  nudgeOffset?: number;
  nudgeMaxRetry?: number;
  loader?: unknown;
}

/** 创建 HLS.js 默认配置，可通过 overrides 覆盖 */
export function createHlsConfig(overrides?: HlsConfigOverrides) {
  return {
    debug: false,
    enableWorker: true,
    // 默认按点播场景取更稳妥的缓冲策略，直播再单独覆盖。
    lowLatencyMode: false,
    maxBufferLength: 90,
    backBufferLength: 90,
    maxBufferSize: 60 * 1000 * 1000,
    maxBufferHole: 0.5,
    nudgeOffset: 0.1,
    nudgeMaxRetry: 8,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Artplayer 配置工厂
// ---------------------------------------------------------------------------

export interface ArtPlayerConfigOverrides {
  isLive?: boolean;
  setting?: boolean;
  playbackRate?: boolean;
  fastForward?: boolean;
  autoPlayback?: boolean;
  moreVideoAttr?: Record<string, unknown>;
}

/** 加载中 SVG 图标（base64） */
export const LOADING_ICON_SVG =
  '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDUwIDUwIj48cGF0aCBkPSJNMjUuMjUxIDYuNDYxYy0xMC4zMTggMC0xOC42ODMgOC4zNjUtMTguNjgzIDE4LjY4M2g0LjA2OGMwLTguMDcgNi41NDUtMTQuNjE1IDE0LjYxNS0xNC42MTVWNi40NjF6IiBmaWxsPSIjMDA5Njg4Ij48YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIGF0dHJpYnV0ZVR5cGU9IlhNTCIgZHVyPSIxcyIgZnJvbT0iMCAyNSAyNSIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIHRvPSIzNjAgMjUgMjUiIHR5cGU9InJvdGF0ZSIvPjwvcGF0aD48L3N2Zz4=">';

/**
 * 创建 Artplayer 基础配置，VOD / Live 场景通过 overrides 差异化。
 * 不包含 container / url，这两个必须在调用端传入。
 */
export function createArtPlayerConfig(overrides?: ArtPlayerConfigOverrides) {
  const { moreVideoAttr: extraVideoAttr, ...rest } = overrides || {};

  return {
    volume: 0.7,
    muted: false,
    autoplay: true,
    pip: true,
    autoSize: false,
    autoMini: false,
    screenshot: false,
    loop: false,
    flip: false,
    aspectRatio: false,
    fullscreen: true,
    fullscreenWeb: true,
    subtitleOffset: false,
    miniProgressBar: false,
    mutex: true,
    playsInline: true,
    airplay: true,
    theme: '#3b82f6',
    lang: 'zh-cn' as const,
    hotkey: false,
    autoOrientation: true,
    lock: true,
    moreVideoAttr: {
      crossOrigin: 'anonymous',
      ...extraVideoAttr,
    },
    icons: { loading: LOADING_ICON_SVG },
    // 以下为可覆盖的差异项
    isLive: false,
    setting: false,
    playbackRate: false,
    fastForward: false,
    autoPlayback: false,
    ...rest,
  };
}

// ---------------------------------------------------------------------------
// Artplayer 静态属性预设
// ---------------------------------------------------------------------------

/** 统一设置 Artplayer 全局静态属性 */
export function configureArtplayerStatics(Artplayer: {
  USE_RAF: boolean;
  FULLSCREEN_WEB_IN_BODY: boolean;
  PLAYBACK_RATE?: number[];
}) {
  Artplayer.USE_RAF = false;
  Artplayer.FULLSCREEN_WEB_IN_BODY = true;
}

// ---------------------------------------------------------------------------
// HLS 错误统一处理
// ---------------------------------------------------------------------------

/** HLS 致命错误标准处理：网络错误重载、媒体错误恢复、其他销毁 */
export function handleHlsFatalError(
  hls: {
    startLoad: () => void;
    recoverMediaError: () => void;
    destroy: () => void;
  },
  errorType: string,
  ErrorTypes: { NETWORK_ERROR: string; MEDIA_ERROR: string },
) {
  switch (errorType) {
    case ErrorTypes.NETWORK_ERROR:
      hls.startLoad();
      break;
    case ErrorTypes.MEDIA_ERROR:
      hls.recoverMediaError();
      break;
    default:
      hls.destroy();
      break;
  }
}
