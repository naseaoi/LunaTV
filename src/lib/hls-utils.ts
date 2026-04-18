import { formatBytesPerSecond } from '@/lib/player-utils';
import {
  clearSourceProxyOverride,
  rememberSourceServerProxy,
} from '@/lib/proxy-modes';

type VideoProbeResult = {
  quality: string;
  loadSpeed: string;
  pingTime: number;
};

type MasterVariant = {
  url: string;
  width: number;
  bandwidth: number;
};

type PartialProbeResult = {
  quality: string;
  pingTime: number;
};

class ProbeError extends Error {
  partial?: PartialProbeResult;

  constructor(message: string, partial?: PartialProbeResult) {
    super(message);
    this.name = 'ProbeError';
    this.partial = partial;
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function mapWidthToQuality(width: number): string {
  if (width >= 3840) return '4K';
  if (width >= 2560) return '2K';
  if (width >= 1920) return '1080p';
  if (width >= 1280) return '720p';
  if (width >= 854) return '480p';
  if (width > 0) return 'SD';
  return '未知';
}

function getNonCommentLines(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function parseMasterVariants(content: string): MasterVariant[] {
  const lines = content.split('\n');
  const variants: MasterVariant[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;

    const nextLine = lines[i + 1]?.trim() || '';
    if (!nextLine || nextLine.startsWith('#')) continue;

    const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
    const width = resolutionMatch ? Number.parseInt(resolutionMatch[1], 10) : 0;
    const bandwidthMatch = line.match(/[,:]BANDWIDTH=(\d+)/i);
    const bandwidth = bandwidthMatch
      ? Number.parseInt(bandwidthMatch[1], 10)
      : 0;
    variants.push({
      url: nextLine,
      width,
      bandwidth,
    });
  }

  return variants;
}

function pickProbeVariant(variants: MasterVariant[]) {
  if (!variants.length) return null;

  const bestVariant = [...variants].sort((a, b) => b.width - a.width)[0];

  // 判定 master 声明的 RESOLUTION 是否可信。
  // 源站常见的虚标情形：
  // 1) 混合声明：部分 variant 有 RESOLUTION，部分没有 —— 缺失者可能才是真实高清轨；
  // 2) 统一虚标：所有 variant 的 RESOLUTION 完全相同，但 BANDWIDTH 差距 >2x，
  //    正常情况下带宽翻倍通常伴随分辨率提升，同分辨率带宽剧变多为占位元数据。
  // 命中任一情形时视为不可信，后续 quality 直接标"未知"，避免误导用户。
  const hasMissingResolution = variants.some((v) => v.width <= 0);
  let suspiciousBandwidth = false;
  if (!hasMissingResolution && variants.length >= 2) {
    const allSameWidth = variants.every((v) => v.width === variants[0].width);
    const bandwidths = variants.map((v) => v.bandwidth).filter((bw) => bw > 0);
    if (allSameWidth && bandwidths.length >= 2) {
      const maxBw = Math.max(...bandwidths);
      const minBw = Math.min(...bandwidths);
      if (minBw > 0 && maxBw / minBw > 2) {
        suspiciousBandwidth = true;
      }
    }
  }
  const resolutionTrusted = !hasMissingResolution && !suspiciousBandwidth;

  return {
    bestQualityWidth: bestVariant?.width || 0,
    resolutionTrusted,
    // 测速优先选择首个变体，尽量贴近实际起播路径。
    probePlaylistUrl: variants[0].url,
  };
}

/**
 * 从 master playlist 抽出所有 variant 的 CODECS 声明。
 * 格式：#EXT-X-STREAM-INF:...,CODECS="avc1.64001f,mp4a.40.2",...
 */
function extractMasterCodecs(playlistContent: string): string[] {
  return Array.from(
    playlistContent.matchAll(/#EXT-X-STREAM-INF:[^\n]*CODECS="([^"]+)"/gi),
  ).map((m) => m[1]);
}

/**
 * 基于浏览器 MediaSource.isTypeSupported 判定 master playlist 里的 codec 是否可解码。
 * 命中任何一个可播放的 variant 即算通过；全部不支持才抛错。
 * 说明：
 * - 仅对声明了 CODECS 的 master 生效。media playlist（单档 TS）通常不带 codec，留空放行，
 *   让后续真实起播再暴露问题，避免把大量源误判为不可播放。
 * - 服务端渲染或老浏览器无 MediaSource 时直接跳过，不影响探测流程。
 */
function ensureCodecsPlayable(playlistContent: string): void {
  if (typeof window === 'undefined' || typeof MediaSource === 'undefined') {
    return;
  }

  const codecsList = extractMasterCodecs(playlistContent);
  if (codecsList.length === 0) return;

  const anyPlayable = codecsList.some((codecs) => {
    try {
      return (
        MediaSource.isTypeSupported(`video/mp4; codecs="${codecs}"`) ||
        MediaSource.isTypeSupported(`video/mp2t; codecs="${codecs}"`)
      );
    } catch {
      return false;
    }
  });

  if (!anyPlayable) {
    throw new Error(`Unsupported codec: ${codecsList.join(' | ')}`);
  }
}

function getFirstSegmentUrl(content: string): string | null {
  return getNonCommentLines(content)[0] || null;
}

function buildProxyUrl(
  m3u8Url: string,
  useProxy: boolean,
  sourceKey?: string,
): string {
  const params = new URLSearchParams({
    url: m3u8Url,
  });
  if (!useProxy) {
    params.set('allowCORS', 'true');
  }
  if (sourceKey) {
    params.set('icetv-source', sourceKey);
  }
  return `/api/proxy/m3u8?${params.toString()}`;
}

function pickBestPartial(
  primary?: PartialProbeResult,
  fallback?: PartialProbeResult,
): PartialProbeResult | undefined {
  if (!primary) return fallback;
  if (!fallback) return primary;
  if (primary.quality !== '未知') return primary;
  if (fallback.quality !== '未知') return fallback;
  return primary.pingTime > 0 ? primary : fallback;
}

function normalizeProbeError(
  error: unknown,
  partial?: PartialProbeResult,
): ProbeError {
  if (error instanceof ProbeError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return new ProbeError(message, partial);
}

async function probeWithMode(
  m3u8Url: string,
  useProxy: boolean,
  sourceKey?: string,
): Promise<VideoProbeResult> {
  const proxyUrl = buildProxyUrl(m3u8Url, useProxy, sourceKey);

  const pingStart = performance.now();
  const pingPromise = fetch(proxyUrl, { method: 'HEAD' })
    .catch(() => null)
    .then(() => Math.round(performance.now() - pingStart));

  let partial: PartialProbeResult | undefined;

  try {
    const playlistResponse = await withTimeout(
      fetch(proxyUrl, { cache: 'no-store' }),
      8000,
      'Timeout loading playlist',
    );
    if (!playlistResponse.ok) {
      throw new ProbeError('Failed to load playlist', partial);
    }

    const playlistContent = await playlistResponse.text();
    ensureCodecsPlayable(playlistContent);
    const variants = parseMasterVariants(playlistContent);
    const pickedVariant = pickProbeVariant(variants);
    const quality =
      pickedVariant && pickedVariant.resolutionTrusted
        ? mapWidthToQuality(pickedVariant.bestQualityWidth)
        : '未知';

    let mediaPlaylistContent = playlistContent;

    if (pickedVariant?.probePlaylistUrl) {
      const mediaPlaylistResponse = await withTimeout(
        fetch(pickedVariant.probePlaylistUrl, { cache: 'no-store' }),
        8000,
        'Timeout loading media playlist',
      );
      if (!mediaPlaylistResponse.ok) {
        throw new ProbeError('Failed to load media playlist', partial);
      }
      mediaPlaylistContent = await mediaPlaylistResponse.text();
    }

    const pingTime = await pingPromise;
    partial = { quality, pingTime };

    const firstSegmentUrl = getFirstSegmentUrl(mediaPlaylistContent);
    if (!firstSegmentUrl) {
      throw new ProbeError('Missing media segment url', partial);
    }

    const segmentStart = performance.now();
    const segmentResponse = await withTimeout(
      fetch(firstSegmentUrl, {
        cache: 'no-store',
        headers: {
          Range: 'bytes=0-8191',
        },
      }),
      8000,
      'Timeout loading first segment',
    );
    if (!segmentResponse.ok) {
      throw new ProbeError('Failed to load first segment', partial);
    }

    const segmentBuffer = await segmentResponse.arrayBuffer();
    const elapsedMs = performance.now() - segmentStart;
    const loadSpeed =
      segmentBuffer.byteLength > 0 && elapsedMs > 0
        ? formatBytesPerSecond(segmentBuffer.byteLength / (elapsedMs / 1000))
        : '未知';

    return {
      quality,
      loadSpeed,
      pingTime,
    };
  } catch (error) {
    throw normalizeProbeError(error, partial);
  }
}

/**
 * 从 m3u8 地址获取视频质量等级和网络信息。
 * 改为直接请求 playlist 与首个分片，避免为每个源创建隐藏 video+hls 实例。
 *
 * 优化：variant playlist 与 first segment range 尝试并行发起，
 *      将原 3 段串行（HEAD+playlist → variant playlist → first segment）
 *      压缩到 ~2 轮 RTT。若 master 无 variants，退回单 playlist 链路。
 */
export async function getVideoResolutionFromM3u8(
  m3u8Url: string,
  useProxy = true,
  sourceKey = '',
): Promise<VideoProbeResult> {
  try {
    const result = await probeWithMode(m3u8Url, useProxy, sourceKey);
    if (!useProxy && sourceKey) {
      clearSourceProxyOverride(sourceKey);
    }
    return result;
  } catch (error) {
    const firstError = normalizeProbeError(error);

    if (!useProxy) {
      try {
        const fallbackResult = await probeWithMode(m3u8Url, true, sourceKey);
        if (sourceKey) {
          rememberSourceServerProxy(sourceKey);
        }
        return fallbackResult;
      } catch (fallbackError) {
        const normalizedFallbackError = normalizeProbeError(fallbackError);
        const partial = pickBestPartial(
          normalizedFallbackError.partial,
          firstError.partial,
        );
        if (partial) {
          return {
            quality: partial.quality,
            loadSpeed: '未知',
            pingTime: partial.pingTime,
          };
        }
        throw new Error(normalizedFallbackError.message);
      }
    }

    if (firstError.partial) {
      return {
        quality: firstError.partial.quality,
        loadSpeed: '未知',
        pingTime: firstError.partial.pingTime,
      };
    }

    throw new Error(
      `Error getting video resolution: ${
        firstError instanceof Error ? firstError.message : String(firstError)
      }`,
    );
  }
}
