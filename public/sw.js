if (!self.define) {
  let c,
    e = {};
  const s = (s, i) => (
    (s = new URL(s + '.js', i).href),
    e[s] ||
      new Promise((e) => {
        if ('document' in self) {
          const c = document.createElement('script');
          ((c.src = s), (c.onload = e), document.head.appendChild(c));
        } else ((c = s), importScripts(s), e());
      }).then(() => {
        let c = e[s];
        if (!c) throw new Error(`Module ${s} didn’t register its module`);
        return c;
      })
  );
  self.define = (i, n) => {
    const t =
      c ||
      ('document' in self ? document.currentScript.src : '') ||
      location.href;
    if (e[t]) return;
    let a = {};
    const r = (c) => s(c, t),
      o = { module: { uri: t }, exports: a, require: r };
    e[t] = Promise.all(i.map((c) => o[c] || r(c))).then((c) => (n(...c), a));
  };
}
define(['./workbox-e9849328'], function (c) {
  'use strict';
  (importScripts(),
    self.skipWaiting(),
    c.clientsClaim(),
    c.precacheAndRoute(
      [
        {
          url: '/_next/static/K9W-vCmoCo8ylyLQ2Q58e/_buildManifest.js',
          revision: 'bb06eecccda90bff24825145568458de',
        },
        {
          url: '/_next/static/K9W-vCmoCo8ylyLQ2Q58e/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
        },
        {
          url: '/_next/static/chunks/1109-cd8ece9041c3834b.js',
          revision: 'cd8ece9041c3834b',
        },
        {
          url: '/_next/static/chunks/1790-0b74d4b350aed470.js',
          revision: '0b74d4b350aed470',
        },
        {
          url: '/_next/static/chunks/2191-03c507f62eee7a19.js',
          revision: '03c507f62eee7a19',
        },
        {
          url: '/_next/static/chunks/2571-599c79130d69a68e.js',
          revision: '599c79130d69a68e',
        },
        {
          url: '/_next/static/chunks/2922.682797e46620cda2.js',
          revision: '682797e46620cda2',
        },
        {
          url: '/_next/static/chunks/4233-5757b94d0254e647.js',
          revision: '5757b94d0254e647',
        },
        {
          url: '/_next/static/chunks/4308-8265d02c12d78028.js',
          revision: '8265d02c12d78028',
        },
        {
          url: '/_next/static/chunks/483-f03bab21e1fd08a2.js',
          revision: 'f03bab21e1fd08a2',
        },
        {
          url: '/_next/static/chunks/6177-9df43b48976f30f5.js',
          revision: '9df43b48976f30f5',
        },
        {
          url: '/_next/static/chunks/6407.8fbed1a1b4293227.js',
          revision: '8fbed1a1b4293227',
        },
        {
          url: '/_next/static/chunks/9482-fee74c42161518b8.js',
          revision: 'fee74c42161518b8',
        },
        {
          url: '/_next/static/chunks/app/_global-error/page-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/_not-found/page-eb8ca3bcf4eb7f51.js',
          revision: 'eb8ca3bcf4eb7f51',
        },
        {
          url: '/_next/static/chunks/app/admin/page-faa76de266b6a81c.js',
          revision: 'faa76de266b6a81c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/category/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/config/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/config_file/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/config_subscription/fetch/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/data_migration/export/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/data_migration/import/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/live/refresh/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/live/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/reset/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/site-icon/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/site/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/source/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/source/validate/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/admin/user/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/auth/session/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/change-password/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/cron/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/detail/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/douban/categories/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/douban/recommends/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/douban/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/favorites/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/image-proxy/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/live/channels/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/live/epg/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/live/precheck/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/live/sources/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/login/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/logout/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/playrecords/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/proxy/key/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/proxy/logo/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/proxy/m3u8/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/proxy/segment/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/register/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/search/one/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/search/resources/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/search/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/search/suggestions/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/search/ws/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/searchhistory/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/server-config/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/skipconfigs/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/api/version/latest/route-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/douban/page-115ab97c93f1c3b7.js',
          revision: '115ab97c93f1c3b7',
        },
        {
          url: '/_next/static/chunks/app/layout-fae0263c642e20a3.js',
          revision: 'fae0263c642e20a3',
        },
        {
          url: '/_next/static/chunks/app/live/page-14e5e3425fc1a5a5.js',
          revision: '14e5e3425fc1a5a5',
        },
        {
          url: '/_next/static/chunks/app/login/page-86b1587d5aff68ee.js',
          revision: '86b1587d5aff68ee',
        },
        {
          url: '/_next/static/chunks/app/page-a06ab02206220951.js',
          revision: 'a06ab02206220951',
        },
        {
          url: '/_next/static/chunks/app/play/page-b2a02078c71b1e8e.js',
          revision: 'b2a02078c71b1e8e',
        },
        {
          url: '/_next/static/chunks/app/search/loading-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/app/search/page-c13083c9813de32e.js',
          revision: 'c13083c9813de32e',
        },
        {
          url: '/_next/static/chunks/app/warning/page-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
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
          url: '/_next/static/chunks/next/dist/client/components/builtin/app-error-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/forbidden-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/global-error-aed3ffd1c64df30e.js',
          revision: 'aed3ffd1c64df30e',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/not-found-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
        },
        {
          url: '/_next/static/chunks/next/dist/client/components/builtin/unauthorized-8812c9733cf8dc0c.js',
          revision: '8812c9733cf8dc0c',
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
          url: '/_next/static/css/85e0d0041a0a8e91.css',
          revision: '85e0d0041a0a8e91',
        },
        {
          url: '/_next/static/css/9b026bb460caee65.css',
          revision: '9b026bb460caee65',
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
    c.cleanupOutdatedCaches(),
    c.registerRoute(
      '/',
      new c.NetworkFirst({
        cacheName: 'start-url',
        plugins: [
          {
            cacheWillUpdate: async ({
              request: c,
              response: e,
              event: s,
              state: i,
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
    c.registerRoute(
      /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      new c.CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [
          new c.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 }),
        ],
      }),
      'GET',
    ),
    c.registerRoute(
      /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      new c.StaleWhileRevalidate({
        cacheName: 'google-fonts-stylesheets',
        plugins: [
          new c.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      'GET',
    ),
    c.registerRoute(
      /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      new c.StaleWhileRevalidate({
        cacheName: 'static-font-assets',
        plugins: [
          new c.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      'GET',
    ),
    c.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new c.StaleWhileRevalidate({
        cacheName: 'static-image-assets',
        plugins: [
          new c.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    c.registerRoute(
      /\/_next\/image\?url=.+$/i,
      new c.StaleWhileRevalidate({
        cacheName: 'next-image',
        plugins: [
          new c.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    c.registerRoute(
      /\.(?:mp3|wav|ogg)$/i,
      new c.CacheFirst({
        cacheName: 'static-audio-assets',
        plugins: [
          new c.RangeRequestsPlugin(),
          new c.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    c.registerRoute(
      /\.(?:mp4)$/i,
      new c.CacheFirst({
        cacheName: 'static-video-assets',
        plugins: [
          new c.RangeRequestsPlugin(),
          new c.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    c.registerRoute(
      /\.(?:js)$/i,
      new c.StaleWhileRevalidate({
        cacheName: 'static-js-assets',
        plugins: [
          new c.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    c.registerRoute(
      /\.(?:css|less)$/i,
      new c.StaleWhileRevalidate({
        cacheName: 'static-style-assets',
        plugins: [
          new c.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    c.registerRoute(
      /\/_next\/data\/.+\/.+\.json$/i,
      new c.StaleWhileRevalidate({
        cacheName: 'next-data',
        plugins: [
          new c.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    c.registerRoute(
      /\.(?:json|xml|csv)$/i,
      new c.NetworkFirst({
        cacheName: 'static-data-assets',
        plugins: [
          new c.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    c.registerRoute(
      ({ url: c }) => {
        if (!(self.origin === c.origin)) return !1;
        const e = c.pathname;
        return !e.startsWith('/api/auth/') && !!e.startsWith('/api/');
      },
      new c.NetworkFirst({
        cacheName: 'apis',
        networkTimeoutSeconds: 10,
        plugins: [
          new c.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    c.registerRoute(
      ({ url: c }) => {
        if (!(self.origin === c.origin)) return !1;
        return !c.pathname.startsWith('/api/');
      },
      new c.NetworkFirst({
        cacheName: 'others',
        networkTimeoutSeconds: 10,
        plugins: [
          new c.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    c.registerRoute(
      ({ url: c }) => !(self.origin === c.origin),
      new c.NetworkFirst({
        cacheName: 'cross-origin',
        networkTimeoutSeconds: 10,
        plugins: [
          new c.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 3600 }),
        ],
      }),
      'GET',
    ));
});
