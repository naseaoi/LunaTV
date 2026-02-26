if (!self.define) {
  let a,
    e = {};
  const c = (c, s) => (
    (c = new URL(c + '.js', s).href),
    e[c] ||
      new Promise((e) => {
        if ('document' in self) {
          const a = document.createElement('script');
          ((a.src = c), (a.onload = e), document.head.appendChild(a));
        } else ((a = c), importScripts(c), e());
      }).then(() => {
        let a = e[c];
        if (!a) throw new Error(`Module ${c} didn’t register its module`);
        return a;
      })
  );
  self.define = (s, i) => {
    const n =
      a ||
      ('document' in self ? document.currentScript.src : '') ||
      location.href;
    if (e[n]) return;
    let t = {};
    const r = (a) => c(a, n),
      o = { module: { uri: n }, exports: t, require: r };
    e[n] = Promise.all(s.map((a) => o[a] || r(a))).then((a) => (i(...a), t));
  };
}
define(['./workbox-e9849328'], function (a) {
  'use strict';
  (importScripts(),
    self.skipWaiting(),
    a.clientsClaim(),
    a.precacheAndRoute(
      [
        {
          url: '/_next/static/8A84xPgRQhJC72xTbG_90/_buildManifest.js',
          revision: 'bb06eecccda90bff24825145568458de',
        },
        {
          url: '/_next/static/8A84xPgRQhJC72xTbG_90/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
        },
        {
          url: '/_next/static/chunks/1109-cd8ece9041c3834b.js',
          revision: 'cd8ece9041c3834b',
        },
        {
          url: '/_next/static/chunks/1399.fa94bbc1800a3b10.js',
          revision: 'fa94bbc1800a3b10',
        },
        {
          url: '/_next/static/chunks/1790-0cd535b426fa5042.js',
          revision: '0cd535b426fa5042',
        },
        {
          url: '/_next/static/chunks/1973-29709d8c1c4ea87b.js',
          revision: '29709d8c1c4ea87b',
        },
        {
          url: '/_next/static/chunks/2184-94228adc79087b8b.js',
          revision: '94228adc79087b8b',
        },
        {
          url: '/_next/static/chunks/2922.682797e46620cda2.js',
          revision: '682797e46620cda2',
        },
        {
          url: '/_next/static/chunks/3277-d2d1201c1a805775.js',
          revision: 'd2d1201c1a805775',
        },
        {
          url: '/_next/static/chunks/43-47fcc81d644abce0.js',
          revision: '47fcc81d644abce0',
        },
        {
          url: '/_next/static/chunks/5995-5e0e5f171a30ee11.js',
          revision: '5e0e5f171a30ee11',
        },
        {
          url: '/_next/static/chunks/6407.8fbed1a1b4293227.js',
          revision: '8fbed1a1b4293227',
        },
        {
          url: '/_next/static/chunks/87-7d301cd9b93fd19f.js',
          revision: '7d301cd9b93fd19f',
        },
        {
          url: '/_next/static/chunks/9340-aa3f7c5c2e122e11.js',
          revision: 'aa3f7c5c2e122e11',
        },
        {
          url: '/_next/static/chunks/9482-2fc703fcbf9166e6.js',
          revision: '2fc703fcbf9166e6',
        },
        {
          url: '/_next/static/chunks/app/_global-error/page-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/_not-found/page-eb8ca3bcf4eb7f51.js',
          revision: 'eb8ca3bcf4eb7f51',
        },
        {
          url: '/_next/static/chunks/app/admin/page-de9775715a2657bc.js',
          revision: 'de9775715a2657bc',
        },
        {
          url: '/_next/static/chunks/app/api/admin/category/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/admin/config/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/admin/config_file/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/admin/config_subscription/fetch/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/admin/data_migration/export/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/admin/data_migration/import/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/admin/live/refresh/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/admin/live/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/admin/reset/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/admin/site-icon/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/admin/site/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/admin/source/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/admin/source/validate/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/admin/user/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/auth/session/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/change-password/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/cron/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/detail/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/douban/categories/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/douban/recommends/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/douban/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/favorites/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/image-proxy/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/live/channels/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/live/epg/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/live/precheck/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/live/sources/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/login/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/logout/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/playrecords/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/proxy/key/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/proxy/logo/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/proxy/m3u8/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/proxy/segment/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/register/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/search/one/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/search/resources/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/search/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/search/suggestions/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/search/ws/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/searchhistory/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/server-config/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/skipconfigs/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/api/version/latest/route-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/app/douban/page-867fd2d22c4bc5aa.js',
          revision: '867fd2d22c4bc5aa',
        },
        {
          url: '/_next/static/chunks/app/layout-fae0263c642e20a3.js',
          revision: 'fae0263c642e20a3',
        },
        {
          url: '/_next/static/chunks/app/live/page-84b89f2636dbd70c.js',
          revision: '84b89f2636dbd70c',
        },
        {
          url: '/_next/static/chunks/app/login/page-5414b798625e1fc1.js',
          revision: '5414b798625e1fc1',
        },
        {
          url: '/_next/static/chunks/app/page-6246716259bee4f1.js',
          revision: '6246716259bee4f1',
        },
        {
          url: '/_next/static/chunks/app/play/page-7cda22e047b6ddc8.js',
          revision: '7cda22e047b6ddc8',
        },
        {
          url: '/_next/static/chunks/app/search/loading-e8b5c58e3be7a840.js',
          revision: 'e8b5c58e3be7a840',
        },
        {
          url: '/_next/static/chunks/app/search/page-16f57d5c9bbe0a37.js',
          revision: '16f57d5c9bbe0a37',
        },
        {
          url: '/_next/static/chunks/app/warning/page-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/d5b6d25f-0e021ece50f19c4b.js',
          revision: '0e021ece50f19c4b',
        },
        {
          url: '/_next/static/chunks/deb030d4-b65162262be8615f.js',
          revision: 'b65162262be8615f',
        },
        {
          url: '/_next/static/chunks/framework-af674a464d67f8cb.js',
          revision: 'af674a464d67f8cb',
        },
        {
          url: '/_next/static/chunks/main-afe14ba5b067fc7f.js',
          revision: 'afe14ba5b067fc7f',
        },
        {
          url: '/_next/static/chunks/main-app-b741a61d59381658.js',
          revision: 'b741a61d59381658',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/app-error-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/forbidden-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/global-error-aed3ffd1c64df30e.js',
          revision: 'aed3ffd1c64df30e',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/not-found-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/unauthorized-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
        },
        {
          url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
          revision: '846118c33b2c0e922d7b3a7676f81f6f',
        },
        {
          url: '/_next/static/chunks/webpack-5a218c514a344710.js',
          revision: '5a218c514a344710',
        },
        {
          url: '/_next/static/css/85e0d0041a0a8e91.css',
          revision: '85e0d0041a0a8e91',
        },
        {
          url: '/_next/static/css/af4b83b298641d97.css',
          revision: 'af4b83b298641d97',
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
    a.cleanupOutdatedCaches(),
    a.registerRoute(
      '/',
      new a.NetworkFirst({
        cacheName: 'start-url',
        plugins: [
          {
            cacheWillUpdate: async ({
              request: a,
              response: e,
              event: c,
              state: s,
            }) =>
              e && 'opaqueredirect' === e.type
                ? new Response(e.body, {
                    status: 200,
                    statusText: 'OK',
                    headers: e.headers,
                  })
                : e,
          },
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      new a.CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [
          new a.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 }),
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      new a.StaleWhileRevalidate({
        cacheName: 'google-fonts-stylesheets',
        plugins: [
          new a.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      new a.StaleWhileRevalidate({
        cacheName: 'static-font-assets',
        plugins: [
          new a.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new a.StaleWhileRevalidate({
        cacheName: 'static-image-assets',
        plugins: [
          new a.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      /\/_next\/image\?url=.+$/i,
      new a.StaleWhileRevalidate({
        cacheName: 'next-image',
        plugins: [
          new a.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      /\.(?:mp3|wav|ogg)$/i,
      new a.CacheFirst({
        cacheName: 'static-audio-assets',
        plugins: [
          new a.RangeRequestsPlugin(),
          new a.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      /\.(?:mp4)$/i,
      new a.CacheFirst({
        cacheName: 'static-video-assets',
        plugins: [
          new a.RangeRequestsPlugin(),
          new a.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      /\.(?:js)$/i,
      new a.StaleWhileRevalidate({
        cacheName: 'static-js-assets',
        plugins: [
          new a.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      /\.(?:css|less)$/i,
      new a.StaleWhileRevalidate({
        cacheName: 'static-style-assets',
        plugins: [
          new a.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      /\/_next\/data\/.+\/.+\.json$/i,
      new a.StaleWhileRevalidate({
        cacheName: 'next-data',
        plugins: [
          new a.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      /\.(?:json|xml|csv)$/i,
      new a.NetworkFirst({
        cacheName: 'static-data-assets',
        plugins: [
          new a.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      ({ url: a }) => {
        if (!(self.origin === a.origin)) return !1;
        const e = a.pathname;
        return !e.startsWith('/api/auth/') && !!e.startsWith('/api/');
      },
      new a.NetworkFirst({
        cacheName: 'apis',
        networkTimeoutSeconds: 10,
        plugins: [
          new a.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      ({ url: a }) => {
        if (!(self.origin === a.origin)) return !1;
        return !a.pathname.startsWith('/api/');
      },
      new a.NetworkFirst({
        cacheName: 'others',
        networkTimeoutSeconds: 10,
        plugins: [
          new a.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    a.registerRoute(
      ({ url: a }) => !(self.origin === a.origin),
      new a.NetworkFirst({
        cacheName: 'cross-origin',
        networkTimeoutSeconds: 10,
        plugins: [
          new a.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 3600 }),
        ],
      }),
      'GET',
    ));
});
