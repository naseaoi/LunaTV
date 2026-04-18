/**
 * 广告段识别器（针对 cj.rycjapi 这类按 DISCONTINUITY 切分、但广告
 * 段与正片段在时长/码率上均有明显偏离的源站）。
 *
 * 基础观察：
 * - 正片被均匀切片，单集内段时长呈显著众数（如 25s × N）；
 * - 广告为独立编码素材拼入，段时长会偏离众数（如 20s）；
 * - 同时广告的编码码率通常高于正片（样本中 4~5 倍）。
 *
 * 算法：时长众数过滤（零开销）→ 偏离段再做段均码率复核。
 * 仅对命中两路信号的段判为广告，控制误杀。
 */
import { getBaseUrl, resolveUrl } from '@/lib/live';

/** 段落解析结果（一个 DISCONTINUITY 之间的 ts 集合） */
interface DiscontSegment {
  /** 原 m3u8 中属于该段的行索引（含 #EXTINF 与 ts 行，不含分段标记） */
  lineIndices: number[];
  /** 段内 ts 相对路径（按原顺序） */
  tsPaths: string[];
  /** 段总时长（秒） */
  duration: number;
}

/** 判断某 source key 是否启用广告段物理识别 */
export function shouldRunAdDetection(source: string | null): boolean {
  if (!source) return false;
  // cj.rycjapi 源站 key 在本项目中通常配置为 "rycj"
  return source === 'rycj';
}

/** 将 m3u8 按 DISCONTINUITY 切为段；返回段数组与原行数组 */
function parseSegments(m3u8Content: string): {
  lines: string[];
  segments: DiscontSegment[];
} {
  const lines = m3u8Content.split('\n');
  const segments: DiscontSegment[] = [];
  let current: DiscontSegment = { lineIndices: [], tsPaths: [], duration: 0 };
  let pendingDur = 0;
  let pendingExtinfIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();

    if (t === '#EXT-X-DISCONTINUITY') {
      if (current.tsPaths.length > 0) {
        segments.push(current);
      }
      current = { lineIndices: [], tsPaths: [], duration: 0 };
      pendingDur = 0;
      pendingExtinfIdx = -1;
      continue;
    }

    if (t.startsWith('#EXTINF:')) {
      const raw = t.slice(8).split(',')[0]?.trim() || '';
      pendingDur = Number.parseFloat(raw) || 0;
      pendingExtinfIdx = i;
      continue;
    }

    // ts 行
    if (t && !t.startsWith('#')) {
      if (pendingExtinfIdx >= 0) current.lineIndices.push(pendingExtinfIdx);
      current.lineIndices.push(i);
      current.tsPaths.push(t);
      current.duration += pendingDur;
      pendingDur = 0;
      pendingExtinfIdx = -1;
    }
  }
  if (current.tsPaths.length > 0) segments.push(current);

  return { lines, segments };
}

/** 计算段时长众数（精度 0.1s）；不满足规律性时返回 null */
function computeDurationMode(segments: DiscontSegment[]): number | null {
  if (segments.length < 3) return null;

  const buckets = new Map<number, number>();
  for (const s of segments) {
    const key = Math.round(s.duration * 10) / 10;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
  const [modeKey, modeCount] = sorted[0];

  // 众数覆盖率 < 60% → 切分不规整，算法不适用
  if (modeCount / segments.length < 0.6) return null;
  return modeKey;
}

/** 通过 Range 请求获取 ts 总字节数（仅传回 188 字节头） */
async function fetchTsSize(url: string, ua: string): Promise<number> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': ua, Range: 'bytes=0-187' },
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok || res.status !== 206) return 0;
    const cr = res.headers.get('content-range') || '';
    const total = Number.parseInt(cr.split('/')[1] || '0', 10);
    // 关闭 body，避免 socket 挂起
    try {
      await res.arrayBuffer();
    } catch {
      /* ignore */
    }
    return Number.isFinite(total) ? total : 0;
  } catch {
    return 0;
  }
}

/** 段均码率（kbps）：所有 ts 的 Content-Length 之和 / 段时长 */
async function computeSegmentBitrate(
  seg: DiscontSegment,
  baseUrl: string,
  ua: string,
): Promise<number> {
  if (seg.duration <= 0 || seg.tsPaths.length === 0) return 0;

  const sizes = await Promise.all(
    seg.tsPaths.map((p) => fetchTsSize(resolveUrl(baseUrl, p), ua)),
  );
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return (total * 8) / seg.duration / 1000;
}

/** 从 normal 段中采样若干做基线码率（防御式：最多 5 个，避免开销） */
async function computeBaselineBitrate(
  segments: DiscontSegment[],
  mode: number,
  baseUrl: string,
  ua: string,
): Promise<number> {
  const candidates = segments.filter(
    (s) => Math.abs(s.duration - mode) < 0.5 && s.tsPaths.length > 0,
  );
  if (candidates.length === 0) return 0;

  // 均匀采样 5 个，避免集中在开头（开头可能不是稳态）
  const step = Math.max(1, Math.floor(candidates.length / 5));
  const sampled: DiscontSegment[] = [];
  for (let i = 0; i < candidates.length && sampled.length < 5; i += step) {
    sampled.push(candidates[i]);
  }

  const rates = await Promise.all(
    sampled.map((s) => computeSegmentBitrate(s, baseUrl, ua)),
  );
  const valid = rates.filter((r) => r > 0).sort((a, b) => a - b);
  if (valid.length === 0) return 0;
  return valid[Math.floor(valid.length / 2)];
}

/** 生成去掉广告段后的 m3u8 文本，保持其他行原样 */
function rebuildM3U8(
  lines: string[],
  segments: DiscontSegment[],
  adIndices: Set<number>,
): string {
  if (adIndices.size === 0) return lines.join('\n');

  // 收集所有要删除的行号
  const dropLines = new Set<number>();
  for (const idx of adIndices) {
    for (const li of segments[idx].lineIndices) dropLines.add(li);
  }

  // 仅保留非广告行；DISCONTINUITY 原本就是段之间的分隔符，删广告段后
  // 相邻两个正片段间仍保留一条 DISCONTINUITY，无需额外处理。
  // 但要避免多个广告段相邻时出现连续 DISCONTINUITY，做一次折叠。
  const out: string[] = [];
  let lastWasDisc = false;
  for (let i = 0; i < lines.length; i++) {
    if (dropLines.has(i)) continue;
    const t = lines[i].trim();
    if (t === '#EXT-X-DISCONTINUITY') {
      if (lastWasDisc) continue;
      lastWasDisc = true;
    } else if (t !== '') {
      lastWasDisc = false;
    }
    out.push(lines[i]);
  }
  return out.join('\n');
}

/**
 * 对一段 m3u8 内容做广告段识别与剔除。
 * 识别失败或无可疑段时原样返回，保证永不更差。
 */
export async function stripAdSegmentsByPhysicalSignal(
  m3u8Content: string,
  originM3u8Url: string,
  ua: string,
): Promise<string> {
  // 前置门控：不含 DISCONTINUITY 的清单不处理
  if (!m3u8Content.includes('#EXT-X-DISCONTINUITY')) return m3u8Content;

  const { lines, segments } = parseSegments(m3u8Content);
  if (segments.length < 4) return m3u8Content;

  const mode = computeDurationMode(segments);
  if (mode === null) return m3u8Content;

  // 1. 筛可疑段：偏离众数 >1s（排除尾段短碎片与过短段）
  const suspiciousIdx: number[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (Math.abs(s.duration - mode) < 1) continue;
    // 尾段碎片（最后一段 1 个 ts 且时长很短）不做处理
    if (i === segments.length - 1 && s.tsPaths.length === 1 && s.duration < 5) {
      continue;
    }
    suspiciousIdx.push(i);
  }
  if (suspiciousIdx.length === 0) return m3u8Content;

  // 2. 基线码率 + 可疑段码率，双信号复核
  const baseUrl = getBaseUrl(originM3u8Url);
  const [baseline, suspectRates] = await Promise.all([
    computeBaselineBitrate(segments, mode, baseUrl, ua),
    Promise.all(
      suspiciousIdx.map((i) => computeSegmentBitrate(segments[i], baseUrl, ua)),
    ),
  ]);
  if (baseline <= 0) return m3u8Content;

  // 3. 码率超过基线 2 倍才判广告
  const adIndices = new Set<number>();
  suspiciousIdx.forEach((segIdx, k) => {
    const r = suspectRates[k];
    if (r > 0 && r > baseline * 2) adIndices.add(segIdx);
  });

  if (adIndices.size === 0) return m3u8Content;
  return rebuildM3U8(lines, segments, adIndices);
}
