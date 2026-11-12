// 차빼! 문제 만들기 (한 번만 돌려서 js/games/carpark-puzzles.js 를 만듦)
//   node tools/gen-carpark.mjs [초] [합칠 json 파일들…]
//   (여러 개를 동시에 돌린 결과를 합치려면: node tools/gen-carpark.mjs 0 a.json b.json …)
// 무작위 주차장을 만든 뒤, 그 배치에서 갈 수 있는 모든 상태를 훑어 "다 빼낸 상태"에서 가장 먼 상태들을 문제로 고름.
// 최소 이동 수로 난이도 단계를 나눔.
import { writeFileSync } from 'node:fs';
import { neighbors, solved, N, EXIT_ROW } from '../js/games/carpark-solver.js';

export const BANDS = [[3, 5], [6, 9], [10, 14], [15, 20], [21, 28], [29, 99]];
const PER = 60;
const seconds = Number(process.argv[2] || 240);
const LETTERS = 'BCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomLot() {
  const a = Array(36).fill('o');
  const ax = Math.floor(Math.random() * 3); // 빨간 차는 왼쪽 쪽에서 시작
  a[EXIT_ROW * N + ax] = 'A'; a[EXIT_ROW * N + ax + 1] = 'A';
  const count = 10 + Math.floor(Math.random() * 6);
  let k = 0;
  for (let tries = 0; tries < 400 && k < count; tries++) {
    const len = Math.random() < 0.72 ? 2 : 3;
    const horiz = Math.random() < 0.5;
    const x = Math.floor(Math.random() * (horiz ? N - len + 1 : N));
    const y = Math.floor(Math.random() * (horiz ? N : N - len + 1));
    if (horiz && y === EXIT_ROW) continue; // 출구 줄의 가로 차는 영영 못 비킴
    const cells = Array.from({ length: len }, (_, t) => (horiz ? y * N + x + t : (y + t) * N + x));
    if (cells.some((c) => a[c] !== 'o')) continue;
    for (const c of cells) a[c] = LETTERS[k];
    k++;
  }
  return a.join('');
}

// 같은 배치에서 갈 수 있는 상태 전부 (차 이동은 되돌릴 수 있으므로 서로 오갈 수 있음)
function component(start, limit = 250000) {
  const seen = new Map([[start, []]]);
  let q = [start];
  while (q.length) {
    const nq = [];
    for (const s of q) {
      const ns = neighbors(s).map((x) => x[0]);
      seen.set(s, ns);
      for (const t of ns) if (!seen.has(t)) { seen.set(t, null); nq.push(t); }
      if (seen.size > limit) return null;
    }
    q = nq;
  }
  return seen;
}

// 다 빼낸 상태들에서부터 거리
function distances(comp) {
  const dist = new Map();
  let q = [...comp.keys()].filter(solved);
  for (const s of q) dist.set(s, 0);
  let d = 0;
  while (q.length) {
    d++;
    const nq = [];
    for (const s of q) for (const t of comp.get(s)) if (!dist.has(t)) { dist.set(t, d); nq.push(t); }
    q = nq;
  }
  return dist;
}

// 글자를 왼쪽 위부터 B, C, … 순서로 다시 붙임 (같은 배치가 겹치지 않게)
function normalize(s) {
  const m = new Map([['A', 'A'], ['o', 'o']]);
  let k = 0;
  return s.split('').map((c) => { if (!m.has(c)) m.set(c, LETTERS[k++]); return m.get(c); }).join('');
}

const bank = BANDS.map(() => new Map());
// 앞서 만든 결과 합치기
import { readFileSync } from 'node:fs';
for (const f of process.argv.slice(3)) JSON.parse(readFileSync(f, 'utf8')).forEach((xs, bi) => xs.forEach(([k, d]) => bank[bi].set(k, d)));
const dump = process.env.DUMP;
const until = Date.now() + seconds * 1000;
let lots = 0;
while (Date.now() < until && bank.some((b) => b.size < PER)) {
  if (seconds <= 0) break;
  lots++;
  const comp = component(randomLot());
  if (!comp || ![...comp.keys()].some(solved)) continue;
  const dist = distances(comp);
  // 단계마다 이 배치에서 하나씩만 (다양하게)
  const byBand = BANDS.map(() => []);
  for (const [s, d] of dist) {
    if (s[EXIT_ROW * N + N - 1] === 'A' || s[EXIT_ROW * N + N - 2] === 'A') continue;
    const bi = BANDS.findIndex(([lo, hi]) => d >= lo && d <= hi);
    if (bi >= 0) byBand[bi].push([s, d]);
  }
  byBand.forEach((xs, bi) => {
    if (!xs.length || bank[bi].size >= PER) return;
    xs.sort((a, b) => b[1] - a[1]);
    // 그 단계 안에서 가장 어려운 것 쪽으로
    const [s, d] = xs[Math.floor(Math.random() * Math.min(5, xs.length))];
    const key = normalize(s);
    if (!bank[bi].has(key)) bank[bi].set(key, d);
  });
}
console.log('배치', lots, '개 살펴봄 →', bank.map((b) => b.size).join(' / '));
if (dump) { writeFileSync(dump, JSON.stringify(bank.map((b) => [...b]))); process.exit(0); }
// 단계마다 최대 PER*3 개, 쉬운 것부터 어려운 것까지 고르게
const spread = (xs, n) => (xs.length <= n ? xs : Array.from({ length: n }, (_, k) => xs[Math.floor((k * xs.length) / n)]));
const out = bank.map((b) => spread([...b].sort((x, y) => x[1] - y[1]), PER * 3).map(([s, d]) => `${s}${d}`));
const body = `// 차빼! 문제 (tools/gen-carpark.mjs 로 만듦). 단계별 [36자 배치 + 최소 이동 수]
// 'o' 빈칸, 'A' 빼낼 빨간 차(셋째 줄, 오른쪽 출구), 그 밖의 글자 = 다른 차
export const PUZZLES = ${JSON.stringify(out, null, 0).replace(/\],\[/g, '],\n[')};
`;
writeFileSync(new URL('../js/games/carpark-puzzles.js', import.meta.url), body);
