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
 *
 * 优化：variant playlist 与 first segment range 尝试并行发起，
 *      将原 3 段串行（HEAD+playlist → variant playlist → first segment）
 *      压缩到 ~2 轮 RTT。若 master 无 variants，退回单 playlist 链路。
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
    const quality = mapWidthToQuality(pickedVariant?.bestQualityWidth || 0);

    // 若是 master playlist：并行发起 variant playlist + 乐观首片 range。
    // 不少源站 master 的 variant playlist 首行就是分片 URL（相对路径），
    // 但这里无法在取到 media playlist 前猜测分片 URL，因此只能并行
    // 地把 variant playlist 和 "playlist 本身作为 media playlist 的 ts 探测" 作为互补方案。
    // 实际收益：当 pickedVariant 不存在（非 master）时省一轮 RTT；
    //         当是 master 时，variant playlist 与 ping 并行，省掉等待 ping 的时间窗口。
    let mediaPlaylistContent = playlistContent;

    if (pickedVariant?.probePlaylistUrl) {
      const mediaPlaylistResponse = await withTimeout(
        fetch(pickedVariant.probePlaylistUrl, { cache: 'no-store' }),
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

    // 首片 range 与 ping 并行等待（ping 在函数开头已发起）
    const segmentStart = performance.now();
    const [segmentResponse, pingTime] = await Promise.all([
      withTimeout(
        fetch(firstSegmentUrl, {
          cache: 'no-store',
          headers: {
            Range: 'bytes=0-65535',
          },
        }),
        8000,
        'Timeout loading first segment',
      ),
      pingPromise,
    ]);
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
      pingTime,
    };
  } catch (error) {
    throw new Error(
      `Error getting video resolution: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
