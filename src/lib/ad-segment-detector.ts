/**
 * 广告段识别器（针对 cj.rycjapi 这类按 DISCONTINUITY 切分、广告与正片
 * 在编码器特征上有明显差异的源站）。
 *
 * 识别信号按成本由低到高分三路：
 *
 *  信号 A - EXTINF 量化规律（纯本地、零开销）：
 *    正片由原始转码切片，EXTINF 时长为微秒级浮点（4.170833, 3.628622）；
 *    广告素材多为独立编码 + ffmpeg segment 切片，常见两类指纹：
 *      A1. 整秒/近整秒切片：4.0 × N + 尾帧；
 *      A2. 25fps 粗粒度步进：4.00 / 5.48 / 3.24 / 0.28 这类 40ms 网格时长。
 *    当整片段的量化特征显著高于正片基线时判广告。
 *
 *  信号 B - TS Host 异常（纯本地、零开销）：
 *    正片 TS 从主 CDN host 下发；部分源站将广告 TS 硬编码为 absolute URL
 *    指向另一个 CDN。整段 TS host 与全局主流 host 不同时判广告。
 *
 *  信号 C - 时长众数 + 段均码率复核（需 Range 请求，兜底）：
 *    正片段总时长呈显著众数时启用；偏离众数且段均码率显著高于基线者判广告。
 *    对"段总时长高度一致"的源站有效；段总时长离散的源站由 A/B 覆盖。
 *
 * 任一路命中即剔除该 DISCONTINUITY 段及其所有 TS 行。
 * 永不更差：识别失败或无信号时原样返回。
 */
import { getBaseUrl, resolveUrl } from '@/lib/live';

/** 段落解析结果（一个 DISCONTINUITY 之间的 ts 集合） */
interface DiscontSegment {
  /** 原 m3u8 中属于该段的行索引（含 #EXTINF 与 ts 行，不含分段标记） */
  lineIndices: number[];
  /** 段内 ts 相对/绝对路径（按原顺序） */
  tsPaths: string[];
  /** 段内每个 ts 的 EXTINF 时长（秒），与 tsPaths 一一对应 */
  tsDurations: number[];
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
  let current: DiscontSegment = {
    lineIndices: [],
    tsPaths: [],
    tsDurations: [],
    duration: 0,
  };
  let pendingDur = 0;
  let pendingExtinfIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();

    if (t === '#EXT-X-DISCONTINUITY') {
      if (current.tsPaths.length > 0) {
        segments.push(current);
      }
      current = {
        lineIndices: [],
        tsPaths: [],
        tsDurations: [],
        duration: 0,
      };
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
      current.tsDurations.push(pendingDur);
      current.duration += pendingDur;
      pendingDur = 0;
      pendingExtinfIdx = -1;
    }
  }
  if (current.tsPaths.length > 0) segments.push(current);

  return { lines, segments };
}

// ============================================================
// 信号 A：EXTINF 量化规律（本地、零开销）
// ============================================================

/** 判定浮点数是否近似整数秒（误差 < 10ms） */
function isNearInteger(d: number): boolean {
  if (d <= 0) return false;
  return Math.abs(d - Math.round(d)) < 0.01;
}

/** 判定时长是否贴近固定步进网格（默认 40ms，对应常见 25fps 广告切片） */
function isNearGrid(d: number, step: number): boolean {
  if (d <= 0 || step <= 0) return false;
  const snapped = Math.round(d / step) * step;
  return Math.abs(d - snapped) < 0.01;
}

/** 计算段内 TS 时长的"整数率"（0~1） */
function integerRatioOfSegment(seg: DiscontSegment): number {
  if (seg.tsDurations.length === 0) return 0;
  const hits = seg.tsDurations.filter(isNearInteger).length;
  return hits / seg.tsDurations.length;
}

/** 计算段内 TS 时长的 40ms 网格命中率（0~1） */
function coarseGridRatioOfSegment(seg: DiscontSegment): number {
  if (seg.tsDurations.length === 0) return 0;
  const hits = seg.tsDurations.filter((d) => isNearGrid(d, 0.04)).length;
  return hits / seg.tsDurations.length;
}

/** 段内将时长按指定精度量化后的众数占比 */
function roundedModeShare(seg: DiscontSegment, digits: number): number {
  if (seg.tsDurations.length === 0) return 0;
  const scale = 10 ** digits;
  const counts = new Map<number, number>();
  for (const d of seg.tsDurations) {
    const k = Math.round(d * scale) / scale;
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  let topCount = 0;
  counts.forEach((v) => {
    if (v > topCount) topCount = v;
  });
  return topCount / seg.tsDurations.length;
}

/** 中位数（数组会被拷贝排序） */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * 检测 EXTINF 量化规律异常段。
 *
 * A1. 整秒规律（必须全部满足）：
 *   1. 段内 TS 数 ≥ 3（样本太少易误判）；
 *   2. 段内整数率 ≥ 0.85（允许 1~2 个非整数尾帧）；
 *   3. 主值重复：段内整数化后 round(d) 的众数占比 ≥ 0.5；
 *   4. 与全局基线显著差异：基线（全体段整数率的中位数）< 0.4，
 *      或本段整数率比基线高 0.5 以上。
 *
 * A2. 粗粒度步进规律（必须全部满足）：
 *   1. 段内 TS 数 ≥ 4；
 *   2. 40ms 网格命中率 ≥ 0.85；
 *   3. 2 位小数量化后的众数占比 ≥ 0.5（典型为 4.00 重复多次）；
 *   4. 近整数率 ≥ 0.45（保守要求至少半段是 4.00 / 5.00 / 3.00 这类整秒片）；
 *   5. 与全局基线显著差异：全体段 40ms 网格命中率中位数 < 0.35，
 *      或本段比基线高 0.5 以上。
 *
 * 条件 4/5 用于防止"整片都是粗粒度切片的源站"被整体误判。
 */
function detectByExtinfIntegerPattern(segments: DiscontSegment[]): Set<number> {
  const result = new Set<number>();
  if (segments.length < 3) return result;

  const ratios = segments.map(integerRatioOfSegment);
  const integerBaseline = median(ratios);
  const coarseRatios = segments.map(coarseGridRatioOfSegment);
  const coarseBaseline = median(coarseRatios);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.tsDurations.length < 3) continue;

    const ratio = ratios[i];

    // 主值重复度：段内整数化后的最高频次 / 段内 TS 数
    const counts = new Map<number, number>();
    for (const d of seg.tsDurations) {
      if (!isNearInteger(d)) continue;
      const k = Math.round(d);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    let topCount = 0;
    counts.forEach((v) => {
      if (v > topCount) topCount = v;
    });
    const topShare = topCount / seg.tsDurations.length;

    const coarseRatio = coarseRatios[i];
    const coarseModeShare = roundedModeShare(seg, 2);

    const matchedIntegerPattern =
      ratio >= 0.85 &&
      topShare >= 0.5 &&
      !(integerBaseline >= 0.4 && ratio - integerBaseline < 0.5);

    const matchedCoarseGridPattern =
      seg.tsDurations.length >= 4 &&
      coarseRatio >= 0.85 &&
      coarseModeShare >= 0.5 &&
      ratio >= 0.45 &&
      !(coarseBaseline >= 0.35 && coarseRatio - coarseBaseline < 0.5);

    if (matchedIntegerPattern || matchedCoarseGridPattern) {
      result.add(i);
    }
  }

  return result;
}

// ============================================================
// 信号 B：TS Host 异常（本地、零开销）
// ============================================================

/** 判断路径是否为绝对 URL（http/https） */
function isAbsoluteUrl(p: string): boolean {
  return /^https?:\/\//i.test(p);
}

/** 提取段内所有 TS 的 host（相对路径 resolve 到 baseUrl） */
function collectSegmentHosts(seg: DiscontSegment, baseUrl: string): string[] {
  const hosts: string[] = [];
  for (const p of seg.tsPaths) {
    try {
      hosts.push(new URL(p, baseUrl).host.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  return hosts;
}

/**
 * 检测 TS host 异常段。
 *
 * 判定规则：
 *   1. 存在"主流 host"：某 host 覆盖 ≥ 60% 的全体 TS（含相对路径 resolve 到 baseUrl）；
 *   2. 段内至少 2 个绝对 URL TS（相对路径段天然属于 baseUrl host，不适用此识别）；
 *   3. 段内全部 host 与主流 host 不同。
 *
 * 覆盖场景：部分源站把广告 TS 用绝对 URL 指向独立广告 CDN。
 */
function detectByHostAnomaly(
  segments: DiscontSegment[],
  baseUrl: string,
): Set<number> {
  const result = new Set<number>();

  // 统计全体 TS host 频次（相对路径算作 baseUrl 的 host）
  const globalCounts = new Map<string, number>();
  let totalTs = 0;
  for (const s of segments) {
    totalTs += s.tsPaths.length;
    for (const h of collectSegmentHosts(s, baseUrl)) {
      globalCounts.set(h, (globalCounts.get(h) || 0) + 1);
    }
  }
  if (totalTs === 0) return result;

  let dominantHost: string | null = null;
  let dominantCount = 0;
  globalCounts.forEach((v, k) => {
    if (v > dominantCount) {
      dominantHost = k;
      dominantCount = v;
    }
  });
  if (!dominantHost || dominantCount / totalTs < 0.6) return result;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    // 段内至少 2 个绝对 URL 才启用识别（避免相对路径段被误判）
    const absCount = seg.tsPaths.filter(isAbsoluteUrl).length;
    if (absCount < 2) continue;
    const hosts = collectSegmentHosts(seg, baseUrl);
    if (hosts.length === 0) continue;
    if (hosts.every((h) => h !== dominantHost)) {
      result.add(i);
    }
  }
  return result;
}

// ============================================================
// 信号 C：时长众数 + 段均码率（兜底，需网络）
// ============================================================

/** 计算段时长众数（精度 0.1s）；不满足规律性时返回 null */
function computeDurationMode(segments: DiscontSegment[]): number | null {
  if (segments.length < 3) return null;

  const buckets = new Map<number, number>();
  for (const s of segments) {
    const key = Math.round(s.duration * 10) / 10;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const sorted = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]);
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

async function detectByBitrate(
  segments: DiscontSegment[],
  baseUrl: string,
  ua: string,
): Promise<Set<number>> {
  const result = new Set<number>();

  const mode = computeDurationMode(segments);
  if (mode === null) return result;

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
  if (suspiciousIdx.length === 0) return result;

  // 2. 基线码率 + 可疑段码率，双信号复核
  const [baseline, suspectRates] = await Promise.all([
    computeBaselineBitrate(segments, mode, baseUrl, ua),
    Promise.all(
      suspiciousIdx.map((i) => computeSegmentBitrate(segments[i], baseUrl, ua)),
    ),
  ]);
  if (baseline <= 0) return result;

  // 3. 码率超过基线 2 倍才判广告
  suspiciousIdx.forEach((segIdx, k) => {
    const r = suspectRates[k];
    if (r > 0 && r > baseline * 2) result.add(segIdx);
  });
  return result;
}

// ============================================================
// 重建 m3u8
// ============================================================

/** 生成去掉广告段后的 m3u8 文本，保持其他行原样 */
function rebuildM3U8(
  lines: string[],
  segments: DiscontSegment[],
  adIndices: Set<number>,
): string {
  if (adIndices.size === 0) return lines.join('\n');

  // 收集所有要删除的行号
  const dropLines = new Set<number>();
  adIndices.forEach((idx) => {
    for (const li of segments[idx].lineIndices) dropLines.add(li);
  });

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

// ============================================================
// 主入口
// ============================================================

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

  const baseUrl = getBaseUrl(originM3u8Url);

  // 先跑本地强信号（A + B），命中即返回，零网络成本
  const adSet = new Set<number>();
  detectByExtinfIntegerPattern(segments).forEach((i) => adSet.add(i));
  detectByHostAnomaly(segments, baseUrl).forEach((i) => adSet.add(i));

  if (adSet.size > 0) {
    return rebuildM3U8(lines, segments, adSet);
  }

  // 兜底：时长众数 + 段均码率（需 Range 请求）
  try {
    const bitrateSet = await detectByBitrate(segments, baseUrl, ua);
    if (bitrateSet.size > 0) {
      return rebuildM3U8(lines, segments, bitrateSet);
    }
  } catch {
    /* 兜底失败不影响原始返回 */
  }

  return m3u8Content;
}
