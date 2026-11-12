// 차빼!: 6×6 주차장에서 차를 앞뒤로 밀어 빨간 차를 오른쪽 출구로 빼내는 혼자 하는 퍼즐
//  문제는 tools/gen-carpark.mjs 로 미리 만들어 둔 것(최소 이동 수를 계산해 단계별로 나눔)에서 고름
//  '오늘의 문제'는 날짜로 정해진 같은 문제
// session.data = { level, daily, start, min, cur, hist:[이전 상태], moves, hints, elapsed, solved, gaveUp }
import { PUZZLES } from './carpark-puzzles.js?v=202611121529';
import { vehicles, range, slide, solved, solve, N, EXIT_ROW } from './carpark-solver.js?v=202611121529';

export const LEVELS = [
  { name: '입문', pts: 50 },
  { name: '초급', pts: 100 },
  { name: '중급', pts: 150 },
  { name: '상급', pts: 200 },
  { name: '고수', pts: 300 },
  { name: '마스터', pts: 400 },
];
const COLORS = ['#5b8db8', '#e0a43a', '#6aa36f', '#9a7bb8', '#d07a4f', '#4fa3a5', '#b88a5b', '#7f8c9a', '#c76b98', '#8aa04a', '#5f74c0', '#b5a33c', '#3f8f6b', '#a35f5f', '#6a6ac4'];
const colorOf = (id) => (id === 'A' ? '#c62f28' : COLORS[(id.charCodeAt(0) - 66) % COLORS.length]);

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const fmtTime = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// 좌우 뒤집기는 출구가 바뀌어 안 되고, 위아래 뒤집기는 출구 줄이 바뀌어 안 됨 → 그대로 씀
export function pickPuzzle(level, seed = null) {
  const list = PUZZLES[level]?.length ? PUZZLES[level] : PUZZLES.flat();
  const k = seed == null ? Math.floor(Math.random() * list.length) : hashStr(seed) % list.length;
  const item = list[k];
  return { start: item.slice(0, 36), min: Number(item.slice(36)) };
}
export const scoreOf = (d) => {
  if (!d.solved) return 0;
  const base = LEVELS[d.level]?.pts || 100;
  return Math.max(10, Math.round(base * Math.min(1, d.min / Math.max(1, d.moves))) - d.hints * 20);
};

export default {
  id: 'carpark',
  name: '차빼!',
  guide: {
    players: '1명', time: '1~15분',
    intro: '꽉 막힌 주차장에서 다른 차들을 앞뒤로 밀어 빨간 차를 오른쪽 출구로 빼내는 퍼즐이에요. 단계마다 가장 적은 이동 수가 정해져 있어요.',
    rules: [
      '차를 손가락으로 끌어서 움직여요. 가로로 놓인 차는 좌우로만, 세로로 놓인 차는 위아래로만 가요.',
      '차는 다른 차를 넘거나 돌 수 없어요.',
      '빨간 차가 오른쪽 출구(셋째 줄 끝)에 닿으면 성공이에요.',
      '한 차를 한 번에 몇 칸 밀든 1번 이동으로 세요.',
      '힌트를 누르면 가장 빠른 풀이의 다음 한 수를 대신 둬요.',
      '"오늘의 문제"를 고르면 그날 같은 단계를 고른 사람 모두에게 같은 문제가 나와요.',
    ],
    scoring: ['단계 점수(입문 50 · 초급 100 · 중급 150 · 상급 200 · 고수 300 · 마스터 400)에 "최소 이동 수 ÷ 내 이동 수"를 곱해요. 최소 이동 수로 풀면 만점이에요.', '힌트 1번에 20점을 빼요(최소 10점). 포기하면 0점이에요.'],
    tips: [
      '빨간 차 앞을 막은 차부터 보고, 그 차가 비키려면 어떤 차가 먼저 움직여야 하는지 거꾸로 따라가 보세요.',
      '세로로 긴 트럭(세 칸)은 위아래 어느 쪽으로 빼야 하는지가 핵심일 때가 많아요.',
      '막히면 되돌리기로 몇 수 돌아가서 다른 차를 먼저 움직여 보세요.',
    ],
  },
  minPlayers: 1,
  maxPlayers: 1,
  pickHint: '혼자 푸는 퍼즐이에요. 푸는 사람 1명을 고르세요.',
  settingsFields: [
    { key: 'level', label: '단계', default: 1, options: LEVELS.map((l, i) => ({ value: i, label: `${i + 1} ${l.name}` })) },
    { key: 'daily', label: '문제', default: false, options: [{ value: false, label: '새 문제' }, { value: true, label: '오늘의 문제 (모두 같은 문제)' }] },
  ],
  roundLabel: '퍼즐',

  initData(players, settings) {
    const level = Number(settings?.level ?? 1);
    const daily = settings?.daily ? today() : null;
    const { start, min } = pickPuzzle(level, daily ? `carpark-${daily}-${level}` : null);
    return { level, daily, start, min, cur: start, hist: [], moves: 0, hints: 0, elapsed: 0, solved: false, gaveUp: false };
  },
  computeTotals(session) { return [scoreOf(session.data)]; },
  incompleteCount(session) { return session.data.solved || session.data.gaveUp ? 0 : 1; },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const readonly = session.status === 'finished';
    const done = () => d.solved || d.gaveUp || readonly;
    let last = Date.now();
    let busy = false;
    const addTime = () => { const now = Date.now(); if (!done()) d.elapsed += now - last; last = now; };
    const save = () => { addTime(); ctx.save(); };
    const tick = setInterval(() => {
      if (!root.isConnected) { clearInterval(tick); addTime(); return; }
      const el = root.querySelector('#cp-time');
      if (el && !done()) el.textContent = fmtTime(d.elapsed + Date.now() - last);
    }, 500);

    const apply = (next, { hint = false } = {}) => {
      d.hist.push(d.cur);
      if (d.hist.length > 300) d.hist.shift();
      d.cur = next; d.moves++;
      if (hint) d.hints++;
      if (solved(d.cur)) d.solved = true;
      save(); draw();
      if (d.solved) ctx.toast?.(d.moves <= d.min ? '최소 이동으로 빼냈어요' : '빼냈어요');
    };

    const draw = () => {
      const L = LEVELS[d.level] || LEVELS[1];
      const cars = vehicles(d.cur).map((v) => {
        const x = v.cells[0] % N; const y = Math.floor(v.cells[0] / N);
        const w = v.horiz ? v.cells.length : 1; const h = v.horiz ? 1 : v.cells.length;
        return `<div class="cp-car ${v.id === 'A' ? 'red' : ''} ${v.cells.length === 3 ? 'truck' : ''} ${v.horiz ? 'h' : 'v'}" data-id="${v.id}"
          style="left:${(x / N) * 100}%;top:${(y / N) * 100}%;width:${(w / N) * 100}%;height:${(h / N) * 100}%;--cc:${colorOf(v.id)}"><span></span></div>`;
      }).join('');
      root.innerHTML = `<section class="card cp-card">
        <div class="quiz-head"><b>${d.level + 1}단계 ${L.name}${d.daily ? ` · 오늘의 문제 (${d.daily.slice(5).replace('-', '/')})` : ''}</b>
          <span class="muted">이동 ${d.moves} · 최소 ${d.min} · <span id="cp-time">${fmtTime(d.elapsed)}</span></span></div>
        ${d.solved ? `<div class="chess-status done">빼냈어요 · ${d.moves}번 이동 · ${scoreOf(d)}점</div>` : d.gaveUp ? '<div class="chess-status">포기했어요</div>' : ''}
        <div class="cp-wrap"><div class="cp-lot ${d.solved ? 'won' : ''}" style="--exit:${EXIT_ROW}">${cars}<i class="cp-exit" aria-hidden="true"></i></div></div>
        ${done() ? '' : `<div class="chess-actions">
          <button class="btn small" data-act="undo" ${d.hist.length ? '' : 'disabled'}>되돌리기</button>
          <button class="btn small" data-act="reset" ${d.moves ? '' : 'disabled'}>처음부터</button>
          <button class="btn small" data-act="hint">힌트</button>
          <button class="btn small danger" data-act="giveup">포기</button>
        </div>`}
        ${(d.solved || d.gaveUp) && !readonly ? '<button class="btn primary block" data-act="finish">전적에 기록</button>' : ''}
      </section>`;
      if (!done()) bindDrag(root.querySelector('.cp-lot'));
    };

    // 끌어서 밀기
    function bindDrag(lot) {
      lot.onpointerdown = (e) => {
        const el = e.target.closest('.cp-car');
        if (!el || busy) return;
        e.preventDefault();
        const v = vehicles(d.cur).find((x) => x.id === el.dataset.id);
        const [lo, hi] = range(d.cur, v);
        const cell = lot.getBoundingClientRect().width / N;
        const start = v.horiz ? e.clientX : e.clientY;
        let delta = 0;
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('drag');
        const moveFn = (ev) => {
          const px = (v.horiz ? ev.clientX : ev.clientY) - start;
          delta = Math.max(lo, Math.min(hi, px / cell));
          el.style.transform = v.horiz ? `translateX(${delta * cell}px)` : `translateY(${delta * cell}px)`;
        };
        const upFn = () => {
          el.removeEventListener('pointermove', moveFn);
          el.removeEventListener('pointerup', upFn);
          el.removeEventListener('pointercancel', upFn);
          el.classList.remove('drag');
          const k = Math.round(delta);
          if (k) apply(slide(d.cur, v, k)); else el.style.transform = '';
        };
        el.addEventListener('pointermove', moveFn);
        el.addEventListener('pointerup', upFn);
        el.addEventListener('pointercancel', upFn);
      };
    }

    root.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'finish') return ctx.finish({ ask: false });
      if (done() || busy) return;
      if (act === 'undo') { if (!d.hist.length) return; d.cur = d.hist.pop(); d.moves = Math.max(0, d.moves - 1); save(); return draw(); }
      if (act === 'reset') { if (!confirm('처음 배치로 돌릴까요? 이동 수도 0으로 돌아가요.')) return; d.cur = d.start; d.hist = []; d.moves = 0; save(); return draw(); }
      if (act === 'giveup') { if (!confirm('포기할까요? 점수는 0점이에요.')) return; addTime(); d.gaveUp = true; ctx.save(); return draw(); }
      if (act === 'hint') {
        busy = true; b.textContent = '계산 중…';
        setTimeout(() => {
          busy = false;
          const path = solve(d.cur);
          if (!path || !path.length) { ctx.toast?.('지금 배치에서는 풀이를 찾지 못했어요. 처음부터 해 보세요.'); return draw(); }
          const [id, k] = path[0];
          const v = vehicles(d.cur).find((x) => x.id === id);
          apply(slide(d.cur, v, k), { hint: true });
          const el = root.querySelector(`.cp-car[data-id="${id}"]`);
          el?.classList.add('hinted');
        }, 30);
      }
    };
    draw();
  },
};
