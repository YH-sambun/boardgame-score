// 체스 퀴즈 문제 생성기 (개발용, 앱에는 결과물인 js/games/chess-puzzles.js 만 들어감)
// 엔진끼리 일부러 실수를 섞어 대국을 두게 하고, 그 중에 "정확히 n수 메이트 + 첫 수 정답이 하나뿐"인 장면을 골라 냅니다.
// 실행: node tools/gen-puzzles.mjs  (몇 분 걸림)
import { writeFileSync } from 'node:fs';
import { Position, search, mateMoves, mateIn, moveToUci } from '../js/games/chess-engine.js';

const target = { 1: 150, 2: 200, 3: 120 };
const found = { 1: [], 2: [], 3: [] };
const seen = new Set();
const start = Date.now();
const LIMIT = Number(process.env.LIMIT_MIN || 25) * 60 * 1000;
let games = 0;

function consider(pos) {
  if (pos.side < 0) return; // 백 차례만 저장 (앱에서 색을 바꿔 흑 문제도 만듦)
  const fen = pos.fen();
  const key = fen.split(' ').slice(0, 2).join(' ');
  if (seen.has(key)) return;
  seen.add(key);
  if (pos.inCheck()) return; // 체크 상태에서 시작하는 문제는 제외
  // 빠른 걸러내기: 얕은 탐색으로 메이트 점수가 나오는지
  const r = search(fen, { depth: 4, timeMs: 250 });
  if (Math.abs(r.score) < 99000 || r.score < 0) return;
  const p = new Position(fen);
  let dist = 0;
  for (let n = 1; n <= 3; n++) if (mateIn(p, n)) { dist = n; break; }
  if (!dist || found[dist].length >= target[dist]) return;
  const sol = mateMoves(fen, dist);
  if (sol.length !== 1) return;
  found[dist].push([key, sol[0]]);
}

while (Object.keys(target).some((n) => found[n].length < target[n]) && Date.now() - start < LIMIT) {
  games++;
  const pos = new Position();
  const hist = [];
  // 처음 몇 수는 무작위로 다양하게
  for (let ply = 0; ply < 160; ply++) {
    const legal = pos.legal();
    if (!legal.length || pos.half >= 100) break;
    let m;
    if (ply < 6) m = legal[Math.floor(Math.random() * legal.length)];
    else {
      const noise = 60 + Math.random() * 260;
      const r = search(pos.fen(), { depth: 2, timeMs: 150, noise });
      m = pos.findUci(r.move);
    }
    pos.make(m);
    hist.push(moveToUci(m));
    if (ply >= 12) consider(new Position(pos.fen()));
  }
  if (games % 10 === 0) console.log(games, found[1].length, found[2].length, found[3].length, Math.round((Date.now() - start) / 1000) + 's');
}

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const header = `// 체스 퀴즈 문제 모음 — tools/gen-puzzles.mjs 로 생성 (엔진끼리 둔 대국에서 골라낸 장면, 외부 출처 없음)
// [FEN(백 차례, 판과 차례만), 유일한 첫 수(uci)]. 앱에서는 절반 정도를 색을 바꿔(흑 차례로) 보여 줍니다.
`;
const body = Object.entries(found).map(([n, list]) => `  ${n}: [\n${shuffle(list).map(([f, m]) => `    ['${f}', '${m}'],`).join('\n')}\n  ],`).join('\n');
writeFileSync(new URL('../js/games/chess-puzzles.js', import.meta.url), `${header}export const MATE_PUZZLES = {\n${body}\n};\n`);
console.log('done', games, found[1].length, found[2].length, found[3].length);
