// 오목: 한 기기에서 번갈아 두기 (15×15). 먼저 고른 사람이 흑(선).
//  렌주룰을 켜면 흑은 3·3, 4·4, 6목 이상(장목)이 금지 (흑이 다섯을 만드는 수는 예외로 허용).
// session.data = { moves:[칸 번호], winner:자리|null, draw:bool }
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
    players: '2명', time: '5~15분',
    intro: '바둑판에 흑과 백이 번갈아 돌을 놓아, 가로·세로·대각선으로 다섯 개를 먼저 잇는 사람이 이기는 게임이에요. 한 폰으로 번갈아 둬요.',
    rules: [
      '먼저 고른 사람이 흑으로 먼저 둬요. 빈 교차점을 누르면 돌이 놓여요.',
      '가로·세로·대각선으로 같은 색 다섯 개를 이으면 이겨요.',
      '렌주룰을 켜면 흑은 3·3(열린 셋 두 개 동시), 4·4(넷 두 개 동시), 6목 이상이 금지예요. 흑이 다섯을 만드는 수는 괜찮아요. 백은 제한 없어요.',
      '실수했으면 무르기로 한 수씩 되돌릴 수 있어요.',
    ],
    scoring: ['이기면 승, 지면 패로 전적에 남아요. 판이 다 차면 무승부예요.'],
    tips: [
      '양쪽이 열린 셋을 만들면 상대는 반드시 막아야 해요. 막는 사이에 다른 곳에 셋을 하나 더 만들면 이겨요.',
      '상대의 열린 셋은 바로 막으세요. 한 칸 띈 셋(●●·●)도 열린 셋이에요.',
      '렌주룰 없이 하면 흑이 많이 유리해요. 실력 차가 크면 약한 사람이 흑을 잡으세요.',
    ],
  },
  minPlayers: 2,
  maxPlayers: 2,
  pickHint: '두 사람을 고르세요. 먼저 고른 사람이 흑(먼저 둠)이에요.',
  settingsFields: [{ key: 'renju', label: '렌주룰', default: false, options: [{ value: false, label: '끄기 (자유룰)' }, { value: true, label: '켜기 (흑 3·3 등 금지)' }] }],
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

    const draw = () => {
      const b = boardOf(d.moves);
      const turn = d.moves.length % 2;
      const last = d.moves[d.moves.length - 1];
      root.innerHTML = `<section class="card omok-card">
        <div class="omok-players">${players.map((p, i) => `<span class="${!over() && turn === i ? 'turn' : ''}"><i class="stone s${i + 1}"></i>${esc(p.name)}</span>`).join('')}</div>
        <div class="chess-status ${over() ? 'done' : ''}">${d.winner != null ? `${esc(players[d.winner].name)} 승리!` : d.draw ? '무승부' : `${esc(players[turn].name)} 차례 (${turn ? '백' : '흑'})${renju ? ' · 렌주룰' : ''}`}</div>
        <div class="omok-board">${Array.from({ length: N * N }, (_, i) => `<button class="pt ${i % N === 0 ? 'l' : ''} ${i % N === N - 1 ? 'r' : ''} ${i < N ? 't' : ''} ${i >= N * (N - 1) ? 'b' : ''} ${[48, 56, 112, 168, 176].includes(i) ? 'star' : ''}" data-i="${i}" ${over() || b[i] ? 'disabled' : ''}>${b[i] ? `<i class="stone s${b[i]} ${i === last ? 'last' : ''}"></i>` : ''}</button>`).join('')}</div>
        <p class="quiz-msg no">${esc(msg)}</p>
        <div class="chess-actions">
          ${session.status === 'finished' ? '' : `<button class="btn small" data-act="undo" ${d.moves.length ? '' : 'disabled'}>무르기</button>
          ${over() ? '<button class="btn primary small" data-act="finish">전적에 기록</button>' : '<button class="btn small" data-act="resign">기권</button>'}`}
        </div>
        <p class="muted center">${d.moves.length}수</p>
      </section>`;
    };

    root.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'finish') return ctx.finish({ ask: false });
      if (session.status === 'finished') return;
      if (act === 'undo') { d.moves.pop(); d.winner = null; d.draw = false; msg = ''; ctx.save(); return draw(); }
      if (act === 'resign') {
        const turn = d.moves.length % 2;
        if (!confirm(`${players[turn].name}님이 기권할까요?`)) return;
        d.winner = 1 - turn; ctx.save(); draw(); return ctx.finish({ ask: false });
      }
      if (btn.dataset.i == null || over()) return;
      const i = Number(btn.dataset.i);
      const b = boardOf(d.moves);
      const turn = d.moves.length % 2;
      if (renju && turn === 0) { const why = forbidden(b, i); if (why) { msg = `${why}: 흑은 그 자리에 둘 수 없어요`; return draw(); } }
      msg = '';
      d.moves.push(i);
      b[i] = turn + 1;
      if (isFive(b, i, turn + 1, renju && turn === 0)) d.winner = turn;
      else if (d.moves.length === N * N) d.draw = true;
      ctx.save(); draw();
      if (over()) setTimeout(() => ctx.finish({ ask: false }), 900);
    };
    draw();
  },
};
