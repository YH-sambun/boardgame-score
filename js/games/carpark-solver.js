// 차빼! 계산: 6×6 주차장 상태 = 36자 문자열 ('o' 빈칸, 'A' 빼낼 빨간 차, 그 밖의 글자 = 다른 차)
//  빨간 차(A)는 세 번째 줄(위에서 3번째)에 가로로 놓이고 오른쪽 출구로 빼내면 끝
//  차 한 대를 한 방향으로 몇 칸이든 미는 것을 1번 이동으로 셈
export const N = 6;
export const EXIT_ROW = 2;

// 차 목록: { id, cells:[칸], horiz }
export function vehicles(s) {
  const map = new Map();
  for (let i = 0; i < 36; i++) {
    const c = s[i];
    if (c === 'o' || c === '.') continue;
    if (!map.has(c)) map.set(c, []);
    map.get(c).push(i);
  }
  return [...map].map(([id, cells]) => ({ id, cells, horiz: Math.floor(cells[0] / N) === Math.floor(cells[cells.length - 1] / N) }));
}

export const solved = (s) => s[EXIT_ROW * N + N - 1] === 'A';

// 차 하나를 delta 칸 밀 수 있는 범위 [최소(음수), 최대(양수)]
export function range(s, v) {
  const step = v.horiz ? 1 : N;
  const first = v.cells[0]; const last = v.cells[v.cells.length - 1];
  let lo = 0; let hi = 0;
  for (let k = 1; ; k++) {
    const j = first - k * step;
    if (v.horiz ? Math.floor(j / N) !== Math.floor(first / N) || j < 0 : j < 0) break;
    if (s[j] !== 'o') break;
    lo = -k;
  }
  for (let k = 1; ; k++) {
    const j = last + k * step;
    if (v.horiz ? Math.floor(j / N) !== Math.floor(last / N) : j >= 36) break;
    if (s[j] !== 'o') break;
    hi = k;
  }
  return [lo, hi];
}

export function slide(s, v, delta) {
  const step = v.horiz ? 1 : N;
  const a = s.split('');
  for (const i of v.cells) a[i] = 'o';
  for (const i of v.cells) a[i + delta * step] = v.id;
  return a.join('');
}

// 한 번 이동으로 갈 수 있는 상태들: [[상태, 차 id, delta]]
export function neighbors(s) {
  const out = [];
  for (const v of vehicles(s)) {
    const [lo, hi] = range(s, v);
    for (let d = lo; d <= hi; d++) if (d) out.push([slide(s, v, d), v.id, d]);
  }
  return out;
}

// 가장 짧은 풀이: [[차 id, delta], …] (못 풀면 null). limit: 살펴볼 상태 수 한도
export function solve(start, limit = 300000) {
  if (solved(start)) return [];
  const prev = new Map([[start, null]]);
  let q = [start];
  while (q.length) {
    const nq = [];
    for (const s of q) {
      for (const [t, id, d] of neighbors(s)) {
        if (prev.has(t)) continue;
        prev.set(t, [s, id, d]);
        if (solved(t)) {
          const path = [];
          for (let x = t; prev.get(x); x = prev.get(x)[0]) path.unshift([prev.get(x)[1], prev.get(x)[2]]);
          return path;
        }
        if (prev.size > limit) return null;
        nq.push(t);
      }
    }
    q = nq;
  }
  return null;
}
