// 장기 컴퓨터 상대: 기물 점수 + 약간의 위치 점수로 몇 수 앞을 내다보는 탐색 (알파-베타)
//  실력 0 쉬움(1수 + 흔들기) / 1 보통(2수) / 2 어려움(3수, 잡는 수 연장)
import { pseudoMoves, applyMove, legalMovesFrom, other, VALUE, xy } from './janggi-rules.js?v=202611121512';

const KING = 1000;
function evaluate(b, s) {
  let v = 0;
  for (let i = 0; i < b.length; i++) {
    const p = b[i];
    if (!p) continue;
    let w = p[1] === 'K' ? KING : VALUE[p[1]];
    // 졸·병은 앞으로 갈수록 조금 더, 마·포는 가운데 쪽이 조금 더
    const [x, y] = xy(i);
    if (p[1] === 'P') w += 0.15 * (p[0] === 'c' ? 6 - y : y - 3);
    if (p[1] === 'H' || p[1] === 'C') w += 0.1 * (4 - Math.abs(4 - x));
    v += p[0] === s ? w : -w;
  }
  return v;
}

function movesOf(b, s) {
  const caps = []; const quiet = [];
  for (let i = 0; i < b.length; i++) {
    if (!b[i] || b[i][0] !== s) continue;
    for (const j of pseudoMoves(b, i)) {
      if (b[j]) caps.push([i, j, (b[j][1] === 'K' ? KING : VALUE[b[j][1]]) * 10 - VALUE[b[i][1]]]);
      else quiet.push([i, j, 0]);
    }
  }
  caps.sort((a, c) => c[2] - a[2]);
  return caps.concat(quiet);
}

function search(b, s, depth, alpha, beta, ext) {
  if (depth <= 0 && ext <= 0) return evaluate(b, s);
  const ms = movesOf(b, s);
  if (depth <= 0) {
    // 잡는 수만 조금 더 봄 (주고받기 계산)
    let best = evaluate(b, s);
    if (best >= beta) return best;
    alpha = Math.max(alpha, best);
    for (const [i, j] of ms) {
      if (!b[j]) break;
      if (b[j][1] === 'K') return KING;
      const v = -search(applyMove(b, i, j), other(s), 0, -beta, -alpha, ext - 1);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = -Infinity;
  for (const [i, j] of ms) {
    if (b[j] && b[j][1] === 'K') return KING + depth;
    const v = -search(applyMove(b, i, j), other(s), depth - 1, -beta, -alpha, ext);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best === -Infinity ? 0 : best;
}

// 컴퓨터 수 고르기: [from, to] 또는 null
export function pickMove(b, s, level = 1) {
  const legal = [];
  for (let i = 0; i < b.length; i++) if (b[i] && b[i][0] === s) for (const j of legalMovesFrom(b, i)) legal.push([i, j]);
  if (!legal.length) return null;
  const depth = [1, 2, 3][level] ?? 2;
  const ext = [0, 2, 4][level] ?? 2;
  const noise = [2.5, 0.4, 0.05][level] ?? 0.4;
  // 잡는 수부터 보면 가지치기가 잘 됨
  legal.sort((m1, m2) => (b[m2[1]] ? VALUE[b[m2[1]][1]] : 0) - (b[m1[1]] ? VALUE[b[m1[1]][1]] : 0));
  let best = null; let bestV = -Infinity;
  for (const [i, j] of legal) {
    const v = -search(applyMove(b, i, j), other(s), depth - 1, -Infinity, Infinity, ext) + Math.random() * noise;
    if (v > bestV) { bestV = v; best = [i, j]; }
  }
  return best;
}
