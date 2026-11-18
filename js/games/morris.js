// 나인 멘스 모리스: 말 9개씩으로 하는 고전 보드게임. 한 줄 3개(밀)를 만들면 상대 말을 하나 뺏음
//  1) 놓기: 번갈아 빈 점에 하나씩 9개 → 2) 옮기기: 선을 따라 이웃한 빈 점으로 → 3) 3개만 남으면 아무 빈 점으로 날기
//  상대 말이 2개가 되거나, 상대가 움직일 수 없으면 승리. 잡지 못한 채 50수가 지나면 무승부
// session.data = { board:[24칸, -1 빈칸/0/1], placed:[0,0], turn, removing, sinceCapture, moves, winner, draw }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 점 좌표 (7×7 격자 위). 고리 r(0 바깥 ~ 2 안쪽)마다 왼쪽 위부터 시계 방향 8점
const RING = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]];
export const POS = [0, 1, 2].flatMap((r) => RING.map(([x, y]) => [r + x * (3 - r), r + y * (3 - r)]));
export const ADJ = POS.map((_, i) => {
  const r = Math.floor(i / 8); const k = i % 8;
  const out = [r * 8 + (k + 1) % 8, r * 8 + (k + 7) % 8];
  if (k % 2) { if (r > 0) out.push(i - 8); if (r < 2) out.push(i + 8); }
  return out;
});
export const MILLS = [
  ...[0, 1, 2].flatMap((r) => [[0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0]].map((m) => m.map((k) => r * 8 + k))),
  ...[1, 3, 5, 7].map((k) => [k, k + 8, k + 16]),
];
const inMill = (b, i) => b[i] >= 0 && MILLS.some((m) => m.includes(i) && m.every((j) => b[j] === b[i]));
const MAX_QUIET = 50;

const onBoard = (b, s) => b.filter((v) => v === s).length;
const phaseOf = (d, s) => (d.placed[s] < 9 ? 'place' : onBoard(d.board, s) === 3 ? 'fly' : 'move');
// 이 사람이 둘 수 있는 수가 있는지
function canMove(d, s) {
  const ph = phaseOf(d, s);
  if (ph !== 'move') return d.board.includes(-1);
  return d.board.some((v, i) => v === s && ADJ[i].some((j) => d.board[j] < 0));
}
// 뺏을 수 있는 상대 말: 밀에 들어 있지 않은 말 (모두 밀이면 아무거나)
export function removable(b, s) {
  const theirs = b.map((v, i) => (v === s ? i : -1)).filter((i) => i >= 0);
  const free = theirs.filter((i) => !inMill(b, i));
  return free.length ? free : theirs;
}

export default {
  id: 'morris',
  name: '나인 멘스 모리스',
  guide: {
    players: '2명', time: '10~20분',
    intro: '로마 시대부터 전해 오는 2인 보드게임이에요. 말을 놓고 옮기면서 같은 색 세 개를 한 줄(밀)로 만들 때마다 상대 말을 하나씩 빼앗아요.',
    rules: [
      '각자 말 9개를 가지고 시작해요. 먼저 고른 사람이 흑으로 먼저 둬요.',
      '놓기: 번갈아 빈 점에 말을 하나씩 놓아요. 둘 다 9개를 다 놓을 때까지 계속해요.',
      '옮기기: 다 놓은 뒤에는 내 말 하나를 선을 따라 바로 옆 빈 점으로 옮겨요. 내 말을 누르고 갈 곳을 누르세요.',
      '날기: 내 말이 3개만 남으면 아무 빈 점으로나 옮길 수 있어요.',
      '같은 줄 위의 세 점에 내 말 세 개가 모이면(밀) 상대 말 하나를 빼앗아요. 밀에 들어 있는 말은 다른 말이 없을 때만 뺏을 수 있어요.',
      '상대 말이 2개만 남거나, 상대 차례에 옮길 수 있는 말이 없으면 이겨요.',
      `옮기기 단계에서 ${MAX_QUIET}수 동안 아무도 말을 뺏지 못하면 무승부예요.`,
    ],
    scoring: ['이기면 승, 지면 패, 무승부는 무로 전적에 남아요.'],
    tips: [
      '밀을 열었다 닫았다 할 수 있는 자리(말 하나만 옮기면 다시 밀이 되는 모양)를 만들면 매번 상대 말을 뺏을 수 있어요.',
      '놓기 단계에서는 밀보다 움직일 공간을 넓게 차지하는 게 더 중요할 때가 많아요. 네 갈래 교차점(가운데 고리의 변 중앙)이 좋아요.',
      '상대 말을 가둬서 움직일 수 없게 만들어도 이겨요.',
    ],
  },
  minPlayers: 2,
  maxPlayers: 2,
  pickHint: '두 사람을 고르세요. 먼저 고른 사람이 흑(먼저 둠)이에요.',
  settingsFields: [],
  roundLabel: '대국',
  tieIsNoWin: true,

  initData() { return { board: Array(24).fill(-1), placed: [0, 0], turn: 0, removing: false, sinceCapture: 0, moves: 0, winner: null, draw: false }; },
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
    let sel = null;
    let msg = '';
    const undo = [];
    const snap = () => JSON.stringify(d);

    const endTurn = () => {
      d.turn = 1 - d.turn;
      const t = d.turn;
      // 놓기가 끝난 사람의 말이 2개 이하면 패배
      if (d.placed[t] === 9 && onBoard(d.board, t) < 3) d.winner = 1 - t;
      else if (!canMove(d, t)) { d.winner = 1 - t; msg = `${players[t].name}님은 옮길 수 있는 말이 없어요`; }
      else if (d.placed[0] === 9 && d.placed[1] === 9 && d.sinceCapture >= MAX_QUIET) d.draw = true;
    };
    const afterPut = (i) => {
      d.moves++;
      d.sinceCapture++;
      if (inMill(d.board, i) && removable(d.board, 1 - d.turn).length) { d.removing = true; msg = '밀! 뺏을 상대 말을 누르세요'; } else { msg = ''; endTurn(); }
    };

    const svg = () => {
      const legal = new Set();
      const t = d.turn;
      if (!over()) {
        if (d.removing) removable(d.board, 1 - t).forEach((i) => legal.add(i));
        else if (phaseOf(d, t) === 'place') d.board.forEach((v, i) => { if (v < 0) legal.add(i); });
        else if (sel == null) d.board.forEach((v, i) => { if (v === t && (phaseOf(d, t) === 'fly' ? d.board.includes(-1) : ADJ[i].some((j) => d.board[j] < 0))) legal.add(i); });
        else if (phaseOf(d, t) === 'fly') d.board.forEach((v, i) => { if (v < 0) legal.add(i); });
        else ADJ[sel].forEach((j) => { if (d.board[j] < 0) legal.add(j); });
      }
      const P = (i) => POS[i].map((v) => 8 + v * 14);
      const lines = [];
      for (let r = 0; r < 3; r++) { const a = 8 + r * 14; const z = 8 + (6 - r) * 14; lines.push(`<rect x="${a}" y="${a}" width="${z - a}" height="${z - a}"/>`); }
      [1, 3, 5, 7].forEach((k) => { const [x1, y1] = P(k); const [x2, y2] = P(k + 16); lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`); });
      const pts = d.board.map((v, i) => {
        const [x, y] = P(i);
        const cls = [legal.has(i) ? 'legal' : '', sel === i ? 'sel' : '', d.removing && legal.has(i) ? 'target' : ''].join(' ');
        return `<g class="mm-pt ${cls}" data-i="${i}" role="button" aria-label="${i + 1}번 점"><circle class="hit" cx="${x}" cy="${y}" r="6.5"/>${v >= 0 ? `<circle class="mm-s s${v}" cx="${x}" cy="${y}" r="5"/>` : `<circle class="dot" cx="${x}" cy="${y}" r="1.6"/>`}</g>`;
      }).join('');
      return `<svg class="mm-board" viewBox="0 0 100 100"><g class="mm-lines">${lines.join('')}</g>${pts}</svg>`;
    };

    const status = () => {
      if (d.winner != null) return `${esc(players[d.winner].name)} 승리!`;
      if (d.draw) return '무승부';
      const t = d.turn;
      const ph = d.removing ? '상대 말 뺏기' : { place: `놓기 (${d.placed[t] + 1}/9)`, move: '옮기기', fly: '날기' }[phaseOf(d, t)];
      return `${esc(players[t].name)} 차례 (${t ? '백' : '흑'}) · ${ph}`;
    };

    const draw = () => {
      root.innerHTML = `<section class="card mm-card">
        <div class="omok-players">${players.map((p, i) => `<span class="${!over() && d.turn === i ? 'turn' : ''}"><i class="stone s${i + 1}"></i>${esc(p.name)} <small class="muted">판 ${onBoard(d.board, i)} · 손 ${9 - d.placed[i]}</small></span>`).join('')}</div>
        <div class="chess-status ${over() ? 'done' : ''}">${status()}</div>
        ${svg()}
        <p class="quiz-msg ok">${esc(msg)}</p>
        <div class="chess-actions">
          ${session.status === 'finished' ? '' : `<button class="btn small" data-act="undo" ${undo.length ? '' : 'disabled'}>무르기</button>
          ${over() ? '<button class="btn primary small" data-act="finish">전적에 기록</button>' : '<button class="btn small" data-act="drawoffer">무승부 합의</button><button class="btn small" data-act="resign">기권</button>'}`}
        </div>
        <p class="muted center">${d.moves}수${d.placed[0] === 9 && d.placed[1] === 9 ? ` · 잡지 못한 수 ${d.sinceCapture}/${MAX_QUIET}` : ''}</p>
      </section>`;
    };
    const commit = () => { ctx.save(); draw(); if (over()) setTimeout(() => ctx.finish({ ask: false }), 1000); };

    root.onclick = (e) => {
      const btn = e.target.closest('button');
      const act = btn?.dataset.act;
      if (act === 'finish') return ctx.finish({ ask: false });
      if (session.status === 'finished') return;
      if (act === 'undo') { const s = undo.pop(); if (!s) return; Object.assign(d, JSON.parse(s)); sel = null; msg = ''; ctx.save(); return draw(); }
      if (act === 'resign') { if (!confirm(`${players[d.turn].name}님이 기권할까요?`)) return; d.winner = 1 - d.turn; return commit(); }
      if (act === 'drawoffer') { if (!confirm('두 사람 모두 무승부에 동의하나요?')) return; d.draw = true; return commit(); }
      const pt = e.target.closest('[data-i]');
      if (!pt || over()) return;
      const i = Number(pt.dataset.i);
      const t = d.turn;
      if (d.removing) {
        if (!removable(d.board, 1 - t).includes(i)) { msg = '밀에 들어 있는 말은 다른 말이 없을 때만 뺏을 수 있어요'; return draw(); }
        undo.push(snap());
        d.board[i] = -1; d.removing = false; d.sinceCapture = 0; msg = '';
        endTurn(); return commit();
      }
      const ph = phaseOf(d, t);
      if (ph === 'place') {
        if (d.board[i] >= 0) return;
        undo.push(snap());
        d.board[i] = t; d.placed[t]++;
        afterPut(i); return commit();
      }
      if (d.board[i] === t) { sel = sel === i ? null : i; return draw(); }
      if (sel == null || d.board[i] >= 0) return;
      if (ph === 'move' && !ADJ[sel].includes(i)) { msg = '선으로 이어진 바로 옆 빈 점으로만 옮길 수 있어요'; return draw(); }
      undo.push(snap());
      d.board[sel] = -1; d.board[i] = t; sel = null;
      afterPut(i); commit();
    };
    draw();
  },
};
