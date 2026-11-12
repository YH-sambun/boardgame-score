// 요트다이스 컴퓨터 상대: 어떤 주사위를 남길지, 어느 칸에 기록할지 고름
//  쉬움: 가장 많이 나온 눈만 남기고, 지금 점수가 제일 큰 칸에 기록
//  보통: 남길 주사위 조합마다 다시 굴렸을 때의 기대 점수를 계산 (칸의 가치는 단순 비교)
//  어려움: 같은 계산 + 칸마다 평소 기대 점수(기준값)와 상단 보너스 63점 진행 상황까지 따짐
import { CATEGORIES, scoreFor, BONUS_LINE } from './yacht.js?v=202611121212';

// 칸을 쓸 때 평소에 기대하는 점수 (이보다 낮으면 아까운 칸)
const PAR = { choice: 22, fourKind: 9, fullHouse: 11, smallStraight: 10, largeStraight: 14, yacht: 9 };

// 주사위 k개를 굴렸을 때 나올 수 있는 결과(순서 무시)와 확률
const OUTCOMES = (() => {
  const fact = [1, 1, 2, 6, 24, 120];
  const out = [];
  for (let k = 0; k <= 5; k++) {
    const list = [];
    const rec = (start, cur) => {
      if (cur.length === k) {
        const cnt = {}; cur.forEach((v) => { cnt[v] = (cnt[v] || 0) + 1; });
        let ways = fact[k]; Object.values(cnt).forEach((c) => { ways /= fact[c]; });
        list.push([cur.slice(), ways / 6 ** k]);
        return;
      }
      for (let v = start; v <= 6; v++) { cur.push(v); rec(v, cur); cur.pop(); }
    };
    rec(1, []);
    out.push(list);
  }
  return out;
})();

// 이 컴퓨터의 남은 칸·상단 합계
export function stateOf(scores, pi) {
  const open = CATEGORIES.filter((c) => scores[c.key]?.[pi] == null);
  const upper = CATEGORIES.filter((c) => c.upper).reduce((a, c) => a + (scores[c.key]?.[pi] || 0), 0);
  const upperLeft = open.filter((c) => c.upper).reduce((a, c) => a + c.face * 5, 0);
  return { open, upper, bonusAlive: upper < BONUS_LINE && upper + upperLeft >= BONUS_LINE };
}

function catValue(c, dice, st, level) {
  const s = scoreFor(c.key, dice);
  if (level === 0) return s;
  if (c.upper) {
    const par = 3 * c.face;
    let v = s - par * (level === 2 ? 0.9 : 0.5);
    if (level === 2 && st.bonusAlive) {
      v += (s - par) * 0.6;
      if (st.upper < BONUS_LINE && st.upper + s >= BONUS_LINE) v += 25;
    }
    return v;
  }
  return s - PAR[c.key] * (level === 2 ? 1 : 0.5);
}

const bestCat = (dice, st, level) => {
  let best = null; let bestV = -Infinity;
  for (const c of st.open) { const v = catValue(c, dice, st, level); if (v > bestV) { bestV = v; best = c; } }
  return { cat: best, val: bestV };
};

// 기록할 칸 key
export function chooseCategory(dice, scores, pi, level) {
  return bestCat(dice, stateOf(scores, pi), level).cat.key;
}

// 남길 주사위 (true = 남김). 모두 true 면 더 굴리지 않음
export function chooseHold(dice, scores, pi, level) {
  if (level === 0) {
    const cnt = [0, 0, 0, 0, 0, 0, 0];
    dice.forEach((v) => { cnt[v]++; });
    let face = 6;
    for (let v = 6; v >= 1; v--) if (cnt[v] > cnt[face]) face = v;
    if (cnt[face] === 5) return dice.map(() => true);
    return dice.map((v) => v === face);
  }
  const st = stateOf(scores, pi);
  const seen = new Map();
  let best = null; let bestE = -Infinity;
  for (let mask = 0; mask < 32; mask++) {
    const held = dice.filter((_, i) => mask & (1 << i));
    const key = held.slice().sort().join('');
    if (seen.has(key)) continue;
    seen.set(key, true);
    let e = 0;
    for (const [roll, p] of OUTCOMES[5 - held.length]) e += p * bestCat([...held, ...roll], st, level).val;
    // 같은 기대값이면 더 많이 남기는 쪽 (덜 흔들림)
    if (e > bestE + 1e-9 || (Math.abs(e - bestE) < 1e-9 && held.length > best.held.length)) { bestE = e; best = { mask, held }; }
  }
  return dice.map((_, i) => !!(best.mask & (1 << i)));
}
