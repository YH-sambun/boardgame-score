// 마방진: n×n 칸에 1~n² 를 한 번씩 넣어 가로·세로·대각선 합을 모두 같게 만드는 퍼즐 (홀수 크기)
//  1은 맨 윗줄 가운데에 고정. 화면에 "다음 숫자"가 뜨고, 놓을 칸을 누르면 들어감
//  판정은 공식 답과 비교하지 않고 모든 줄의 합으로 함 (다른 풀이도 정답)
// session.data = { n, cells:[n²개, 0=빈칸], hints, checks, elapsed, solved, gaveUp }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const magicSum = (n) => (n * (n * n + 1)) / 2;
const BASE = { 3: 50, 5: 100, 7: 200 };
const fmtTime = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// 계단식 방법: 1을 맨 윗줄 가운데에 두고, 다음 수는 오른쪽 위, 차 있으면 바로 아래
export function siamese(n) {
  const g = Array(n * n).fill(0);
  let r = 0; let c = (n - 1) / 2;
  for (let k = 1; k <= n * n; k++) {
    g[r * n + c] = k;
    const nr = (r - 1 + n) % n; const nc = (c + 1) % n;
    if (g[nr * n + nc]) r = (r + 1) % n; else { r = nr; c = nc; }
  }
  return g;
}
// 줄들: 가로 n, 세로 n, 대각선 2
export function lines(n) {
  const L = [];
  for (let i = 0; i < n; i++) { L.push([...Array(n).keys()].map((j) => i * n + j)); L.push([...Array(n).keys()].map((j) => j * n + i)); }
  L.push([...Array(n).keys()].map((j) => j * n + j));
  L.push([...Array(n).keys()].map((j) => j * n + (n - 1 - j)));
  return L;
}
export const isMagic = (cells, n) => !cells.includes(0) && lines(n).every((l) => l.reduce((a, i) => a + cells[i], 0) === magicSum(n));
export const scoreOf = (d) => (!d.solved ? 0 : Math.max(10, (BASE[d.n] || 100) - d.hints * 15 - d.checks * 10));

export default {
  id: 'magic',
  name: '마방진',
  guide: {
    players: '1명', time: '3~20분',
    intro: '칸에 1부터 차례로 숫자를 넣어 가로·세로·대각선의 합이 모두 같아지게 만드는 숫자 퍼즐이에요. 7×7이면 1~49를 넣어 모든 줄의 합을 175로 맞춰요.',
    rules: [
      '1은 맨 윗줄 가운데에 미리 놓여 있어요.',
      '화면에 뜬 "다음 숫자"를 놓을 칸을 누르면 들어가요. 숫자는 2, 3, 4… 차례로 놓아요.',
      '놓은 숫자를 다시 누르면 빠지고, 빠진 숫자가 다시 "다음 숫자"가 돼요.',
      '모든 칸을 채웠을 때 가로·세로·대각선 합이 모두 같으면(3×3은 15, 5×5는 65, 7×7은 175) 성공이에요. 틀린 줄은 빨갛게 표시돼요.',
      '힌트를 누르면 다음 숫자를 놓을 자리를 잠깐 보여 줘요. 그 전에 공식과 다르게 놓은 숫자가 있으면 그 숫자를 알려 줘요.',
    ],
    scoring: ['기본 점수는 3×3 50점, 5×5 100점, 7×7 200점이에요.', '힌트 한 번에 15점, 다 채웠는데 틀린 판정 한 번에 10점을 빼요(최소 10점). 걸린 시간도 기록돼요.'],
    tips: [
      '규칙이 있어요. 숫자를 하나 놓을 때마다 "다음 숫자는 어느 방향으로 한 칸 갔지?"를 보세요.',
      '판 밖으로 나가면 반대편 끝에서 다시 들어온다고 생각해 보세요.',
      '3×3에서 규칙을 찾으면 5×5, 7×7도 똑같이 풀려요.',
    ],
  },
  minPlayers: 1,
  maxPlayers: 1,
  pickHint: '혼자 푸는 퍼즐이에요. 푸는 사람 1명을 고르세요.',
  settingsFields: [
    { key: 'n', label: '크기', default: 7, options: [{ value: 3, label: '3×3 (합 15)' }, { value: 5, label: '5×5 (합 65)' }, { value: 7, label: '7×7 (합 175)' }] },
  ],
  roundLabel: '퍼즐',

  initData(players, settings) {
    const n = Number(settings?.n ?? 7);
    const cells = Array(n * n).fill(0);
    cells[(n - 1) / 2] = 1;
    return { n, cells, hints: 0, checks: 0, elapsed: 0, solved: false, gaveUp: false };
  },
  computeTotals(session) { return [scoreOf(session.data)]; },
  incompleteCount(session) { return session.data.solved || session.data.gaveUp ? 0 : 1; },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const n = d.n;
    const M = magicSum(n);
    const fixed = (n - 1) / 2;
    const readonly = session.status === 'finished';
    const done = () => d.solved || d.gaveUp || readonly;
    const undo = [];
    let flash = -1; let flashCls = '';
    let msg = ''; let ok = false;
    let last = Date.now();
    const addTime = () => { const now = Date.now(); if (!done()) d.elapsed += now - last; last = now; };
    const save = () => { addTime(); ctx.save(); };
    const tick = setInterval(() => {
      if (!root.isConnected) { clearInterval(tick); addTime(); return; }
      const el = root.querySelector('#mg-time');
      if (el && !done()) el.textContent = fmtTime(d.elapsed + Date.now() - last);
    }, 500);

    const nextNum = () => { for (let k = 1; k <= n * n; k++) if (!d.cells.includes(k)) return k; return 0; };
    const sumOf = (l) => l.reduce((a, i) => a + d.cells[i], 0);

    const judge = () => {
      if (d.cells.includes(0)) return;
      if (isMagic(d.cells, n)) { d.solved = true; msg = ''; ctx.toast?.('성공! 모든 줄의 합이 같아요'); } else { d.checks++; msg = `다 채웠지만 합이 ${M}이 아닌 줄이 있어요 (-10점)`; ok = false; }
    };

    const draw = () => {
      const L = lines(n);
      const full = !d.cells.includes(0);
      const bad = new Set();
      if (full && !d.solved) L.forEach((l) => { if (sumOf(l) !== M) l.forEach((i) => bad.add(i)); });
      const rowSums = [...Array(n).keys()].map((r) => sumOf(L[r * 2]));
      const colSums = [...Array(n).keys()].map((c) => sumOf(L[c * 2 + 1]));
      const sumCls = (s) => (s === M ? 'ok' : s > M ? 'over' : '');
      root.innerHTML = `<section class="card mg-card">
        <div class="quiz-head"><b>${n}×${n} · 목표 합 ${M}</b><span class="muted">힌트 ${d.hints} · <span id="mg-time">${fmtTime(d.elapsed)}</span></span></div>
        ${d.solved ? `<div class="chess-status done">성공! ${scoreOf(d)}점 · ${fmtTime(d.elapsed)}</div>` : d.gaveUp ? '<div class="chess-status">포기했어요. 계단식 풀이를 보여 드려요.</div>' : `<div class="chess-status">다음 숫자 <span class="mg-next">${nextNum()}</span></div>`}
        <div class="mg-wrap" style="--n:${n}">
          <div class="mg-grid">${d.cells.map((v, i) => `<button class="mg-c ${i === fixed ? 'fixed' : ''} ${bad.has(i) ? 'bad' : ''} ${i === flash ? flashCls : ''} ${v && v === nextNum() - 1 ? 'last' : ''}" data-i="${i}" ${done() || i === fixed ? 'disabled' : ''}>${v || ''}</button>`).join('')}</div>
          <div class="mg-rs">${rowSums.map((s) => `<span class="${sumCls(s)}">${s}</span>`).join('')}</div>
          <div class="mg-cs">${colSums.map((s) => `<span class="${sumCls(s)}">${s}</span>`).join('')}</div>
        </div>
        <p class="muted center">오른쪽·아래 숫자는 줄마다 지금까지의 합이에요. 대각선 합 ${sumOf(L[2 * n])} · ${sumOf(L[2 * n + 1])}</p>
        <p class="quiz-msg ${ok ? 'ok' : 'no'}">${esc(msg)}</p>
        ${done() ? '' : `<div class="chess-actions">
          <button class="btn small" data-act="undo" ${undo.length ? '' : 'disabled'}>되돌리기</button>
          <button class="btn small" data-act="hint">힌트</button>
          <button class="btn small" data-act="reset">처음부터</button>
          <button class="btn small danger" data-act="giveup">포기</button></div>`}
        ${(d.solved || d.gaveUp) && !readonly ? '<button class="btn primary block" data-act="finish">전적에 기록</button>' : ''}
      </section>`;
    };

    root.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'finish') return ctx.finish({ ask: false });
      if (done()) return;
      flash = -1;
      if (act === 'undo') { const u = undo.pop(); if (!u) return; d.cells = u; msg = ''; save(); return draw(); }
      if (act === 'reset') {
        if (!confirm('1만 남기고 모두 지울까요?')) return;
        undo.push(d.cells.slice()); d.cells = d.cells.map((v, i) => (i === fixed ? 1 : 0)); msg = ''; save(); return draw();
      }
      if (act === 'hint') {
        const sol = siamese(n);
        const wrong = d.cells.map((v, i) => (v && sol[i] !== v ? i : -1)).filter((i) => i >= 0);
        d.hints++;
        if (wrong.length) {
          const first = wrong.sort((a, b) => d.cells[a] - d.cells[b])[0];
          flash = first; flashCls = 'hint-bad';
          msg = `${d.cells[first]}부터 계단식 풀이와 달라요 (-15점)`; ok = false;
        } else {
          const k = nextNum();
          flash = sol.indexOf(k); flashCls = 'hint';
          msg = `다음 숫자 ${k}의 자리가 반짝이고 있어요 (-15점)`; ok = true;
        }
        save(); return draw();
      }
      if (act === 'giveup') {
        if (!confirm('포기하고 풀이를 볼까요? 점수는 0점이에요.')) return;
        addTime(); d.gaveUp = true; d.cells = siamese(n); ctx.save(); return draw();
      }
      if (b.dataset.i == null) return;
      const i = Number(b.dataset.i);
      if (i === fixed) return;
      undo.push(d.cells.slice());
      if (d.cells[i]) { d.cells[i] = 0; msg = ''; } else {
        const k = nextNum();
        if (!k) return;
        d.cells[i] = k; msg = '';
        judge();
      }
      save(); draw();
    };
    draw();
  },
};
