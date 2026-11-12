// 스도쿠: 해가 하나뿐인 문제를 난이도별로 그때그때 만들어 혼자 풀기
//  '오늘의 문제'를 고르면 날짜로 정해진 같은 문제가 나와서, 가족끼리 같은 문제로 점수·시간을 비교할 수 있음
// session.data = { level, daily:'YYYY-MM-DD'|null, puzzle, solution, cells:(81자, 0=빈칸), notes:{ 칸: 비트 }, mistakes, hints, checks, flagged:{ 칸: 그때 값 }, elapsed(ms), solved, gaveUp }
//  settings.check: 'off'(기본, 틀려도 표시 없음. '검사' 버튼으로만 확인) | 'instant'(넣는 즉시 틀린 칸 표시, 연습용)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const LEVELS = [
  { name: '쉬움', clues: 40, pts: 100 },
  { name: '보통', clues: 33, pts: 200 },
  { name: '어려움', clues: 28, pts: 300 },
  { name: '최상', clues: 24, pts: 400 },
];

// 같은 씨앗이면 같은 수열 (오늘의 문제용)
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (xs, r) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } return xs; };

const ROW = (i) => Math.floor(i / 9);
const COL = (i) => i % 9;
const BOX = (i) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);
// 칸마다 같은 행·열·상자에 있는 칸들
const PEERS = Array.from({ length: 81 }, (_, i) => {
  const s = new Set();
  for (let j = 0; j < 81; j++) if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) s.add(j);
  return [...s];
});
const candMask = (g, i) => { let m = 0x3fe; for (const j of PEERS[i]) if (g[j]) m &= ~(1 << g[j]); return m; };
const bits = (m) => { const out = []; for (let v = 1; v <= 9; v++) if (m & (1 << v)) out.push(v); return out; };

// 해의 개수 (limit 개까지만 셈). g 는 숫자 배열(0=빈칸), 바꿨다가 되돌려 놓음
function countSolutions(g, limit = 2) {
  let best = -1; let bestN = 10;
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    const n = bits(candMask(g, i)).length;
    if (n < bestN) { bestN = n; best = i; if (n <= 1) break; }
  }
  if (best < 0) return 1;
  if (bestN === 0) return 0;
  let c = 0;
  for (const v of bits(candMask(g, best))) {
    g[best] = v;
    c += countSolutions(g, limit - c);
    g[best] = 0;
    if (c >= limit) break;
  }
  return c;
}

function fill(g, r) {
  let best = -1; let bestN = 10;
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue;
    const n = bits(candMask(g, i)).length;
    if (n < bestN) { bestN = n; best = i; }
  }
  if (best < 0) return true;
  for (const v of shuffle(bits(candMask(g, best)), r)) {
    g[best] = v;
    if (fill(g, r)) return true;
  }
  g[best] = 0;
  return false;
}

// 문제 만들기: 꽉 찬 판에서 해가 하나로 유지되는 동안 칸을 지움
export function generate(level, seed = String(Math.random())) {
  const r = rng(seed);
  const sol = Array(81).fill(0);
  fill(sol, r);
  const g = sol.slice();
  const target = LEVELS[level]?.clues ?? 33;
  let clues = 81;
  for (const i of shuffle([...Array(81).keys()], r)) {
    if (clues <= target) break;
    const keep = g[i];
    g[i] = 0;
    if (countSolutions(g, 2) !== 1) g[i] = keep; else clues--;
  }
  return { puzzle: g.join(''), solution: sol.join('') };
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtTime = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const scoreOf = (d, instant = false) => (!d.solved ? 0 : Math.max(10, Math.round((LEVELS[d.level]?.pts || 100) * (instant ? 0.5 : 1)) - d.mistakes * 10 - d.hints * 25));

// 예전 기록(설정 없음)은 바로 표시였음
const instantOf = (session) => (session.settings?.check ?? 'instant') === 'instant';

export default {
  id: 'sudoku',
  name: '스도쿠',
  guide: {
    players: '1명', time: '5~40분',
    intro: '9×9 칸에 1~9를 채우는 숫자 퍼즐이에요. 문제는 그때그때 새로 만들고, 답은 언제나 하나뿐이에요.',
    rules: [
      '가로줄, 세로줄, 굵은 선으로 나뉜 3×3 상자마다 1~9가 한 번씩만 들어가야 해요.',
      '빈칸을 누르고 아래 숫자를 누르면 들어가요. 기본으로는 틀려도 알려 주지 않아요.',
      '검사 버튼을 누르면 그때까지 틀린 칸이 빨갛게 표시되고, 틀린 칸 수만큼 실수로 세요. 다 채웠는데 틀린 칸이 있으면 알려 줘요.',
      '연습할 때는 새 게임 화면의 "틀린 칸 표시"를 "바로 표시"로 바꾸면 넣는 즉시 틀린 숫자가 빨갛게 보여요(실수로 셈).',
      '메모를 켜면 칸에 후보 숫자를 작게 적을 수 있어요. 숫자를 넣으면 같은 줄·상자의 메모에서 그 숫자가 자동으로 지워져요.',
      '힌트를 누르면 고른 칸(없으면 아무 빈칸)의 답이 하나 채워져요.',
      '"오늘의 문제"를 고르면 그날 같은 난이도를 고른 사람 모두에게 같은 문제가 나와요. 가족끼리 시간과 점수를 겨뤄 보세요.',
    ],
    scoring: ['다 풀면 난이도 점수(쉬움 100, 보통 200, 어려움 300, 최상 400)에서 실수(검사로 찾은 틀린 칸, 또는 바로 표시 모드의 틀린 입력) 1개에 10점, 힌트 1번에 25점을 빼요(최소 10점). 바로 표시 모드는 점수가 절반이에요.', '풀이 시간은 기록 화면에 함께 남아요. 포기하면 0점이에요.'],
    tips: [
      '한 줄이나 상자에 빈칸이 하나뿐인 곳부터 채우세요.',
      '숫자 하나를 정해 놓고 상자 아홉 개를 차례로 보면서, 그 숫자가 들어갈 수 있는 칸이 한 곳뿐인 상자를 찾으세요.',
      '어려움부터는 메모를 꼭 쓰세요. 후보가 두 개뿐인 칸이 실마리가 될 때가 많아요.',
    ],
  },
  minPlayers: 1,
  maxPlayers: 1,
  pickHint: '혼자 푸는 퍼즐이에요. 푸는 사람 1명을 고르세요.',
  settingsFields: [
    { key: 'level', label: '난이도', default: 1, options: LEVELS.map((l, i) => ({ value: i, label: l.name })) },
    { key: 'check', label: '틀린 칸 표시', default: 'off', options: [{ value: 'off', label: '안 함 (검사 버튼으로만)' }, { value: 'instant', label: '바로 표시 (연습용, 점수 절반)' }] },
    { key: 'daily', label: '문제', default: false, options: [{ value: false, label: '새 문제' }, { value: true, label: '오늘의 문제 (모두 같은 문제)' }] },
  ],
  roundLabel: '퍼즐',

  initData(players, settings) {
    const level = Number(settings?.level ?? 1);
    const daily = settings?.daily ? today() : null;
    const { puzzle, solution } = generate(level, daily ? `sudoku-${daily}-${level}` : undefined);
    return { level, daily, puzzle, solution, cells: puzzle, notes: {}, mistakes: 0, hints: 0, checks: 0, flagged: {}, elapsed: 0, solved: false, gaveUp: false };
  },
  computeTotals(session) { return [scoreOf(session.data, instantOf(session))]; },
  incompleteCount(session) { return session.data.solved || session.data.gaveUp ? 0 : 1; },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const readonly = session.status === 'finished';
    const done = () => d.solved || d.gaveUp || readonly;
    let sel = null;
    let noteMode = false;
    let last = Date.now();
    const undo = [];
    const cells = () => d.cells.split('').map(Number);
    const given = (i) => d.puzzle[i] !== '0';
    const instant = instantOf(session);
    if (!d.flagged) d.flagged = {};
    // 틀린 칸으로 보일지: 바로 표시 모드, 검사로 찾은 칸(그 뒤 안 바꿈), 끝난 뒤
    const showWrong = (i, v) => v && String(v) !== d.solution[i] && (instant || done() || d.flagged[i] === v);

    // 시간: 화면이 열려 있는 동안만 셈
    const addTime = () => { const now = Date.now(); if (!done()) d.elapsed += now - last; last = now; };
    const save = () => { addTime(); ctx.save(); };
    const tick = setInterval(() => {
      if (!root.isConnected) { clearInterval(tick); addTime(); return; }
      const el = root.querySelector('#sd-time');
      if (el && !done()) el.textContent = fmtTime(d.elapsed + Date.now() - last);
    }, 500);

    const setCell = (i, v) => {
      const g = cells();
      undo.push({ i, v: g[i], n: d.notes[i] || 0, peers: PEERS[i].filter((j) => d.notes[j]).map((j) => [j, d.notes[j]]) });
      g[i] = v;
      if (v) {
        delete d.notes[i];
        for (const j of PEERS[i]) if (d.notes[j]) { d.notes[j] &= ~(1 << v); if (!d.notes[j]) delete d.notes[j]; }
        if (instant && String(v) !== d.solution[i]) d.mistakes++;
      }
      d.cells = g.join('');
      if (d.cells === d.solution) { d.solved = true; } else if (!d.cells.includes('0') && !instant) ctx.toast?.('다 채웠는데 틀린 칸이 있어요. 검사로 찾아보세요');
    };

    const draw = () => {
      const g = cells();
      const sv = sel != null ? g[sel] : 0;
      const counts = Array(10).fill(0);
      // 바로 표시 모드에서만 맞은 숫자만 세고, 아니면 넣은 숫자를 다 셈 (정답을 흘리지 않게)
      g.forEach((v, i) => { if (v && (!instant || String(v) === d.solution[i])) counts[v]++; });
      const grid = g.map((v, i) => {
        const wrong = showWrong(i, v);
        const rel = sel != null && i !== sel && (ROW(i) === ROW(sel) || COL(i) === COL(sel) || BOX(i) === BOX(sel));
        const cls = ['sd-c', given(i) ? 'given' : '', wrong ? 'wrong' : '', i === sel ? 'sel' : '', rel ? 'rel' : '', sv && v === sv ? 'same' : '',
          COL(i) % 3 === 2 && COL(i) < 8 ? 'br' : '', ROW(i) % 3 === 2 && ROW(i) < 8 ? 'bb' : ''].join(' ');
        const inner = v ? v : d.notes[i] ? `<span class="sd-notes">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<i>${d.notes[i] & (1 << n) ? n : ''}</i>`).join('')}</span>` : '';
        return `<button class="${cls}" data-i="${i}" ${done() ? 'disabled' : ''}>${inner}</button>`;
      }).join('');
      const L = LEVELS[d.level] || LEVELS[1];
      root.innerHTML = `<section class="card sd-card">
        <div class="quiz-head"><b>${L.name}${d.daily ? ` · 오늘의 문제 (${d.daily.slice(5).replace('-', '/')})` : ''}</b>
          <span class="muted">${instant ? '바로 표시 · ' : ''}실수 ${d.mistakes} · 힌트 ${d.hints} · <span id="sd-time">${fmtTime(d.elapsed)}</span></span></div>
        ${d.solved ? `<div class="chess-status done">다 풀었어요 · ${scoreOf(d, instant)}점 · ${fmtTime(d.elapsed)}</div>` : d.gaveUp ? '<div class="chess-status">포기했어요. 정답을 보여 드려요.</div>' : ''}
        <div class="sd-grid">${grid}</div>
        ${done() ? '' : `<div class="sd-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="key ${counts[n] >= 9 ? 'zero' : ''}" data-n="${n}" ${counts[n] >= 9 && !noteMode ? 'disabled' : ''}>${n}<small>${9 - counts[n] || ''}</small></button>`).join('')}</div>
        <div class="chess-actions">
          <button class="btn small ${noteMode ? 'primary' : ''}" data-act="note">메모 ${noteMode ? '켜짐' : '꺼짐'}</button>
          <button class="btn small" data-act="erase">지우기</button>
          <button class="btn small" data-act="undo" ${undo.length ? '' : 'disabled'}>되돌리기</button>
          ${instant ? '' : '<button class="btn small" data-act="check">검사</button>'}
          <button class="btn small" data-act="hint">힌트</button>
          <button class="btn small danger" data-act="giveup">포기</button>
        </div>`}
        ${(d.solved || d.gaveUp) && !readonly ? '<button class="btn primary block" data-act="finish">전적에 기록</button>' : ''}
      </section>`;
    };

    root.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'finish') return ctx.finish({ ask: false });
      if (done()) return;
      if (b.dataset.i != null) { const i = Number(b.dataset.i); sel = sel === i ? null : i; return draw(); }
      const act = b.dataset.act;
      if (act === 'note') { noteMode = !noteMode; return draw(); }
      if (act === 'check') {
        const g = cells();
        const wrong = g.map((v, i) => (v && !given(i) && String(v) !== d.solution[i] ? i : -1)).filter((i) => i >= 0);
        // 이미 검사로 찾은 칸(그대로인 것)은 다시 세지 않음
        const fresh = wrong.filter((i) => d.flagged[i] !== g[i]);
        if (!confirm(`지금까지 넣은 숫자를 검사할까요? 틀린 칸 하나마다 실수 1개(10점)로 세요.`)) return;
        d.checks = (d.checks || 0) + 1;
        d.mistakes += fresh.length;
        for (const i of wrong) d.flagged[i] = g[i];
        save(); draw();
        ctx.toast?.(wrong.length ? `틀린 칸 ${wrong.length}개를 빨갛게 표시했어요` : '지금까지 넣은 숫자는 모두 맞아요');
        return;
      }
      if (act === 'undo') {
        const u = undo.pop(); if (!u) return;
        const g = cells(); g[u.i] = u.v; d.cells = g.join('');
        if (u.n) d.notes[u.i] = u.n; else delete d.notes[u.i];
        for (const [j, m] of u.peers) d.notes[j] = m;
        sel = u.i; save(); return draw();
      }
      if (act === 'hint') {
        const g = cells();
        let i = sel != null && !given(sel) && String(g[sel]) !== d.solution[sel] ? sel : -1;
        if (i < 0) { const empty = g.map((v, k) => (String(v) !== d.solution[k] ? k : -1)).filter((k) => k >= 0); i = empty[Math.floor(Math.random() * empty.length)]; }
        if (i == null || i < 0) return;
        d.hints++;
        const before = d.mistakes;
        setCell(i, Number(d.solution[i]));
        d.mistakes = before;
        sel = i; save(); draw();
        if (d.solved) ctx.toast?.('다 풀었어요');
        return;
      }
      if (act === 'giveup') {
        if (!confirm('포기하고 정답을 볼까요? 점수는 0점이에요.')) return;
        addTime(); d.gaveUp = true; d.cells = d.solution; ctx.save(); return draw();
      }
      if (sel == null || given(sel)) { if (b.dataset.n || act === 'erase') ctx.toast?.('먼저 빈칸을 눌러 주세요'); return; }
      const g = cells();
      if (act === 'erase') {
        if (!g[sel] && !d.notes[sel]) return;
        undo.push({ i: sel, v: g[sel], n: d.notes[sel] || 0, peers: [] });
        g[sel] = 0; delete d.notes[sel]; d.cells = g.join(''); save(); return draw();
      }
      const n = Number(b.dataset.n);
      if (!n) return;
      if (noteMode) {
        if (g[sel]) return;
        undo.push({ i: sel, v: 0, n: d.notes[sel] || 0, peers: [] });
        d.notes[sel] = (d.notes[sel] || 0) ^ (1 << n);
        if (!d.notes[sel]) delete d.notes[sel];
        save(); return draw();
      }
      if (g[sel] === n) return;
      setCell(sel, n);
      save(); draw();
      if (d.solved) ctx.toast?.('다 풀었어요');
    };
    draw();
  },
};
