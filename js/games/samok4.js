// 4인 삼목: 2~4명이 한 판에 번갈아 말을 놓아, 가로·세로·대각선으로 정한 개수(기본 3)를 먼저 잇는 사람이 승리
//  판 크기(5~7)와 이을 개수(3·4)는 새 게임 화면에서 고름. 한 기기에서 번갈아 둠
// session.data = { size, need, moves:[칸 번호], winner:자리|null, draw }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const MARKS = [
  { g: '●', c: '#1d2a3a', name: '검정 동그라미' },
  { g: '▲', c: '#d8342c', name: '빨강 세모' },
  { g: '■', c: '#2453b8', name: '파랑 네모' },
  { g: '◆', c: '#2f8a4c', name: '초록 마름모' },
];
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

// 방금 놓은 칸에서 같은 말이 need 개 이상 이어졌으면 그 칸들
export function lineAt(board, size, i, need) {
  const who = board[i];
  const x0 = i % size; const y0 = Math.floor(i / size);
  for (const [dx, dy] of DIRS) {
    const cells = [i];
    for (const sgn of [1, -1]) {
      for (let s = 1; ; s++) {
        const x = x0 + dx * s * sgn; const y = y0 + dy * s * sgn;
        if (x < 0 || y < 0 || x >= size || y >= size || board[y * size + x] !== who) break;
        cells.push(y * size + x);
      }
    }
    if (cells.length >= need) return cells;
  }
  return null;
}

export default {
  id: 'samok4',
  name: '4인 삼목',
  guide: {
    players: '2~4명', time: '5분',
    intro: '여럿이 한 판에 번갈아 말을 놓아 같은 말 세 개를 먼저 잇는 사람이 이기는 게임이에요. 셋이나 넷이 하면 서로 막아 주다가 엉뚱한 사람이 이기기도 해요.',
    rules: [
      '고른 순서대로 한 칸씩 말을 놓아요. 사람마다 모양과 색이 달라요.',
      '가로·세로·대각선으로 내 말을 정한 개수(기본 3개)만큼 먼저 이으면 이겨요.',
      '판이 다 차도록 아무도 못 이으면 무승부예요.',
      '두 명이 할 때는 너무 쉽게 끝나니 "4개 잇기"를 추천해요.',
      '실수했으면 무르기로 한 수씩 되돌릴 수 있어요.',
    ],
    scoring: ['이긴 사람은 승, 나머지는 패로 전적에 남아요. 무승부는 모두 무승부예요.'],
    tips: [
      '내 다음 차례까지 다른 사람이 여러 명 둬요. 두 칸짜리 줄이 생기면 막을 사람이 있는지 보세요.',
      '바로 앞 사람보다 바로 다음 사람의 줄을 먼저 막는 게 대체로 안전해요.',
      '양쪽이 열린 두 칸 줄을 두 개 동시에 만들면 다 막을 수 없어요.',
    ],
  },
  minPlayers: 2,
  maxPlayers: 4,
  pickHint: '고른 순서대로 둬요. 2~4명을 고르세요.',
  settingsFields: [
    { key: 'size', label: '판 크기', default: 6, options: [5, 6, 7].map((v) => ({ value: v, label: `${v}×${v}` })) },
    { key: 'need', label: '이을 개수', default: 3, options: [{ value: 3, label: '3개 (기본)' }, { value: 4, label: '4개 (2명일 때 추천)' }] },
  ],
  roundLabel: '대국',
  tieIsNoWin: true,

  initData(players, settings) {
    return { size: Number(settings?.size ?? 6), need: Number(settings?.need ?? 3), moves: [], winner: null, draw: false };
  },
  computeTotals(session) {
    const d = session.data;
    return session.players.map((_, i) => (d.draw ? 0.5 : d.winner == null ? 0 : d.winner === i ? 1 : -1));
  },
  totalLabel(t) { return t === 1 ? '승' : t === 0.5 ? '무' : t === -1 ? '패' : ''; },
  incompleteCount(session) { return session.data.winner == null && !session.data.draw ? 1 : 0; },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const players = session.players;
    const n = players.length;
    const over = () => d.winner != null || d.draw || session.status === 'finished';
    const boardOf = () => { const b = Array(d.size * d.size).fill(-1); d.moves.forEach((m, k) => { b[m] = k % n; }); return b; };
    const mark = (s, cls = '') => `<i class="s4-m ${cls}" style="color:${MARKS[s].c}" aria-label="${MARKS[s].name}">${MARKS[s].g}</i>`;

    const draw = () => {
      const b = boardOf();
      const turn = d.moves.length % n;
      const last = d.moves[d.moves.length - 1];
      const win = d.winner != null && last != null ? lineAt(b, d.size, last, d.need) || [] : [];
      root.innerHTML = `<section class="card s4-card">
        <div class="omok-players">${players.map((p, i) => `<span class="${!over() && turn === i ? 'turn' : ''}">${mark(i)}${esc(p.name)}</span>`).join('')}</div>
        <div class="chess-status ${over() ? 'done' : ''}">${d.winner != null ? `${esc(players[d.winner].name)} 승리!` : d.draw ? '무승부' : `${esc(players[turn].name)} 차례 · ${d.need}개 잇기`}</div>
        <div class="s4-board" style="--n:${d.size}">${b.map((v, i) => `<button class="s4-c ${win.includes(i) ? 'win' : ''} ${i === last ? 'last' : ''}" data-i="${i}" ${over() || v >= 0 ? 'disabled' : ''}>${v >= 0 ? mark(v) : ''}</button>`).join('')}</div>
        <div class="chess-actions">
          ${session.status === 'finished' ? '' : `<button class="btn small" data-act="undo" ${d.moves.length ? '' : 'disabled'}>무르기</button>
          ${over() ? '<button class="btn primary small" data-act="finish">전적에 기록</button>' : ''}`}
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
      if (act === 'undo') { if (!d.moves.length) return; d.moves.pop(); d.winner = null; d.draw = false; ctx.save(); return draw(); }
      if (btn.dataset.i == null || over()) return;
      const i = Number(btn.dataset.i);
      const b = boardOf();
      if (b[i] >= 0) return;
      const turn = d.moves.length % n;
      d.moves.push(i); b[i] = turn;
      if (lineAt(b, d.size, i, d.need)) d.winner = turn;
      else if (d.moves.length === d.size * d.size) d.draw = true;
      ctx.save(); draw();
      if (over()) setTimeout(() => ctx.finish({ ask: false }), 1000);
    };
    draw();
  },
};
