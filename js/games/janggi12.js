// 십이장기: 3×4 판에서 말 4개(왕·장·상·자)로 두는 작은 장기. 잡은 말은 내 말로 다시 놓을 수 있음
//  왕을 잡거나, 내 왕이 상대 진영(상대 맨 끝 줄)에 들어가 상대 차례를 버티면 승리
//  아래쪽(자리 0)이 먼저 둠. 위쪽 말은 뒤집어 표시해서 마주 앉아 두기 좋게 함
// session.data = { board:[12칸, null | { s:자리, k:'K'|'R'|'B'|'P'|'Q' }], hand:{ h0:[종류], h1:[종류] }, turn, plies, winner, draw, why }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const W = 3; const H = 4;
const NAMES = { K: '왕', R: '장', B: '상', P: '자', Q: '후' };
const ORTH = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const DIAG = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const MAX_PLIES = 200;
const homeRow = (s) => (s === 0 ? H - 1 : 0); // 자리 s 의 진영(맨 끝 줄)
const fwd = (s) => (s === 0 ? -1 : 1);

// 말이 한 칸에 갈 수 있는 방향들 (앞 = 상대 쪽)
function dirsOf(k, s) {
  const f = fwd(s);
  if (k === 'K') return [...ORTH, ...DIAG];
  if (k === 'R') return ORTH;
  if (k === 'B') return DIAG;
  if (k === 'P') return [[0, f]];
  return [...ORTH, [-1, f], [1, f]]; // 후: 뒤쪽 대각선만 못 감
}
export function movesFrom(board, i) {
  const p = board[i];
  if (!p) return [];
  const x = i % W; const y = Math.floor(i / W);
  return dirsOf(p.k, p.s).map(([dx, dy]) => [x + dx, y + dy])
    .filter(([a, b]) => a >= 0 && b >= 0 && a < W && b < H && board[b * W + a]?.s !== p.s)
    .map(([a, b]) => b * W + a);
}
// 잡은 말을 놓을 수 있는 칸: 빈칸 중 상대 진영 줄은 빼고
export const dropCells = (board, s) => board.map((v, i) => (!v && Math.floor(i / W) !== homeRow(1 - s) ? i : -1)).filter((i) => i >= 0);

function initBoard() {
  const b = Array(W * H).fill(null);
  // 아래(자리 0): 맨 아랫줄 장·왕·상, 그 앞 가운데 자 / 위(자리 1): 180도 돌린 모양
  b[9] = { s: 0, k: 'R' }; b[10] = { s: 0, k: 'K' }; b[11] = { s: 0, k: 'B' }; b[7] = { s: 0, k: 'P' };
  b[2] = { s: 1, k: 'R' }; b[1] = { s: 1, k: 'K' }; b[0] = { s: 1, k: 'B' }; b[4] = { s: 1, k: 'P' };
  return b;
}

export default {
  id: 'janggi12',
  name: '십이장기',
  guide: {
    players: '2명', time: '5~15분',
    intro: '가로 3칸, 세로 4칸, 열두 칸짜리 판에서 말 네 개로 두는 작은 장기예요. 잡은 상대 말을 내 말로 다시 쓸 수 있어서 짧지만 수 싸움이 치열해요.',
    rules: [
      '각자 왕·장·상·자 네 개로 시작해요. 아래쪽(먼저 고른 사람)이 먼저 둬요.',
      '모든 말은 한 번에 한 칸씩 움직여요. 왕은 여덟 방향, 장은 앞뒤좌우, 상은 대각선 네 방향, 자는 앞으로만 가요.',
      '자가 상대 진영(상대 맨 끝 줄)에 들어가면 후로 바뀌어요. 후는 뒤쪽 대각선 두 방향만 빼고 여섯 방향으로 가요.',
      '상대 말이 있는 칸으로 가면 그 말을 잡아요. 잡은 말은 내 손에 들어오고(후는 자로 돌아감), 내 차례에 말을 옮기는 대신 빈칸에 놓을 수 있어요. 상대 진영 줄에는 놓을 수 없어요.',
      '상대 왕을 잡으면 이겨요. 내 왕이 상대 진영에 들어간 뒤 상대 차례가 지나도록 잡히지 않아도 이겨요.',
      `${MAX_PLIES}수가 넘도록 끝나지 않으면 무승부예요.`,
    ],
    scoring: ['이기면 승, 지면 패, 무승부는 무로 전적에 남아요.'],
    tips: [
      '왕이 직접 공격에 나서는 게 이 게임의 묘미예요. 상대 진영까지 두 칸밖에 안 돼요.',
      '잡은 말을 바로 놓기보다, 상대 왕이 갈 길을 막는 자리에 놓으면 효과가 커요.',
      '상은 대각선만 다녀서 앞뒤좌우가 약해요. 장과 서로 지켜 주게 두세요.',
    ],
  },
  minPlayers: 2,
  maxPlayers: 2,
  pickHint: '두 사람을 고르세요. 먼저 고른 사람이 아래쪽(초록)이고 먼저 둬요.',
  settingsFields: [],
  roundLabel: '대국',
  tieIsNoWin: true,

  initData() { return { board: initBoard(), hand: { h0: [], h1: [] }, turn: 0, plies: 0, winner: null, draw: false, why: '' }; },
  computeTotals(session) {
    const d = session.data;
    return [0, 1].map((i) => (d.draw ? 0.5 : d.winner == null ? 0 : d.winner === i ? 1 : -1));
  },
  totalLabel(t) { return t === 1 ? '승' : t === 0.5 ? '무' : t === -1 ? '패' : ''; },
  incompleteCount(session) { return session.data.winner == null && !session.data.draw ? 1 : 0; },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const players = session.players;
    const over = () => d.winner != null || d.draw || session.status === 'finished';
    let sel = null; // 판의 칸 번호 또는 'h:종류'(손에 든 말)
    let msg = '';
    const undo = [];
    const handOf = (s) => d.hand[`h${s}`];

    const startTurn = () => {
      // 상대 차례를 버틴 내 왕이 상대 진영에 있으면 승리
      const t = d.turn;
      const ki = d.board.findIndex((p) => p && p.s === t && p.k === 'K');
      if (ki >= 0 && Math.floor(ki / W) === homeRow(1 - t)) { d.winner = t; d.why = '왕이 상대 진영에서 버텼어요'; return; }
      const canAct = d.board.some((p, i) => p && p.s === t && movesFrom(d.board, i).length) || (handOf(t).length && dropCells(d.board, t).length);
      if (!canAct) { d.winner = 1 - t; d.why = '둘 수 있는 수가 없어요'; return; }
      if (d.plies >= MAX_PLIES) d.draw = true;
    };
    const endMove = () => { d.plies++; d.turn = 1 - d.turn; sel = null; startTurn(); ctx.save(); draw(); if (over()) setTimeout(() => ctx.finish({ ask: false }), 1000); };

    const piece = (p) => `<span class="j12-p s${p.s}">${NAMES[p.k]}</span>`;
    const handHtml = (s) => `<div class="j12-hand ${!over() && d.turn === s ? 'turn' : ''}"><b>${esc(players[s].name)}</b><span class="muted">${s ? '위 · 빨강' : '아래 · 초록'}</span>
      <div class="j12-handp">${handOf(s).length ? handOf(s).map((k, n) => `<button class="j12-hb ${sel === `h:${n}` && d.turn === s ? 'sel' : ''}" data-h="${s}:${n}" ${over() || d.turn !== s ? 'disabled' : ''}>${piece({ s, k })}</button>`).join('') : '<span class="muted">잡은 말 없음</span>'}</div></div>`;

    const draw = () => {
      const t = d.turn;
      let legal = [];
      if (!over() && sel != null) legal = typeof sel === 'number' ? movesFrom(d.board, sel) : dropCells(d.board, t);
      root.innerHTML = `<section class="card j12-card">
        ${handHtml(1)}
        <div class="chess-status ${over() ? 'done' : ''}">${d.winner != null ? `${esc(players[d.winner].name)} 승리!${d.why ? ` <small class="muted">${esc(d.why)}</small>` : ''}` : d.draw ? '무승부' : `${esc(players[t].name)} 차례`}</div>
        <div class="j12-board">${d.board.map((p, i) => {
    const row = Math.floor(i / W);
    const zone = row === 0 ? 'z1' : row === H - 1 ? 'z0' : '';
    return `<button class="j12-c ${zone} ${sel === i ? 'sel' : ''} ${legal.includes(i) ? (p ? 'cap' : 'legal') : ''}" data-i="${i}" ${over() ? 'disabled' : ''}>${p ? piece(p) : ''}</button>`;
  }).join('')}</div>
        ${handHtml(0)}
        <p class="quiz-msg no">${esc(msg)}</p>
        <div class="chess-actions">
          ${session.status === 'finished' ? '' : `<button class="btn small" data-act="undo" ${undo.length ? '' : 'disabled'}>무르기</button>
          ${over() ? '<button class="btn primary small" data-act="finish">전적에 기록</button>' : '<button class="btn small" data-act="drawoffer">무승부 합의</button><button class="btn small" data-act="resign">기권</button>'}`}
        </div>
        <p class="muted center">${d.plies}수 · 색칠된 줄이 각자의 진영이에요</p>
      </section>`;
    };

    root.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'finish') return ctx.finish({ ask: false });
      if (session.status === 'finished') return;
      if (act === 'undo') { const s = undo.pop(); if (!s) return; Object.assign(d, JSON.parse(s)); sel = null; msg = ''; ctx.save(); return draw(); }
      if (over()) return;
      if (act === 'resign') { if (!confirm(`${players[d.turn].name}님이 기권할까요?`)) return; d.winner = 1 - d.turn; d.why = '기권'; ctx.save(); draw(); return ctx.finish({ ask: false }); }
      if (act === 'drawoffer') { if (!confirm('두 사람 모두 무승부에 동의하나요?')) return; d.draw = true; ctx.save(); draw(); return ctx.finish({ ask: false }); }
      const t = d.turn;
      if (btn.dataset.h) { const [s, n] = btn.dataset.h.split(':').map(Number); if (s !== t) return; sel = sel === `h:${n}` ? null : `h:${n}`; msg = ''; return draw(); }
      if (btn.dataset.i == null) return;
      const i = Number(btn.dataset.i);
      const p = d.board[i];
      if (p && p.s === t && !(typeof sel === 'number' && movesFrom(d.board, sel).includes(i))) { sel = sel === i ? null : i; msg = ''; return draw(); }
      if (sel == null) return;
      if (typeof sel === 'string') {
        if (!dropCells(d.board, t).includes(i)) { msg = '빈칸에, 상대 진영 줄이 아닌 곳에만 놓을 수 있어요'; return draw(); }
        undo.push(JSON.stringify(d));
        const n = Number(sel.slice(2));
        const k = handOf(t).splice(n, 1)[0];
        d.board[i] = { s: t, k };
        msg = '';
        return endMove();
      }
      if (!movesFrom(d.board, sel).includes(i)) { msg = '그 말은 거기로 갈 수 없어요'; return draw(); }
      undo.push(JSON.stringify(d));
      const mover = d.board[sel];
      if (p) {
        if (p.k === 'K') { d.board[i] = mover; d.board[sel] = null; d.winner = t; d.why = '왕을 잡았어요'; d.plies++; sel = null; ctx.save(); draw(); return setTimeout(() => ctx.finish({ ask: false }), 1000); }
        handOf(t).push(p.k === 'Q' ? 'P' : p.k);
      }
      d.board[i] = mover.k === 'P' && Math.floor(i / W) === homeRow(1 - t) ? { s: t, k: 'Q' } : mover;
      d.board[sel] = null;
      msg = '';
      endMove();
    };
    draw();
  },
};
