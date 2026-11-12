// 체스판 화면 + 엔진(웹 워커) 호출 도우미. 체스 대국과 체스 퀴즈가 함께 씁니다.
import { Chess } from './lib/chess.js?v=202611121529';

export { Chess };

// ───────── 엔진 (웹 워커, 안 되면 화면 쪽에서 직접 계산) ─────────
let worker = null, seq = 0;
const waiting = new Map();
export function engine(type, args) {
  if (worker === null) {
    try {
      worker = new Worker(new URL('./chess-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => { const w = waiting.get(e.data.id); if (!w) return; waiting.delete(e.data.id); e.data.error ? w.reject(new Error(e.data.error)) : w.resolve(e.data.result); };
      worker.onerror = (e) => { console.error('chess worker', e); worker = false; for (const w of waiting.values()) w.retry(); waiting.clear(); };
    } catch (e) { console.warn('worker 사용 불가', e); worker = false; }
  }
  const direct = () => import('./chess-engine.js').then((E) => ({
    search: (a) => E.search(a.fen, a.opts), mateMoves: (a) => E.mateMoves(a.fen, a.n), isForcedMate: (a) => E.isForcedMate(a.fen, a.n),
    bestDefense: (a) => E.bestDefense(a.fen, a.n), mateLine: (a) => E.mateLine(a.fen, a.n),
  }[type](args)));
  if (!worker) return direct();
  return new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { resolve, reject, retry: () => direct().then(resolve, reject) });
    worker.postMessage({ id, type, args });
  });
}

// 전체 기물 모양(채워진 글자)을 두 색 모두에 쓰고, 색은 CSS 로 입힘. FE0E: 이모지로 바뀌지 않게
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const pieceHtml = (p) => `<span class="pc ${p.color}">${GLYPH[p.type]}︎</span>`;
const FILES = 'abcdefgh';

// uci 문자열 → chess.js 수 객체
export const uciObj = (u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });

// 색 뒤집기 (퍼즐을 흑 차례로 보여줄 때)
export function mirrorFen(fen) {
  const [board, side] = fen.split(' ');
  const swap = (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase());
  const b = board.split('/').reverse().map((row) => row.replace(/[a-zA-Z]/g, swap)).join('/');
  return `${b} ${side === 'w' ? 'b' : 'w'} - - 0 1`;
}
export const mirrorUci = (u) => u[0] + (9 - Number(u[1])) + u[2] + (9 - Number(u[3])) + (u[4] || '');

// 체스판 컴포넌트
//  opts.onMove({from,to,promotion}) : 사용자가 둔 수 (합법 수만 전달됨)
//  set({ chess, orientation:'w'|'b', canMove:(color)=>bool, lastMove:{from,to}, hint:[sq..], marks:{sq:cls} })
export function createBoard(root, opts) {
  let st = { chess: null, orientation: 'w', canMove: () => false, lastMove: null, hint: [], marks: {} };
  let sel = null, promo = null;

  const draw = () => {
    const c = st.chess;
    if (!c) return;
    const board = c.board(); // [rank8..rank1][a..h]
    const targets = sel ? c.moves({ square: sel, verbose: true }) : [];
    const tset = new Map(targets.map((m) => [m.to, m]));
    const checkSq = c.inCheck() ? findKing(c, c.turn()) : null;
    const ranks = st.orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    const files = st.orientation === 'w' ? [...FILES] : [...FILES].reverse();
    let html = '';
    for (const r of ranks) {
      for (const f of files) {
        const sq = f + r;
        const p = board[8 - r][FILES.indexOf(f)];
        const cls = [(FILES.indexOf(f) + r) % 2 === 1 ? 'dark' : 'light'];
        if (st.lastMove && (st.lastMove.from === sq || st.lastMove.to === sq)) cls.push('last');
        if (sel === sq) cls.push('sel');
        if (st.hint?.includes(sq)) cls.push('hint');
        if (checkSq === sq) cls.push('check');
        if (st.marks?.[sq]) cls.push(st.marks[sq]);
        const t = tset.get(sq);
        if (t) cls.push(t.captured || t.flags.includes('e') ? 'cap' : 'dot');
        const coord = (f === files[0] ? `<i class="rk">${r}</i>` : '') + (r === ranks[7] ? `<i class="fl">${f}</i>` : '');
        html += `<button class="sq ${cls.join(' ')}" data-sq="${sq}">${coord}${p ? pieceHtml(p) : ''}</button>`;
      }
    }
    const promoHtml = promo ? `<div class="promo"><div>${['q', 'r', 'b', 'n'].map((t) => `<button data-promo="${t}">${pieceHtml({ type: t, color: c.turn() })}</button>`).join('')}</div></div>` : '';
    root.innerHTML = `<div class="chessboard">${html}${promoHtml}</div>`;
  };

  const onClick = (e) => {
    const c = st.chess;
    if (!c) return;
    const pb = e.target.closest('[data-promo]');
    if (pb && promo) { const m = { ...promo, promotion: pb.dataset.promo }; promo = null; sel = null; opts.onMove(m); return; }
    if (promo) { promo = null; draw(); return; }
    const b = e.target.closest('[data-sq]');
    if (!b) return;
    const sq = b.dataset.sq;
    const myTurn = st.canMove(c.turn());
    if (sel && myTurn) {
      const ms = c.moves({ square: sel, verbose: true }).filter((m) => m.to === sq);
      if (ms.length) {
        if (ms.some((m) => m.promotion)) { promo = { from: sel, to: sq }; draw(); return; }
        const m = { from: sel, to: sq }; sel = null; opts.onMove(m); return;
      }
    }
    const p = c.get(sq);
    sel = myTurn && p && p.color === c.turn() && sel !== sq ? sq : null;
    draw();
  };

  root.onclick = onClick;
  return {
    // 화면을 다시 그릴 때 새 자리(div)에 붙이기
    mount(el) { root = el; root.onclick = onClick; },
    set(next) { st = { ...st, ...next }; sel = null; promo = null; draw(); },
    redraw: draw,
  };
}

function findKing(c, color) {
  const b = c.board();
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const p = b[r][f]; if (p && p.type === 'k' && p.color === color) return FILES[f] + (8 - r); }
  return null;
}

// 게임이 끝났는지와 이유
export function gameOverInfo(c) {
  if (c.isCheckmate()) return { winner: c.turn() === 'w' ? 'b' : 'w', reason: '체크메이트' };
  if (c.isStalemate()) return { winner: null, reason: '스테일메이트' };
  if (c.isInsufficientMaterial()) return { winner: null, reason: '기물 부족' };
  if (c.isThreefoldRepetition()) return { winner: null, reason: '3회 반복' };
  if (c.isDrawByFiftyMoves()) return { winner: null, reason: '50수 규칙' };
  return null;
}

// 기보: SAN 을 수 번호와 함께
export function moveListHtml(c) {
  const h = c.history();
  const out = [];
  for (let i = 0; i < h.length; i += 2) out.push(`<span><b>${i / 2 + 1}.</b> ${h[i]}${h[i + 1] ? ' ' + h[i + 1] : ''}</span>`);
  return out.length ? `<div class="movelist">${out.join(' ')}</div>` : '';
}
