export type SourceTestResult = {
  quality: string;
  loadSpeed: string;
  pingTime: number;
};

export type AdRange = {
  start: number;
  end: number;
  reason: string;
};

export const AD_KEYWORD_RE =
  /(^|[\/_.?=&-])(ad|ads|adbreak|advert|commercial|promo|preroll|midroll)($|[\/_.?=&-])/i;
export const AD_TAG_RE =
  /#EXT-X-CUE-OUT|#EXT-X-DATERANGE|SCTE35|X-ASSET-LIST|CLASS="ad"|CLASS=ad/i;

export function calculateSourceScore(
  testResult: SourceTestResult,
  maxSpeed: number,
  minPing: number,
  maxPing: number,
): number {
  let score = 0;

  const qualityScore = (() => {
    switch (testResult.quality) {
      case '4K':
        return 100;
      case '2K':
        return 85;
      case '1080p':
        return 75;
      case '720p':
        return 60;
      case '480p':
        return 40;
      case 'SD':
        return 20;
      default:
        return 0;
    }
  })();
  score += qualityScore * 0.4;

  const speedScore = (() => {
    const speedStr = testResult.loadSpeed;
    if (speedStr === '未知' || speedStr === '测量中...') return 30;

    const match = speedStr.match(/^([\d.]+)\s*(Mbps|KB\/s|MB\/s)$/);
    if (!match) return 30;

    const value = parseFloat(match[1]);
    const unit = match[2];
    // 统一转换为 KB/s 用于内部评分比较
    let speedKBps: number;
    if (unit === 'Mbps') speedKBps = (value * 1024) / 8;
    else speedKBps = unit === 'MB/s' ? value * 1024 : value;
    const speedRatio = speedKBps / maxSpeed;
    return Math.min(100, Math.max(0, speedRatio * 100));
  })();
  score += speedScore * 0.4;

  const pingScore = (() => {
    const ping = testResult.pingTime;
    if (ping <= 0) return 0;
    if (maxPing === minPing) return 100;
    const pingRatio = (maxPing - ping) / (maxPing - minPing);
    return Math.min(100, Math.max(0, pingRatio * 100));
  })();
  score += pingScore * 0.2;

  return Math.round(score * 100) / 100;
}

function parseExtinfDuration(line: string): number {
  const raw = line.replace('#EXTINF:', '').split(',')[0]?.trim() || '';
  const duration = Number.parseFloat(raw);
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return duration;
}

export function isLikelyAdUri(uri: string): boolean {
  if (!uri) return false;
  const normalized = uri.toLowerCase();
  if (AD_KEYWORD_RE.test(normalized)) return true;

  try {
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost';
    const parsed = new URL(uri, base);
    if (AD_KEYWORD_RE.test(parsed.hostname)) return true;
    let matched = false;
    parsed.searchParams.forEach((value, key) => {
      if (matched) return;
      if (AD_KEYWORD_RE.test(`${key}=${value}`)) {
        matched = true;
      }
    });
    if (matched) return true;
  } catch {
    return false;
  }
  return false;
}

export function mergeAdRanges(ranges: AdRange[]): AdRange[] {
  if (!ranges.length) return [];

  const sorted = [...ranges]
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start);

  if (!sorted.length) return [];

  const merged: AdRange[] = [];
  for (const range of sorted) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({ ...range });
      continue;
    }
    if (range.start <= prev.end + 0.35) {
      prev.end = Math.max(prev.end, range.end);
      if (prev.reason !== range.reason) {
        prev.reason = `${prev.reason}|${range.reason}`;
      }
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

/**
 * 按 DISCONTINUITY 将 M3U8 行切分为多个区间，计算每个区间的总时长，
 * 识别广告区间并移除，只保留正片区间。
 *
 * 判定策略（保守）：
 * 1. 最长区间一定是正片，绝不删除
 * 2. 短区间（时长 < 最长区间的 20% 且 < 120s）标记为疑似广告
 * 3. 区间内片段 URL 命中广告关键词 → 强判定为广告
 * 4. 区间内存在 CUE-OUT / SCTE35 等广告标签 → 强判定为广告
 * 5. 仅凭时长短不足以删除（避免误删短正片），需要位于首尾位置才删除
 *
 * 返回过滤后的 M3U8 文本。如果无法识别任何广告区间，退化为仅删除
 * DISCONTINUITY 标签（与旧逻辑一致，保证不会比原来更差）。
 */
export function filterAdsFromM3U8(m3u8Content: string): string {
  if (!m3u8Content) return '';
  if (!m3u8Content.includes('#EXT-X-DISCONTINUITY')) return m3u8Content;

  const lines = m3u8Content.split('\n');

  // --- 第一步：按 DISCONTINUITY 切分区间 ---
  type Segment = {
    lines: string[];
    duration: number;
    hasAdTag: boolean;
    hasAdUri: boolean;
  };
  const segments: Segment[] = [];
  let current: Segment = {
    lines: [],
    duration: 0,
    hasAdTag: false,
    hasAdUri: false,
  };
  let pendingDuration = 0;
  let cueOutActive = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // DISCONTINUITY 标签作为区间分隔符，不放入任何区间
    if (line === '#EXT-X-DISCONTINUITY') {
      if (current.lines.length > 0) {
        segments.push(current);
        current = { lines: [], duration: 0, hasAdTag: false, hasAdUri: false };
      }
      cueOutActive = false;
      continue;
    }

    current.lines.push(rawLine);

    if (line.startsWith('#EXTINF:')) {
      pendingDuration = parseExtinfDuration(line);
      continue;
    }

    if (line.startsWith('#')) {
      if (line.startsWith('#EXT-X-CUE-IN')) {
        cueOutActive = false;
      } else if (line.startsWith('#EXT-X-CUE-OUT') || AD_TAG_RE.test(line)) {
        cueOutActive = true;
        current.hasAdTag = true;
      }
      continue;
    }

    // 非注释行 = 片段 URL
    if (pendingDuration > 0) {
      current.duration += pendingDuration;
      pendingDuration = 0;
    }
    if (cueOutActive) {
      current.hasAdTag = true;
    }
    if (isLikelyAdUri(line)) {
      current.hasAdUri = true;
    }
  }
  if (current.lines.length > 0) {
    segments.push(current);
  }

  // 只有 0 或 1 个区间，没有广告可删
  if (segments.length <= 1) return m3u8Content;

  // --- 第二步：识别广告区间 ---
  const maxDuration = Math.max(...segments.map((s) => s.duration));

  const isAdSegment = (seg: Segment, index: number): boolean => {
    // 强信号：广告标签或广告 URL
    if (seg.hasAdTag || seg.hasAdUri) return true;

    // 弱信号：时长短 + 位于首尾位置
    const isShort =
      seg.duration > 0 &&
      seg.duration < 120 &&
      seg.duration < maxDuration * 0.2;
    const isEdge = index === 0 || index === segments.length - 1;
    if (isShort && isEdge) return true;

    return false;
  };

  const adFlags = segments.map((seg, i) => isAdSegment(seg, i));
  const hasAnyAd = adFlags.some(Boolean);

  // 没识别出任何广告 → 退化为旧逻辑（仅删 DISCONTINUITY 标签）
  if (!hasAnyAd) {
    return lines.filter((l) => l.trim() !== '#EXT-X-DISCONTINUITY').join('\n');
  }

  // --- 第三步：重组 M3U8，只保留非广告区间 ---
  const contentLines: string[] = [];
  let isFirst = true;

  for (let i = 0; i < segments.length; i++) {
    if (adFlags[i]) continue;

    if (isFirst) {
      isFirst = false;
    } else {
      // 非广告区间之间保留 DISCONTINUITY（正片本身可能有合法的不连续点）
      contentLines.push('#EXT-X-DISCONTINUITY');
    }
    for (const l of segments[i].lines) {
      contentLines.push(l);
    }
  }

  return contentLines.join('\n');
}

export function collectAdRangesFromM3U8(m3u8Content: string): AdRange[] {
  if (!m3u8Content || !m3u8Content.includes('#EXTINF')) return [];

  const lines = m3u8Content.split('\n');
  const ranges: AdRange[] = [];
  let timeline = 0;
  let currentDuration = 0;
  let cueOutActive = false;
  let adTagMarked = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      currentDuration = parseExtinfDuration(line);
      continue;
    }

    if (line.startsWith('#')) {
      if (line.startsWith('#EXT-X-CUE-IN')) {
        cueOutActive = false;
        adTagMarked = false;
        continue;
      }

      if (line.startsWith('#EXT-X-CUE-OUT') || AD_TAG_RE.test(line)) {
        cueOutActive = true;
        adTagMarked = true;
      }
      continue;
    }

    const duration = currentDuration;
    const start = timeline;
    const end = timeline + duration;

    const byUriKeyword = isLikelyAdUri(line);
    const byTag = cueOutActive || adTagMarked;

    if (duration > 0 && (byUriKeyword || byTag)) {
      ranges.push({
        start,
        end,
        reason: byUriKeyword ? 'uri' : 'tag',
      });
    }

    timeline = end;
    currentDuration = 0;

    if (!cueOutActive) {
      adTagMarked = false;
    }
  }

  return mergeAdRanges(ranges);
}
