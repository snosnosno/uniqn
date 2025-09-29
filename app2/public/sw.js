/**
 * T-HOLDEM Service Worker
 * - 정적 자산 캐싱
 * - 오프라인 폴백
 * - 네트워크 우선 전략
 */

const CACHE_NAME = 'tholdem-v1.0.0';
const STATIC_CACHE = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE = `${CACHE_NAME}-dynamic`;
const RUNTIME_CACHE = `${CACHE_NAME}-runtime`;

// 프리캐시할 정적 자산들
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/favicon.ico',
  '/manifest.json',
];

// 캐시 우선 전략 적용할 리소스들
const CACHE_FIRST_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/i, // 이미지
  /\.(?:woff2?|ttf|eot)$/i, // 폰트
  /\/static\//i, // 정적 자산
];

// 네트워크 우선 전략 적용할 리소스들
const NETWORK_FIRST_PATTERNS = [
  /\/api\//i, // API 호출
  /firestore\.googleapis\.com/i, // Firebase
  /firebase\.googleapis\.com/i, // Firebase
];

// 오프라인 폴백 페이지 HTML
const OFFLINE_FALLBACK = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>T-HOLDEM - 오프라인</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;
      text-align: center;
      padding: 40px 20px;
      background: #f8fafc;
      color: #1f2937;
    }
    .container {
      max-width: 400px;
      margin: 0 auto;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
    .title {
      font-size: 24px;
      margin-bottom: 16px;
      font-weight: 600;
    }
    .message {
      font-size: 16px;
      line-height: 1.5;
      margin-bottom: 24px;
      color: #6b7280;
    }
    .button {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .button:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1 class="title">오프라인 상태</h1>
    <p class="message">
      인터넷 연결을 확인하고 다시 시도해주세요.<br>
      일부 기능은 오프라인에서도 사용할 수 있습니다.
    </p>
    <button class="button" onclick="window.location.reload()">
      다시 시도
    </button>
  </div>
</body>
</html>
`;

/**
 * Service Worker 설치
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker 설치 중...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] 정적 자산 캐싱 중...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] 정적 자산 캐싱 완료');
        return self.skipWaiting(); // 즉시 활성화
      })
      .catch((error) => {
        console.error('[SW] 정적 자산 캐싱 실패:', error);
      })
  );
});

/**
 * Service Worker 활성화
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker 활성화 중...');

  event.waitUntil(
    Promise.all([
      // 오래된 캐시 정리
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('tholdem-') && !name.includes(CACHE_NAME))
            .map((name) => {
              console.log('[SW] 오래된 캐시 삭제:', name);
              return caches.delete(name);
            })
        );
      }),

      // 오프라인 폴백 페이지 캐싱
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.put('/offline.html', new Response(OFFLINE_FALLBACK, {
          headers: { 'Content-Type': 'text/html' }
        }));
      }),

      // 모든 클라이언트에서 활성화
      self.clients.claim(),
    ])
  );
});

/**
 * Fetch 이벤트 처리
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Chrome 확장 프로그램 및 개발 도구 요청 무시
  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
    return;
  }

  // POST 요청은 캐싱하지 않음
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(handleFetch(request));
});

/**
 * Fetch 요청 처리 로직
 */
async function handleFetch(request) {
  const url = new URL(request.url);

  try {
    // 1. 캐시 우선 전략 (이미지, 폰트, 정적 자산)
    if (CACHE_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
      return await cacheFirstStrategy(request);
    }

    // 2. 네트워크 우선 전략 (API, Firebase)
    if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.href))) {
      return await networkFirstStrategy(request);
    }

    // 3. 기본: Stale While Revalidate 전략
    return await staleWhileRevalidate(request);

  } catch (error) {
    console.error('[SW] Fetch 처리 에러:', error);
    return await getOfflineFallback(request);
  }
}

/**
 * 캐시 우선 전략
 */
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.warn('[SW] 네트워크 요청 실패 (캐시 우선):', request.url);
    return getOfflineFallback(request);
  }
}

/**
 * 네트워크 우선 전략
 */
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.warn('[SW] 네트워크 요청 실패 (네트워크 우선):', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    return getOfflineFallback(request);
  }
}

/**
 * Stale While Revalidate 전략
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  // 백그라운드에서 네트워크 요청
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  // 캐시된 응답이 있으면 즉시 반환
  if (cachedResponse) {
    return cachedResponse;
  }

  // 캐시가 없으면 네트워크 응답 대기
  const networkResponse = await fetchPromise;

  if (networkResponse) {
    return networkResponse;
  }

  return getOfflineFallback(request);
}

/**
 * 오프라인 폴백 응답 생성
 */
async function getOfflineFallback(request) {
  const url = new URL(request.url);

  // HTML 페이지인 경우 오프라인 페이지 반환
  if (request.headers.get('Accept')?.includes('text/html')) {
    return caches.match('/offline.html');
  }

  // 기타 리소스는 기본 응답
  return new Response('오프라인 상태입니다.', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

/**
 * 백그라운드 동기화 (향후 구현)
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] 백그라운드 동기화:', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  // 오프라인 중 실패한 요청들 재시도
  console.log('[SW] 백그라운드 동기화 처리 중...');
}

/**
 * 푸시 메시지 처리 (향후 구현)
 */
self.addEventListener('push', (event) => {
  console.log('[SW] 푸시 메시지 수신:', event);

  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: 'tholdem-notification',
    };

    event.waitUntil(
      self.registration.showNotification('T-HOLDEM', options)
    );
  }
});

/**
 * 메시지 처리
 */
self.addEventListener('message', (event) => {
  console.log('[SW] 메시지 수신:', event.data);

  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      })
    );
  }
});