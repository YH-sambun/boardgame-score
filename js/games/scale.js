// 저울 추리: 무게를 모르는 색깔 큐브들을 양팔 저울로 비교해서, 가벼운 순서대로 맞히는 퍼즐
//  저울을 적게 쓸수록 점수가 높음. 한쪽 접시에 여러 개를 올려 합을 비교해도 됨
// session.data = { n, w:[무게], logs:[{ L:[큐브], R:[큐브], res:-1|0|1 }], tries, solved, gaveUp, elapsed }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CUBES = [
  { c: '#d8342c', name: '빨강' }, { c: '#f2c200', name: '노랑' }, { c: '#2453b8', name: '파랑' },
  { c: '#2f8a4c', name: '초록' }, { c: '#7a4b8c', name: '보라' }, { c: '#e07a1f', name: '주황' },
];
const LETTERS = 'ABCDEF';
// 큐브 n개를 비교로 정렬하는 데 필요한 최소 횟수 (이보다 적게 쓰면 보너스)
export const PAR = { 4: 5, 5: 7, 6: 10 };
const fmtTime = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export const scoreOf = (d) => (!d.solved ? 0 : Math.max(10, 100 + (d.n - 4) * 50 - Math.max(0, d.logs.length - PAR[d.n]) * 10 - (d.tries - 1) * 20));

export default {
  id: 'scale',
  name: '저울 추리',
  guide: {
    players: '1명', time: '5~10분',
    intro: '색깔 큐브들의 무게가 모두 달라요. 양팔 저울로 비교해서 가벼운 것부터 무거운 순서를 맞히는 추리 퍼즐이에요. 저울을 적게 쓸수록 점수가 높아요.',
    rules: [
      '큐브를 누를 때마다 왼쪽 접시 → 오른쪽 접시 → 내리기 순서로 바뀌어요. 한 접시에 여러 개를 올려도 돼요.',
      '"달기"를 누르면 어느 쪽이 무거운지(또는 같은지) 알려 줘요. 잰 결과는 아래 기록에 남아요.',
      '순서를 알았으면 아래 "정답 순서"에 가벼운 큐브부터 차례로 누르고 "제출"하세요.',
      '틀리면 20점을 빼고 다시 도전할 수 있어요. 포기하면 정답을 보여 줘요.',
    ],
    scoring: ['기본 점수는 큐브 4개 100점, 5개 150점, 6개 200점이에요.', '저울을 최소 횟수(4개 5번, 5개 7번, 6개 10번)보다 더 쓰면 한 번에 10점, 틀린 제출 한 번에 20점을 빼요(최소 10점).'],
    tips: [
      '먼저 두 개씩 짝을 지어 재고, 이긴 것끼리 다시 재면 가장 무거운 큐브를 빨리 찾아요.',
      '여러 개를 같이 올리면 한 번에 더 많은 걸 알 수도 있어요. 예를 들어 A+B < C 이면 C는 A와 B보다 무거워요.',
      '기록을 보면서 아직 비교하지 않은 짝만 재세요.',
    ],
  },
  minPlayers: 1,
  maxPlayers: 1,
  pickHint: '혼자 푸는 퍼즐이에요. 푸는 사람 1명을 고르세요.',
  settingsFields: [
    { key: 'n', label: '큐브 수', default: 5, options: [{ value: 4, label: '4개 (쉬움)' }, { value: 5, label: '5개 (보통)' }, { value: 6, label: '6개 (어려움)' }] },
  ],
  roundLabel: '퍼즐',

  initData(players, settings) {
    const n = Number(settings?.n ?? 5);
    const pool = [...Array(12).keys()].map((x) => x + 1);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return { n, w: pool.slice(0, n), logs: [], tries: 0, solved: false, gaveUp: false, elapsed: 0 };
  },
  computeTotals(session) { return [scoreOf(session.data)]; },
  incompleteCount(session) { return session.data.solved || session.data.gaveUp ? 0 : 1; },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const readonly = session.status === 'finished';
    const done = () => d.solved || d.gaveUp || readonly;
    const pan = Array(d.n).fill(0); // 0 내림, 1 왼쪽, 2 오른쪽
    let answer = [];
    let msg = ''; let ok = false;
    let last = Date.now();
    const addTime = () => { const now = Date.now(); if (!done()) d.elapsed += now - last; last = now; };
    const save = () => { addTime(); ctx.save(); };
    const tick = setInterval(() => {
      if (!root.isConnected) { clearInterval(tick); addTime(); return; }
      const el = root.querySelector('#sc-time');
      if (el && !done()) el.textContent = fmtTime(d.elapsed + Date.now() - last);
    }, 500);

    const cube = (i, extra = '') => `<span class="sc-cube" style="--c:${CUBES[i].c}" aria-label="${CUBES[i].name}">${LETTERS[i]}${extra}</span>`;
    const side = (xs) => xs.map((i) => cube(i)).join('') || '<span class="muted">빈 접시</span>';
    const sym = (r) => (r < 0 ? '<' : r > 0 ? '>' : '=');

    const draw = () => {
      const L = pan.map((v, i) => (v === 1 ? i : -1)).filter((i) => i >= 0);
      const R = pan.map((v, i) => (v === 2 ? i : -1)).filter((i) => i >= 0);
      const lastLog = d.logs[d.logs.length - 1];
      const tilt = lastLog ? lastLog.res : 0;
      const sorted = [...Array(d.n).keys()].sort((a, b) => d.w[a] - d.w[b]);
      root.innerHTML = `<section class="card sc-card">
        <div class="quiz-head"><b>큐브 ${d.n}개</b><span class="muted">저울 ${d.logs.length}번 (최소 ${PAR[d.n]}번) · 제출 ${d.tries}번 · <span id="sc-time">${fmtTime(d.elapsed)}</span></span></div>
        ${d.solved ? `<div class="chess-status done">정답! ${scoreOf(d)}점</div>` : d.gaveUp ? '<div class="chess-status">포기했어요. 정답을 보여 드려요.</div>' : ''}
        <div class="sc-scale tilt${tilt}"><div class="sc-beam"></div>
          <div class="sc-pan l">${lastLog ? side(lastLog.L) : ''}</div><div class="sc-pan r">${lastLog ? side(lastLog.R) : ''}</div></div>
        ${done() ? `<p class="center">가벼운 순서: ${sorted.map((i) => cube(i, `<small>${d.w[i]}</small>`)).join(' ')}</p>` : `
        <p class="muted center">큐브를 눌러 접시에 올리세요 (왼쪽 → 오른쪽 → 내리기)</p>
        <div class="sc-cubes">${[...Array(d.n).keys()].map((i) => `<button class="sc-pick p${pan[i]}" data-c="${i}">${cube(i)}<small>${['', '왼쪽', '오른쪽'][pan[i]]}</small></button>`).join('')}</div>
        <div class="chess-actions"><button class="btn primary small" data-act="weigh" ${L.length && R.length ? '' : 'disabled'}>달기</button><button class="btn small" data-act="clear">접시 비우기</button></div>
        <h3 class="sc-h">정답 순서 <small class="muted">가벼운 것부터 누르세요</small></h3>
        <div class="sc-answer">${answer.map((i) => cube(i)).join('') || '<span class="muted">아직 없음</span>'}</div>
        <div class="sc-cubes">${[...Array(d.n).keys()].map((i) => `<button class="sc-pick" data-a="${i}" ${answer.includes(i) ? 'disabled' : ''}>${cube(i)}</button>`).join('')}</div>
        <div class="chess-actions"><button class="btn small" data-act="back" ${answer.length ? '' : 'disabled'}>하나 지우기</button><button class="btn primary small" data-act="submit" ${answer.length === d.n ? '' : 'disabled'}>제출</button><button class="btn small danger" data-act="giveup">포기</button></div>`}
        <p class="quiz-msg ${ok ? 'ok' : 'no'}">${esc(msg)}</p>
        ${d.logs.length ? `<div class="sc-log">${d.logs.map((l, k) => `<div><span class="muted">${k + 1}</span> ${side(l.L)} <b>${sym(l.res)}</b> ${side(l.R)}</div>`).join('')}</div>` : ''}
        ${(d.solved || d.gaveUp) && !readonly ? '<button class="btn primary block" data-act="finish">전적에 기록</button>' : ''}
      </section>`;
    };

    root.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'finish') return ctx.finish({ ask: false });
      if (done()) return;
      if (b.dataset.c != null) { const i = Number(b.dataset.c); pan[i] = (pan[i] + 1) % 3; return draw(); }
      if (b.dataset.a != null) { const i = Number(b.dataset.a); if (!answer.includes(i)) answer.push(i); return draw(); }
      if (act === 'clear') { pan.fill(0); return draw(); }
      if (act === 'back') { answer.pop(); return draw(); }
      if (act === 'weigh') {
        const L = pan.map((v, i) => (v === 1 ? i : -1)).filter((i) => i >= 0);
        const R = pan.map((v, i) => (v === 2 ? i : -1)).filter((i) => i >= 0);
        if (!L.length || !R.length) return;
        const sum = (xs) => xs.reduce((a, i) => a + d.w[i], 0);
        const res = Math.sign(sum(R) - sum(L)) * -1; // 왼쪽이 무거우면 1
        d.logs.push({ L, R, res });
        msg = res > 0 ? '왼쪽이 무거워요' : res < 0 ? '오른쪽이 무거워요' : '무게가 같아요'; ok = true;
        save(); return draw();
      }
      if (act === 'submit') {
        if (answer.length !== d.n) return;
        d.tries++;
        const right = answer.every((i, k) => k === 0 || d.w[answer[k - 1]] < d.w[i]);
        if (right) { d.solved = true; msg = ''; } else { msg = '순서가 틀렸어요. 20점을 빼고 다시 도전해 보세요'; ok = false; answer = []; }
        save(); draw();
        if (right) ctx.toast?.('정답이에요');
        return;
      }
      if (act === 'giveup') {
        if (!confirm('포기하고 정답을 볼까요? 점수는 0점이에요.')) return;
        addTime(); d.gaveUp = true; ctx.save(); return draw();
      }
    };
    draw();
  },
};
