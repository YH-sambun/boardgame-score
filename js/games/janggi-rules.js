// 장기 규칙 (9×10 판). 화면 없이 계산만 함 → janggi.js(화면), 컴퓨터 상대가 같이 씀
//  칸 번호 i = y*9 + x (x 0~8 왼→오, y 0~9 위→아래). 한(漢)이 위(y 0~3), 초(楚)가 아래(y 6~9)에 놓이고 초가 먼저 둠
//  기물: 'c'|'h' + K(궁) A(사) R(차) C(포) H(마) E(상) P(졸·병)
//  빅장(궁끼리 마주 봄)과 한 수 쉬기는 넣지 않음. 둘 수 있는 수가 없으면 장군일 때 외통(패), 아닐 때 무승부
export const W = 9;
export const H = 10;
export const idx = (x, y) => y * W + x;
export const xy = (i) => [i % W, Math.floor(i / W)];
const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
export const other = (s) => (s === 'c' ? 'h' : 'c');

// 상차림: 자기 쪽에서 봤을 때 왼쪽부터 (마=H, 상=E)
export const SETUPS = [
  { id: 'HEHE', label: '마상마상' },
  { id: 'EHEH', label: '상마상마' },
  { id: 'HEEH', label: '마상상마' },
  { id: 'EHHE', label: '상마마상' },
];
export const VALUE = { K: 0, A: 3, R: 13, C: 7, H: 5, E: 3, P: 2 };
export const HAN_BONUS = 1.5; // 후수(한) 덤

export function initialBoard(choSetup = 'HEHE', hanSetup = 'HEHE') {
  const b = Array(W * H).fill(null);
  const back = (s, y, setup) => {
    // 초는 아래에서 위를 보므로 왼쪽 = x 작은 쪽, 한은 위에서 아래를 보므로 왼쪽 = x 큰 쪽
    const xs = s === 'c' ? [1, 2, 6, 7] : [7, 6, 2, 1];
    b[idx(0, y)] = s + 'R'; b[idx(8, y)] = s + 'R';
    b[idx(3, y)] = s + 'A'; b[idx(5, y)] = s + 'A';
    xs.forEach((x, k) => { b[idx(x, y)] = s + setup[k]; });
  };
  back('h', 0, hanSetup);
  b[idx(4, 1)] = 'hK';
  b[idx(1, 2)] = 'hC'; b[idx(7, 2)] = 'hC';
  [0, 2, 4, 6, 8].forEach((x) => { b[idx(x, 3)] = 'hP'; });
  back('c', 9, choSetup);
  b[idx(4, 8)] = 'cK';
  b[idx(1, 7)] = 'cC'; b[idx(7, 7)] = 'cC';
  [0, 2, 4, 6, 8].forEach((x) => { b[idx(x, 6)] = 'cP'; });
  return b;
}

// 궁성: x 3~5, y 0~2(한) / 7~9(초)
const inPalace = (x, y) => x >= 3 && x <= 5 && ((y >= 0 && y <= 2) || (y >= 7 && y <= 9));
const palaceCenter = (x, y) => x === 4 && (y === 1 || y === 8);
// 궁성 대각선 한 칸 (가운데와 모서리를 잇는 선 위에서만)
function diagStep(x, y, dx, dy) {
  const nx = x + dx; const ny = y + dy;
  if (!inPalace(x, y) || !inPalace(nx, ny)) return false;
  if (Math.abs(ny - y) !== 1 || Math.abs(nx - x) !== 1) return false;
  // 같은 궁성 안이어야 함
  if ((y <= 2) !== (ny <= 2)) return false;
  return palaceCenter(x, y) || palaceCenter(nx, ny);
}
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

// 자기 편 수 고려 없이 갈 수 있는 칸 (장군 여부는 따지지 않음)
export function pseudoMoves(b, i) {
  const p = b[i];
  if (!p) return [];
  const s = p[0]; const t = p[1];
  const [x, y] = xy(i);
  const out = [];
  const own = (j) => b[j] && b[j][0] === s;
  const add = (nx, ny) => { const j = idx(nx, ny); if (!own(j)) out.push(j); };

  if (t === 'K' || t === 'A') {
    for (const [dx, dy] of ORTH) { const nx = x + dx; const ny = y + dy; if (inPalace(nx, ny) && (ny <= 2) === (y <= 2)) add(nx, ny); }
    for (const [dx, dy] of DIAG) if (diagStep(x, y, dx, dy)) add(x + dx, y + dy);
  } else if (t === 'R') {
    for (const [dx, dy] of ORTH) {
      for (let k = 1; ; k++) {
        const nx = x + dx * k; const ny = y + dy * k;
        if (!inside(nx, ny)) break;
        const j = idx(nx, ny);
        if (b[j]) { if (b[j][0] !== s) out.push(j); break; }
        out.push(j);
      }
    }
    for (const [dx, dy] of DIAG) {
      let cx = x; let cy = y;
      while (diagStep(cx, cy, dx, dy)) {
        cx += dx; cy += dy;
        const j = idx(cx, cy);
        if (b[j]) { if (b[j][0] !== s) out.push(j); break; }
        out.push(j);
      }
    }
  } else if (t === 'C') {
    // 포: 기물 하나(포 제외)를 넘어서 감. 포는 잡을 수 없음
    for (const [dx, dy] of ORTH) {
      let k = 1; let screen = false;
      for (; ; k++) {
        const nx = x + dx * k; const ny = y + dy * k;
        if (!inside(nx, ny)) break;
        const q = b[idx(nx, ny)];
        if (!screen) { if (q) { if (q[1] === 'C') break; screen = true; } continue; }
        if (!q) { out.push(idx(nx, ny)); continue; }
        if (q[0] !== s && q[1] !== 'C') out.push(idx(nx, ny));
        break;
      }
    }
    for (const [dx, dy] of DIAG) {
      if (!diagStep(x, y, dx, dy) || !diagStep(x + dx, y + dy, dx, dy)) continue;
      const mid = b[idx(x + dx, y + dy)];
      if (!mid || mid[1] === 'C') continue;
      const j = idx(x + 2 * dx, y + 2 * dy);
      const q = b[j];
      if (!q || (q[0] !== s && q[1] !== 'C')) out.push(j);
    }
  } else if (t === 'H' || t === 'E') {
    for (const [dx, dy] of ORTH) {
      const ax = x + dx; const ay = y + dy;
      if (!inside(ax, ay) || b[idx(ax, ay)]) continue;
      for (const side of [-1, 1]) {
        // 바깥쪽 대각선 방향
        const ddx = dx || side; const ddy = dy || side;
        const bx = ax + ddx; const by = ay + ddy;
        if (!inside(bx, by)) continue;
        if (t === 'H') { add(bx, by); continue; }
        if (b[idx(bx, by)]) continue;
        const cx = bx + ddx; const cy = by + ddy;
        if (inside(cx, cy)) add(cx, cy);
      }
    }
  } else if (t === 'P') {
    const fy = s === 'c' ? -1 : 1;
    for (const [dx, dy] of [[0, fy], [1, 0], [-1, 0]]) { const nx = x + dx; const ny = y + dy; if (inside(nx, ny)) add(nx, ny); }
    for (const dx of [-1, 1]) if (diagStep(x, y, dx, fy)) add(x + dx, y + fy);
  }
  return out;
}

export const kingAt = (b, s) => b.indexOf(s + 'K');

export function attacked(b, sq, by) {
  for (let i = 0; i < b.length; i++) if (b[i] && b[i][0] === by && pseudoMoves(b, i).includes(sq)) return true;
  return false;
}
export function inCheck(b, s) { const k = kingAt(b, s); return k >= 0 && attacked(b, k, other(s)); }

export function applyMove(b, from, to) {
  const nb = b.slice();
  nb[to] = nb[from]; nb[from] = null;
  return nb;
}

// 둘 수 있는 수 (내 궁이 장군 상태로 남는 수는 뺌)
export function legalMovesFrom(b, i) {
  const p = b[i];
  if (!p) return [];
  return pseudoMoves(b, i).filter((j) => !inCheck(applyMove(b, i, j), p[0]));
}
export function allLegal(b, s) {
  const out = [];
  for (let i = 0; i < b.length; i++) if (b[i] && b[i][0] === s) for (const j of legalMovesFrom(b, i)) out.push([i, j]);
  return out;
}

// 수 목록(from*100+to)으로 판 다시 만들기. 차례: 짝수 번째 수는 초
export function replay(moves, choSetup, hanSetup) {
  let b = initialBoard(choSetup, hanSetup);
  for (const m of moves) b = applyMove(b, Math.floor(m / 100), m % 100);
  return b;
}
export const turnOf = (moves) => (moves.length % 2 ? 'h' : 'c');

// 남은 기물 점수 (한은 덤 1.5점)
export function material(b, s) {
  let v = s === 'h' ? HAN_BONUS : 0;
  for (const p of b) if (p && p[0] === s) v += VALUE[p[1]];
  return v;
}

// 끝났는지: { winner:'c'|'h'|null, reason } 또는 null
export function gameOver(b, s) {
  if (kingAt(b, s) < 0) return { winner: other(s), reason: '궁을 잡음' };
  if (allLegal(b, s).length) return null;
  return inCheck(b, s) ? { winner: other(s), reason: '외통' } : { winner: null, reason: '둘 수 있는 수 없음' };
}
