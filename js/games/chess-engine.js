// 체스 엔진 (직접 작성, 외부 라이브러리 없음)
//  - 0x88 보드, 합법 수 생성, 알파-베타 탐색(반복 심화 + 정지 탐색), 위치 평가
//  - 컴퓨터 상대의 수 계산, 퀴즈의 메이트 검사·방어 수 계산에 사용
//  - 화면(규칙 판정·기보 표기)은 chess.js 가 담당하고, 이 엔진은 웹 워커에서 수를 계산합니다.
// 기물: 1 폰, 2 나이트, 3 비숍, 4 룩, 5 퀸, 6 킹. 백은 양수, 흑은 음수.

export const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
const FEN_PIECE = { p: -P, n: -N, b: -B, r: -R, q: -Q, k: -K, P, N, B, R, Q, K };
const PIECE_CHAR = { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K', '-1': 'p', '-2': 'n', '-3': 'b', '-4': 'r', '-5': 'q', '-6': 'k' };
const N_DIRS = [33, 31, 18, 14, -33, -31, -18, -14];
const B_DIRS = [17, 15, -17, -15];
const R_DIRS = [16, -16, 1, -1];
const K_DIRS = [...B_DIRS, ...R_DIRS];
// 이동 플래그
const F_DOUBLE = 1, F_EP = 2, F_CASTLE = 3, F_PROMO = 4;
const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[0x04] = 15 & ~3; CASTLE_MASK[0x00] = 15 & ~2; CASTLE_MASK[0x07] = 15 & ~1;
CASTLE_MASK[0x74] = 15 & ~12; CASTLE_MASK[0x70] = 15 & ~8; CASTLE_MASK[0x77] = 15 & ~4;

export const sqName = (s) => 'abcdefgh'[s & 7] + ((s >> 4) + 1);
export const sqIndex = (n) => (n.charCodeAt(1) - 49) * 16 + (n.charCodeAt(0) - 97);
const mv = (from, to, flag = 0, promo = 0) => from | (to << 7) | (flag << 14) | (promo << 17);
export const mFrom = (m) => m & 127;
export const mTo = (m) => (m >> 7) & 127;
const mFlag = (m) => (m >> 14) & 7;
const mPromo = (m) => (m >> 17) & 7;
export const moveToUci = (m) => sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? 'nbrq'[mPromo(m) - 2] : '');

export class Position {
  constructor(fen) {
    this.b = new Int8Array(128);
    this.stack = [];
    this.load(fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  }

  load(fen) {
    const [board, side, castle, ep, half] = fen.trim().split(/\s+/);
    this.b.fill(0);
    this.kings = [-1, -1]; // [백, 흑]
    let r = 7, f = 0;
    for (const ch of board) {
      if (ch === '/') { r--; f = 0; } else if (/\d/.test(ch)) f += Number(ch);
      else {
        const p = FEN_PIECE[ch]; const s = r * 16 + f;
        this.b[s] = p; if (p === K) this.kings[0] = s; if (p === -K) this.kings[1] = s; f++;
      }
    }
    this.side = side === 'b' ? -1 : 1;
    this.castle = (castle || '-').split('').reduce((a, c) => a | ({ K: 1, Q: 2, k: 4, q: 8 }[c] || 0), 0);
    this.ep = ep && ep !== '-' ? sqIndex(ep) : -1;
    this.half = Number(half) || 0;
    this.stack = [];
    return this;
  }

  fen() {
    let out = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.b[r * 16 + f];
        if (!p) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        out += PIECE_CHAR[p];
      }
      if (empty) out += empty;
      if (r) out += '/';
    }
    const c = (this.castle & 1 ? 'K' : '') + (this.castle & 2 ? 'Q' : '') + (this.castle & 4 ? 'k' : '') + (this.castle & 8 ? 'q' : '');
    return `${out} ${this.side > 0 ? 'w' : 'b'} ${c || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.half} 1`;
  }

  // by 쪽(1 백, -1 흑)이 s 칸을 공격하는지
  attacked(s, by) {
    const b = this.b;
    // 폰: 백 폰은 아래쪽(s-15, s-17)에서 공격
    const pd = by > 0 ? [-15, -17] : [15, 17];
    for (const d of pd) { const t = s + d; if (!(t & 0x88) && b[t] === by * P) return true; }
    for (const d of N_DIRS) { const t = s + d; if (!(t & 0x88) && b[t] === by * N) return true; }
    for (const d of K_DIRS) { const t = s + d; if (!(t & 0x88) && b[t] === by * K) return true; }
    for (const d of B_DIRS) {
      for (let t = s + d; !(t & 0x88); t += d) { const p = b[t]; if (p) { if (p === by * B || p === by * Q) return true; break; } }
    }
    for (const d of R_DIRS) {
      for (let t = s + d; !(t & 0x88); t += d) { const p = b[t]; if (p) { if (p === by * R || p === by * Q) return true; break; } }
    }
    return false;
  }

  inCheck(side = this.side) { return this.attacked(this.kings[side > 0 ? 0 : 1], -side); }

  // 의사 합법 수 (자기 킹이 체크로 남는 수 포함). capturesOnly: 잡는 수와 승급만
  pseudo(capturesOnly = false) {
    const b = this.b, us = this.side, out = [];
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s];
      if (!p || (p > 0) !== (us > 0)) continue;
      const t = p * us;
      if (t === P) {
        const fwd = 16 * us, startRank = us > 0 ? 1 : 6, lastRank = us > 0 ? 7 : 0;
        const one = s + fwd;
        const promo = (one >> 4) === lastRank;
        if (!(one & 0x88) && !b[one]) {
          if (promo) for (const pr of [Q, N, R, B]) out.push(mv(s, one, F_PROMO, pr));
          else if (!capturesOnly) {
            out.push(mv(s, one));
            const two = one + fwd;
            if ((s >> 4) === startRank && !b[two]) out.push(mv(s, two, F_DOUBLE));
          }
        }
        for (const d of [fwd - 1, fwd + 1]) {
          const c = s + d;
          if (c & 0x88) continue;
          if (b[c] && (b[c] > 0) !== (us > 0)) {
            if (promo) for (const pr of [Q, N, R, B]) out.push(mv(s, c, F_PROMO, pr));
            else out.push(mv(s, c));
          } else if (c === this.ep) out.push(mv(s, c, F_EP));
        }
      } else if (t === N || t === K) {
        for (const d of t === N ? N_DIRS : K_DIRS) {
          const c = s + d;
          if (c & 0x88) continue;
          const q = b[c];
          if (!q ? !capturesOnly : (q > 0) !== (us > 0)) out.push(mv(s, c));
        }
        if (t === K && !capturesOnly) this._castles(s, out);
      } else {
        const dirs = t === B ? B_DIRS : t === R ? R_DIRS : K_DIRS;
        for (const d of dirs) {
          for (let c = s + d; !(c & 0x88); c += d) {
            const q = b[c];
            if (!q) { if (!capturesOnly) out.push(mv(s, c)); continue; }
            if ((q > 0) !== (us > 0)) out.push(mv(s, c));
            break;
          }
        }
      }
    }
    return out;
  }

  _castles(s, out) {
    const us = this.side, b = this.b;
    const home = us > 0 ? 0x04 : 0x74;
    if (s !== home || this.attacked(home, -us)) return;
    const [kbit, qbit] = us > 0 ? [1, 2] : [4, 8];
    if (this.castle & kbit && !b[home + 1] && !b[home + 2] && b[home + 3] === us * R
      && !this.attacked(home + 1, -us) && !this.attacked(home + 2, -us)) out.push(mv(home, home + 2, F_CASTLE));
    if (this.castle & qbit && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === us * R
      && !this.attacked(home - 1, -us) && !this.attacked(home - 2, -us)) out.push(mv(home, home - 2, F_CASTLE));
  }

  make(m) {
    const b = this.b, from = mFrom(m), to = mTo(m), flag = mFlag(m), us = this.side;
    const p = b[from];
    let cap = b[to], capSq = to;
    if (flag === F_EP) { capSq = to - 16 * us; cap = b[capSq]; b[capSq] = 0; }
    this.stack.push({ m, cap, capSq, castle: this.castle, ep: this.ep, half: this.half });
    b[to] = flag === F_PROMO ? mPromo(m) * us : p;
    b[from] = 0;
    if (flag === F_CASTLE) {
      if (to > from) { b[from + 1] = b[from + 3]; b[from + 3] = 0; } else { b[from - 1] = b[from - 4]; b[from - 4] = 0; }
    }
    if (p === K) this.kings[0] = to; else if (p === -K) this.kings[1] = to;
    this.castle &= CASTLE_MASK[from] & CASTLE_MASK[to];
    this.ep = flag === F_DOUBLE ? from + 16 * us : -1;
    this.half = cap || p * us === P ? 0 : this.half + 1;
    this.side = -us;
  }

  unmake() {
    const u = this.stack.pop();
    const b = this.b, m = u.m, from = mFrom(m), to = mTo(m), flag = mFlag(m);
    this.side = -this.side;
    const us = this.side;
    const p = flag === F_PROMO ? P * us : b[to];
    b[from] = p; b[to] = 0;
    if (u.cap) b[u.capSq] = u.cap;
    if (flag === F_CASTLE) {
      if (to > from) { b[from + 3] = b[from + 1]; b[from + 1] = 0; } else { b[from - 4] = b[from - 1]; b[from - 1] = 0; }
    }
    if (p === K) this.kings[0] = from; else if (p === -K) this.kings[1] = from;
    this.castle = u.castle; this.ep = u.ep; this.half = u.half;
  }

  // 합법 수만
  legal(capturesOnly = false) {
    const out = [];
    for (const m of this.pseudo(capturesOnly)) {
      this.make(m);
      if (!this.inCheck(-this.side)) out.push(m);
      this.unmake();
    }
    return out;
  }

  perft(d) {
    if (!d) return 1;
    let n = 0;
    for (const m of this.legal()) { this.make(m); n += this.perft(d - 1); this.unmake(); }
    return n;
  }

  findUci(uci) { return this.legal().find((m) => moveToUci(m) === uci) || 0; }

  // 기물 개수 요약 (킹 제외): { w: {1:n,...}, b: {...} }
  material() {
    const w = [0, 0, 0, 0, 0, 0, 0], k = [0, 0, 0, 0, 0, 0, 0];
    for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = this.b[s]; if (p > 0) w[p]++; else if (p < 0) k[-p]++; }
    return { w, b: k };
  }
}

// ───────── 평가 ─────────
const VAL = [0, 100, 320, 330, 500, 900, 0];
// 백 기준 칸 점수표 (a8..h8 이 첫 줄). 흑은 위아래를 뒤집어 사용
const PST_RAW = {
  1: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  3: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  4: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  5: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  6: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  7: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
};
// PST[piece][0x88 칸] (백 기준), 흑은 rank 뒤집기
const PST = {};
for (const k of Object.keys(PST_RAW)) {
  const w = new Int16Array(128), bl = new Int16Array(128);
  for (let i = 0; i < 64; i++) {
    const r = 7 - (i >> 3), f = i & 7;
    w[r * 16 + f] = PST_RAW[k][i];
    bl[(7 - r) * 16 + f] = PST_RAW[k][i];
  }
  PST[k] = [w, bl];
}
const edgeDist = (s) => { const r = s >> 4, f = s & 7; return Math.min(r, 7 - r) + Math.min(f, 7 - f); };
const kingDist = (a, c) => Math.max(Math.abs((a >> 4) - (c >> 4)), Math.abs((a & 7) - (c & 7)));
const centerDist = (s) => { const r = s >> 4, f = s & 7; return Math.max(3 - r, r - 4, 0) + Math.max(3 - f, f - 4, 0); };

// 현재 둘 차례 쪽 기준 점수 (센티폰)
export function evaluate(pos) {
  const b = pos.b;
  let score = 0, nonPawn = 0;
  let wMat = 0, bMat = 0, wCount = 0, bCount = 0;
  for (let s = 0; s < 128; s++) {
    if (s & 0x88) { s += 7; continue; }
    const p = b[s];
    if (!p || p === K || p === -K) continue;
    const t = p > 0 ? p : -p;
    if (t !== P) nonPawn += VAL[t];
    if (p > 0) { wMat += VAL[t]; wCount++; score += VAL[t] + PST[t][0][s]; } else { bMat += VAL[t]; bCount++; score -= VAL[t] + PST[t][1][s]; }
  }
  const endgame = nonPawn <= 1300;
  const [wk, bk] = pos.kings;
  score += endgame ? PST[7][0][wk] - PST[7][1][bk] : PST[6][0][wk] - PST[6][1][bk];
  // 몰아붙이기: 한쪽이 킹만 남았으면 그 킹을 가장자리로, 두 킹은 가깝게
  if (!bCount && wMat >= 500) score += 20 * (6 - centerDist(bk)) * 2 + 10 * (7 - kingDist(wk, bk)) - 10 * edgeDist(bk) + 400;
  if (!wCount && bMat >= 500) score -= 20 * (6 - centerDist(wk)) * 2 + 10 * (7 - kingDist(wk, bk)) - 10 * edgeDist(wk) + 400;
  return score * pos.side;
}

// ───────── 탐색 ─────────
const MATE = 100000;
const isMateScore = (v) => Math.abs(v) > MATE - 1000;

function orderMoves(pos, moves, best, killers) {
  const b = pos.b;
  const key = (m) => {
    if (m === best) return 1e7;
    const cap = b[mTo(m)];
    let k = 0;
    if (cap) k = 1e5 + VAL[Math.abs(cap)] * 10 - VAL[Math.abs(b[mFrom(m)])] / 10;
    else if (mFlag(m) === F_EP) k = 1e5 + 1000;
    if (mFlag(m) === F_PROMO) k += 9e4 + mPromo(m);
    if (killers && (m === killers[0] || m === killers[1])) k += 5e4;
    return k;
  };
  return moves.map((m) => [key(m), m]).sort((a, c) => c[0] - a[0]).map((x) => x[1]);
}

export function search(fen, { depth = 4, timeMs = 1000, noise = 0, history = [] } = {}) {
  const pos = new Position(fen);
  const start = Date.now();
  let nodes = 0, stop = false;
  const killers = [];
  const seen = new Set(history.map((f) => f.split(' ').slice(0, 4).join(' ')));
  const keyOf = () => pos.fen().split(' ').slice(0, 4).join(' ');

  function qsearch(alpha, beta, ply) {
    nodes++;
    const stand = evaluate(pos);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 12) return stand;
    for (const m of orderMoves(pos, pos.pseudo(true), 0)) {
      pos.make(m);
      if (pos.inCheck(-pos.side)) { pos.unmake(); continue; }
      const v = -qsearch(-beta, -alpha, ply + 1);
      pos.unmake();
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function negamax(d, alpha, beta, ply) {
    if ((++nodes & 1023) === 0 && Date.now() - start > timeMs) stop = true;
    if (stop) return 0;
    if (ply && pos.half >= 100) return 0;
    if (ply && ply <= 4 && seen.has(keyOf())) return 0; // 반복은 무승부 취급 (얕은 곳만 검사)
    const check = pos.inCheck();
    if (check) d++;
    if (d <= 0) return qsearch(alpha, beta, ply);
    const moves = orderMoves(pos, pos.legal(), 0, killers[ply]);
    if (!moves.length) return check ? -MATE + ply : 0;
    let best = -Infinity;
    for (const m of moves) {
      pos.make(m);
      const v = -negamax(d - 1, -beta, -alpha, ply + 1);
      pos.unmake();
      if (stop) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (!pos.b[mTo(m)]) { const k = (killers[ply] ||= [0, 0]); if (k[0] !== m) { k[1] = k[0]; k[0] = m; } }
        break;
      }
    }
    return best;
  }

  const rootMoves = pos.legal();
  if (!rootMoves.length) return { move: null, score: 0, depth: 0, nodes };
  let bestMove = rootMoves[0], bestScore = -Infinity, reached = 0;
  let scored = rootMoves.map((m) => [m, 0]);
  for (let d = 1; d <= depth; d++) {
    const results = [];
    let alpha = -Infinity;
    const ordered = orderMoves(pos, rootMoves, bestMove);
    for (const m of ordered) {
      pos.make(m);
      // 실력 조절(noise)이 있을 때는 모든 수의 실제 점수가 필요하므로 창을 넓게
      const v = noise ? -negamax(d - 1, -Infinity, Infinity, 1) : -negamax(d - 1, -Infinity, -alpha, 1);
      pos.unmake();
      if (stop) break;
      results.push([m, v]);
      if (v > alpha) alpha = v;
    }
    if (stop && d > 1) break;
    if (results.length) {
      results.sort((a, c) => c[1] - a[1]);
      scored = results; bestMove = results[0][0]; bestScore = results[0][1]; reached = d;
    }
    if (stop || isMateScore(bestScore)) break;
  }
  // 쉬운 단계: 점수에 무작위 흔들림을 더해 가끔 실수
  if (noise && scored.length > 1) {
    const pick = scored.map(([m, v]) => [m, isMateScore(v) ? v : v + (Math.random() * 2 - 1) * noise]).sort((a, c) => c[1] - a[1]);
    bestMove = pick[0][0];
  }
  return { move: moveToUci(bestMove), score: bestScore, depth: reached, nodes };
}

// ───────── 메이트 퍼즐 ─────────
// 둘 차례인 쪽이 n수 안에 메이트시킬 수 있는지
export function mateIn(pos, n) {
  for (const m of pos.legal()) {
    pos.make(m);
    // 마지막 수는 체크여야 메이트가 될 수 있음
    if (n <= 1 && !pos.inCheck()) { pos.unmake(); continue; }
    const ok = forcedMate(pos, n);
    pos.unmake();
    if (ok) return true;
  }
  return false;
}
// 방금 공격 쪽이 수를 두었고, 이제 방어 쪽 차례. 방어 쪽의 모든 응수에 대해 (n-1)수 메이트가 있으면 true
function forcedMate(pos, n) {
  const replies = pos.legal();
  if (!replies.length) return pos.inCheck();
  if (n <= 1) return false;
  for (const r of replies) {
    pos.make(r);
    const ok = mateIn(pos, n - 1);
    pos.unmake();
    if (!ok) return false;
  }
  return true;
}
// n수 메이트를 만드는 첫 수 목록 (uci)
export function mateMoves(fen, n) {
  const pos = new Position(fen);
  const out = [];
  for (const m of pos.legal()) {
    pos.make(m);
    if (forcedMate(pos, n)) out.push(moveToUci(m));
    pos.unmake();
  }
  return out;
}
// 공격 쪽이 방금 둔 위치(방어 쪽 차례)에서, 남은 n수 안에 메이트가 보장되는지
export function isForcedMate(fen, n) { return forcedMate(new Position(fen), n); }
// 정답 수순 (공격 수, 방어 응수, … 메이트까지) uci 목록
export function mateLine(fen, n) {
  const pos = new Position(fen);
  const line = [];
  for (let k = n; k >= 1; k--) {
    const ms = mateMoves(pos.fen(), k);
    if (!ms.length) break;
    const m = pos.findUci(ms[0]); pos.make(m); line.push(ms[0]);
    if (!pos.legal().length) break;
    const r = bestDefense(pos.fen(), k - 1);
    if (!r) break;
    pos.make(pos.findUci(r)); line.push(r);
  }
  return line;
}
// 가장 빠른 메이트 수 (max 까지 검사, 없으면 0)
export function mateDistance(fen, max) {
  const pos = new Position(fen);
  for (let n = 1; n <= max; n++) if (mateIn(pos, n)) return n;
  return 0;
}
// 방어 쪽 최선 응수: 메이트를 가장 늦추는 수 (모두 같으면 무작위)
export function bestDefense(fen, maxMate) {
  const pos = new Position(fen);
  const replies = pos.legal();
  if (!replies.length) return null;
  let best = [], bestD = -1;
  for (const r of replies) {
    pos.make(r);
    let d = 0;
    for (let n = 1; n <= maxMate; n++) if (mateIn(pos, n)) { d = n; break; }
    if (!d) d = 99; // 메이트를 피할 수 있으면 가장 좋음
    pos.unmake();
    if (d > bestD) { bestD = d; best = [r]; } else if (d === bestD) best.push(r);
  }
  return moveToUci(best[Math.floor(Math.random() * best.length)]);
}

// ───────── 엔드게임 도전 (킹+기물 vs 킹) ─────────
// pieces: 공격 쪽 기물 목록 (예: [Q], [R], [B, B]). 백이 공격, 흑은 킹만.
export function randomEndgame(pieces, rnd = Math.random) {
  for (let tries = 0; tries < 5000; tries++) {
    const pos = new Position('8/8/8/8/8/8/8/8 w - - 0 1');
    const used = new Set();
    const pick = () => { for (;;) { const s = Math.floor(rnd() * 8) * 16 + Math.floor(rnd() * 8); if (!used.has(s)) { used.add(s); return s; } } };
    const wk = pick(), bk = pick();
    if (kingDist(wk, bk) < 2) continue;
    pos.b[wk] = K; pos.b[bk] = -K; pos.kings = [wk, bk];
    let ok = true;
    const bishops = [];
    for (const p of pieces) {
      const s = pick();
      pos.b[s] = p;
      if (p === B) bishops.push(((s >> 4) + (s & 7)) & 1);
    }
    if (bishops.length === 2 && bishops[0] === bishops[1]) ok = false; // 같은 색 비숍 둘은 메이트 불가
    if (!ok) continue;
    // 백 차례인데 흑 킹이 이미 체크면 불가능한 위치
    if (pos.inCheck(-1)) continue;
    pos.side = 1;
    const fen = pos.fen();
    // 백 차례에 흑 킹이 공격받는 기물을 지키지 못한 채 두지 않도록: 흑 킹 인접 칸에 무방비 기물 금지
    let hanging = false;
    for (const d of K_DIRS) {
      const t = bk + d;
      if (t & 0x88) continue;
      if (pos.b[t] > 0 && pos.b[t] !== K && !pos.attacked(t, 1)) hanging = true;
    }
    if (hanging) continue;
    // 첫 수에 바로 메이트되는 위치 제외
    if (mateIn(new Position(fen), 1)) continue;
    // 흑 킹이 체크 없이 움직일 곳이 하나도 없는 위치 제외 (스테일메이트 함정 방지)
    const tmp = new Position(fen); tmp.side = -1;
    if (!tmp.legal().length) continue;
    return fen;
  }
  return '8/8/8/3k4/8/8/8/4K2Q w - - 0 1';
}

// 엔드게임 방어: 킹만 남은 쪽이 가장 오래 버티는 수 (탐색 점수 기준)
export function defend(fen, timeMs = 400) {
  return search(fen, { depth: 5, timeMs }).move;
}
