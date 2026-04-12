import { formatBytesPerSecond } from '@/lib/player-utils';

type VideoProbeResult = {
  quality: string;
  loadSpeed: string;
  pingTime: number;
};

type MasterVariant = {
  url: string;
  width: number;
};

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
    variants.push({
      url: nextLine,
      width,
    });
  }

  return variants;
}

function pickProbeVariant(variants: MasterVariant[]) {
  if (!variants.length) return null;

  const bestVariant = [...variants].sort((a, b) => b.width - a.width)[0];

  return {
    bestQualityWidth: bestVariant?.width || 0,
    // 测速优先选择首个变体，尽量贴近实际起播路径。
    probePlaylistUrl: variants[0].url,
  };
}

function getFirstSegmentUrl(content: string): string | null {
  return getNonCommentLines(content)[0] || null;
}

/**
 * 从 m3u8 地址获取视频质量等级和网络信息。
 * 改为直接请求 playlist 与首个分片，避免为每个源创建隐藏 video+hls 实例。
 */
export async function getVideoResolutionFromM3u8(
  m3u8Url: string,
  useProxy = true,
): Promise<VideoProbeResult> {
  try {
    // useProxy=true 走服务端代理；false 走 allowCORS 模式（浏览器直连 ts 片段）
    const proxyUrl = useProxy
      ? `/api/proxy/m3u8?url=${encodeURIComponent(m3u8Url)}`
      : `/api/proxy/m3u8?url=${encodeURIComponent(m3u8Url)}&allowCORS=true`;

    const pingStart = performance.now();
    const pingPromise = fetch(proxyUrl, { method: 'HEAD' })
      .catch(() => null)
      .then(() => Math.round(performance.now() - pingStart));

    const playlistResponse = await withTimeout(
      fetch(proxyUrl, { cache: 'no-store' }),
      8000,
      'Timeout loading playlist',
    );
    if (!playlistResponse.ok) {
      throw new Error('Failed to load playlist');
    }

    const playlistContent = await playlistResponse.text();
    const variants = parseMasterVariants(playlistContent);
    const pickedVariant = pickProbeVariant(variants);

    let quality = mapWidthToQuality(pickedVariant?.bestQualityWidth || 0);
    let mediaPlaylistUrl = proxyUrl;
    let mediaPlaylistContent = playlistContent;

    if (pickedVariant?.probePlaylistUrl) {
      mediaPlaylistUrl = pickedVariant.probePlaylistUrl;

      const mediaPlaylistResponse = await withTimeout(
        fetch(mediaPlaylistUrl, { cache: 'no-store' }),
        8000,
        'Timeout loading media playlist',
      );
      if (!mediaPlaylistResponse.ok) {
        throw new Error('Failed to load media playlist');
      }
      mediaPlaylistContent = await mediaPlaylistResponse.text();
    }

    const firstSegmentUrl = getFirstSegmentUrl(mediaPlaylistContent);
    if (!firstSegmentUrl) {
      throw new Error('Missing media segment url');
    }

    const segmentStart = performance.now();
    const segmentResponse = await withTimeout(
      fetch(firstSegmentUrl, {
        cache: 'no-store',
        headers: {
          Range: 'bytes=0-65535',
        },
      }),
      8000,
      'Timeout loading first segment',
    );
    if (!segmentResponse.ok) {
      throw new Error('Failed to load first segment');
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
      pingTime: await pingPromise,
    };
  } catch (error) {
    throw new Error(
      `Error getting video resolution: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
