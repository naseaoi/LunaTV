import { defaultCache } from '@serwist/next/worker';
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Serwist 提供的 Next.js 默认缓存策略（静态资源、页面路由等）
    ...defaultCache,
    // next/image 缓存
    {
      matcher: ({ url }) =>
        /^\/_next\/image\?url=.+$/.test(url.pathname + url.search),
      handler: new StaleWhileRevalidate({
        cacheName: 'next-image-cache',
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 256,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    // 封面代理缓存
    {
      matcher: ({ url }) =>
        /^\/api\/image-proxy\?url=.+$/.test(url.pathname + url.search),
      handler: new CacheFirst({
        cacheName: 'cover-proxy-cache',
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 256,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    // 豆瓣外部图片缓存
    {
      matcher: ({ url }) =>
        /^(img\d+\.doubanio\.com|img3\.doubanio\.com|img\.doubanio\.cmliussss\.(net|com))$/.test(
          url.hostname,
        ),
      handler: new StaleWhileRevalidate({
        cacheName: 'external-cover-cache',
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 256,
            maxAgeSeconds: 14 * 24 * 60 * 60,
          }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();
