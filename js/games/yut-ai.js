// 윷놀이 컴퓨터 상대: 나온 결과(pending) 중 무엇을 어느 말로 쓸지 고름
//  쉬움: 움직일 수 있는 수 중 무작위 / 보통: 지금 수만 보고 전진·잡기·완주를 따짐
//  어려움: 남은 결과를 쓰는 순서까지 모두 따지고, 상대에게 잡힐 위험도 계산
import { moveResult } from './yut.js?v=202611121408';

// 던졌을 때 각 결과가 나올 확률 (윷가락 하나가 배일 확률 1/2, 빽도는 표시된 가락 하나만 배일 때)
function probs(backdo) {
  const p = { 1: 4 / 16, 2: 6 / 16, 3: 4 / 16, 4: 1 / 16, 5: 1 / 16 };
  if (backdo) { p[1] = 3 / 16; p[-1] = 1 / 16; }
  return p;
}

const distCache = new Map();
// 이 말이 완주까지 남은 칸 수 (지금 모서리에 서 있으면 지름길로)
export function distLeft(pc) {
  if (pc.pos === 'E') return 0;
  const key = pc.pos + pc.line;
  if (distCache.has(key)) return distCache.get(key);
  let n = 1;
  while (n < 30 && moveResult({ ...pc, steps: [] }, n).pos !== 'E') n++;
  distCache.set(key, n);
  return n;
}

const clone = (pieces) => pieces.map((ps) => ps.map((p) => ({ ...p, steps: p.steps.slice() })));

// 가능한 수: { k: 말 번호, enter: 새 말인지 } (같은 칸의 업힌 말은 하나로)
export function movesFor(pieces, pi, v) {
  const out = [];
  const seen = new Set();
  pieces[pi].forEach((p, k) => {
    if (p.pos === 'E') return;
    if (p.pos === 'H') { if (v > 0 && !seen.has('H')) { seen.add('H'); out.push({ k, enter: true }); } return; }
    if (seen.has(p.pos)) return;
    seen.add(p.pos);
    if (moveResult(p, v)) out.push({ k, enter: false });
  });
  return out;
}

// 실제 화면의 apply 와 같은 규칙으로 움직인 결과 (원본은 그대로)
function play(pieces, pi, k, v) {
  const next = clone(pieces);
  const pc = next[pi][k];
  const res = moveResult(pc, v);
  const group = pc.pos === 'H' ? [pc] : next[pi].filter((p) => p.pos === pc.pos);
  group.forEach((p) => Object.assign(p, { pos: res.pos, line: res.line, steps: res.steps.slice() }));
  let caught = 0; let caughtDist = 0;
  if (res.pos !== 'E') {
    next.forEach((ps, oi) => {
      if (oi === pi) return;
      ps.forEach((p) => { if (p.pos === res.pos) { caughtDist += 20 - distLeft(p); caught++; Object.assign(p, { pos: 'H', line: 'O', steps: [] }); } });
    });
  }
  return { pieces: next, caught, caughtDist, finished: res.pos === 'E' ? group.length : 0 };
}

// pi 입장에서 판 상태 점수
function evaluate(pieces, pi, backdo, risk) {
  const P = probs(backdo);
  let score = 0;
  pieces.forEach((ps, oi) => {
    const prog = ps.reduce((a, p) => a + (20 - distLeft(p)) + (p.pos === 'E' ? 6 : 0), 0);
    score += oi === pi ? prog : -prog * 0.6 / (pieces.length - 1);
  });
  if (!risk) return score;
  // 내 말 무더기마다 상대 말이 한 번 던져서 닿을 확률만큼 잃을 수 있음
  const groups = new Map();
  pieces[pi].forEach((p) => { if (p.pos !== 'H' && p.pos !== 'E') groups.set(p.pos, (groups.get(p.pos) || []).concat(p)); });
  for (const [pos, list] of groups) {
    let hit = 0;
    pieces.forEach((ps, oi) => {
      if (oi === pi) return;
      const seen = new Set();
      ps.forEach((p) => {
        const key = p.pos + p.line;
        if (p.pos === 'E' || seen.has(key)) return;
        seen.add(key);
        for (const [v, pr] of Object.entries(P)) { const r = moveResult(p, Number(v)); if (r && r.pos === pos) hit += pr; }
      });
    });
    hit = Math.min(1, hit);
    score -= hit * list.reduce((a, p) => a + 20 - distLeft(p), 0) * 0.8;
  }
  return score;
}

// 결과 하나를 쓰는 즉시 얻는 점수 (잡으면 한 번 더 던지므로 덤)
const gain = (r) => r.caughtDist * 0.8 + (r.caught ? 8 : 0) + r.finished * 3;

// 남은 결과를 모두 쓰는 가장 좋은 순서 (어려움)
function bestSeq(pieces, pi, pending, backdo, budget) {
  if (!pending.length || budget.n <= 0) return { val: evaluate(pieces, pi, backdo, true), first: null };
  let best = { val: -Infinity, first: null };
  const tried = new Set();
  pending.forEach((v, sel) => {
    if (tried.has(v)) return;
    tried.add(v);
    const rest = pending.filter((_, j) => j !== sel);
    const ms = movesFor(pieces, pi, v);
    if (!ms.length) {
      const sub = bestSeq(pieces, pi, rest, backdo, budget);
      if (sub.val > best.val) best = { val: sub.val, first: { sel, discard: true } };
      return;
    }
    for (const m of ms) {
      budget.n--;
      const r = play(pieces, pi, m.k, v);
      const done = r.pieces[pi].every((p) => p.pos === 'E');
      const sub = done ? { val: 1e6 } : bestSeq(r.pieces, pi, rest, backdo, budget);
      const val = gain(r) + sub.val;
      if (val > best.val) best = { val, first: { sel, ...m } };
    }
  });
  return best;
}

// d: 윷놀이 session.data, pi: 컴퓨터 자리 → { sel, k, enter } 또는 { sel, discard: true }
export function chooseMove(d, pi, level, backdo) {
  const pending = d.pending;
  if (level === 0) {
    const all = [];
    pending.forEach((v, sel) => movesFor(d.pieces, pi, v).forEach((m) => all.push({ sel, ...m })));
    if (!all.length) return { sel: 0, discard: true };
    // 잡을 수 있으면 반쯤은 잡음
    const catches = all.filter((m) => play(d.pieces, pi, m.k, pending[m.sel]).caught);
    if (catches.length && Math.random() < 0.5) return catches[0];
    return all[Math.floor(Math.random() * all.length)];
  }
  if (level === 1) {
    let best = null; let bestVal = -Infinity;
    pending.forEach((v, sel) => movesFor(d.pieces, pi, v).forEach((m) => {
      const r = play(d.pieces, pi, m.k, v);
      const val = gain(r) + evaluate(r.pieces, pi, backdo, false) + Math.random() * 0.5;
      if (val > bestVal) { bestVal = val; best = { sel, ...m }; }
    }));
    return best || { sel: 0, discard: true };
  }
  return bestSeq(d.pieces, pi, pending, backdo, { n: 3000 }).first || { sel: 0, discard: true };
}
