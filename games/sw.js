// Service Worker for ZJ-Games PWA
const CACHE_NAME = 'zj-games-v1';
const urlsToCache = [
  '/games/',
  '/games/index.html',
  '/games/manifest.json',
  // 游戏页面
  '/games/nback/index.html',
  '/games/2048/start.html',
  '/games/klotski/levels.html',
  '/games/puzzle15/levels.html',
  '/games/sudoku/levels.html',
  '/games/nonogram/levels.html',
];

// 安装Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[SW] Cache install failed:', error);
      })
  );
  // 立即激活新的SW
  self.skipWaiting();
});

// 激活Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // 立即接管所有页面
  return self.clients.claim();
});

// 拦截网络请求
self.addEventListener('fetch', (event) => {
  // 只处理同源请求，跳过跨域请求（如Clerk SDK）
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 如果缓存中有，返回缓存
        if (response) {
          console.log('[SW] Serving from cache:', event.request.url);
          return response;
        }

        // 否则从网络获取
        console.log('[SW] Fetching from network:', event.request.url);
        return fetch(event.request).then((response) => {
          // 检查是否是有效响应
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // 克隆响应并缓存
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
      .catch((error) => {
        console.error('[SW] Fetch failed:', error);
        // 如果网络失败，可以返回一个离线页面
        return new Response('离线模式：网络不可用', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain; charset=UTF-8'
          })
        });
      })
  );
});

// 监听消息（用于手动更新缓存）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
