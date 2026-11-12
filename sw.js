// 서비스 워커: 앱 설치(홈 화면 추가)와 오프라인 열기를 지원합니다.
// 같은 사이트 파일은 "네트워크 우선, 실패하면 저장본" → 업데이트가 바로 반영됩니다.
// Firebase/Google 요청은 건드리지 않습니다 (Firestore 자체 오프라인 저장 사용).
const CACHE = 'bgscore-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: false }).then((r) => r || caches.match('./index.html')))
  );
});
