// 도구: 선 뽑기 · 타이머 · 주사위/코인. 모두 이 기기 안에서만 동작하고 저장하지 않음
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = (n) => Math.floor(Math.random() * n);
const TABS = [['pick', '선 뽑기'], ['timer', '타이머'], ['dice', '주사위·코인']];
const COLORS = ['#b8452f', '#2f6f9f', '#3d7a4a', '#c08a1e', '#7a4b8c', '#1d2a3a', '#d0627a', '#2b8a8a', '#8a5a2b', '#5a6b7d'];

// 화면을 옮겨도 남는 상태 (도구 탭 사이를 오가도 유지)
const st = {
  pickMode: 'finger', picked: [],
  sand: { total: 60, left: 60, run: false, at: 0 },
  clock: { names: [], per: 0, times: [], cur: 0, run: false, at: 0 },
  dice: { n: 5, sides: 6, vals: [], held: [], hist: [] },
  coin: null, cel: { n: 2, vals: [] },
};
let timers = [];
const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(() => clearTimeout(t)); };
const every = (fn, ms) => { const t = setInterval(fn, ms); timers.push(() => clearInterval(t)); };
const stopAll = () => { timers.forEach((f) => f()); timers = []; };

// 알림음 + 진동
function beep(times = 3) {
  try { navigator.vibrate?.([300, 120, 300, 120, 300]); } catch { /* 지원 안 함 */ }
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = ac.createOscillator(); const gn = ac.createGain();
      o.frequency.value = 880; o.connect(gn); gn.connect(ac.destination);
      const t0 = ac.currentTime + i * 0.35;
      gn.gain.setValueAtTime(0.25, t0); gn.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
      o.start(t0); o.stop(t0 + 0.26);
    }
  } catch { /* 소리 안 남 */ }
}
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export async function viewTools($app, { store, tab }) {
  stopAll();
  addEventListener('hashchange', stopAll, { once: true });
  const cur = TABS.some(([k]) => k === tab) ? tab : 'pick';
  const players = await store.listPlayers().catch(() => []);
  $app.innerHTML = `<section class="card tools">
    <h2>도구</h2>
    <div class="seg">${TABS.map(([k, l]) => `<a class="${k === cur ? 'on' : ''}" href="#/tools/${k}">${l}</a>`).join('')}</div>
    <div id="tool"></div>
  </section>`;
  const root = $app.querySelector('#tool');
  if (cur === 'pick') pickTool(root, players);
  else if (cur === 'timer') timerTool(root, players);
  else diceTool(root);
}

// ───── 선 뽑기 ─────
function pickTool(root, players) {
  const draw = () => {
    root.innerHTML = `<div class="chips">
        <button class="chip ${st.pickMode === 'finger' ? 'on' : ''}" data-mode="finger">손가락으로</button>
        <button class="chip ${st.pickMode === 'list' ? 'on' : ''}" data-mode="list">명단에서</button>
      </div>
      ${st.pickMode === 'finger' ? `<div class="finger-pad" id="pad"><p class="muted">다 같이 화면에 손가락을 올리고 기다리세요.<br>잠시 뒤 한 명이 뽑혀요.</p></div>`
      : `<p class="muted">뽑을 사람을 고르고 돌리기를 누르세요.</p>
        <div class="chips" id="names">${players.map((p) => `<button class="chip ${st.picked.includes(p.id) ? 'on' : ''}" data-p="${p.id}">${esc(p.name)}</button>`).join('') || '<span class="muted">참가자 탭에서 참가자를 먼저 추가해 주세요.</span>'}</div>
        <div class="roulette" id="rl">${st.picked.map((id) => `<span data-r="${id}">${esc(players.find((p) => p.id === id)?.name)}</span>`).join('')}</div>
        <button class="btn primary block" id="spin" ${st.picked.length < 2 ? 'disabled' : ''}>돌리기</button>`}`;
    if (st.pickMode === 'finger') finger(root.querySelector('#pad'));
  };
  root.onclick = (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) { stopAll(); st.pickMode = m.dataset.mode; draw(); return; }
    const p = e.target.closest('[data-p]');
    if (p) { const id = p.dataset.p; st.picked = st.picked.includes(id) ? st.picked.filter((x) => x !== id) : [...st.picked, id]; draw(); return; }
    if (e.target.id === 'spin') spin(root);
  };
  if (!st.picked.length) st.picked = players.map((p) => p.id);
  draw();
}

function spin(root) {
  const items = [...root.querySelectorAll('[data-r]')];
  if (items.length < 2) return;
  root.querySelector('#spin').disabled = true;
  const target = rand(items.length);
  const steps = items.length * 3 + target;
  let i = 0;
  const tick = () => {
    items.forEach((el, j) => el.classList.toggle('on', j === i % items.length));
    if (i >= steps) { items[target].classList.add('win'); root.querySelector('#spin').disabled = false; return; }
    i++;
    later(tick, 50 + (i / steps) ** 3 * 350); // 점점 느려짐
  };
  items.forEach((el) => el.classList.remove('win'));
  tick();
}

function finger(pad) {
  const touches = new Map(); // pointerId → { x, y, color, el }
  let wait = null; let done = false;
  const used = new Set();
  const place = (t) => { t.el.style.left = t.x + 'px'; t.el.style.top = t.y + 'px'; };
  const restart = () => {
    if (wait) { wait(); wait = null; }
    pad.classList.toggle('active', touches.size > 0);
    if (done || touches.size < 2) return;
    const t = setTimeout(() => {
      done = true;
      const ids = [...touches.keys()];
      const win = touches.get(ids[rand(ids.length)]);
      touches.forEach((x) => x.el.classList.add(x === win ? 'win' : 'lose'));
      try { navigator.vibrate?.(200); } catch { /* */ }
    }, 2200);
    wait = () => clearTimeout(t);
    timers.push(wait);
  };
  const pos = (e) => { const r = pad.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  pad.onpointerdown = (e) => {
    e.preventDefault();
    if (done) return;
    const color = COLORS.find((c) => !used.has(c)) || COLORS[rand(COLORS.length)];
    used.add(color);
    const el = document.createElement('span'); el.className = 'finger'; el.style.background = color;
    pad.appendChild(el);
    const t = { ...pos(e), color, el };
    place(t); touches.set(e.pointerId, t);
    try { pad.setPointerCapture(e.pointerId); } catch { /* */ }
    restart();
  };
  pad.onpointermove = (e) => { const t = touches.get(e.pointerId); if (t) { Object.assign(t, pos(e)); place(t); } };
  const up = (e) => {
    const t = touches.get(e.pointerId); if (!t) return;
    touches.delete(e.pointerId);
    if (!done) { t.el.remove(); used.delete(t.color); restart(); }
    if (!touches.size && done) later(() => { pad.querySelectorAll('.finger').forEach((x) => x.remove()); done = false; used.clear(); pad.classList.remove('active'); }, 600);
  };
  pad.onpointerup = up; pad.onpointercancel = up;
}

// ───── 타이머 ─────
function timerTool(root, players) {
  const S = st.sand; const C = st.clock;
  if (!C.names.length) C.names = players.slice(0, 4).map((p) => p.name);
  const sandLeft = () => (S.run ? S.left - (Date.now() - S.at) : S.left);
  const clockNow = () => C.times.map((t, i) => (C.run && i === C.cur ? t + (Date.now() - C.at) : t));
  const draw = () => {
    const ct = clockNow();
    root.innerHTML = `<h3>모래시계</h3>
      <div class="chips">${[30, 60, 120, 180, 300].map((s) => `<button class="chip ${S.total === s ? 'on' : ''}" data-sand="${s}">${s < 60 ? s + '초' : s / 60 + '분'}</button>`).join('')}
        <label class="chip ghost">직접 <input type="number" id="sandMin" min="1" max="99" placeholder="분" style="width:56px;padding:2px 4px"></label></div>
      <div class="big-time ${sandLeft() <= 0 ? 'over' : ''}" id="sandT">${mmss(sandLeft())}</div>
      <div class="bar"><span id="sandBar" style="width:${Math.max(0, sandLeft() / (S.total * 1000)) * 100}%"></span></div>
      <div class="row-btns"><button class="btn primary" data-act="sand">${S.run ? '멈춤' : sandLeft() <= 0 ? '다시' : '시작'}</button><button class="btn" data-act="sandReset">처음으로</button></div>

      <h3 class="sub-h">턴 시계</h3>
      <p class="muted">화면을 누르면 다음 사람으로 넘어가요. 1인당 제한 시간을 정하면 남은 시간이, 0이면 쓴 시간이 보여요.</p>
      <div class="chips">${players.map((p) => `<button class="chip ${C.names.includes(p.name) ? 'on' : ''}" data-cn="${esc(p.name)}">${esc(p.name)}</button>`).join('')}</div>
      <label class="setting">1인당 제한(분) <input type="number" id="per" min="0" max="120" value="${C.per}"></label>
      ${C.names.length ? `<button class="turn-pad ${C.run ? 'run' : ''}" data-act="next">
          <span class="who">${esc(C.names[C.cur] || '')}</span>
          <span class="big-time ${C.per && C.per * 60000 - ct[C.cur] <= 0 ? 'over' : ''}" id="clockT">${mmss(C.per ? C.per * 60000 - ct[C.cur] : ct[C.cur])}</span>
          <small>${C.run ? '누르면 다음 사람' : '누르면 시작'}</small></button>
        <div class="clock-list">${C.names.map((n, i) => `<span class="${i === C.cur ? 'on' : ''}">${esc(n)} <b>${mmss(C.per ? C.per * 60000 - ct[i] : ct[i])}</b></span>`).join('')}</div>
        <div class="row-btns"><button class="btn" data-act="clockPause" ${C.run ? '' : 'disabled'}>멈춤</button><button class="btn" data-act="clockReset">처음으로</button></div>` : '<p class="muted">사람을 골라 주세요.</p>'}`;
  };
  const resetClock = () => { C.times = C.names.map(() => 0); C.cur = 0; C.run = false; };
  if (C.times.length !== C.names.length) resetClock();
  let alerted = sandLeft() <= 0;
  const alertedClock = new Set();
  every(() => {
    const t = root.querySelector('#sandT');
    if (S.run && t) {
      const l = sandLeft();
      t.textContent = mmss(l); root.querySelector('#sandBar').style.width = Math.max(0, l / (S.total * 1000)) * 100 + '%';
      if (l <= 0 && !alerted) { alerted = true; S.run = false; S.left = 0; beep(); draw(); }
    }
    const c = root.querySelector('#clockT');
    if (C.run && c) {
      const ct = clockNow();
      const v = C.per ? C.per * 60000 - ct[C.cur] : ct[C.cur];
      c.textContent = mmss(v);
      root.querySelectorAll('.clock-list b')[C.cur].textContent = mmss(v);
      if (C.per && v <= 0 && !alertedClock.has(C.cur)) { alertedClock.add(C.cur); c.classList.add('over'); beep(2); }
    }
  }, 200);
  root.onclick = (e) => {
    const b = e.target.closest('[data-sand],[data-act],[data-cn]');
    if (!b) return;
    if (b.dataset.sand) { S.total = Number(b.dataset.sand); S.left = S.total * 1000; S.run = false; alerted = false; return draw(); }
    if (b.dataset.cn != null) { const n = b.dataset.cn; C.names = C.names.includes(n) ? C.names.filter((x) => x !== n) : [...C.names, n]; resetClock(); alertedClock.clear(); return draw(); }
    const a = b.dataset.act;
    if (a === 'sand') {
      if (S.run) { S.left = sandLeft(); S.run = false; } else { if (S.left <= 0) S.left = S.total * 1000; S.at = Date.now(); S.run = true; alerted = false; }
      draw();
    } else if (a === 'sandReset') { S.left = S.total * 1000; S.run = false; alerted = false; draw(); }
    else if (a === 'next') {
      if (C.run) { C.times[C.cur] += Date.now() - C.at; C.cur = (C.cur + 1) % C.names.length; }
      C.at = Date.now(); C.run = true; draw();
    } else if (a === 'clockPause') { if (C.run) { C.times[C.cur] += Date.now() - C.at; C.run = false; } draw(); }
    else if (a === 'clockReset') { resetClock(); alertedClock.clear(); draw(); }
  };
  root.onchange = (e) => {
    if (e.target.id === 'sandMin') { const m = Math.max(1, Math.min(99, Number(e.target.value) || 1)); S.total = m * 60; S.left = S.total * 1000; S.run = false; alerted = false; draw(); }
    if (e.target.id === 'per') { C.per = Math.max(0, Math.min(120, Number(e.target.value) || 0)); alertedClock.clear(); draw(); }
  };
  if (S.left == null || S.left === 60) S.left = S.total * 1000;
  draw();
}

// ───── 주사위 · 코인 · 셀레스티아 주사위 ─────
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export const dieFace = (v, sides = 6) => (sides === 6 && v >= 1 && v <= 6
  ? `<span class="pips">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'on' : ''}"></i>`).join('')}</span>`
  : `<b>${v ?? '?'}</b>`);
// 셀레스티아 위험 주사위: 6면 중 4면에 위험 그림, 2면은 빈 면 (가지고 있는 판본과 다르면 알려 주세요)
const CEL_FACES = ['', '', '먹구름', '번개', '새떼', '해적'];

function diceTool(root) {
  const D = st.dice;
  const draw = () => {
    const total = D.vals.reduce((a, b) => a + b, 0);
    root.innerHTML = `<h3>주사위</h3>
      <div class="dice-opts">
        <div class="chips">${[1, 2, 3, 4, 5, 6].map((n) => `<button class="chip ${D.n === n ? 'on' : ''}" data-n="${n}">${n}개</button>`).join('')}</div>
        <div class="chips">${[4, 6, 8, 10, 12, 20].map((s) => `<button class="chip ${D.sides === s ? 'on' : ''}" data-s="${s}">d${s}</button>`).join('')}</div>
      </div>
      <div class="dice-tray">${Array.from({ length: D.n }, (_, i) => `<button class="die ${D.held[i] ? 'held' : ''} ${D.sides !== 6 ? 'num' : ''}" data-hold="${i}" ${D.vals[i] == null ? 'disabled' : ''}>${dieFace(D.vals[i], D.sides)}</button>`).join('')}</div>
      <p class="center dice-sum">${D.vals.length ? `합계 <b>${total}</b>` : '<span class="muted">굴리기를 누르세요</span>'}${D.held.some(Boolean) ? ' <span class="muted">· 고정한 주사위는 그대로</span>' : ''}</p>
      <div class="row-btns"><button class="btn primary" data-act="roll">굴리기</button><button class="btn" data-act="free" ${D.held.some(Boolean) ? '' : 'disabled'}>고정 풀기</button></div>
      <p class="muted">굴린 뒤 주사위를 누르면 고정돼요.</p>
      ${D.hist.length ? `<div class="hist muted">최근: ${D.hist.map((h) => h.join('·')).join(' / ')}</div>` : ''}

      <h3 class="sub-h">코인</h3>
      <button class="coin ${st.coin ? 'c-' + st.coin : ''}" data-act="coin"><span>${st.coin === 'h' ? '앞' : st.coin === 't' ? '뒤' : '?'}</span></button>
      <p class="center muted">동전을 누르면 던져요.</p>

      <h3 class="sub-h">셀레스티아 위험 주사위</h3>
      <div class="chips">${[1, 2, 3, 4].map((n) => `<button class="chip ${st.cel.n === n ? 'on' : ''}" data-cel="${n}">${n}개</button>`).join('')}</div>
      <div class="dice-tray">${Array.from({ length: st.cel.n }, (_, i) => { const v = st.cel.vals[i]; return `<span class="die cel ${v ? 'hit' : ''}">${v == null ? '?' : v || '빈 면'}</span>`; }).join('')}</div>
      <div class="row-btns"><button class="btn primary" data-act="cel">굴리기</button></div>
      <p class="muted">도시 칸에 적힌 수만큼 굴려요. 나온 위험마다 선장이 맞는 장비 카드를 내야 해요.</p>`;
  };
  const animate = (apply, sel) => {
    let k = 0;
    const tick = () => {
      apply(k >= 6);
      draw();
      root.querySelectorAll(sel).forEach((el) => el.classList.toggle('rolling', k < 6));
      if (k++ < 6) later(tick, 60);
    };
    tick();
  };
  root.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.n) { D.n = Number(b.dataset.n); D.vals = []; D.held = []; return draw(); }
    if (b.dataset.s) { D.sides = Number(b.dataset.s); D.vals = []; D.held = []; return draw(); }
    if (b.dataset.cel) { st.cel.n = Number(b.dataset.cel); st.cel.vals = []; return draw(); }
    if (b.dataset.hold != null) { const i = Number(b.dataset.hold); D.held[i] = !D.held[i]; return draw(); }
    const a = b.dataset.act;
    if (a === 'roll') {
      animate((last) => {
        D.vals = Array.from({ length: D.n }, (_, i) => (D.held[i] && D.vals[i] != null ? D.vals[i] : 1 + rand(D.sides)));
        if (last) { D.hist = [D.vals.slice(), ...D.hist].slice(0, 6); }
      }, '.die:not(.held):not(.cel)');
    } else if (a === 'free') { D.held = []; draw(); }
    else if (a === 'coin') { animate((last) => { st.coin = last ? (rand(2) ? 'h' : 't') : (st.coin === 'h' ? 't' : 'h'); }, '.coin'); }
    else if (a === 'cel') { animate(() => { st.cel.vals = Array.from({ length: st.cel.n }, () => CEL_FACES[rand(6)]); }, '.die.cel'); }
  };
  draw();
}
