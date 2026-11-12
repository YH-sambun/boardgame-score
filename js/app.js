import { store } from './store.js?v=202611120750';
import { GAMES, getGame } from './games/index.js?v=202611120750';

const $app = document.getElementById('app');
const $user = document.getElementById('user');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (ms) => new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });

// 동점은 같은 등수 (1, 1, 3 ...)
export function ranks(totals) {
  return totals.map((t) => 1 + totals.filter((o) => o > t).length);
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ───────── 화면들 ─────────
async function viewHome() {
  const sessions = await store.listSessions();
  const playing = sessions.filter((s) => s.status === 'playing');
  const recent = sessions.filter((s) => s.status === 'finished').slice(0, 5);
  $app.innerHTML = `<div class="home-grid"><div>
    <section class="card">
      <h2>새 게임</h2>
      <div class="game-grid">
        ${GAMES.map((g) => `<a class="game-tile" href="#/new/${g.id}"><span class="emoji">${g.emoji}</span>${g.name}</a>`).join('')}
        <div class="game-tile disabled"><span class="emoji">➕</span>다른 게임은 추가 예정</div>
      </div>
    </section>
    ${playing.length ? `<section class="card"><h2>진행 중</h2>${playing.map(sessionRow).join('')}</section>` : ''}
    </div><div>
    <section class="card">
      <h2>최근 기록 <a class="more" href="#/history">전체 보기</a></h2>
      ${recent.length ? recent.map(sessionRow).join('') : '<p class="muted">아직 끝난 게임이 없어요.</p>'}
    </section></div></div>`;
}

// 게임 모듈이 totalLabel(total) 을 주면 숫자 대신 그 글자로 표시 (예: 클루 '정답')
const totalText = (g, t) => (g?.totalLabel ? g.totalLabel(t) : t);

function sessionRow(s) {
  const g = getGame(s.gameId);
  const rk = ranks(s.totals || []);
  const order = s.players.map((p, i) => ({ name: p.name, total: s.totals?.[i] ?? 0, rank: rk[i] })).sort((a, b) => a.rank - b.rank);
  return `<a class="srow" href="#/play/${s.id}">
    <div><b>${g?.emoji || ''} ${esc(g?.name || s.gameId)}</b> <span class="muted">${fmtDate(s.createdAt)}${s.settings?.startRound ? ` · ${s.settings.startRound}~${s.settings.endRound}R` : ''}</span>
      ${s.status === 'playing' ? '<span class="badge">진행 중</span>' : ''}
      ${s.shared ? `<span class="badge shared">공유받음${s.ownerName ? ' · ' + esc(s.ownerName) : ''}</span>` : ''}</div>
    <div class="srow-players">${order.map((o) => `<span class="${o.rank === 1 && s.status === 'finished' ? 'winner' : ''}">${o.rank === 1 && s.status === 'finished' ? '👑' : ''}${esc(o.name)} ${totalText(g, o.total)}</span>`).join('')}</div>
  </a>`;
}

async function viewNew(gameId) {
  const g = getGame(gameId);
  if (!g) return viewNotFound();
  let players = await store.listPlayers();
  const selected = [];
  const settings = Object.fromEntries(g.settingsFields.map((f) => [f.key, f.default]));

  const draw = () => {
    $app.innerHTML = `
      <section class="card">
        <h2>${g.emoji} ${g.name} 새 게임</h2>
        <p class="muted">참가자를 순서대로 눌러 주세요 (${g.minPlayers}~${g.maxPlayers}명). 누른 순서가 자리 순서가 됩니다.</p>
        <div class="chips">
          ${players.map((p) => { const i = selected.indexOf(p.id); return `<button class="chip ${i >= 0 ? 'on' : ''}" data-pick="${p.id}">${i >= 0 ? `<i>${i + 1}</i>` : ''}${esc(p.name)}</button>`; }).join('')}
        </div>
        <form class="inline" id="addp"><input name="n" placeholder="새 참가자 이름" maxlength="20" autocomplete="off"><button class="btn">추가</button></form>
        ${g.settingsFields.map((f) => `<label class="setting">${f.label} <input type="number" data-set="${f.key}" value="${settings[f.key]}" min="${f.min}" max="${f.max}"></label>`).join('')}
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
    if (e.target.id === 'start') {
      const ps = selected.map((id) => players.find((p) => p.id === id)).map((p) => ({ id: p.id, name: p.name, email: p.email || null }));
      const now = Date.now();
      const s = { gameId: g.id, players: ps, playerIds: ps.map((p) => p.id), settings: { ...settings }, status: 'playing', createdAt: now, updatedAt: now };
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

async function viewPlay(id) {
  const s = await store.getSession(id);
  if (!s) return viewNotFound();
  const g = getGame(s.gameId);
  $app.innerHTML = `<div class="play-top">
      <h2>${g.emoji} ${g.name} <span class="muted">${fmtDate(s.createdAt)}</span></h2>
      <div class="actions">
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
    box.innerHTML = `<section class="card result"><h3>최종 결과</h3><ol class="podium">${order.map((o) => `<li><span class="rk">${o.rank === 1 ? '👑' : g.totalLabel ? '' : o.rank + '등'}</span>${esc(o.name)}<b>${g.totalLabel ? g.totalLabel(o.total) : o.total + '점'}</b></li>`).join('')}</ol></section>`;
  };

  const persist = debounce(async () => {
    try { await store.updateSession(s.id, { data: s.data, totals: s.totals, updatedAt: Date.now() }); }
    catch (err) { console.error(err); toast('저장 실패: ' + err.message); }
  }, 400);

  // 개인 노트(클루 등): 내 계정에만 저장, 다른 참가자는 볼 수 없음
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
      finish: async () => {
        s.totals = g.computeTotals(s);
        // 게임 모듈이 incompleteCount(session) 를 주면 그 값을 사용 (roundLabel: '판', '국' 등. 없으면 '빈 칸' 단위)
        const incomplete = g.incompleteCount ? g.incompleteCount(s) : (s.data.rounds || []).filter((r) => r.wins?.some((w) => w == null)).length;
        const unit = g.roundLabel || '라운드';
        const josa = (unit.charCodeAt(unit.length - 1) - 0xac00) % 28 ? '이' : '가'; // 받침 있으면 '이'
        const what = g.incompleteCount && !g.roundLabel ? '비어 있는 칸이' : `입력이 덜 된 ${unit}${josa}`;
        const msg = incomplete ? `아직 ${what} ${incomplete}개 있어요. 그래도 종료하고 전적에 기록할까요?` : '게임을 종료하고 전적에 기록할까요?';
        if (!confirm(msg)) return;
        s.status = 'finished'; s.finishedAt = Date.now();
        await store.updateSession(s.id, { data: s.data, totals: s.totals, status: s.status, finishedAt: s.finishedAt, updatedAt: Date.now() });
        toast('전적에 기록했어요');
        viewPlay(s.id);
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

async function viewHistory() {
  const sessions = await store.listSessions();
  const filter = new URLSearchParams(location.hash.split('?')[1] || '').get('game') || '';
  const list = sessions.filter((s) => !filter || s.gameId === filter);
  $app.innerHTML = `<section class="card">
    <h2>전체 기록</h2>
    <div class="chips">
      <a class="chip ${!filter ? 'on' : ''}" href="#/history">전체</a>
      ${GAMES.map((g) => `<a class="chip ${filter === g.id ? 'on' : ''}" href="#/history?game=${g.id}">${g.emoji} ${g.name}</a>`).join('')}
    </div>
    ${list.length ? list.map(sessionRow).join('') : '<p class="muted">기록이 없어요.</p>'}
  </section>`;
}

// since: 이 시각 이후 게임만 집계(전적 초기화), activeIds: 현재 등록된 참가자만 표시(삭제한 참가자 제외)
export function computeStats(sessions, gameId, { since = 0, activeIds = null } = {}) {
  const map = new Map();
  for (const s of sessions) {
    if (s.status !== 'finished' || s.gameId !== gameId) continue;
    if ((s.finishedAt || s.createdAt) < since) continue;
    const rk = ranks(s.totals);
    s.players.forEach((p, i) => {
      // 삭제한 참가자 제외는 내가 만든 게임에만 적용 (공유받은 게임은 참가자 id 체계가 다름)
      if (!s.shared && activeIds && p.id && !activeIds.has(p.id)) return;
      // 이메일이 연결된 참가자는 계정이 달라도 같은 사람으로 집계
      const key = p.email ? 'e:' + p.email.toLowerCase() : (s.shared ? `x:${s.ownerUid}:${p.id || p.name}` : p.id || p.name);
      const st = map.get(key) || { name: p.name, played: 0, wins: 0, sum: 0, best: -Infinity, rankSum: 0 };
      st.name = p.name; st.played++; st.sum += s.totals[i]; st.rankSum += rk[i];
      st.best = Math.max(st.best, s.totals[i]);
      if (rk[i] === 1) st.wins++;
      map.set(key, st);
    });
  }
  return [...map.values()].map((st) => ({ ...st, winRate: st.wins / st.played, avg: st.sum / st.played, avgRank: st.rankSum / st.played }))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.avg - a.avg);
}

async function viewStats() {
  const [sessions, players, meta] = await Promise.all([store.listSessions(), store.listPlayers(), store.getMeta()]);
  const gameId = new URLSearchParams(location.hash.split('?')[1] || '').get('game') || GAMES[0].id;
  const g = getGame(gameId);
  const resetMap = meta.statsResetAt || {};
  const since = resetMap[gameId] || 0;
  const activeIds = new Set(players.map((p) => p.id));
  const stats = computeStats(sessions, gameId, { since, activeIds });
  const games = sessions.filter((s) => s.status === 'finished' && s.gameId === gameId && (s.finishedAt || s.createdAt) >= since).length;
  $app.innerHTML = `<section class="card">
    <h2>전적</h2>
    <div class="chips">${GAMES.map((x) => `<a class="chip ${x.id === gameId ? 'on' : ''}" href="#/stats?game=${x.id}">${x.emoji} ${x.name}</a>`).join('')}</div>
    <p class="muted">${g.name} 완료 게임 ${games}판${since ? ` · ${fmtDate(since)} 초기화 이후` : ''}</p>
    ${stats.length ? `<div class="table-wrap"><table class="stats">
      <thead><tr><th>#</th><th>이름</th><th>판수</th><th>1등</th><th>승률</th><th>평균 점수</th><th>최고</th><th>평균 등수</th></tr></thead>
      <tbody>${stats.map((st, i) => `<tr><td>${i + 1}</td><td><b>${esc(st.name)}</b></td><td>${st.played}</td><td>${st.wins}</td><td>${Math.round(st.winRate * 100)}%</td><td>${Math.round(st.avg)}</td><td>${st.best}</td><td>${st.avgRank.toFixed(1)}</td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="muted">완료된 게임이 생기면 여기 쌓여요.</p>'}
    <div class="stats-actions">
      <button class="btn ghost small danger" id="reset">${g.name} 전적 초기화</button>
      ${since ? '<button class="btn ghost small" id="undo">초기화 취소</button>' : ''}
    </div>
    <p class="muted">초기화해도 게임 기록은 '기록' 탭에 남아 있고, 초기화 이후 게임부터 다시 집계해요. 기록 탭에서 게임을 삭제하면 전적에서도 빠져요.</p>
  </section>`;
  const setReset = async (v) => { await store.setMeta({ statsResetAt: { ...resetMap, [gameId]: v } }); viewStats(); };
  document.getElementById('reset').onclick = () => { if (confirm(`${g.name} 전적을 0부터 다시 집계할까요?\n(게임 기록은 지워지지 않아요)`)) setReset(Date.now()); };
  const undo = document.getElementById('undo');
  if (undo) undo.onclick = () => setReset(null);
}

async function viewPlayers() {
  const [players, sessions] = await Promise.all([store.listPlayers(), store.listSessions()]);
  const count = (id) => sessions.filter((s) => s.playerIds?.includes(id)).length;
  $app.innerHTML = `<section class="card">
    <h2>참가자</h2>
    ${players.length ? players.map((p) => `<div class="player-row" data-id="${p.id}">
        <div class="pinfo"><b>${esc(p.name)}</b> <span class="muted">${count(p.id)}판</span>
          <div class="muted email">${p.email ? '📧 ' + esc(p.email) : '이메일 미연결'}</div></div>
        <button class="btn ghost small" data-act="email">${p.email ? '이메일 변경' : '이메일 연결'}</button>
        <button class="btn ghost small" data-act="rename">이름 변경</button>
        <button class="btn ghost small danger" data-act="delete">삭제</button>
      </div>`).join('') : '<p class="muted">새 게임을 만들 때 참가자를 추가할 수 있어요.</p>'}
    <form class="inline" id="addp"><input name="n" placeholder="새 참가자 이름" maxlength="20" autocomplete="off"><button class="btn">추가</button></form>
    <p class="muted">이름을 바꾸면 지난 기록과 전적에도 새 이름으로 보여요. 삭제한 참가자는 목록과 전적에서 빠지고, 지난 게임 기록에는 이름이 그대로 남아요.</p>
    ${store.mode === 'firebase' ? '<p class="muted">📧 참가자에 Google 계정 이메일을 연결하면, 그 사람이 자기 계정으로 로그인했을 때 함께 한 게임 기록과 전적을 볼 수 있고 점수도 같이 입력할 수 있어요. 이미 끝난 게임에도 바로 적용돼요.</p>' : ''}
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
  $app.innerHTML = `<section class="card center">
    <h2>로그인이 필요해요</h2>
    <p class="muted">점수는 Firestore에 저장돼서 어느 기기에서나 볼 수 있어요.</p>
    <button class="btn primary" id="login">Google로 로그인</button>
  </section>`;
  document.getElementById('login').onclick = () => store.signIn().catch((e) => toast(e.message));
}

// ───────── 라우터 ─────────
async function route() {
  $app.onclick = $app.onsubmit = $app.onchange = null;
  if (store.mode === 'firebase' && !store.user) return viewLogin();
  const [path] = location.hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href').split('?')[0] === '#/' + (parts[0] || '')));
  try {
    if (!parts.length) await viewHome();
    else if (parts[0] === 'new') await viewNew(parts[1]);
    else if (parts[0] === 'play') await viewPlay(parts[1]);
    else if (parts[0] === 'history') await viewHistory();
    else if (parts[0] === 'stats') await viewStats();
    else if (parts[0] === 'players') await viewPlayers();
    else viewNotFound();
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<section class="card"><h2>오류</h2><p>${esc(err.message)}</p><p class="muted">Firestore 보안 규칙에 내 계정이 허용돼 있는지 확인해 주세요.</p></section>`;
  }
}

async function main() {
  try { await store.init(); } catch (err) { $app.innerHTML = `<section class="card"><p>Firebase 초기화 실패: ${esc(err.message)}</p></section>`; return; }
  store.onAuth((u) => {
    $user.innerHTML = store.mode === 'local'
      ? '<span class="muted" title="firebase-config.js를 채우면 Firestore에 저장됩니다">이 기기에만 저장</span>'
      : u ? `<button class="btn ghost small" id="logout">${esc(u.displayName || u.email)} · 로그아웃</button>` : '';
    const lo = document.getElementById('logout');
    if (lo) lo.onclick = () => store.signOut();
    route();
  });
  window.addEventListener('hashchange', route);
}

if (typeof document !== 'undefined' && $app) main();
