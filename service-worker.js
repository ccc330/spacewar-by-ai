const CACHE_NAME = 'spacewar-game-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './game.js',
    './manifest.json',
    './static/player.png',
    './static/enemy.png',
    './static/bullet.png',
    './static/icon-192.png',
    './static/icon-512.png'
];

// 安装Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 激活Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 拦截请求并提供缓存内容
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            // 如果请求在缓存中找到，返回缓存的版本
            if (response) {
                return response;
            }
            
            // 否则发起网络请求
            return fetch(event.request).then(response => {
                // 如果返回有效，则缓存副本
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                
                return response;
            });
        })
    );
}); 