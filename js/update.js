// 버전 정보와 새로고침 (홈 화면에 앱으로 설치하면 브라우저 새로고침 버튼이 없어서 필요)
//  버전 = 배포 때 bump-version.sh 가 붙이는 번호(?v=YYYYMMDDhhmm, UTC)
export const VERSION = new URL(import.meta.url).searchParams.get('v') || 'dev';

// 202611121111 → 2026.11.12 20:11 (한국 시간)
export function fmtVersion(v) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(v || '');
  if (!m) return v || '알 수 없음';
  const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 서버에 올라간 최신 버전 (index.html 이 가리키는 app.js 번호)
export async function latestVersion() {
  const r = await fetch(`./index.html?check=${Date.now()}`, { cache: 'no-store' });
  const t = await r.text();
  return /js\/app\.js\?v=(\d+)/.exec(t)?.[1] || null;
}

// 저장해 둔 파일을 모두 지우고 새로 받음
export async function hardReload() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(regs.map((r) => r.update().catch(() => {})));
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
  } catch (e) { console.error(e); }
  location.reload();
}

// 새 버전이 있으면 화면 아래에 알림 띠 (앱을 다시 볼 때마다, 10분에 한 번까지)
let lastCheck = 0;
export function watchForUpdate() {
  const check = async () => {
    if (VERSION === 'dev' || Date.now() - lastCheck < 10 * 60 * 1000 || document.querySelector('.update-bar')) return;
    lastCheck = Date.now();
    const v = await latestVersion().catch(() => null);
    if (!v || v <= VERSION) return;
    const bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.innerHTML = '<span>새 버전이 있어요</span><button class="btn small primary">업데이트</button><button class="btn small ghost" aria-label="닫기">나중에</button>';
    const [up, later] = bar.querySelectorAll('button');
    up.onclick = () => { up.disabled = true; up.textContent = '받는 중…'; hardReload(); };
    later.onclick = () => bar.remove();
    document.body.appendChild(bar);
  };
  setTimeout(check, 3000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
}

// 도움말 아래 "앱 정보" 칸
export function appInfoHtml() {
  return `<section class="card app-info">
    <h3>앱 정보</h3>
    <p class="muted">현재 버전 <b id="ver-now">${fmtVersion(VERSION)}</b><span id="ver-new"></span></p>
    <button class="btn block" id="ver-check">업데이트 확인 후 새로고침</button>
    <p class="muted">홈 화면에 앱으로 설치한 경우 여기서 새로고침하세요. 저장해 둔 파일을 지우고 최신 버전을 받아요. 기록은 지워지지 않아요.</p>
  </section>`;
}
export function bindAppInfo(root) {
  const btn = root.querySelector('#ver-check');
  if (!btn) return;
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = '확인 중…';
    const v = await latestVersion().catch(() => null);
    root.querySelector('#ver-new').textContent = v ? (v === VERSION ? ' · 최신이에요' : ` → 최신 ${fmtVersion(v)}`) : ' · 확인 실패 (인터넷 연결 확인)';
    btn.textContent = '새로고침 중…';
    setTimeout(hardReload, 600);
  };
}
