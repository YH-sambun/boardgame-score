// 오목 컴퓨터 상대 (브라우저 안에서 계산, 외부 서버 없음)
//  각 빈칸에 돌을 놓았을 때 생기는 모양(다섯·열린 넷·넷·열린 셋 …)으로 공격 점수와 막기 점수를 매김
//  쉬움: 막기를 자주 놓치고 상위 후보 중 무작위 / 보통: 점수가 가장 높은 칸 / 어려움: 연속 넷 필승 수읽기 + 상대 응수까지 한 수 더 봄
const N = 15;
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const CENTER = 7 * N + 7;
const OPPW = 0.6;
const MYW = 0.3;

// 모양 → 점수 (위에서부터 먼저 맞는 것 하나만)
const SHAPES = [
  [1e7, ['11111']],
  [1e6, ['011110']],
  [1e5, ['11110', '01111', '10111', '11011', '11101']],
  [1e4, ['011100', '001110', '011010', '010110']],
  [1e3, ['11100', '00111', '11010', '01011', '10110', '01101', '10011', '11001', '10101', '01110']],
  [300, ['001100', '011000', '000110', '010100', '001010', '010010']],
  [50, ['11000', '00011', '10100', '00101', '01100', '00110', '10010', '01001', '10001']],
];

// 가운데(4번) 칸을 포함하는 자리에서 모양이 나오는지
function hasAt(str, pat) {
  for (let k = Math.max(0, 5 - pat.length); k <= 4 && k + pat.length <= str.length; k++) {
    if (str.startsWith(pat, k)) return true;
  }
  return false;
}

// i 에 c 색 돌을 놓았다고 칠 때 한 방향 모양 점수
function dirScore(b, i, c, [dx, dy]) {
  const x = i % N; const y = Math.floor(i / N);
  let str = '';
  for (let s = -4; s <= 4; s++) {
    if (s === 0) { str += '1'; continue; }
    const xx = x + dx * s; const yy = y + dy * s;
    if (xx < 0 || yy < 0 || xx >= N || yy >= N) { str += '2'; continue; }
    const v = b[yy * N + xx];
    str += v === c ? '1' : v === 0 ? '0' : '2';
  }
  for (const [val, pats] of SHAPES) if (pats.some((p) => hasAt(str, p))) return val;
  return 5;
}

// i 에 c 색을 놓았을 때의 모양 점수 (여러 방향에 동시에 위협이 생기면 덤)
export function shapeScore(b, i, c) {
  let sum = 0; let strong = 0;
  for (const d of DIRS) { const v = dirScore(b, i, c, d); sum += v; if (v >= 1e4) strong++; }
  if (strong >= 2 && sum < 1e6) sum += 5e5;
  return sum;
}

// 돌 둘레 2칸 안의 빈칸 (후보)
function candidates(b) {
  const out = [];
  for (let i = 0; i < N * N; i++) {
    if (b[i]) continue;
    const x = i % N; const y = Math.floor(i / N);
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2 && !near; dx++) {
      const xx = x + dx; const yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < N && yy < N && b[yy * N + xx]) near = true;
    }
    if (near) out.push(i);
  }
  return out;
}

// 놓으면 바로 다섯이 되는 칸들
function fiveCells(b, c, cand) {
  return cand.filter((i) => !b[i] && DIRS.some((d) => dirScore(b, i, c, d) >= 1e7));
}

// 연속 넷(VCF)으로 이기는 첫 수 찾기: 내가 넷을 만들면 상대는 그 자리를 막을 수밖에 없음
function vcf(b, me, depth, budget, legal) {
  if (depth <= 0 || budget.n <= 0) return -1;
  const opp = 3 - me;
  const cand = candidates(b);
  for (const i of cand) {
    if (budget.n-- <= 0) return -1;
    if (!DIRS.some((d) => dirScore(b, i, me, d) >= 1e5) || !legal(b, i, me)) continue;
    b[i] = me;
    const wins = fiveCells(b, me, cand).filter((j) => legal(b, j, me));
    let ok = false;
    if (wins.length >= 2) ok = true;
    else if (wins.length === 1) {
      const block = wins[0];
      b[block] = opp;
      // 막은 수로 상대가 다섯이 되면 실패
      const oppFive = DIRS.some((d) => dirScore(b, block, opp, d) >= 1e7);
      if (!oppFive) ok = vcf(b, me, depth - 1, budget, legal) >= 0;
      b[block] = 0;
    }
    b[i] = 0;
    if (ok) return i;
  }
  return -1;
}

// moves: 지금까지 둔 칸 번호, level 0~2, forbidden(b, i): 렌주 흑 금수 이유 (없으면 null) — 렌주룰 끄면 null 로
export function pickMove(moves, level, forbidden = null) {
  const b = new Uint8Array(N * N);
  moves.forEach((m, k) => { b[m] = k % 2 ? 2 : 1; });
  if (!moves.length) return CENTER;
  const me = moves.length % 2 ? 2 : 1;
  const opp = 3 - me;
  const legal = (bb, i, c) => !(forbidden && c === 1 && forbidden(bb, i));
  const cand = candidates(b).filter((i) => legal(b, i, me));
  if (!cand.length) { for (let i = 0; i < N * N; i++) if (!b[i]) return i; return -1; }

  const defW = [0.5, 0.9, 0.95][level];
  const scored = cand.map((i) => {
    const atk = shapeScore(b, i, me);
    let def = shapeScore(b, i, opp);
    // 렌주: 흑이 둘 수 없는 자리는 막을 필요 없음
    if (def >= 1e3 && opp === 1 && !legal(b, i, 1)) def = 0;
    return { i, atk, def, s: atk + def * defW };
  }).sort((a, z) => z.s - a.s);

  const win = scored.find((x) => x.atk >= 1e7);
  if (win) return win.i;

  if (level === 0) {
    // 상대 다섯은 70%만 막음, 나머지는 상위 몇 칸에서 무작위
    const must = scored.find((x) => x.def >= 1e7);
    if (must && Math.random() < 0.7) return must.i;
    const top = scored.slice(0, 6);
    return Math.random() < 0.45 ? top[Math.floor(Math.random() * top.length)].i : top[0].i;
  }

  const must = scored.find((x) => x.def >= 1e7);
  if (must) return must.i;

  if (level === 2) {
    const v = vcf(b, me, 8, { n: 4000 }, legal);
    if (v >= 0) return v;
    // 상위 후보마다 상대의 가장 좋은 응수를 빼서 비교
    let best = scored[0]; let bestVal = -Infinity;
    for (const c of scored.slice(0, 10)) {
      b[c.i] = me;
      const replies = candidates(b).filter((i) => legal(b, i, opp));
      // 내가 넷을 만들었으면 상대는 막아야 하니, 상대 다섯이 아니면 상대 공격은 신경 쓰지 않음
      const forcing = fiveCells(b, me, replies).length > 0;
      let oppBest = 0; let myNext = 0;
      for (const r of replies) {
        const a = shapeScore(b, r, opp);
        if (!forcing || a >= 1e7) oppBest = Math.max(oppBest, a);
        if (legal(b, r, me)) myNext = Math.max(myNext, shapeScore(b, r, me));
      }
      // 상대가 가장 좋은 곳에 둘 때의 위험은 빼고, 다음에 내가 만들 수 있는 위협은 조금 더함
      let val = c.s - oppBest * OPPW + myNext * MYW;
      // 이 수 뒤에 상대가 연속 넷으로 이길 수 있으면 피함
      if (!forcing && vcf(b, opp, 6, { n: 800 }, legal) >= 0) val -= 5e6;
      b[c.i] = 0;
      if (val > bestVal) { bestVal = val; best = c; }
    }
    return best.i;
  }

  // 보통: 최고점에 가까운 칸 중 무작위 (매판 똑같지 않게)
  const top = scored.filter((x) => x.s >= scored[0].s * 0.95);
  return top[Math.floor(Math.random() * top.length)].i;
}
