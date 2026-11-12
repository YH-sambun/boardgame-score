// 서비스 워커: 앱 설치(홈 화면 추가)와 오프라인 열기를 지원합니다.
//  - 버전 번호(?v=)가 붙은 파일(JS·CSS): 내용이 바뀌면 번호도 바뀌므로 "저장본 우선" → 매번 다시 받지 않아 빠름
//  - 그 밖의 같은 사이트 파일(index.html 등): "네트워크 우선, 실패하면 저장본" → 업데이트가 바로 반영됨
// Firebase/Google 요청은 건드리지 않습니다 (Firestore 자체 오프라인 저장 사용).
const CACHE = 'bgscore-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

const put = (req, res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.searchParams.has('v')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
    return;
  }
  e.respondWith(
    fetch(req)
      .then((res) => put(req, res))
      .catch(() => caches.match(req, { ignoreSearch: false }).then((r) => r || caches.match('./index.html')))
  );
});
