// 윷놀이: 한 기기에서 번갈아 (2~4명, 각자 말 2~4개)
//  윷 던지기 → 윷·모가 나오면 한 번 더. 다 던진 뒤 나온 결과를 하나씩 골라 말을 움직임.
//  모서리(오른쪽 위·왼쪽 위)와 가운데에 정확히 멈추면 다음 이동은 지름길로. 출발점에 도착하거나 지나면 완주.
//  내 말끼리 같은 칸이면 업혀서 함께 움직이고, 상대 말이 있는 칸에 멈추면 잡아서 집으로 보내고 한 번 더 던짐.
// session.data = { pieces:[[{ pos, line, steps:[{pos,line}] }]], turn, pending:[값], canThrow, sticks, catches:[], caught:[], winner, log }
//  pos: 'H'(대기) | 'E'(완주) | 'O0'~'O19' | 'A1'.. | 'B1'.. | 'C', line: 'O' | 'A' | 'B'
//  혼자 고르면 컴퓨터 1~3명과 함께 (settings.cpus, cpuLevel). 컴퓨터 차례는 자동으로 던지고 움직임
import { isCpu, levelField, cpuPlayers, levelOf, LEVEL_NAMES, wait } from './cpu.js?v=202611121529';
import { chooseMove } from './yut-ai.js?v=202611121529';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const NAMES = { '-1': '빽도', 1: '도', 2: '개', 3: '걸', 4: '윷', 5: '모' };
const COLORS = ['#c0392b', '#2f6f9f', '#3d7a4a', '#c08a1e'];

// 칸 좌표 (0~100)
export const POS = (() => {
  const p = { O0: [100, 100] };
  for (let k = 1; k <= 5; k++) p['O' + k] = [100, 100 - k * 20];
  for (let k = 6; k <= 10; k++) p['O' + k] = [100 - (k - 5) * 20, 0];
  for (let k = 11; k <= 15; k++) p['O' + k] = [0, (k - 10) * 20];
  for (let k = 16; k <= 19; k++) p['O' + k] = [(k - 15) * 20, 100];
  const t = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  p.A1 = t([100, 0], [0, 100], 1 / 6); p.A2 = t([100, 0], [0, 100], 2 / 6); p.C = [50, 50];
  p.A3 = t([100, 0], [0, 100], 4 / 6); p.A4 = t([100, 0], [0, 100], 5 / 6);
  p.B1 = t([0, 0], [100, 100], 1 / 6); p.B2 = t([0, 0], [100, 100], 2 / 6);
  p.B3 = t([0, 0], [100, 100], 4 / 6); p.B4 = t([0, 0], [100, 100], 5 / 6);
  return p;
})();

// 한 칸 앞으로 (first: 이번 이동의 첫 걸음 → 모서리·가운데에서 지름길)
function stepFwd(pos, line, first) {
  if (first && pos === 'O5') return ['A1', 'A'];
  if (first && pos === 'O10') return ['B1', 'B'];
  if (first && pos === 'C') return ['B3', 'B'];
  if (pos === 'H') return ['O1', 'O'];
  if (pos === 'O0' || pos === 'O19') return ['E', 'O'];
  if (pos[0] === 'O') return ['O' + (Number(pos.slice(1)) + 1), 'O'];
  const seqA = ['A1', 'A2', 'C', 'A3', 'A4'];
  const seqB = ['B1', 'B2', 'C', 'B3', 'B4'];
  const seq = line === 'A' ? seqA : seqB;
  const i = seq.indexOf(pos);
  if (i < seq.length - 1) return [seq[i + 1], line];
  return line === 'A' ? ['O15', 'O'] : ['E', 'B'];
}

// 말 하나가 n 칸(빽도 -1) 갔을 때의 결과 (실제로 바꾸지 않음)
export function moveResult(pc, n) {
  if (n === -1) {
    if (pc.pos === 'H' || pc.pos === 'E') return null;
    const st = pc.steps.slice();
    const prev = st.pop() || { pos: 'O0', line: 'O' };
    return { pos: prev.pos === 'H' ? 'O0' : prev.pos, line: prev.line, steps: st };
  }
  if (pc.pos === 'E') return null;
  let { pos, line } = pc; const steps = pc.steps.slice();
  for (let s = 0; s < n && pos !== 'E'; s++) { steps.push({ pos, line }); [pos, line] = stepFwd(pos, line, s === 0); }
  return { pos, line, steps };
}

// 윷가락 4개: true = 배(평평한 면). 0번 가락에 빽도 표시
function throwSticks(backdo) {
  const sticks = Array.from({ length: 4 }, () => Math.random() < 0.5);
  const flat = sticks.filter(Boolean).length;
  const v = flat === 0 ? 5 : flat === 1 && backdo && sticks[0] ? -1 : flat;
  return { sticks, v };
}

const allHome = (ps) => ps.every((p) => p.pos === 'E');

export default {
  id: 'yut',
  name: '윷놀이',
  guide: {
    players: '1~4명 (1명이면 컴퓨터와)', time: '15~30분',
    intro: '윷가락 네 개를 던져 나온 만큼 말을 움직여, 말판을 한 바퀴 돌아 모든 말을 먼저 들여보내는 사람이 이기는 전통 놀이예요. 한 폰으로 번갈아 던지거나, 혼자면 컴퓨터와 해요.',
    rules: [
      '던지기를 누르면 윷가락 네 개가 떨어져요. 배(평평한 면)가 1개 도(1칸), 2개 개(2칸), 3개 걸(3칸), 4개 윷(4칸), 모두 등이면 모(5칸).',
      '윷이나 모가 나오면 한 번 더 던져요. 다 던진 뒤 나온 결과를 하나씩 골라 말을 움직여요.',
      '빽도를 켜면 표시된 가락 하나만 배일 때 빽도로 한 칸 뒤로 가요. 판에 말이 없으면 버려요.',
      '오른쪽 위·왼쪽 위 모서리나 가운데에 딱 멈추면 다음에 지름길(대각선)로 가요.',
      '내 말끼리 같은 칸에 서면 업혀서 같이 움직여요. 상대 말이 있는 칸에 멈추면 잡아서 집으로 보내고 한 번 더 던져요.',
      '출발점(오른쪽 아래)에 도착하거나 지나가면 그 말은 완주예요. 모든 말을 먼저 완주시키면 이겨요.',
      '혼자 고르면 컴퓨터(1~3명)와 해요. 컴퓨터 차례에는 컴퓨터가 알아서 던지고 말을 옮겨요.',
    ],
    scoring: ['처음으로 모든 말을 완주시킨 사람이 1등이에요. 나머지는 완주한 말 수로 순위를 정해요.', '잡은 횟수와 잡힌 횟수는 업적에 반영돼요.', '컴퓨터는 전적 목록에 나오지 않아요.'],
    tips: [
      '모서리에 정확히 멈추면 지름길로 훨씬 빨리 돌아요. 모서리 앞 한두 칸에서는 도·개를 아껴 두세요.',
      '업으면 빠르지만 한 번 잡히면 업힌 말이 다 집으로 가요.',
      '상대 말 바로 뒤 1~3칸은 잡히기 쉬운 자리예요.',
    ],
  },
  minPlayers: 1,
  maxPlayers: 4,
  pickHint: '참가자를 순서대로 눌러 주세요 (2~4명). 누른 순서가 자리 순서가 됩니다. 1명만 고르면 컴퓨터와 해요.',
  settingsFields: [
    { key: 'pieces', label: '말 수', default: 4, options: [{ value: 2, label: '2개' }, { value: 3, label: '3개' }, { value: 4, label: '4개' }] },
    { key: 'backdo', label: '빽도', default: true, options: [{ value: true, label: '있음' }, { value: false, label: '없음' }] },
    { key: 'cpus', label: '컴퓨터 수', default: 1, show: ({ count }) => count === 1, options: [1, 2, 3].map((n) => ({ value: n, label: `${n}명` })) },
    levelField(),
  ],
  // 1명만 고르면 컴퓨터를 뒤에 추가
  preparePlayers(ps, settings) {
    return ps.length === 1 ? [...ps, ...cpuPlayers(Math.max(1, Math.min(3, settings?.cpus || 1)))] : ps;
  },
  roundLabel: '판',

  initData(players, settings) {
    const k = settings?.pieces || 4;
    return {
      pieces: players.map(() => Array.from({ length: k }, () => ({ pos: 'H', line: 'O', steps: [] }))),
      turn: 0, pending: [], canThrow: true, sticks: null, catches: players.map(() => 0), caught: players.map(() => 0), winner: null, log: [],
    };
  },
  computeTotals(session) {
    const d = session.data;
    return d.pieces.map((ps, i) => ps.filter((p) => p.pos === 'E').length + (d.winner === i ? 0.5 : 0));
  },
  totalLabel(t) { return `${Math.floor(t)}개 완주`; },
  incompleteCount(session) { return session.data.winner == null ? 1 : 0; },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const players = session.players;
    const backdo = session.settings?.backdo !== false;
    const done = () => d.winner != null || session.status === 'finished';
    let sel = 0; // 고른 결과 위치
    let undo = []; // 이번 차례 무르기용
    let rolling = false;
    const cpuSeat = players.map(isCpu);
    const hasCpu = cpuSeat.some(Boolean);
    const level = levelOf(session);
    let cpuBusy = false;
    const cpuTurn = () => cpuSeat[d.turn] && !done();

    const snapshot = () => JSON.stringify({ pieces: d.pieces, pending: d.pending, canThrow: d.canThrow, catches: d.catches, caught: d.caught, log: d.log });
    const nextTurn = () => {
      d.turn = (d.turn + 1) % players.length;
      d.pending = []; d.canThrow = true; sel = 0; undo = [];
    };
    const onBoard = (pi) => d.pieces[pi].some((p) => p.pos !== 'H' && p.pos !== 'E');

    const stickSvg = (flat, mark) => `<svg viewBox="0 0 20 80" class="stick ${flat ? 'flat' : ''}"><rect x="2" y="2" width="16" height="76" rx="8"/>${flat ? (mark ? '<path d="M6 34 L14 46 M14 34 L6 46" stroke="#7a1d12" stroke-width="2"/>' : '') : '<path d="M7 14 v52 M13 14 v52" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>'}</svg>`;

    const board = () => {
      const lines = [['O0', 'O5'], ['O5', 'O10'], ['O10', 'O15'], ['O15', 'O0'], ['O5', 'O15'], ['O10', 'O0']]
        .map(([a, b]) => `<line x1="${POS[a][0]}" y1="${POS[a][1]}" x2="${POS[b][0]}" y2="${POS[b][1]}"/>`).join('');
      const big = new Set(['O0', 'O5', 'O10', 'O15', 'C']);
      const spots = Object.entries(POS).map(([k, [x, y]]) => `<circle class="spot ${big.has(k) ? 'big' : ''}" cx="${x}" cy="${y}" r="${big.has(k) ? 6 : 4}" data-spot="${k}"/>`).join('');
      // 칸마다 말 모으기
      const at = new Map();
      d.pieces.forEach((ps, pi) => ps.forEach((p, k) => { if (p.pos !== 'H' && p.pos !== 'E') { const a = at.get(p.pos) || []; a.push({ pi, k }); at.set(p.pos, a); } }));
      const v = d.pending[sel];
      const pcs = [...at.entries()].map(([pos, list]) => {
        const [x, y] = POS[pos]; const pi = list[0].pi;
        const mine = pi === d.turn && !d.canThrow && v != null && !done() && !cpuSeat[pi];
        return `<g class="pc ${mine ? 'can' : ''}" data-piece="${pi}:${list[0].k}" transform="translate(${x} ${y})"><circle r="5.2" fill="${COLORS[pi]}"/>${list.length > 1 ? `<text y="2.2">${list.length}</text>` : ''}</g>`;
      }).join('');
      return `<svg class="yut-board" viewBox="-9 -9 118 118">${lines}${spots}<text class="start" x="100" y="112">출발</text>${pcs}</svg>`;
    };

    const draw = () => {
      const t = d.turn;
      const v = d.pending[sel];
      root.innerHTML = `<section class="card yut-card">
        <div class="yut-players">${players.map((p, i) => {
          const ps = d.pieces[i];
          const home = ps.filter((x) => x.pos === 'H').length; const fin = ps.filter((x) => x.pos === 'E').length;
          return `<div class="yp ${i === t && !done() ? 'turn' : ''} ${d.winner === i ? 'win' : ''}"><i style="background:${COLORS[i]}"></i><b>${esc(p.name)}</b><small>대기 ${home} · 완주 ${fin}</small></div>`;
        }).join('')}</div>
        <div class="chess-status ${done() ? 'done' : ''}">${d.winner != null ? `${esc(players[d.winner].name)} 승리!` : cpuTurn() ? `${esc(players[t].name)} 차례 · 컴퓨터가 두는 중…` : `${esc(players[t].name)} 차례 · ${d.canThrow ? '윷을 던지세요' : d.pending.length ? '결과를 골라 말을 움직이세요' : ''}`}${hasCpu ? ` <small class="muted">· 컴퓨터 ${LEVEL_NAMES[level]}</small>` : ''}</div>
        <div class="yut-wrap">
          ${board()}
          <div class="yut-side">
            <div class="sticks">${d.sticks ? d.sticks.map((f, i) => stickSvg(f, i === 0 && backdo)).join('') : '<span class="muted">아직 안 던졌어요</span>'}</div>
            ${done() ? '' : `<button class="btn primary block" data-act="throw" ${d.canThrow && !rolling && !cpuTurn() ? '' : 'disabled'}>던지기</button>`}
            <div class="chips yut-pending">${d.pending.map((x, i) => `<button class="chip ${i === sel ? 'on' : ''}" data-sel="${i}" ${d.canThrow || cpuTurn() ? 'disabled' : ''}>${NAMES[x]}</button>`).join('')}</div>
            ${!done() && !cpuTurn() && !d.canThrow && v != null ? `<div class="row-btns">
              <button class="btn small" data-act="enter" ${v > 0 && d.pieces[t].some((p) => p.pos === 'H') ? '' : 'disabled'}>새 말 올리기</button>
              <button class="btn small ghost" data-act="discard">이 결과 버리기</button></div>
              <p class="muted">판 위의 내 말을 누르면 ${NAMES[v]}만큼 움직여요.</p>` : ''}
            ${!done() ? `<div class="row-btns"><button class="btn small ghost" data-act="undo" ${undo.length && !cpuTurn() ? '' : 'disabled'}>무르기</button></div>` : ''}
            ${d.log.length ? `<div class="hist muted">${d.log.slice(-4).map(esc).join('<br>')}</div>` : ''}
          </div>
        </div>
      </section>`;
    };

    const apply = (pi, k, v) => {
      const pc = d.pieces[pi][k];
      const res = moveResult(pc, v);
      if (!res) return false;
      undo.push(snapshot());
      const group = pc.pos === 'H' ? [pc] : d.pieces[pi].filter((p) => p.pos === pc.pos);
      group.forEach((p) => Object.assign(p, { pos: res.pos, line: res.line, steps: res.steps.slice() }));
      let caughtNow = 0;
      if (res.pos !== 'E') {
        d.pieces.forEach((ps, oi) => {
          if (oi === pi) return;
          let c = 0;
          ps.forEach((p) => { if (p.pos === res.pos) { Object.assign(p, { pos: 'H', line: 'O', steps: [] }); c++; } });
          if (c) d.caught[oi]++;
          caughtNow += c;
        });
      }
      d.pending.splice(sel, 1); sel = 0;
      const who = players[pi].name;
      d.log.push(`${who}: ${NAMES[v]}${group.length > 1 ? ` (${group.length}개 업고)` : ''}${res.pos === 'E' ? ' → 완주' : ''}${caughtNow ? ` → ${caughtNow}개 잡음!` : ''}`);
      if (caughtNow) { d.catches[pi]++; d.canThrow = true; }
      if (allHome(d.pieces[pi])) { d.winner = pi; d.pending = []; d.canThrow = false; }
      else if (!d.pending.length && !d.canThrow) nextTurn();
      return true;
    };

    const doThrow = async () => {
      rolling = true;
      for (let i = 0; i < 5; i++) { d.sticks = throwSticks(backdo).sticks; draw(); await wait(70); }
      const { sticks, v } = throwSticks(backdo);
      d.sticks = sticks; rolling = false;
      undo.push(snapshot());
      d.pending.push(v);
      d.canThrow = v >= 4;
      if (!d.canThrow) sel = 0;
      // 빽도뿐인데 판에 말이 없으면 버림
      if (!d.canThrow && d.pending.every((x) => x === -1) && !onBoard(d.turn)) { d.log.push(`${players[d.turn].name}: 빽도 (움직일 말 없음)`); nextTurn(); }
      ctx.save(); draw();
    };
    const discard = () => {
      const v = d.pending[sel];
      undo.push(snapshot()); d.pending.splice(sel, 1); sel = 0; d.log.push(`${players[d.turn].name}: ${NAMES[v]} 버림`); if (!d.pending.length) nextTurn();
    };
    const finishIfWon = () => { if (d.winner != null) setTimeout(() => ctx.finish({ ask: false }), 900); };

    // 컴퓨터 차례: 던지기 → 결과 고르기 → 말 옮기기를 사람이 볼 수 있게 천천히
    const runCpu = async () => {
      if (cpuBusy || !cpuTurn()) return;
      cpuBusy = true;
      try {
        while (cpuTurn() && root.isConnected && session.status !== 'finished') {
          await wait(550);
          if (!root.isConnected) break;
          if (d.canThrow) { await doThrow(); continue; }
          if (!d.pending.length) break;
          const m = chooseMove(d, d.turn, level, backdo);
          sel = m.sel; draw();
          await wait(450);
          if (!root.isConnected) break;
          if (m.discard) discard();
          else if (!apply(d.turn, m.k, d.pending[sel])) discard();
          ctx.save(); draw();
        }
      } catch (err) { console.error(err); ctx.toast?.('컴퓨터 계산 오류'); } finally { cpuBusy = false; }
      if (root.isConnected) draw();
      finishIfWon();
    };

    root.onclick = async (e) => {
      const el = e.target.closest('button,[data-piece]');
      if (!el || done() || cpuTurn() || cpuBusy) return;
      const ds = el.dataset;
      if (ds.act === 'throw' && d.canThrow && !rolling) { await doThrow(); return runCpu(); }
      if (ds.sel != null) { sel = Number(ds.sel); return draw(); }
      if (ds.act === 'undo' && undo.length) { Object.assign(d, JSON.parse(undo.pop())); sel = 0; ctx.save(); return draw(); }
      if (d.canThrow) return;
      const v = d.pending[sel];
      if (v == null) return;
      if (ds.act === 'discard') { discard(); ctx.save(); draw(); return runCpu(); }
      if (ds.act === 'enter') { const k = d.pieces[d.turn].findIndex((p) => p.pos === 'H'); if (k >= 0 && apply(d.turn, k, v)) { ctx.save(); draw(); } }
      else if (ds.piece) {
        const [pi, k] = ds.piece.split(':').map(Number);
        if (pi !== d.turn) return;
        if (apply(pi, k, v)) { ctx.save(); draw(); }
      }
      finishIfWon();
      runCpu();
    };
    draw();
    runCpu();
  },
};
