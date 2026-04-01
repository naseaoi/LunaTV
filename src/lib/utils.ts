import he from 'he';

export type DoubanImageProxyType =
  | 'direct'
  | 'server'
  | 'img3'
  | 'cmliussss-cdn-tencent'
  | 'cmliussss-cdn-ali'
  | 'custom';

/**
 * 获取豆瓣图片代理配置。
 * 优先级：用户手动设置(localStorage) > 管理后台(RUNTIME_CONFIG) > 默认(direct)
 */
export function getDoubanImageProxyConfig(): {
  proxyType: DoubanImageProxyType;
  proxyUrl: string;
} {
  if (typeof window === 'undefined') {
    // SSR 端无法读取客户端配置，返回 direct（配合 CoverImage unoptimized 使用）
    return { proxyType: 'direct', proxyUrl: '' };
  }
  const doubanImageProxyType =
    localStorage.getItem('doubanImageProxyType') ||
    window.RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
    'direct';
  const doubanImageProxy =
    localStorage.getItem('doubanImageProxyUrl') ||
    window.RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY ||
    '';
  return {
    proxyType: doubanImageProxyType as DoubanImageProxyType,
    proxyUrl: doubanImageProxy,
  };
}

/**
 * 处理豆瓣图片 URL，根据代理配置替换域名或走代理。
 * - direct: 原样返回，由 CoverImage 设置 unoptimized + referrerPolicy='no-referrer' 绕过防盗链
 * - server: 走本地 /api/image-proxy 服务端代理
 * - img3: 替换域名为 img3.doubanio.com
 * - cmliussss-cdn-*: 替换为对应 CDN 域名
 * - custom: 拼接自定义代理前缀
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // 仅处理豆瓣图片
  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }

  const { proxyType, proxyUrl } = getDoubanImageProxyConfig();
  switch (proxyType) {
    case 'direct':
      return originalUrl;
    case 'server':
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    case 'img3':
      return originalUrl.replace(/img\d+\.doubanio\.com/g, 'img3.doubanio.com');
    case 'cmliussss-cdn-tencent':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.net',
      );
    case 'cmliussss-cdn-ali':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.com',
      );
    case 'custom':
      return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
    default:
      return originalUrl;
  }
}

export function cleanHtmlTags(text: string): string {
  if (!text) return '';

  const cleanedText = text
    .replace(/<[^>]+>/g, '\n') // 将 HTML 标签替换为换行
    .replace(/\n+/g, '\n') // 将多个连续换行合并为一个
    .replace(/[ \t]+/g, ' ') // 将多个连续空格和制表符合并为一个空格，但保留换行符
    .replace(/^\n+|\n+$/g, '') // 去掉首尾换行
    .trim(); // 去掉首尾空格

  // 使用 he 库解码 HTML 实体
  return he.decode(cleanedText);
}

/**
 * 解析存储 key（格式：`{source}+{id}`）
 * 返回 null 表示格式无效
 */
export function parseStorageKey(
  key: string,
): { source: string; id: string } | null {
  const idx = key.indexOf('+');
  if (idx <= 0 || idx === key.length - 1) return null;
  return { source: key.substring(0, idx), id: key.substring(idx + 1) };
}
