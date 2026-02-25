if (!self.define) {
  let e,
    a = {};
  const c = (c, s) => (
    (c = new URL(c + '.js', s).href),
    a[c] ||
      new Promise((a) => {
        if ('document' in self) {
          const e = document.createElement('script');
          ((e.src = c), (e.onload = a), document.head.appendChild(e));
        } else ((e = c), importScripts(c), a());
      }).then(() => {
        let e = a[c];
        if (!e) throw new Error(`Module ${c} didn’t register its module`);
        return e;
      })
  );
  self.define = (s, i) => {
    const n =
      e ||
      ('document' in self ? document.currentScript.src : '') ||
      location.href;
    if (a[n]) return;
    let t = {};
    const r = (e) => c(e, n),
      o = { module: { uri: n }, exports: t, require: r };
    a[n] = Promise.all(s.map((e) => o[e] || r(e))).then((e) => (i(...e), t));
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
          url: '/_next/static/BobOIhecUeqymQUyH9VnZ/_buildManifest.js',
          revision: 'bb06eecccda90bff24825145568458de',
        },
        {
          url: '/_next/static/BobOIhecUeqymQUyH9VnZ/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
        },
        {
          url: '/_next/static/chunks/1109-cd8ece9041c3834b.js',
          revision: 'cd8ece9041c3834b',
        },
        {
          url: '/_next/static/chunks/1790-13fdfe02ffa0c1a8.js',
          revision: '13fdfe02ffa0c1a8',
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
          url: '/_next/static/chunks/4233-5757b94d0254e647.js',
          revision: '5757b94d0254e647',
        },
        {
          url: '/_next/static/chunks/43-ee0a655e4f5ec05d.js',
          revision: 'ee0a655e4f5ec05d',
        },
        {
          url: '/_next/static/chunks/6407.8fbed1a1b4293227.js',
          revision: '8fbed1a1b4293227',
        },
        {
          url: '/_next/static/chunks/87-c7c553dc386e1fcb.js',
          revision: 'c7c553dc386e1fcb',
        },
        {
          url: '/_next/static/chunks/9482-fee74c42161518b8.js',
          revision: 'fee74c42161518b8',
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
          url: '/_next/static/chunks/app/admin/page-2a710c4644c5c0b5.js',
          revision: '2a710c4644c5c0b5',
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
          url: '/_next/static/chunks/app/douban/page-9cfe5e9e83dc4069.js',
          revision: '9cfe5e9e83dc4069',
        },
        {
          url: '/_next/static/chunks/app/layout-fae0263c642e20a3.js',
          revision: 'fae0263c642e20a3',
        },
        {
          url: '/_next/static/chunks/app/live/page-3b8b04fe6e79d0f4.js',
          revision: '3b8b04fe6e79d0f4',
        },
        {
          url: '/_next/static/chunks/app/login/page-e51452ce70fbdc7f.js',
          revision: 'e51452ce70fbdc7f',
        },
        {
          url: '/_next/static/chunks/app/page-d93eb603b05713bc.js',
          revision: 'd93eb603b05713bc',
        },
        {
          url: '/_next/static/chunks/app/play/page-582b0b01e8028673.js',
          revision: '582b0b01e8028673',
        },
        {
          url: '/_next/static/chunks/app/search/loading-e8b5c58e3be7a840.js',
          revision: 'e8b5c58e3be7a840',
        },
        {
          url: '/_next/static/chunks/app/search/page-0012a0e1f470686e.js',
          revision: '0012a0e1f470686e',
        },
        {
          url: '/_next/static/chunks/app/warning/page-8efd2a066cca45a0.js',
          revision: '8efd2a066cca45a0',
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
          url: '/_next/static/chunks/main-10f77dfc95f38c19.js',
          revision: '10f77dfc95f38c19',
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
          url: '/_next/static/chunks/webpack-73434c30f0572fac.js',
          revision: '73434c30f0572fac',
        },
        {
          url: '/_next/static/css/672bbdcc68f58e24.css',
          revision: '672bbdcc68f58e24',
        },
        {
          url: '/_next/static/css/85e0d0041a0a8e91.css',
          revision: '85e0d0041a0a8e91',
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
              response: a,
              event: c,
              state: s,
            }) =>
              a && 'opaqueredirect' === a.type
                ? new Response(a.body, {
                    status: 200,
                    statusText: 'OK',
                    headers: a.headers,
                  })
                : a,
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
        const a = e.pathname;
        return !a.startsWith('/api/auth/') && !!a.startsWith('/api/');
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
