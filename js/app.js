import { store } from './store.js?v=202611121212';
import { GAMES, getGame, loadGame, loadGames, gameIcon, prefetchGames } from './games/index.js?v=202611121212';
import { ranks, computeStats, headToHead, eloRatings, rankedSessions } from './stats.js?v=202611121212';
import { ACHIEVEMENTS, computeAchievements, newlyEarned } from './achievements.js?v=202611121212';
import { watchForUpdate, appInfoHtml, bindAppInfo } from './update.js?v=202611121212';
import { viewTools } from './tools.js?v=202611121212';

const $app = document.getElementById('app');
const $user = document.getElementById('user');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (ms) => new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDay = (ms) => new Date(ms).toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' });
const query = () => new URLSearchParams(location.hash.split('?')[1] || '');

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// 실시간 구독(온라인 체스 등): 화면을 옮기면 끊음
let unwatch = null;
function stopWatching() { if (unwatch) { unwatch(); unwatch = null; } }

const MODE_NAME = { record: '기록', play: '플레이' };
// 기록하기/바로 하기 둘 다 되는 게임은 세션 설정의 mode 로 구분
const sessionMode = (s) => { const g = getGame(s.gameId); return g?.modes?.length > 1 ? (s.settings?.mode || 'record') : g?.modes?.[0]; };

// ───────── 화면들 ─────────
async function viewHome() {
  const sessions = await store.listSessions();
  const playing = sessions.filter((s) => s.status === 'playing');
  const recent = sessions.filter((s) => s.status === 'finished').slice(0, 5);
  await loadGames([...playing, ...recent].map((s) => s.gameId));
  const tiles = (mode) => GAMES.filter((g) => g.modes.includes(mode)).map((g) => `<button type="button" class="game-tile" data-intro="${g.id}" data-mode="${mode}">${gameIcon(g)}<span>${g.name}</span></button>`).join('');
  $app.innerHTML = `<div class="home-grid"><div>
    <section class="card">
      <h2>기록하기 <small class="muted">실물로 하고 점수만 입력</small></h2>
      <div class="game-grid">${tiles('record')}</div>
      <h2 class="sub-h">바로 하기 <small class="muted">화면에서 직접 플레이</small></h2>
      <div class="game-grid">${tiles('play')}</div>
    </section>
    ${playing.length ? `<section class="card"><h2>진행 중</h2>${playing.map(sessionRow).join('')}</section>` : ''}
    </div><div>
    <section class="card">
      <h2>최근 기록 <a class="more" href="#/history">전체 보기</a></h2>
      ${recent.length ? recent.map(sessionRow).join('') : '<p class="muted">아직 끝난 게임이 없어요.</p>'}
    </section>
    <a class="card tools-link" href="#/tools"><b>도구</b><span class="muted">선 뽑기 · 타이머 · 주사위 · 코인</span></a>
    </div></div>`;
  $app.onclick = (e) => {
    const t = e.target.closest('[data-intro]');
    if (t) showIntro(t.dataset.intro, t.dataset.mode);
  };
}

// 게임 소개 팝업: 확인 → 새 게임 화면, 룰·팁 → 도움말 화면
async function showIntro(id, mode) {
  const g = await loadGame(id);
  if (!g) return;
  const gd = g.guide || {};
  const box = document.createElement('div');
  box.className = 'modal-back';
  box.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      ${gameIcon(g, 'big')}
      <h2 id="intro-title">${g.name}${g.modes.length > 1 ? ` <small class="muted">${MODE_NAME[mode]}</small>` : ''}</h2>
      <p class="meta">${esc(gd.players || `${g.minPlayers}~${g.maxPlayers}명`)}${gd.time ? ` · ${esc(gd.time)}` : ''}</p>
      ${gd.intro ? `<p class="intro">${esc(gd.intro)}</p>` : ''}
      <a class="help-link" href="#/help/${g.id}">게임 룰과 팁 보기</a>
      <div class="modal-actions">
        <button type="button" class="btn" data-close>취소</button>
        <button type="button" class="btn primary" data-go>시작</button>
      </div>
    </div>`;
  const close = () => { box.remove(); removeEventListener('keydown', onKey); removeEventListener('hashchange', close); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  box.onclick = (e) => {
    if (e.target === box || e.target.closest('[data-close]')) close();
    else if (e.target.closest('[data-go]')) { close(); location.hash = `#/new/${g.id}${g.modes.length > 1 ? `?mode=${mode}` : ''}`; }
  };
  addEventListener('keydown', onKey);
  addEventListener('hashchange', close);
  document.body.appendChild(box);
  box.querySelector('[data-go]').focus();
}

// 도움말: 게임별 소개 · 진행 방법 · 점수 계산 · 팁
async function viewHelp(gameId) {
  const g = await loadGame(getGame(gameId) ? gameId : GAMES[0].id);
  const gd = g.guide || {};
  const list = (items) => `<ul class="help-list">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  $app.innerHTML = `<section class="card help">
    <h2>도움말</h2>
    <div class="chips">${GAMES.map((x) => `<a class="chip ${x.id === g.id ? 'on' : ''}" href="#/help/${x.id}">${x.name}</a>`).join('')}<a class="chip" href="#/tools">도구</a></div>
    <div class="help-head">
      ${gameIcon(g, 'big')}
      <div><h3>${g.name}</h3><p class="muted">${esc(gd.players || `${g.minPlayers}~${g.maxPlayers}명`)}${gd.time ? ` · ${esc(gd.time)}` : ''}</p></div>
    </div>
    ${gd.intro ? `<p class="intro">${esc(gd.intro)}</p>` : ''}
    ${gd.rules?.length ? `<h3>진행 방법</h3>${list(gd.rules)}` : ''}
    ${gd.scoring?.length ? `<h3>점수 계산</h3>${list(gd.scoring)}` : ''}
    ${gd.tips?.length ? `<h3>팁</h3>${list(gd.tips)}` : ''}
    ${!gd.intro && !gd.rules ? '<p class="muted">이 게임의 도움말은 준비 중이에요.</p>' : ''}
    <p class="muted note">게임을 빨리 익히기 위한 요약이에요. 에디션마다 세부 규칙이 다를 수 있으니, 애매할 땐 가지고 있는 룰북을 기준으로 해 주세요.</p>
    <div class="help-start">${g.modes.map((m) => `<a class="btn primary" href="#/new/${g.id}${g.modes.length > 1 ? `?mode=${m}` : ''}">${g.name} ${g.modes.length > 1 ? MODE_NAME[m] + ' ' : ''}시작</a>`).join('')}</div>
  </section>`;
  $app.insertAdjacentHTML('beforeend', appInfoHtml());
  bindAppInfo($app);
}

// 게임 모듈이 totalLabel(total) 을 주면 숫자 대신 그 글자로 표시 (예: 클루 '정답')
const totalText = (g, t) => (g?.totalLabel ? g.totalLabel(t) : t);

// 목록 한 줄 (게임 모듈을 미리 loadGames 로 불러 둔 뒤 사용)
function sessionRow(s) {
  const g = getGame(s.gameId);
  const rk = ranks(s.totals || []);
  const order = s.players.map((p, i) => ({ name: p.name, total: s.totals?.[i] ?? 0, rank: rk[i] })).sort((a, b) => a.rank - b.rank);
  const done = s.status === 'finished';
  return `<a class="srow" href="#/play/${s.id}">
    <div class="srow-head">${gameIcon(g, 'sm')}<b>${esc(g?.name || s.gameId)}</b>${g?.modes?.length > 1 ? `<span class="tag">${MODE_NAME[sessionMode(s)]}</span>` : ''} <span class="muted">${fmtDate(s.createdAt)}${s.settings?.startRound ? ` · ${s.settings.startRound}~${s.settings.endRound}R` : ''}</span>
      ${s.status === 'playing' ? '<span class="badge">진행 중</span>' : ''}
      ${s.pending ? '<span class="badge pending" title="이 기기에만 있어요. 인터넷이 연결되면 자동으로 서버에 올라가요">서버 저장 대기</span>' : ''}
      ${s.shared ? `<span class="badge shared">공유받음${s.ownerName ? ' · ' + esc(s.ownerName) : ''}</span>` : ''}</div>
    <div class="srow-players">${order.map((o) => `<span class="${o.rank === 1 && done ? 'winner' : ''}">${esc(o.name)} ${totalText(g, o.total)}</span>`).join('')}</div>
  </a>`;
}

async function viewNew(gameId) {
  const g = await loadGame(gameId);
  if (!g) return viewNotFound();
  const mode = g.modes.length > 1 ? (g.modes.includes(query().get('mode')) ? query().get('mode') : g.modes[0]) : g.modes[0];
  let players = await store.listPlayers();
  const selected = [];
  const settings = Object.fromEntries(g.settingsFields.map((f) => [f.key, f.default]));
  const fieldHtml = (f) => f.options
    ? `<div class="setting"><span>${f.label}</span><div class="chips">${f.options.map((o) => `<button type="button" class="chip ${settings[f.key] === o.value ? 'on' : ''}" data-opt="${f.key}" data-val="${o.value}">${esc(o.label)}</button>`).join('')}</div></div>`
    : `<label class="setting">${f.label} <input type="number" data-set="${f.key}" value="${settings[f.key]}" min="${f.min}" max="${f.max}"></label>`;

  const draw = () => {
    $app.innerHTML = `
      <section class="card">
        <h2>${gameIcon(g, 'sm')} ${g.name}${g.modes.length > 1 ? ` <span class="tag">${MODE_NAME[mode]}</span>` : ''} 새 게임 <a class="more" href="#/help/${g.id}">룰·팁</a></h2>
        <p class="muted">${g.pickHint ? esc(g.pickHint) : `참가자를 순서대로 눌러 주세요 (${g.minPlayers}~${g.maxPlayers}명). 누른 순서가 자리 순서가 됩니다.`}</p>
        <div class="chips">
          ${players.map((p) => { const i = selected.indexOf(p.id); return `<button class="chip ${i >= 0 ? 'on' : ''}" data-pick="${p.id}">${i >= 0 ? `<i>${i + 1}</i>` : ''}${esc(p.name)}</button>`; }).join('')}
        </div>
        <form class="inline" id="addp"><input name="n" placeholder="새 참가자 이름" maxlength="20" autocomplete="off"><button class="btn">추가</button></form>
        ${g.settingsFields.filter((f) => !f.show || f.show({ count: selected.length, settings, mode })).map(fieldHtml).join('')}
        <button class="btn primary block" id="start" ${selected.length < g.minPlayers ? 'disabled' : ''}>게임 시작 (${selected.length}명)</button>
      </section>`;
  };
  draw();

  $app.onclick = async (e) => {
    const b = e.target.closest('[data-pick]');
    if (b) {
      const id = b.dataset.pick; const i = selected.indexOf(id);
      if (i >= 0) selected.splice(i, 1); else if (selected.length < g.maxPlayers) selected.push(id);
      draw(); return;
    }
    const o = e.target.closest('[data-opt]');
    if (o) { const f = g.settingsFields.find((x) => x.key === o.dataset.opt); settings[f.key] = f.options.find((x) => String(x.value) === o.dataset.val).value; draw(); return; }
    if (e.target.id === 'start') {
      const picked = selected.map((id) => players.find((p) => p.id === id)).map((p) => ({ id: p.id, name: p.name, email: p.email || null }));
      const ps = g.preparePlayers ? g.preparePlayers(picked, { ...settings, mode }) : picked; // 예: 체스 1명이면 컴퓨터 추가
      const now = Date.now();
      const st = { ...settings };
      if (g.modes.length > 1) st.mode = mode;
      const s = { gameId: g.id, players: ps, playerIds: ps.map((p) => p.id), settings: st, status: 'playing', createdAt: now, updatedAt: now };
      s.data = g.initData(ps, s.settings);
      s.totals = g.computeTotals(s);
      e.target.disabled = true;
      const created = await store.createSession(s);
      location.hash = `#/play/${created.id}`;
    }
  };
  $app.onsubmit = async (e) => {
    e.preventDefault();
    const name = e.target.n.value.trim();
    if (!name) return;
    if (players.some((p) => p.name === name)) { toast('이미 있는 이름이에요'); return; }
    const p = await store.addPlayer(name);
    players = [...players, p];
    if (selected.length < g.maxPlayers) selected.push(p.id);
    draw();
  };
  $app.onchange = (e) => {
    const k = e.target.dataset.set;
    if (k) {
      const f = g.settingsFields.find((x) => x.key === k);
      settings[k] = Math.max(f.min, Math.min(f.max, Number(e.target.value) || f.default));
      g.normalizeSettings?.(settings, k);
      draw();
    }
  };
}

// 새로 얻은 업적 알림
function showBadges(list) {
  if (!list.length) return;
  const box = document.createElement('div');
  box.className = 'modal-back';
  box.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <h2>새 업적</h2>
    <ul class="badge-new">${list.map((x) => `<li><span class="medal">${esc(x.a.mark)}</span><div><b>${esc(x.name)} · ${esc(x.a.name)}</b><small class="muted">${esc(x.a.desc)}</small></div></li>`).join('')}</ul>
    <div class="modal-actions one"><button type="button" class="btn primary" data-close>확인</button></div>
  </div>`;
  box.onclick = (e) => { if (e.target === box || e.target.closest('[data-close]')) box.remove(); };
  document.body.appendChild(box);
}

async function viewPlay(id) {
  stopWatching();
  const s = await store.getSession(id);
  if (!s) return viewNotFound();
  const g = await loadGame(s.gameId);
  if (!g) return viewNotFound();
  $app.innerHTML = `<div class="play-top">
      <h2>${gameIcon(g, 'sm')} ${g.name}${g.modes.length > 1 ? ` <span class="tag">${MODE_NAME[sessionMode(s)]}</span>` : ''} <span class="muted">${fmtDate(s.createdAt)}</span></h2>
      <div class="actions">
        <a class="btn ghost small" href="#/help/${g.id}">룰</a>
        ${s.status === 'finished' ? '<button class="btn ghost small" id="reopen">다시 수정</button>' : ''}
        ${s.shared ? `<span class="badge shared">${esc(s.ownerName || '다른 계정')}님이 공유</span>` : '<button class="btn ghost small danger" id="del">삭제</button>'}
      </div>
    </div>
    <div id="result"></div><div id="board"></div>`;

  const showResult = () => {
    const box = document.getElementById('result');
    if (s.status !== 'finished') { box.innerHTML = ''; return; }
    const rk = ranks(s.totals);
    const order = s.players.map((p, i) => ({ name: p.name, total: s.totals[i], rank: rk[i] })).sort((a, b) => a.rank - b.rank);
    box.innerHTML = `<section class="card result"><h3>최종 결과</h3><ol class="podium">${order.map((o) => `<li><span class="rk ${o.rank === 1 ? 'first' : ''}">${g.totalLabel && o.rank !== 1 ? '' : o.rank + '위'}</span>${esc(o.name)}<b>${g.totalLabel ? g.totalLabel(o.total) : o.total + '점'}</b></li>`).join('')}</ol></section>`;
  };

  const persist = debounce(async () => {
    try { await store.updateSession(s.id, { data: s.data, totals: s.totals, updatedAt: Date.now() }); }
    catch (err) { console.error(err); toast('저장 실패: ' + err.message); }
  }, 400);

  // 개인 노트(클루·다빈치 코드 등): 내 계정에만 저장, 다른 참가자는 볼 수 없음
  const saveNote = debounce(async (n) => {
    try { await store.setNote(s.id, { ...n, updatedAt: Date.now() }); }
    catch (err) { console.error(err); toast('노트 저장 실패: ' + err.message); }
  }, 500);
  const note = { load: () => store.getNote(s.id), save: saveNote, private: store.mode === 'firebase' };

  const render = () => {
    showResult();
    g.renderPlay(document.getElementById('board'), s, {
      note,
      me: store.user,
      save: () => { s.totals = g.computeTotals(s); persist(); },
      online: store.mode === 'firebase' && !store.guest && !!store.user,
      toast,
      reload: () => viewPlay(s.id),
      // 다른 기기에서 바뀐 내용을 실시간으로 받기 (Firestore 일 때만)
      watch: store.watchSession && store.mode === 'firebase' ? (cb) => { stopWatching(); unwatch = store.watchSession(s.id, cb); } : null,
      finish: async ({ ask = true } = {}) => {
        s.totals = g.computeTotals(s);
        // 게임 모듈이 incompleteCount(session) 를 주면 그 값을 사용 (roundLabel: '판', '국' 등. 없으면 '빈 칸' 단위)
        const incomplete = g.incompleteCount ? g.incompleteCount(s) : (s.data.rounds || []).filter((r) => r.wins?.some((w) => w == null)).length;
        const unit = g.roundLabel || '라운드';
        const josa = (unit.charCodeAt(unit.length - 1) - 0xac00) % 28 ? '이' : '가'; // 받침 있으면 '이'
        const what = g.incompleteCount && !g.roundLabel ? '비어 있는 칸이' : `입력이 덜 된 ${unit}${josa}`;
        const msg = incomplete ? `아직 ${what} ${incomplete}개 있어요. 그래도 종료하고 전적에 기록할까요?` : '게임을 종료하고 전적에 기록할까요?';
        if (ask && !confirm(msg)) return;
        // 업적: 종료 전후를 비교해 새로 얻은 것만 알림
        let before = null;
        try { const all = await store.listSessions(); await loadGames(all.map((x) => x.gameId)); before = { all: all.filter((x) => x.id !== s.id) }; } catch (err) { console.error(err); }
        s.status = 'finished'; s.finishedAt = Date.now();
        await store.updateSession(s.id, { data: s.data, totals: s.totals, status: s.status, finishedAt: s.finishedAt, updatedAt: Date.now() });
        toast('전적에 기록했어요');
        await viewPlay(s.id);
        if (before) showBadges(newlyEarned(before.all, s));
      },
    });
  };
  render();

  const del = document.getElementById('del');
  if (del) del.onclick = async () => {
    if (!confirm('이 게임 기록을 삭제할까요? 되돌릴 수 없어요.')) return;
    await store.deleteSession(s.id); location.hash = '#/';
  };
  const re = document.getElementById('reopen');
  if (re) re.onclick = async () => { s.status = 'playing'; await store.updateSession(s.id, { status: 'playing' }); viewPlay(s.id); };
  $app.onclick = null; $app.onsubmit = null; $app.onchange = null;
}

// 기록 화면 맨 위: 이 기록이 서버(계정)에 저장돼 다른 기기에서도 보이는지 알려 줌
let unSync = null;
async function syncCardHtml() {
  if (store.mode === 'local' && !store.guest) return '<div class="sync-card warn-card">이 브라우저에만 저장돼요 (서버 설정 없음).</div>';
  if (store.guest) {
    return `<div class="sync-card warn-card">
      <b>게스트 기록은 이 기기에만 있어요.</b> 다른 기기에서 보려면 로그인하세요. 로그인하면 이 기기의 기록을 계정으로 옮겨 드려요.
      <button class="btn primary small" id="sync-login">Google로 로그인</button></div>`;
  }
  const { sessions: n } = store.guestDataCount ? await store.guestDataCount() : { sessions: 0 };
  const email = esc(store.user?.email || '');
  return `${n ? `<div class="sync-card warn-card">
      <b>이 기기에만 있는 게스트 기록 ${n}개</b>가 있어요. 계정으로 올리면 다른 기기에서도 보여요.
      <button class="btn primary small" id="sync-import">계정으로 올리기</button></div>` : ''}
    <div class="sync-card" id="sync-state"></div>
    <p class="muted sync-note">${email ? `<b>${email}</b> 계정으로 로그인한 모든 기기에서 같은 기록이 보여요.` : ''} 다른 기기에서 기록이 안 보이면 같은 계정으로 로그인했는지 확인해 주세요.</p>`;
}
function bindSyncCard() {
  const li = document.getElementById('sync-login');
  if (li) li.onclick = () => store.signIn().catch((e) => toast(e.message));
  const im = document.getElementById('sync-import');
  if (im) im.onclick = async () => {
    im.disabled = true; im.textContent = '올리는 중…';
    try { const n = await store.importGuestData(); toast(`게임 ${n}개를 계정으로 옮겼어요`); viewHistory(); }
    catch (e) { console.error(e); toast('옮기기 실패: ' + e.message); im.disabled = false; im.textContent = '다시 시도'; }
  };
  if (unSync) { unSync(); unSync = null; }
  const el = document.getElementById('sync-state');
  if (!el || !store.onSync) return;
  let off = null;
  const cb = ({ pending, ready }) => {
    if (!el.isConnected) { off?.(); return; }
    el.className = 'sync-card ' + (pending ? 'warn-card' : 'ok-card');
    el.innerHTML = !ready ? '서버와 연결하는 중…'
      : pending ? `<b>${pending}개 기록을 서버에 올리는 중이에요.</b> 인터넷이 연결되면 자동으로 올라가요. 올라가기 전에는 다른 기기에서 안 보여요.`
        : '✓ 모든 기록이 서버에 저장됐어요.';
  };
  off = unSync = store.onSync(cb);
}

async function viewHistory() {
  const sessions = await store.listSessions();
  const filter = query().get('game') || '';
  const list = sessions.filter((s) => !filter || s.gameId === filter);
  await loadGames(list.map((s) => s.gameId));
  $app.innerHTML = `<section class="card">
    <h2>전체 기록</h2>
    <div class="chips">
      <a class="chip ${!filter ? 'on' : ''}" href="#/history">전체</a>
      ${GAMES.map((g) => `<a class="chip ${filter === g.id ? 'on' : ''}" href="#/history?game=${g.id}">${g.name}</a>`).join('')}
    </div>
    ${list.length ? list.map(sessionRow).join('') : '<p class="muted">기록이 없어요.</p>'}
  </section>`;
  // 동기화 안내는 기록 목록 위에 따로 붙임 (게스트 기록 수를 세는 동안 목록을 먼저 보여 줌)
  const sync = await syncCardHtml();
  if (!location.hash.startsWith('#/history')) return;
  $app.insertAdjacentHTML('afterbegin', sync);
  bindSyncCard();
}

// 전적: 순위표 · 상대 전적 · 레이팅 · 업적
const STAT_TABS = [['table', '순위표'], ['h2h', '상대 전적'], ['elo', '레이팅'], ['badges', '업적']];

async function viewStats() {
  const [sessions, players, meta] = await Promise.all([store.listSessions(), store.listPlayers(), store.getMeta()]);
  await loadGames(sessions.map((s) => s.gameId));
  const q = query();
  const tab = STAT_TABS.some(([k]) => k === q.get('tab')) ? q.get('tab') : 'table';
  const allowAll = tab === 'h2h' || tab === 'badges';
  let gameId = q.get('game') || (allowAll ? '' : GAMES[0].id);
  if (!allowAll && !gameId) gameId = GAMES[0].id;
  const g = gameId ? getGame(gameId) : null;
  const resetMap = meta.statsResetAt || {};
  const since = gameId ? resetMap[gameId] || 0 : 0;
  const activeIds = new Set(players.map((p) => p.id));
  const link = (o) => { const p = new URLSearchParams({ tab, ...(gameId ? { game: gameId } : {}), ...o }); [...p.entries()].forEach(([k, v]) => { if (!v) p.delete(k); }); return '#/stats?' + p; };

  let body = '';
  if (tab === 'table') {
    const stats = computeStats(sessions, gameId, { since, activeIds });
    const games = rankedSessions(sessions, { gameId, sinceMap: resetMap }).length;
    body = `<p class="muted">${g.name} 완료 게임 ${games}판${since ? ` · ${fmtDate(since)} 초기화 이후` : ''}</p>
    ${stats.length ? (g.tieIsNoWin ? `<div class="table-wrap"><table class="stats">
      <thead><tr><th>#</th><th>이름</th><th>판수</th><th>승</th><th>무</th><th>패</th><th>승률</th></tr></thead>
      <tbody>${stats.map((st, i) => `<tr><td>${i + 1}</td><td><b>${esc(st.name)}</b></td><td>${st.played}</td><td>${st.wins}</td><td>${st.draws}</td><td>${st.played - st.wins - st.draws}</td><td>${Math.round(st.winRate * 100)}%</td></tr>`).join('')}</tbody>
    </table></div>` : `<div class="table-wrap"><table class="stats">
      <thead><tr><th>#</th><th>이름</th><th>판수</th><th>1등</th><th>승률</th><th>평균 점수</th><th>최고</th><th>평균 등수</th></tr></thead>
      <tbody>${stats.map((st, i) => `<tr><td>${i + 1}</td><td><b>${esc(st.name)}</b></td><td>${st.played}</td><td>${st.wins}</td><td>${Math.round(st.winRate * 100)}%</td><td>${Math.round(st.avg)}</td><td>${st.best}</td><td>${st.avgRank.toFixed(1)}</td></tr>`).join('')}</tbody>
    </table></div>`) : '<p class="muted">완료된 게임이 생기면 여기 쌓여요.</p>'}
    <div class="stats-actions">
      <button class="btn ghost small danger" id="reset">${g.name} 전적 초기화</button>
      ${since ? '<button class="btn ghost small" id="undo">초기화 취소</button>' : ''}
    </div>
    <p class="muted">초기화해도 게임 기록은 '기록' 탭에 남아 있고, 초기화 이후 게임부터 다시 집계해요. 기록 탭에서 게임을 삭제하면 전적에서도 빠져요.</p>`;
  } else if (tab === 'h2h') {
    const { people, cell } = headToHead(sessions, { gameId: gameId || null, sinceMap: resetMap, activeIds });
    const a = q.get('a'); const b = q.get('b');
    const pair = a && b ? cell(a, b) : null;
    body = `<p class="muted">같이 한 게임에서 누가 더 높은 순위로 끝났는지 셉니다. 칸은 <b>왼쪽 사람 기준</b> 승-패(무). 칸을 누르면 게임별로 나눠 봐요.</p>
    ${people.length > 1 ? `<div class="table-wrap"><table class="h2h">
      <thead><tr><th></th>${people.map((p) => `<th>${esc(p.name)}</th>`).join('')}</tr></thead>
      <tbody>${people.map((r) => `<tr><th class="cat">${esc(r.name)}</th>${people.map((c) => {
        if (r.key === c.key) return '<td class="self"></td>';
        const x = cell(r.key, c.key);
        if (!x.n) return '<td class="muted">·</td>';
        const cls = x.w > x.l ? 'pos' : x.w < x.l ? 'neg' : '';
        return `<td><a class="${cls} ${a === r.key && b === c.key ? 'on' : ''}" href="${link({ a: r.key, b: c.key })}">${x.w}-${x.l}${x.d ? `<small>(${x.d})</small>` : ''}</a></td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>` : '<p class="muted">두 명 이상이 함께 한 완료 게임이 생기면 여기 쌓여요.</p>'}
    ${pair && pair.n ? `<h3 class="sub-h">${esc(people.find((p) => p.key === a)?.name)} 대 ${esc(people.find((p) => p.key === b)?.name)}</h3>
      <div class="table-wrap"><table class="stats"><thead><tr><th>게임</th><th>판수</th><th>승</th><th>패</th><th>무</th></tr></thead>
      <tbody>${Object.entries(pair.byGame).map(([gid, x]) => `<tr><td>${esc(getGame(gid)?.name || gid)}</td><td>${x.n}</td><td>${x.w}</td><td>${x.l}</td><td>${x.d}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  } else if (tab === 'elo') {
    const list = eloRatings(sessions, gameId, { since, activeIds });
    body = `<p class="muted">모두 1000점에서 시작해요. 이기면 오르고 지면 내리는데, 나보다 레이팅이 높은 사람을 이기면 더 많이 올라요. 여럿이 한 게임은 순위끼리 1:1로 겨룬 것으로 계산해요.</p>
    ${list.length ? `<div class="table-wrap"><table class="stats elo">
      <thead><tr><th>#</th><th>이름</th><th>레이팅</th><th>최근</th><th>판수</th><th>추이</th></tr></thead>
      <tbody>${list.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x.name)}</b></td><td><b>${Math.round(x.rating)}</b></td><td class="${x.last > 0 ? 'pos' : x.last < 0 ? 'neg' : 'muted'}">${x.last > 0 ? '+' : ''}${Math.round(x.last)}</td><td>${x.played}</td><td>${spark(x.history)}</td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="muted">두 명 이상이 함께 한 완료 게임이 생기면 여기 쌓여요.</p>'}`;
  } else {
    const ach = computeAchievements(sessions, { activeIds });
    const people = [...ach.values()].sort((x, y) => y.earned.size - x.earned.size);
    const visible = ACHIEVEMENTS.filter((x) => !gameId || x.game === gameId);
    body = `<p class="muted">끝난 게임 기록으로 자동으로 매겨져요. 게임을 끝낼 때 새로 얻은 업적이 있으면 알려 드려요.</p>
    ${people.length ? people.map((p) => {
      const got = visible.filter((x) => p.earned.has(x.id));
      return `<div class="badge-person"><div class="bp-head"><b>${esc(p.name)}</b><span class="muted">${got.length}/${visible.length}</span></div>
        <div class="badge-row">${got.map((x) => `<span class="medal-chip got" title="${esc(x.desc)} · ${fmtDay(p.earned.get(x.id))}"><span class="medal">${esc(x.mark)}</span>${esc(x.name)}</span>`).join('') || '<span class="muted">아직 없어요</span>'}</div></div>`;
    }).join('') : '<p class="muted">완료된 게임이 생기면 여기 쌓여요.</p>'}
    <h3 class="sub-h">업적 목록</h3>
    <ul class="badge-list">${visible.map((x) => `<li><span class="medal">${esc(x.mark)}</span><div><b>${esc(x.name)}</b>${x.game ? ` <span class="tag">${esc(getGame(x.game)?.name)}</span>` : ''}<small class="muted">${esc(x.desc)}</small></div></li>`).join('')}</ul>`;
  }

  $app.innerHTML = `<section class="card">
    <h2>전적</h2>
    <div class="seg">${STAT_TABS.map(([k, l]) => `<a class="${k === tab ? 'on' : ''}" href="#/stats?tab=${k}${gameId ? `&game=${gameId}` : ''}">${l}</a>`).join('')}</div>
    <div class="chips">${allowAll ? `<a class="chip ${!gameId ? 'on' : ''}" href="#/stats?tab=${tab}">전체</a>` : ''}${GAMES.map((x) => `<a class="chip ${x.id === gameId ? 'on' : ''}" href="#/stats?tab=${tab}&game=${x.id}">${x.name}</a>`).join('')}</div>
    ${body}
  </section>`;
  if (tab === 'table') {
    const setReset = async (v) => { await store.setMeta({ statsResetAt: { ...resetMap, [gameId]: v } }); viewStats(); };
    document.getElementById('reset').onclick = () => { if (confirm(`${g.name} 전적을 0부터 다시 집계할까요?\n(게임 기록은 지워지지 않아요)`)) setReset(Date.now()); };
    const undo = document.getElementById('undo');
    if (undo) undo.onclick = () => setReset(null);
  }
}

// 레이팅 추이 미니 그래프
function spark(hist) {
  if (hist.length < 2) return '';
  const w = 90; const h = 24;
  const lo = Math.min(...hist); const hi = Math.max(...hist); const span = hi - lo || 1;
  const pts = hist.map((v, i) => `${(i / (hist.length - 1)) * w},${h - 2 - ((v - lo) / span) * (h - 4)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
}

async function viewPlayers() {
  const [players, sessions] = await Promise.all([store.listPlayers(), store.listSessions()]);
  const count = (id) => sessions.filter((s) => s.playerIds?.includes(id)).length;
  $app.innerHTML = `<section class="card">
    <h2>참가자</h2>
    ${players.length ? players.map((p) => `<div class="player-row" data-id="${p.id}">
        <div class="pinfo"><b>${esc(p.name)}</b> <span class="muted">${count(p.id)}판</span>
          <div class="muted email">${p.email ? esc(p.email) : '이메일 미연결'}</div></div>
        <button class="btn ghost small" data-act="email">${p.email ? '이메일 변경' : '이메일 연결'}</button>
        <button class="btn ghost small" data-act="rename">이름 변경</button>
        <button class="btn ghost small danger" data-act="delete">삭제</button>
      </div>`).join('') : '<p class="muted">새 게임을 만들 때 참가자를 추가할 수 있어요.</p>'}
    <form class="inline" id="addp"><input name="n" placeholder="새 참가자 이름" maxlength="20" autocomplete="off"><button class="btn">추가</button></form>
    <p class="muted">이름을 바꾸면 지난 기록과 전적에도 새 이름으로 보여요. 삭제한 참가자는 목록과 전적에서 빠지고, 지난 게임 기록에는 이름이 그대로 남아요.</p>
    ${store.mode === 'firebase' ? '<p class="muted">참가자에 Google 계정 이메일을 연결하면, 그 사람이 자기 계정으로 로그인했을 때 함께 한 게임 기록과 전적을 볼 수 있고 점수도 같이 입력할 수 있어요. 이미 끝난 게임에도 바로 적용돼요.</p>' : ''}
  </section>`;
  $app.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const p = players.find((x) => x.id === b.closest('[data-id]').dataset.id);
    if (b.dataset.act === 'email') {
      const v = prompt(`${p.name}님의 Google 계정 이메일 (비우면 연결 해제)`, p.email || '');
      if (v == null) return;
      const email = v.trim().toLowerCase();
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('이메일 형식이 아니에요'); return; }
      if (email && players.some((x) => x.id !== p.id && x.email === email)) { toast('다른 참가자에 이미 연결된 이메일이에요'); return; }
      await store.setPlayerEmail(p.id, email); toast(email ? '연결했어요' : '연결을 해제했어요'); viewPlayers();
    } else if (b.dataset.act === 'rename') {
      const name = (prompt('새 이름', p.name) || '').trim();
      if (!name || name === p.name) return;
      if (players.some((x) => x.name === name)) { toast('이미 있는 이름이에요'); return; }
      await store.renamePlayer(p.id, name); toast('이름을 바꿨어요'); viewPlayers();
    } else if (b.dataset.act === 'delete') {
      if (!confirm(`${p.name} 참가자를 삭제할까요?\n전적에서 빠지고, 지난 게임 기록에는 이름만 남아요.`)) return;
      await store.deletePlayer(p.id); toast('삭제했어요'); viewPlayers();
    }
  };
  $app.onsubmit = async (e) => {
    e.preventDefault();
    const name = e.target.n.value.trim();
    if (!name) return;
    if (players.some((x) => x.name === name)) { toast('이미 있는 이름이에요'); return; }
    await store.addPlayer(name); viewPlayers();
  };
}

function viewNotFound() { $app.innerHTML = '<section class="card"><p>찾을 수 없어요.</p><a href="#/">처음으로</a></section>'; }

function viewLogin() {
  $app.innerHTML = `<section class="card center login">
    <h2>보드게임</h2>
    <button class="btn primary block" id="login">Google로 로그인</button>
    <p class="muted">어느 기기에서나 같은 기록을 보고, 가족과 기록을 공유할 수 있어요.</p>
    <button class="btn block" id="guest">로그인 없이 게스트로 시작</button>
    <p class="muted">게스트 기록은 이 기기(브라우저)에만 저장돼요. 나중에 로그인하면 계정으로 옮길 수 있어요.</p>
  </section>`;
  document.getElementById('login').onclick = () => store.signIn().catch((e) => toast(e.message));
  document.getElementById('guest').onclick = () => store.enterGuest();
}

// 로그인 직후, 이 기기에 게스트 기록이 있으면 계정으로 옮길지 물어봄
async function offerGuestImport() {
  if (!store.importGuestData || store.mode !== 'firebase') return;
  const { sessions, players } = await store.guestDataCount();
  if (!sessions && !players) return;
  if (await store.guestImportDeclined()) return; // 한 번 거절하면 매번 묻지 않음 (기록 화면에서 언제든 올릴 수 있음)
  if (!confirm(`이 기기에 게스트로 저장한 기록이 있어요 (게임 ${sessions}개, 참가자 ${players}명).\n로그인한 계정으로 옮기면 다른 기기에서도 볼 수 있어요. 옮길까요?`)) {
    await store.declineGuestImport();
    toast('나중에 기록 화면에서 계정으로 올릴 수 있어요');
    return;
  }
  const n = await store.importGuestData();
  toast(`게임 ${n}개를 계정으로 옮겼어요`);
}

// ───────── 라우터 ─────────
async function route() {
  $app.onclick = $app.onsubmit = $app.onchange = null;
  stopWatching();
  if (store.mode === 'firebase' && !store.user) return viewLogin();
  const [path] = location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href').split('?')[0] === '#/' + (parts[0] || '')));
  // 기록을 불러오는 데 오래 걸리면 (느린 네트워크) 눌렀다는 표시를 먼저 보여 줌
  const slow = setTimeout(() => { $app.innerHTML = '<p class="muted center loading">불러오는 중…</p>'; }, 300);
  try {
    if (!parts.length) await viewHome();
    else if (parts[0] === 'new') await viewNew(parts[1]);
    else if (parts[0] === 'play') await viewPlay(parts[1]);
    else if (parts[0] === 'history') await viewHistory();
    else if (parts[0] === 'stats') await viewStats();
    else if (parts[0] === 'players') await viewPlayers();
    else if (parts[0] === 'help') await viewHelp(parts[1]);
    else if (parts[0] === 'tools') viewTools($app, { store, toast, tab: parts[1] });
    else viewNotFound();
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<section class="card"><h2>오류</h2><p>${esc(err.message)}</p><p class="muted">${/permission/i.test(err.message) ? 'Firebase 콘솔 → Firestore → 규칙 탭에 저장소의 최신 firestore.rules 내용을 붙여넣고 게시했는지 확인해 주세요. 게시 후 1분쯤 뒤 새로고침하면 돼요.' : '잠시 후 새로고침해 주세요.'}</p></section>`;
  } finally {
    clearTimeout(slow);
  }
}

async function main() {
  try { await store.init(); } catch (err) { $app.innerHTML = `<section class="card"><p>Firebase 초기화 실패: ${esc(err.message)}</p></section>`; return; }
  let wasSignedIn = false;
  store.onAuth(async (u) => {
    $user.innerHTML = store.guest
      ? `<span class="muted">게스트 · 이 기기에만 저장</span> <button class="btn ghost small" id="login2">로그인</button> <button class="btn ghost small" id="logout">나가기</button>`
      : store.mode === 'local'
        ? '<span class="muted" title="firebase-config.js를 채우면 Firestore에 저장됩니다">이 기기에만 저장</span>'
        : u ? `<button class="btn ghost small" id="logout">${esc(u.displayName || u.email)} · 로그아웃</button>` : '';
    const lo = document.getElementById('logout');
    if (lo) lo.onclick = () => store.signOut();
    const li = document.getElementById('login2');
    if (li) li.onclick = () => store.signIn().catch((e) => toast(e.message));
    const signedIn = store.mode === 'firebase' && !!u;
    if (signedIn && !wasSignedIn) { try { await offerGuestImport(); } catch (e) { console.error(e); toast('기록 옮기기 실패: ' + e.message); } }
    wasSignedIn = signedIn;
    route();
  });
  window.addEventListener('hashchange', route);
  prefetchGames();
  watchForUpdate();
}

if (typeof document !== 'undefined' && $app) main();
