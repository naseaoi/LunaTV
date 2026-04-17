/**
 * 动态注入 <link rel=preconnect> 给定 origin，节省 DNS+TCP+TLS 握手时延。
 *
 * 场景：播放页 mount 时提前建连到视频源站（尤其是 allowCORS 直连模式下），
 * HLS.js 真正开始拉分片前已完成 3~4 次 RTT 的握手，首帧更快。
 *
 * 幂等：同 origin 重复注入时跳过；浏览器本身也会忽略重复 preconnect。
 */

const injected = new Set<string>();

/**
 * 注入一个 preconnect link 到 <head>。
 * - origin 必须为 `https://host` 或 `http://host` 形式
 * - crossOrigin=true 时附加 `crossorigin`，媒体资源通常需要
 * 返回 cleanup，调用后移除该 link（可选，一般无需清理）。
 */
export function injectPreconnect(
  origin: string,
  crossOrigin = true,
): () => void {
  if (typeof document === 'undefined') return () => undefined;
  if (!origin || injected.has(origin)) return () => undefined;

  try {
    // 简单校验，避免把完整 URL 传进来导致 href 不合法
    const u = new URL(origin);
    const normalized = `${u.protocol}//${u.host}`;
    if (injected.has(normalized)) return () => undefined;

    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = normalized;
    if (crossOrigin) link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    injected.add(normalized);

    return () => {
      link.remove();
      injected.delete(normalized);
    };
  } catch {
    return () => undefined;
  }
}

/** 便捷方法：从任意 URL 中抽取 origin 并注入 preconnect。 */
export function preconnectForUrl(url: string, crossOrigin = true): void {
  if (!url) return;
  try {
    const u = new URL(url);
    injectPreconnect(`${u.protocol}//${u.host}`, crossOrigin);
  } catch {
    /* 非合法 URL，忽略 */
  }
}
