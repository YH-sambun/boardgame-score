// 오목: 한 기기에서 번갈아 두기 (15×15). 먼저 고른 사람이 흑(선).
//  렌주룰을 켜면 흑은 3·3, 4·4, 6목 이상(장목)이 금지 (흑이 다섯을 만드는 수는 예외로 허용).
//  혼자 고르면 컴퓨터와 대국 (settings.cpuSide: 내 돌 흑/백, cpuLevel: 실력)
// session.data = { moves:[칸 번호], winner:자리|null, draw:bool }
import { isCpu, levelField, cpuPlayers, levelOf, LEVEL_NAMES } from './cpu.js?v=202611121512';
import { pickMove } from './omok-ai.js?v=202611121512';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const N = 15;
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

// 칸 상태: 0 빈칸, 1 흑, 2 백
export function boardOf(moves) {
  const b = new Uint8Array(N * N);
  moves.forEach((m, k) => { b[m] = k % 2 ? 2 : 1; });
  return b;
}
// 한 방향으로 놓은 돌 포함 연속 개수
function run(b, x, y, dx, dy, c) {
  let n = 1;
  for (let s = 1; inside(x + dx * s, y + dy * s) && b[(y + dy * s) * N + x + dx * s] === c; s++) n++;
  for (let s = 1; inside(x - dx * s, y - dy * s) && b[(y - dy * s) * N + x - dx * s] === c; s++) n++;
  return n;
}
const maxRun = (b, i, c) => Math.max(...DIRS.map(([dx, dy]) => run(b, i % N, Math.floor(i / N), dx, dy, c)));
const isFive = (b, i, c, exact) => DIRS.some(([dx, dy]) => { const r = run(b, i % N, Math.floor(i / N), dx, dy, c); return exact ? r === 5 : r >= 5; });

// 방향 d 위의 칸들 (놓은 자리 기준 -5..+5)
function lineCells(i, [dx, dy]) {
  const x = i % N; const y = Math.floor(i / N);
  const out = [];
  for (let s = -5; s <= 5; s++) { const xx = x + dx * s; const yy = y + dy * s; out.push(inside(xx, yy) ? yy * N + xx : -1); }
  return out;
}
// 흑이 i 에 둔 상태에서, 방향 d 로 "넷"(한 수만 더 두면 정확히 다섯)인지
function fourIn(b, i, d) {
  return lineCells(i, d).some((j) => {
    if (j < 0 || b[j] !== 0) return false;
    b[j] = 1; const ok = run(b, j % N, Math.floor(j / N), d[0], d[1], 1) === 5 && lineCells(i, d).includes(j); b[j] = 0;
    return ok;
  });
}
// 열린 넷(양쪽 어디로 둬도 다섯)이 되는 빈칸이 있으면 열린 셋
function openThreeIn(b, i, d) {
  return lineCells(i, d).some((j) => {
    if (j < 0 || b[j] !== 0) return false;
    b[j] = 1;
    const wins = lineCells(i, d).filter((k) => {
      if (k < 0 || b[k] !== 0) return false;
      b[k] = 1; const ok = run(b, k % N, Math.floor(k / N), d[0], d[1], 1) === 5; b[k] = 0;
      return ok;
    });
    const r = run(b, j % N, Math.floor(j / N), d[0], d[1], 1);
    b[j] = 0;
    return r === 4 && wins.length >= 2;
  });
}
// 렌주 금수 이유 (없으면 null)
export function forbidden(b, i) {
  if (b[i]) return '빈 칸이 아니에요';
  b[i] = 1;
  try {
    if (isFive(b, i, 1, true)) return null;
    if (maxRun(b, i, 1) >= 6) return '장목(6목 이상) 금지';
    if (DIRS.filter((d) => fourIn(b, i, d)).length >= 2) return '4·4 금지';
    if (DIRS.filter((d) => openThreeIn(b, i, d)).length >= 2) return '3·3 금지';
    return null;
  } finally { b[i] = 0; }
}

export default {
  id: 'omok',
  name: '오목',
  guide: {
    players: '1~2명 (1명이면 컴퓨터와)', time: '5~15분',
    intro: '바둑판에 흑과 백이 번갈아 돌을 놓아, 가로·세로·대각선으로 다섯 개를 먼저 잇는 사람이 이기는 게임이에요. 한 폰으로 번갈아 두거나, 혼자면 컴퓨터와 둬요.',
    rules: [
      '먼저 고른 사람이 흑으로 먼저 둬요. 빈 교차점을 누르면 돌이 놓여요.',
      '가로·세로·대각선으로 같은 색 다섯 개를 이으면 이겨요.',
      '렌주룰을 켜면 흑은 3·3(열린 셋 두 개 동시), 4·4(넷 두 개 동시), 6목 이상이 금지예요. 흑이 다섯을 만드는 수는 괜찮아요. 백은 제한 없어요.',
      '실수했으면 무르기로 한 수씩 되돌릴 수 있어요. 컴퓨터와 둘 때는 컴퓨터 수와 내 수가 함께 물러져요.',
      '혼자 고르면 컴퓨터와 둬요. 새 게임 화면에서 내 돌(흑·백)과 컴퓨터 실력(쉬움·보통·어려움)을 고를 수 있어요.',
    ],
    scoring: ['이기면 승, 지면 패로 전적에 남아요. 판이 다 차면 무승부예요.', '컴퓨터는 전적 목록에 나오지 않아요.'],
    tips: [
      '양쪽이 열린 셋을 만들면 상대는 반드시 막아야 해요. 막는 사이에 다른 곳에 셋을 하나 더 만들면 이겨요.',
      '상대의 열린 셋은 바로 막으세요. 한 칸 띈 셋(●●·●)도 열린 셋이에요.',
      '렌주룰 없이 하면 흑이 많이 유리해요. 실력 차가 크면 약한 사람이 흑을 잡으세요.',
      '어려움 컴퓨터는 넷을 연달아 만들어 이기는 수를 잘 찾아요. 상대의 넷 하나에 한 칸 띈 셋이 겹치는 자리를 조심하세요.',
    ],
  },
  minPlayers: 1,
  maxPlayers: 2,
  pickHint: '두 사람을 고르면 먼저 고른 사람이 흑(먼저 둠)이에요. 1명만 고르면 컴퓨터와 둬요.',
  settingsFields: [
    { key: 'renju', label: '렌주룰', default: false, options: [{ value: false, label: '끄기 (자유룰)' }, { value: true, label: '켜기 (흑 3·3 등 금지)' }] },
    { key: 'cpuSide', label: '내 돌', default: 'black', show: ({ count }) => count === 1, options: [{ value: 'black', label: '흑 (먼저)' }, { value: 'white', label: '백 (나중)' }] },
    levelField(),
  ],

  // 1명만 고르면 컴퓨터를 상대로 추가 (내 돌이 백이면 컴퓨터가 흑 자리)
  preparePlayers(ps, settings) {
    if (ps.length !== 1) return ps;
    return settings?.cpuSide === 'white' ? [...cpuPlayers(1), ...ps] : [...ps, ...cpuPlayers(1)];
  },
  roundLabel: '대국',

  initData() { return { moves: [], winner: null, draw: false }; },
  computeTotals(session) {
    const d = session.data;
    return session.players.map((_, i) => (d.draw ? 0.5 : d.winner == null ? 0 : d.winner === i ? 1 : -1));
  },
  totalLabel(t) { return t === 1 ? '승' : t === 0.5 ? '무' : t === -1 ? '패' : ''; },
  incompleteCount(session) { return session.data.winner == null && !session.data.draw ? 1 : 0; },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const players = session.players;
    const renju = !!session.settings?.renju;
    let msg = '';
    const over = () => d.winner != null || d.draw || session.status === 'finished';
    const cpuSeat = players.findIndex(isCpu);
    const level = levelOf(session);
    let thinking = false;
    const humanTurn = () => cpuSeat < 0 || d.moves.length % 2 !== cpuSeat;

    const draw = () => {
      const b = boardOf(d.moves);
      const turn = d.moves.length % 2;
      const last = d.moves[d.moves.length - 1];
      root.innerHTML = `<section class="card omok-card">
        <div class="omok-players">${players.map((p, i) => `<span class="${!over() && turn === i ? 'turn' : ''}"><i class="stone s${i + 1}"></i>${esc(p.name)}</span>`).join('')}</div>
        <div class="chess-status ${over() ? 'done' : ''}">${d.winner != null ? `${esc(players[d.winner].name)} 승리!` : d.draw ? '무승부' : thinking ? '컴퓨터가 생각 중…' : `${esc(players[turn].name)} 차례 (${turn ? '백' : '흑'})${renju ? ' · 렌주룰' : ''}`}${cpuSeat >= 0 ? ` <small class="muted">· 컴퓨터 ${LEVEL_NAMES[level]}</small>` : ''}</div>
        <div class="omok-board ${thinking ? 'busy' : ''}">${Array.from({ length: N * N }, (_, i) => `<button class="pt ${i % N === 0 ? 'l' : ''} ${i % N === N - 1 ? 'r' : ''} ${i < N ? 't' : ''} ${i >= N * (N - 1) ? 'b' : ''} ${[48, 56, 112, 168, 176].includes(i) ? 'star' : ''}" data-i="${i}" ${over() || b[i] || !humanTurn() ? 'disabled' : ''}>${b[i] ? `<i class="stone s${b[i]} ${i === last ? 'last' : ''}"></i>` : ''}</button>`).join('')}</div>
        <p class="quiz-msg no">${esc(msg)}</p>
        <div class="chess-actions">
          ${session.status === 'finished' ? '' : `<button class="btn small" data-act="undo" ${canUndo() ? '' : 'disabled'}>무르기</button>
          ${over() ? '<button class="btn primary small" data-act="finish">전적에 기록</button>' : '<button class="btn small" data-act="resign">기권</button>'}`}
        </div>
        <p class="muted center">${d.moves.length}수</p>
      </section>`;
    };

    // 컴퓨터와 둘 때는 사람의 수가 하나 이상 있어야 무를 수 있음 (컴퓨터 수와 함께 물림)
    const canUndo = () => !thinking && (cpuSeat < 0 ? d.moves.length > 0 : d.moves.length > (cpuSeat === 0 ? 1 : 0));

    const place = (i) => {
      const b = boardOf(d.moves);
      const turn = d.moves.length % 2;
      d.moves.push(i);
      b[i] = turn + 1;
      if (isFive(b, i, turn + 1, renju && turn === 0)) d.winner = turn;
      else if (d.moves.length === N * N) d.draw = true;
      ctx.save(); draw();
      if (over()) setTimeout(() => ctx.finish({ ask: false }), 900);
      else maybeComputer();
    };

    // 컴퓨터 차례면 잠깐 뒤에 둠 (화면이 먼저 그려지도록)
    const maybeComputer = () => {
      if (cpuSeat < 0 || over() || humanTurn() || thinking) return;
      thinking = true; draw();
      setTimeout(() => {
        if (!root.isConnected) return;
        let i = -1;
        try { i = pickMove(d.moves, level, renju ? forbidden : null); } catch (err) { console.error(err); }
        thinking = false;
        if (i < 0 || over()) return draw();
        place(i);
      }, 350 + Math.random() * 300);
    };

    root.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'finish') return ctx.finish({ ask: false });
      if (session.status === 'finished' || thinking) return;
      if (act === 'undo') {
        if (!canUndo()) return;
        d.moves.pop();
        if (cpuSeat >= 0 && !humanTurn()) d.moves.pop();
        d.winner = null; d.draw = false; msg = ''; ctx.save(); draw(); return maybeComputer();
      }
      if (act === 'resign') {
        const me = cpuSeat >= 0 ? 1 - cpuSeat : d.moves.length % 2;
        if (!confirm(`${players[me].name}님이 기권할까요?`)) return;
        d.winner = 1 - me; ctx.save(); draw(); return ctx.finish({ ask: false });
      }
      if (btn.dataset.i == null || over() || !humanTurn()) return;
      const i = Number(btn.dataset.i);
      const b = boardOf(d.moves);
      const turn = d.moves.length % 2;
      if (renju && turn === 0) { const why = forbidden(b, i); if (why) { msg = `${why}: 흑은 그 자리에 둘 수 없어요`; return draw(); } }
      msg = '';
      place(i);
    };
    draw();
    maybeComputer();
  },
};
