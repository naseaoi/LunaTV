/**
 * SSRF 防护：校验代理请求的目标 URL，阻止内网探测。
 */

// 内网 / 保留 IP 段（CIDR）
const BLOCKED_RANGES = [
  // IPv4 loopback
  { prefix: '127.', exact: false },
  // IPv4 private
  { prefix: '10.', exact: false },
  { prefix: '192.168.', exact: false },
  // 172.16.0.0 – 172.31.255.255
  { prefix: '172.', exact: false, check: is172Private },
  // link-local
  { prefix: '169.254.', exact: false },
  // IPv6 loopback & link-local
  { prefix: '::1', exact: true },
  { prefix: 'fe80:', exact: false },
  { prefix: 'fc00:', exact: false },
  { prefix: 'fd', exact: false },
  // 0.0.0.0
  { prefix: '0.0.0.0', exact: true },
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
]);

function is172Private(ip: string): boolean {
  const second = parseInt(ip.split('.')[1], 10);
  return second >= 16 && second <= 31;
}

function isBlockedIp(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(lower)) return true;

  for (const range of BLOCKED_RANGES) {
    if (range.exact) {
      if (lower === range.prefix) return true;
    } else if (lower.startsWith(range.prefix)) {
      if (range.check) {
        if (range.check(lower)) return true;
      } else {
        return true;
      }
    }
  }

  return false;
}

export type UrlValidationResult =
  | { ok: true; url: string }
  | { ok: false; reason: string };

/**
 * 校验代理目标 URL：
 * 1. 仅允许 http / https 协议
 * 2. 拒绝内网 / 保留 IP 和特殊主机名
 */
export function validateProxyUrl(raw: string): UrlValidationResult {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { ok: false, reason: 'Invalid URL encoding' };
  }

  let parsed: URL;
  try {
    parsed = new URL(decoded);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  // 仅允许 http / https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only http/https allowed' };
  }

  // 去掉方括号（IPv6 字面量）
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  if (isBlockedIp(hostname)) {
    return { ok: false, reason: 'Blocked destination' };
  }

  return { ok: true, url: decoded };
}
