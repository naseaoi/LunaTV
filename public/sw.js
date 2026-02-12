if (!self.define) {
  let e,
    s = {};
  const i = (i, c) => (
    (i = new URL(i + '.js', c).href),
    s[i] ||
      new Promise((s) => {
        if ('document' in self) {
          const e = document.createElement('script');
          ((e.src = i), (e.onload = s), document.head.appendChild(e));
        } else ((e = i), importScripts(i), s());
      }).then(() => {
        let e = s[i];
        if (!e) throw new Error(`Module ${i} didn’t register its module`);
        return e;
      })
  );
  self.define = (c, n) => {
    const t =
      e ||
      ('document' in self ? document.currentScript.src : '') ||
      location.href;
    if (s[t]) return;
    let a = {};
    const r = (e) => i(e, t),
      o = { module: { uri: t }, exports: a, require: r };
    s[t] = Promise.all(c.map((e) => o[e] || r(e))).then((e) => (n(...e), a));
  };
}
define(['./workbox-e9849328'], function (e) {
  'use strict';
  (importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        {
          url: '/_next/static/chunks/1109-38a1de6599508c1e.js',
          revision: '38a1de6599508c1e',
        },
        {
          url: '/_next/static/chunks/1406-ad41032758c255d3.js',
          revision: 'ad41032758c255d3',
        },
        {
          url: '/_next/static/chunks/1790-37df6fce1fddeb28.js',
          revision: '37df6fce1fddeb28',
        },
        {
          url: '/_next/static/chunks/2571-8a7630af0770d128.js',
          revision: '8a7630af0770d128',
        },
        {
          url: '/_next/static/chunks/2922.682797e46620cda2.js',
          revision: '682797e46620cda2',
        },
        {
          url: '/_next/static/chunks/4602-116225abeb0b5321.js',
          revision: '116225abeb0b5321',
        },
        {
          url: '/_next/static/chunks/483-f03bab21e1fd08a2.js',
          revision: 'f03bab21e1fd08a2',
        },
        {
          url: '/_next/static/chunks/6407.8fbed1a1b4293227.js',
          revision: '8fbed1a1b4293227',
        },
        {
          url: '/_next/static/chunks/8334-1b36f014540512ab.js',
          revision: '1b36f014540512ab',
        },
        {
          url: '/_next/static/chunks/898-cf5c60661816990c.js',
          revision: 'cf5c60661816990c',
        },
        {
          url: '/_next/static/chunks/9482-fee74c42161518b8.js',
          revision: 'fee74c42161518b8',
        },
        {
          url: '/_next/static/chunks/app/_global-error/page-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/_not-found/page-eb8ca3bcf4eb7f51.js',
          revision: 'eb8ca3bcf4eb7f51',
        },
        {
          url: '/_next/static/chunks/app/admin/page-c737331e0197cf07.js',
          revision: 'c737331e0197cf07',
        },
        {
          url: '/_next/static/chunks/app/api/admin/category/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/admin/config/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/admin/config_file/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/admin/config_subscription/fetch/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/admin/data_migration/export/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/admin/data_migration/import/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/admin/live/refresh/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/admin/live/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/admin/reset/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/admin/site/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/admin/source/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/admin/source/validate/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/admin/user/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/auth/session/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/change-password/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/cron/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/detail/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/douban/categories/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/douban/recommends/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/douban/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/favorites/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/image-proxy/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/live/channels/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/live/epg/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/live/precheck/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/live/sources/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/login/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/logout/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/playrecords/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/proxy/key/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/proxy/logo/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/proxy/m3u8/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/proxy/segment/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/register/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/search/one/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/search/resources/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/search/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/search/suggestions/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/search/ws/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/searchhistory/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/server-config/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/skipconfigs/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/api/version/latest/route-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/app/douban/page-f94d4c85d6903a89.js',
          revision: 'f94d4c85d6903a89',
        },
        {
          url: '/_next/static/chunks/app/layout-d91a813e304f9710.js',
          revision: 'd91a813e304f9710',
        },
        {
          url: '/_next/static/chunks/app/live/page-bb8482e2963604b0.js',
          revision: 'bb8482e2963604b0',
        },
        {
          url: '/_next/static/chunks/app/login/page-e7bc02d02f11d2b0.js',
          revision: 'e7bc02d02f11d2b0',
        },
        {
          url: '/_next/static/chunks/app/page-6819bb7765c2098c.js',
          revision: '6819bb7765c2098c',
        },
        {
          url: '/_next/static/chunks/app/play/page-e2dd96a6e2267754.js',
          revision: 'e2dd96a6e2267754',
        },
        {
          url: '/_next/static/chunks/app/search/page-39402a65c9e64166.js',
          revision: '39402a65c9e64166',
        },
        {
          url: '/_next/static/chunks/app/warning/page-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/d5b6d25f-5b28156c30d129f1.js',
          revision: '5b28156c30d129f1',
        },
        {
          url: '/_next/static/chunks/deb030d4-d09e16096fe77d71.js',
          revision: 'd09e16096fe77d71',
        },
        {
          url: '/_next/static/chunks/framework-af674a464d67f8cb.js',
          revision: 'af674a464d67f8cb',
        },
        {
          url: '/_next/static/chunks/main-app-b741a61d59381658.js',
          revision: 'b741a61d59381658',
        },
        {
          url: '/_next/static/chunks/main-f5b364e927bda0f8.js',
          revision: 'f5b364e927bda0f8',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/app-error-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/forbidden-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/global-error-aed3ffd1c64df30e.js',
          revision: 'aed3ffd1c64df30e',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/not-found-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/unauthorized-9802e88d022018c9.js',
          revision: '9802e88d022018c9',
        },
        {
          url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
          revision: '846118c33b2c0e922d7b3a7676f81f6f',
        },
        {
          url: '/_next/static/chunks/webpack-f621c10d7acef2ab.js',
          revision: 'f621c10d7acef2ab',
        },
        {
          url: '/_next/static/css/7e7d96b1e6991756.css',
          revision: '7e7d96b1e6991756',
        },
        {
          url: '/_next/static/css/b699611732f728a6.css',
          revision: 'b699611732f728a6',
        },
        {
          url: '/_next/static/fQ37eYFaJlPDYNVV-57H-/_buildManifest.js',
          revision: '18ab151e2fb5b7653af26eaf785ffed2',
        },
        {
          url: '/_next/static/fQ37eYFaJlPDYNVV-57H-/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
        },
        {
          url: '/_next/static/media/19cfc7226ec3afaa-s.woff2',
          revision: '9dda5cfc9a46f256d0e131bb535e46f8',
        },
        {
          url: '/_next/static/media/21350d82a1f187e9-s.woff2',
          revision: '4e2553027f1d60eff32898367dd4d541',
        },
        {
          url: '/_next/static/media/8e9860b6e62d6359-s.woff2',
          revision: '01ba6c2a184b8cba08b0d57167664d75',
        },
        {
          url: '/_next/static/media/ba9851c3c22cd980-s.woff2',
          revision: '9e494903d6b0ffec1a1e14d34427d44d',
        },
        {
          url: '/_next/static/media/c5fe6dc8356a8c31-s.woff2',
          revision: '027a89e9ab733a145db70f09b8a18b42',
        },
        {
          url: '/_next/static/media/df0a9ae256c0569c-s.woff2',
          revision: 'd54db44de5ccb18886ece2fda72bdfe0',
        },
        {
          url: '/_next/static/media/e4af272ccee01ff0-s.p.woff2',
          revision: '65850a373e258f1c897a2b3d75eb74de',
        },
        { url: '/favicon.ico', revision: '2a440afb7f13a0c990049fc7c383bdd4' },
        {
          url: '/icons/icon-192x192.png',
          revision: 'e214d3db80d2eb6ef7a911b3f9433b81',
        },
        {
          url: '/icons/icon-256x256.png',
          revision: 'a5cd7490191373b684033f1b33c9d9da',
        },
        {
          url: '/icons/icon-384x384.png',
          revision: '8540e29a41812989d2d5bf8f61e1e755',
        },
        {
          url: '/icons/icon-512x512.png',
          revision: '3e5597604f2c5d99d7ab62b02f6863d3',
        },
        { url: '/logo.png', revision: '5c1047adbe59b9a91cc7f8d3d2f95ef4' },
        { url: '/manifest.json', revision: '6a88bd8e4d722a7046a7e43050b208e3' },
        { url: '/robots.txt', revision: 'e2b2cd8514443456bc6fb9d77b3b1f3e' },
        {
          url: '/screenshot1.png',
          revision: 'd7de3a25686c5b9c9d8c8675bc6109fc',
        },
        {
          url: '/screenshot2.png',
          revision: 'b0b715a3018d2f02aba5d94762473bb6',
        },
        {
          url: '/screenshot3.png',
          revision: '7e454c28e110e291ee12f494fb3cf40c',
        },
      ],
      { ignoreURLParametersMatching: [] },
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      '/',
      new e.NetworkFirst({
        cacheName: 'start-url',
        plugins: [
          {
            cacheWillUpdate: async ({
              request: e,
              response: s,
              event: i,
              state: c,
            }) =>
              s && 'opaqueredirect' === s.type
                ? new Response(s.body, {
                    status: 200,
                    statusText: 'OK',
                    headers: s.headers,
                  })
                : s,
          },
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      new e.CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      new e.StaleWhileRevalidate({
        cacheName: 'google-fonts-stylesheets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-font-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-image-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\/_next\/image\?url=.+$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'next-image',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:mp3|wav|ogg)$/i,
      new e.CacheFirst({
        cacheName: 'static-audio-assets',
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:mp4)$/i,
      new e.CacheFirst({
        cacheName: 'static-video-assets',
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:js)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-js-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:css|less)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-style-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\/_next\/data\/.+\/.+\.json$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'next-data',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:json|xml|csv)$/i,
      new e.NetworkFirst({
        cacheName: 'static-data-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        const s = e.pathname;
        return !s.startsWith('/api/auth/') && !!s.startsWith('/api/');
      },
      new e.NetworkFirst({
        cacheName: 'apis',
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        return !e.pathname.startsWith('/api/');
      },
      new e.NetworkFirst({
        cacheName: 'others',
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      ({ url: e }) => !(self.origin === e.origin),
      new e.NetworkFirst({
        cacheName: 'cross-origin',
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 3600 }),
        ],
      }),
      'GET',
    ));
});
