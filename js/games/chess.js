// 체스 대국
//  - 한 기기: 둘이 한 폰/태블릿으로 번갈아 둠
//  - 온라인: 로그인한 두 사람이 각자 기기에서 둠 (Firestore 실시간 동기화). 상대 참가자에 Google 이메일 연결 필요
//  - 컴퓨터: 참가자를 1명만 고르면 컴퓨터와 대국 (실력 5단계)
// session.data = { mode, white(백을 잡은 자리), moves:[uci], result:{ winner:자리|null, reason }, level, seats:{자리:uid}, drawOffer, seq }
// 전적: 이김 1, 비김 0.5, 짐 -1 (진행 중 0)
import { Chess, createBoard, engine, gameOverInfo, moveListHtml, uciObj } from './chess-board.js?v=202611121133';

export const CPU_ID = 'cpu';
export const LEVELS = [
  { label: '입문', opts: { depth: 1, timeMs: 300, noise: 350 } },
  { label: '쉬움', opts: { depth: 2, timeMs: 500, noise: 150 } },
  { label: '보통', opts: { depth: 3, timeMs: 800, noise: 40 } },
  { label: '어려움', opts: { depth: 5, timeMs: 1500 } },
  { label: '최강', opts: { depth: 10, timeMs: 3500 } },
];
const MODE_LABEL = { local: '한 기기', online: '온라인', ai: '컴퓨터' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 수 목록으로 chess.js 게임 다시 만들기
export function replay(moves = []) {
  const c = new Chess();
  for (const u of moves) { try { c.move(uciObj(u)); } catch { break; } }
  return c;
}

export default {
  id: 'chess',
  name: '체스',
  emoji: '♟️',
  minPlayers: 1,
  maxPlayers: 2,
  settingsFields: [],
  guide: {
    players: '1~2명 (1명이면 컴퓨터와)', time: '10~60분',
    intro: '킹을 잡을 수 없게 몰아붙이는(체크메이트) 쪽이 이기는 두 사람 전략 게임이에요. 한 기기에서 번갈아 두거나, 각자 폰으로 온라인 대국, 또는 컴퓨터와 둘 수 있어요.',
    rules: [
      '백이 먼저 두고 한 수씩 번갈아 둬요. 기물을 누르면 갈 수 있는 칸이 점으로 보여요.',
      '킹은 한 칸, 퀸은 모든 방향 직선, 룩은 가로·세로, 비숍은 대각선, 나이트는 L자(다른 기물을 뛰어넘음), 폰은 앞으로 한 칸(처음엔 두 칸)이고 대각선 앞으로 잡아요.',
      '캐슬링: 킹과 룩이 한 번도 안 움직였고 사이가 비어 있으면 킹을 룩 쪽으로 두 칸 옮겨요(킹을 누르고 두 칸 옆을 누르면 돼요).',
      '앙파상: 상대 폰이 두 칸 전진해 내 폰 옆에 서면, 바로 다음 수에 대각선으로 잡을 수 있어요.',
      '승급: 폰이 끝 줄에 닿으면 퀸·룩·비숍·나이트 중 하나로 바뀌어요.',
      '내 킹이 공격받는 체크 상태로 수를 마칠 수 없어요. 체크를 피할 방법이 없으면 체크메이트로 져요.',
      '무승부: 둘 수 있는 수가 없는데 체크가 아닐 때(스테일메이트), 같은 장면 3번 반복, 50수 동안 잡기·폰 이동 없음, 메이트할 기물 부족, 또는 합의.',
      '온라인 대국: 상대 참가자에 Google 이메일을 연결하고 대국을 시작하면, 상대가 홈의 진행 중 목록에서 열어 바로 둘 수 있어요.',
    ],
    scoring: ['이기면 승, 지면 패, 비기면 무로 전적에 남아요. 전적 탭에서 승·무·패와 승률을 볼 수 있어요.', '컴퓨터는 전적 목록에 나오지 않아요.'],
    tips: [
      '초반에는 가운데(e4·d4) 폰을 두고, 나이트와 비숍을 먼저 꺼낸 뒤 캐슬링으로 킹을 숨기세요.',
      '수를 두기 전에 "상대가 지금 무엇을 노리나?"를 먼저 확인하면 실수가 크게 줄어요.',
      '기물 가치는 대략 폰 1, 나이트·비숍 3, 룩 5, 퀸 9예요. 손해 보는 교환은 피하세요.',
      '컴퓨터 상대는 입문부터 시작해 이기면 한 단계씩 올려 보세요.',
    ],
  },
  pickHint: '1명을 고르면 컴퓨터와, 2명을 고르면 사람끼리 둡니다 (한 기기에서 번갈아 또는 각자 폰으로 온라인).',
  tieIsNoWin: true, // 비긴 판은 1등(승) 횟수에 넣지 않음

  // 1명만 고르면 컴퓨터를 상대로 추가
  preparePlayers(ps) {
    return ps.length === 1 ? [...ps, { id: CPU_ID, name: '🤖 컴퓨터', email: null }] : ps;
  },

  initData(players) {
    const ai = players.some((p) => p.id === CPU_ID);
    return { mode: ai ? 'ai' : null, white: 0, moves: [], result: null, level: 2, seats: {}, drawOffer: null, started: false, seq: 0 };
  },

  computeTotals(session) {
    const r = session.data.result;
    return session.players.map((_, i) => (!r ? 0 : r.winner == null ? 0.5 : r.winner === i ? 1 : -1));
  },
  totalLabel(t) { return t === 1 ? '승' : t === 0.5 ? '무' : t === -1 ? '패' : ''; },
  incompleteCount(session) { return session.data.result ? 0 : 1; },
  roundLabel: '대국',

  renderPlay(root, session, ctx) {
    const d = session.data;
    const players = session.players;
    const readonly = session.status === 'finished';
    const myUid = ctx.me?.uid || null;
    const online = () => d.mode === 'online';
    const cpuIdx = players.findIndex((p) => p.id === CPU_ID);
    let chess = replay(d.moves);
    let thinking = false;
    let flipped = false;
    let lastSeenLen = d.moves.length;
    let finishing = false;

    const colorOf = (idx) => (idx === d.white ? 'w' : 'b');
    const idxOf = (color) => (color === 'w' ? d.white : 1 - d.white);
    const myIdx = () => {
      if (d.mode === 'ai') return 1 - cpuIdx;
      if (!online()) return null;
      const e = Object.entries(d.seats || {}).find(([, u]) => u && u === myUid);
      return e ? Number(e[0]) : null;
    };
    const name = (idx) => esc(players[idx]?.name || '?');
    const bump = () => { d.seq = (d.seq || 0) + 1; ctx.save(); };

    const board = createBoard(document.createElement('div'), { onMove: (m) => play(m) });

    // ── 수 두기 ──
    function play(m) {
      if (d.result || readonly) return;
      let res;
      try { res = chess.move(m); } catch { return; }
      d.moves.push(res.from + res.to + (res.promotion || ''));
      d.drawOffer = null;
      lastSeenLen = d.moves.length;
      checkEnd();
      bump();
      draw();
      maybeComputer();
    }

    function checkEnd() {
      const over = gameOverInfo(chess);
      if (!over) return;
      d.result = { winner: over.winner == null ? null : idxOf(over.winner), reason: over.reason };
    }

    async function maybeComputer() {
      if (d.mode !== 'ai' || d.result || readonly || !d.started) return;
      if (colorOf(cpuIdx) !== chess.turn()) return;
      thinking = true; draw();
      const lenAtStart = d.moves.length;
      const started = Date.now();
      try {
        const hist = [];
        const tmp = new Chess();
        for (const u of d.moves) { hist.push(tmp.fen()); tmp.move(uciObj(u)); }
        const r = await engine('search', { fen: chess.fen(), opts: { ...LEVELS[d.level].opts, history: hist } });
        await new Promise((ok) => setTimeout(ok, Math.max(0, 450 - (Date.now() - started))));
        // 그 사이 무르기 등으로 판이 바뀌었으면 버림
        if (d.moves.length !== lenAtStart || d.result || !r.move) return;
        thinking = false;
        play(uciObj(r.move));
      } catch (err) { console.error(err); ctx.toast?.('컴퓨터 계산 오류'); } finally { thinking = false; draw(); }
    }

    // ── 화면 ──
    const setupHtml = () => {
      if (d.mode === 'ai') {
        const human = 1 - cpuIdx;
        return `<section class="card">
          <h3>컴퓨터와 대국</h3>
          <p class="muted">${name(human)}님이 둘 색</p>
          <div class="chips">
            <button class="chip ${d.white === human ? 'on' : ''}" data-white="${human}">⚪ 백 (먼저 둠)</button>
            <button class="chip ${d.white === cpuIdx ? 'on' : ''}" data-white="${cpuIdx}">⚫ 흑</button>
            <button class="chip" data-white="rand">🎲 무작위</button>
          </div>
          <p class="muted">컴퓨터 실력</p>
          <div class="chips">${LEVELS.map((l, i) => `<button class="chip ${d.level === i ? 'on' : ''}" data-level="${i}">${l.label}</button>`).join('')}</div>
          <button class="btn primary block" data-act="start">대국 시작</button>
        </section>`;
      }
      const canOnline = ctx.online;
      const meSel = myIdx();
      return `<section class="card">
        <h3>대국 방식</h3>
        <div class="chips">
          <button class="chip ${d.mode === 'local' ? 'on' : ''}" data-mode="local">📱 한 기기에서 번갈아</button>
          <button class="chip ${d.mode === 'online' ? 'on' : ''}" data-mode="online" ${canOnline ? '' : 'disabled'}>🌐 각자 폰으로 온라인</button>
        </div>
        ${canOnline ? '' : '<p class="muted">온라인 대국은 Google로 로그인했을 때 쓸 수 있어요.</p>'}
        ${d.mode === 'online' ? `
          <p class="muted">이 기기에서 두는 사람은?</p>
          <div class="chips">${players.map((p, i) => `<button class="chip ${meSel === i ? 'on' : ''}" data-me="${i}">${esc(p.name)}</button>`).join('')}</div>
          ${meSel != null && !players[1 - meSel].email ? `<p class="warn">${name(1 - meSel)}님 참가자에 Google 이메일이 연결돼 있지 않아요. '참가자' 탭에서 이메일을 연결해야 상대 폰에서 이 대국이 보여요.</p>` : ''}` : ''}
        <p class="muted">색 정하기</p>
        <div class="chips">
          ${players.map((p, i) => `<button class="chip ${d.white === i ? 'on' : ''}" data-white="${i}">⚪ 백: ${esc(p.name)}</button>`).join('')}
          <button class="chip" data-white="rand">🎲 무작위</button>
        </div>
        <button class="btn primary block" data-act="start" ${!d.mode || (d.mode === 'online' && meSel == null) ? 'disabled' : ''}>대국 시작</button>
      </section>`;
    };

    const statusHtml = () => {
      if (d.result) {
        const r = d.result;
        return `<div class="chess-status done">${r.winner == null ? `🤝 무승부 (${esc(r.reason)})` : `👑 ${name(r.winner)} 승리 (${esc(r.reason)})`}</div>`;
      }
      const turnIdx = idxOf(chess.turn());
      const me = myIdx();
      let who = `${chess.turn() === 'w' ? '⚪ 백' : '⚫ 흑'} ${name(turnIdx)} 차례`;
      if (d.mode === 'ai' && turnIdx === cpuIdx) who = thinking ? '🤖 컴퓨터가 생각 중…' : '🤖 컴퓨터 차례';
      if (online() && me != null) who = turnIdx === me ? '내 차례예요' : `${name(turnIdx)}님 차례 (기다리는 중)`;
      if (online() && me == null) who += ' · 구경 중';
      return `<div class="chess-status ${chess.inCheck() ? 'check' : ''}">${who}${chess.inCheck() ? ' · 체크!' : ''}</div>`;
    };

    const playerBar = (idx) => {
      if (idx == null) return '';
      const cap = captured(chess, colorOf(idx));
      return `<div class="chess-player ${!d.result && idxOf(chess.turn()) === idx ? 'turn' : ''}">
        <span>${colorOf(idx) === 'w' ? '⚪' : '⚫'} ${name(idx)}${d.mode === 'ai' && idx === cpuIdx ? ` <small class="muted">${LEVELS[d.level].label}</small>` : ''}</span>
        <span class="caps">${cap}</span></div>`;
    };

    function draw() {
      if (!d.started && !readonly && session.shared) { root.innerHTML = `<section class="card"><p class="muted">${esc(session.ownerName || '만든 사람')}님이 대국을 설정하고 있어요. 시작하면 바로 여기에 판이 나타나요.</p></section>`; return; }
      if (!d.started && !readonly) { root.innerHTML = setupHtml(); return; }
      const me = myIdx();
      let bottom = d.mode === 'local' ? d.white : me ?? d.white;
      if (flipped) bottom = 1 - bottom;
      const orientation = colorOf(bottom);
      const hist = chess.history({ verbose: true });
      const last = hist[hist.length - 1];
      const offer = d.drawOffer;
      const btns = [];
      if (!d.result && !readonly) {
        if (d.mode !== 'online' && d.moves.length) btns.push('<button class="btn ghost small" data-act="undo">↶ 무르기</button>');
        if (d.mode === 'local') btns.push('<button class="btn ghost small" data-act="draw">🤝 무승부</button>');
        if (online() && me != null) {
          if (offer != null && offer !== me) btns.push('<button class="btn small primary" data-act="accept">🤝 무승부 수락</button><button class="btn ghost small" data-act="decline">거절</button>');
          else btns.push(`<button class="btn ghost small" data-act="offer" ${offer === me ? 'disabled' : ''}>${offer === me ? '무승부 제안함' : '🤝 무승부 제안'}</button>`);
        }
        if (d.mode !== 'online' || me != null) btns.push('<button class="btn ghost small danger" data-act="resign">🏳️ 기권</button>');
      }
      btns.push('<button class="btn ghost small" data-act="flip">⇅ 뒤집기</button>');
      root.innerHTML = `
        <section class="card chess-card">
          <div class="muted">${MODE_LABEL[d.mode] || ''} 대국${online() && offer != null && offer !== me ? ` · <b>${name(offer)}님이 무승부를 제안했어요</b>` : ''}</div>
          ${statusHtml()}
          ${playerBar(1 - bottom)}
          <div id="cb"></div>
          ${playerBar(bottom)}
          <div class="chess-actions">${btns.join('')}</div>
          ${moveListHtml(chess)}
          ${d.result && !readonly ? '<button class="btn primary block" data-act="finish">전적에 기록</button>' : ''}
        </section>`;
      const holder = root.querySelector('#cb');
      board.mount(holder);
      board.set({
        chess, orientation,
        lastMove: last ? { from: last.from, to: last.to } : null,
        canMove: (color) => {
          if (d.result || readonly || thinking) return false;
          if (d.mode === 'local') return true;
          if (d.mode === 'ai') return color !== colorOf(cpuIdx);
          return me != null && colorOf(me) === color;
        },
      });
    }

    root.onclick = async (e) => {
      const t = e.target.closest('button');
      if (!t || t.disabled || t.closest('#cb')) return;
      const ds = t.dataset;
      if (ds.mode) { d.mode = ds.mode; if (d.mode === 'online' && myUid) { const mine = players.findIndex((p) => p.email && p.email.toLowerCase() === String(ctx.me?.email || '').toLowerCase()); d.seats = mine >= 0 ? { [mine]: myUid } : {}; } return draw(); }
      if (ds.me != null) { d.seats = { [ds.me]: myUid }; return draw(); }
      if (ds.white != null) { d.white = ds.white === 'rand' ? Math.floor(Math.random() * 2) : Number(ds.white); if (ds.white === 'rand') ctx.toast?.(`백은 ${players[d.white].name}`); return draw(); }
      if (ds.level != null) { d.level = Number(ds.level); return draw(); }
      const act = ds.act;
      if (act === 'start') { d.started = true; bump(); draw(); maybeComputer(); return; }
      if (act === 'flip') { flipped = !flipped; return draw(); }
      if (act === 'undo') {
        let n = 1;
        if (d.mode === 'ai') { n = colorOf(cpuIdx) === chess.turn() && !thinking ? 1 : 2; if (thinking) n = 1; }
        d.moves.splice(Math.max(0, d.moves.length - n));
        thinking = false;
        chess = replay(d.moves); lastSeenLen = d.moves.length; bump(); draw();
        if (d.mode === 'ai' && colorOf(cpuIdx) === chess.turn()) maybeComputer();
        return;
      }
      if (act === 'draw') { if (confirm('무승부로 끝낼까요?')) { d.result = { winner: null, reason: '합의' }; bump(); draw(); } return; }
      if (act === 'offer') { d.drawOffer = myIdx(); bump(); draw(); return; }
      if (act === 'accept') { d.result = { winner: null, reason: '합의' }; d.drawOffer = null; bump(); draw(); return; }
      if (act === 'decline') { d.drawOffer = null; bump(); draw(); return; }
      if (act === 'resign') {
        const loser = d.mode === 'local' ? idxOf(chess.turn()) : myIdx();
        if (!confirm(`${players[loser].name}님이 기권할까요?`)) return;
        d.result = { winner: 1 - loser, reason: '기권' }; bump(); draw(); return;
      }
      if (act === 'finish') { finishing = true; ctx.finish(); }
    };

    // 온라인: 상대가 둔 수를 실시간으로 받음
    if (ctx.watch) {
      ctx.watch((remote) => {
        const rd = remote.data;
        if (!rd || (rd.seq || 0) <= (d.seq || 0)) return;
        Object.assign(d, rd);
        session.totals = remote.totals; session.status = remote.status;
        const before = lastSeenLen;
        chess = replay(d.moves); lastSeenLen = d.moves.length;
        if (d.moves.length > before && online()) {
          const h = chess.history();
          ctx.toast?.(`${name(idxOf(chess.turn() === 'w' ? 'b' : 'w'))}: ${h[h.length - 1]}`);
          navigator.vibrate?.(80);
        }
        if (remote.status === 'finished' && !finishing) { ctx.reload?.(); return; }
        claimSeat();
        draw();
      });
    }

    // 온라인 상대가 처음 열면 남은 자리에 앉음
    function claimSeat() {
      if (!online() || !d.started || !myUid || readonly || myIdx() != null) return;
      const free = [0, 1].find((i) => !d.seats?.[i]);
      const myEmail = String(ctx.me?.email || '').toLowerCase();
      if (free != null && (!players[free].email || players[free].email.toLowerCase() === myEmail)) {
        d.seats = { ...d.seats, [free]: myUid }; bump();
      }
    }
    claimSeat();

    draw();
    maybeComputer();
  },
};

// 잡은 기물 표시 (상대에게서 잡은 것)
const START = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const SYM = { w: { q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } };
function captured(c, color) {
  const opp = color === 'w' ? 'b' : 'w';
  const cnt = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  for (const row of c.board()) for (const p of row) if (p && p.color === opp && p.type !== 'k') cnt[p.type]++;
  let s = '';
  for (const t of ['q', 'r', 'b', 'n', 'p']) { const n = Math.max(0, START[t] - cnt[t]); s += SYM[opp][t].repeat(n); }
  return s ? s.split('').map((ch) => ch + '︎').join('') : '';
}
