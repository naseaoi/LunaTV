/**
 * 源站 CORS 能力探测结果缓存
 *
 * 背景：admin 将源站标记为 'server'（服务端代理）是出于稳妥——不少源站不支持
 * CORS，浏览器无法直连。但实际上很多源站已经返回 `Access-Control-Allow-Origin: *`，
 * 此时继续走代理只是在给服务器增负、给用户增加一跳延迟。
 *
 * 本模块在服务端运行时自动探测每个 source 的 CORS 能力：
 * - 仅观察真实媒体资源（segment / key）响应头，避免被 m3u8 头误判
 * - TTL 1h，到期自动重新探测（源站策略可能变化）
 * - m3u8 重写段 URL 时参考结果：CORS-capable 的源即便 allowCORS=false 也直出原始 URL
 *
 * 决策只影响 segment / key URL 重写，不影响 admin 的 proxyMode 语义；
 * m3u8 本身仍走代理（否则客户端 HLS 会遇到 CORS 阻塞）。
 */

type Capability = {
  // 是否支持 CORS（最近一次探测结果）
  cors: boolean;
  // 记录时间，用于 TTL
  at: number;
};

const capabilityMap = new Map<string, Capability>();
const CAPABILITY_TTL_MS = 60 * 60 * 1000; // 1 小时
const MAX_ENTRIES = 500;

/** 检查响应头是否表明支持跨域 */
export function responseAllowsCors(
  headers: Headers,
  requestOrigin?: string | null,
): boolean {
  const allowOrigin = headers.get('access-control-allow-origin');
  if (!allowOrigin) return false;
  if (allowOrigin === '*') return true;
  if (requestOrigin && allowOrigin === requestOrigin) return true;
  return false;
}

/** 记录一次探测结果 */
export function markSourceCors(sourceKey: string, capable: boolean): void {
  if (!sourceKey) return;
  // 溢出时淘汰最早记录
  if (capabilityMap.size >= MAX_ENTRIES && !capabilityMap.has(sourceKey)) {
    const firstKey = capabilityMap.keys().next().value;
    if (firstKey) capabilityMap.delete(firstKey);
  }
  capabilityMap.set(sourceKey, { cors: capable, at: Date.now() });
}

/**
 * 查询某源站是否已知支持 CORS。
 * - 无记录 / 记录已过期：返回 undefined（调用方走保守路径，不重写为直连）
 * - 记录为 false：返回 false（确认不支持）
 * - 记录为 true：返回 true（已验证支持）
 */
export function isSourceCorsCapable(sourceKey: string): boolean | undefined {
  if (!sourceKey) return undefined;
  const entry = capabilityMap.get(sourceKey);
  if (!entry) return undefined;
  if (Date.now() - entry.at > CAPABILITY_TTL_MS) {
    capabilityMap.delete(sourceKey);
    return undefined;
  }
  return entry.cors;
}

/** 调试/管理用：返回当前能力快照（只读） */
export function snapshotCapabilities(): Record<string, Capability> {
  const now = Date.now();
  const snap: Record<string, Capability> = {};
  capabilityMap.forEach((value, key) => {
    if (now - value.at <= CAPABILITY_TTL_MS) snap[key] = { ...value };
  });
  return snap;
}
