const VERSION = 'systumm-pwa-v1';

const STATIC_CACHE =
  `${VERSION}-static`;

const PAGE_CACHE =
  `${VERSION}-pages`;

const CORE_FILES = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png'
];

self.addEventListener(
  'install',
  (event) => {
    event.waitUntil(
      caches
        .open(STATIC_CACHE)
        .then((cache) => {
          return cache.addAll(CORE_FILES);
        })
        .then(() => {
          return self.skipWaiting();
        })
    );
  }
);

self.addEventListener(
  'activate',
  (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => {
          return Promise.all(
            keys
              .filter((key) => {
                return (
                  key !== STATIC_CACHE &&
                  key !== PAGE_CACHE
                );
              })
              .map((key) => {
                return caches.delete(key);
              })
          );
        })
        .then(() => {
          return self.clients.claim();
        })
    );
  }
);

self.addEventListener(
  'message',
  (event) => {
    if (
      event.data?.type ===
      'SKIP_WAITING'
    ) {
      self.skipWaiting();
    }
  }
);

async function networkFirstPage(request) {
  const cache =
    await caches.open(PAGE_CACHE);

  try {
    const response =
      await fetch(request);

    if (response.ok) {
      await cache.put(
        request,
        response.clone()
      );

      if (
        new URL(request.url).pathname ===
        '/'
      ) {
        await cache.put(
          '/',
          response.clone()
        );
      }
    }

    return response;
  } catch {
    const cachedPage =
      await cache.match(request);

    if (cachedPage) {
      return cachedPage;
    }

    const cachedHome =
      await caches.match('/');

    if (cachedHome) {
      return cachedHome;
    }

    return caches.match(
      '/offline.html'
    );
  }
}

async function staleWhileRevalidate(
  request
) {
  const cache =
    await caches.open(STATIC_CACHE);

  const cached =
    await cache.match(request);

  const networkRequest =
    fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(
            request,
            response.clone()
          );
        }

        return response;
      })
      .catch(() => null);

  if (cached) {
    return cached;
  }

  const networkResponse =
    await networkRequest;

  if (networkResponse) {
    return networkResponse;
  }

  return Response.error();
}

self.addEventListener(
  'fetch',
  (event) => {
    const request = event.request;

    if (request.method !== 'GET') {
      return;
    }

    const url =
      new URL(request.url);

    /*
     * Never intercept:
     * - Cloudflare Worker API calls
     * - JioSaavn audio
     * - external artwork
     * - Google Fonts
     */
    if (
      url.origin !==
      self.location.origin
    ) {
      return;
    }

    if (url.pathname === '/sw.js') {
      return;
    }

    if (request.mode === 'navigate') {
      event.respondWith(
        networkFirstPage(request)
      );

      return;
    }

    const cacheableDestination = [
      'script',
      'style',
      'font',
      'image'
    ].includes(request.destination);

    const fixedAsset =
      url.pathname.endsWith(
        '.webmanifest'
      ) ||
      url.pathname.endsWith(
        '.json'
      );

    if (
      cacheableDestination ||
      fixedAsset
    ) {
      event.respondWith(
        staleWhileRevalidate(request)
      );
    }
  }
);
