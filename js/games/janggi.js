// 장기: 한 기기에서 번갈아 두기 (9×10). 먼저 고른 사람이 초(楚, 아래·먼저 둠), 다음 사람이 한(漢, 위)
//  혼자 고르면 컴퓨터와 대국 (settings.cpuSide: 내 쪽 초/한, cpuLevel: 실력)
//  상차림(마·상 자리)은 새 게임 화면에서 초·한 각각 고름
// session.data = { moves:[from*100+to], winner:자리|null, draw:bool, reason }
import { isCpu, levelField, cpuPlayers, levelOf, LEVEL_NAMES } from './cpu.js?v=202611121512';
import { replay, turnOf, legalMovesFrom, inCheck, gameOver, material, kingAt, xy, SETUPS, W, H } from './janggi-rules.js?v=202611121512';
import { pickMove } from './janggi-ai.js?v=202611121512';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CHAR = {
  c: { K: '楚', A: '士', R: '車', C: '包', H: '馬', E: '象', P: '卒' },
  h: { K: '漢', A: '士', R: '車', C: '包', H: '馬', E: '象', P: '兵' },
};
const SIDE_NAME = { c: '초', h: '한' };
const seatOf = (s) => (s === 'c' ? 0 : 1);
const sideOf = (seat) => (seat === 0 ? 'c' : 'h');
const setupOpts = SETUPS.map((x) => ({ value: x.id, label: x.label }));

// 판 그림 (선): viewBox 0 0 90 100, 칸 간격 10
function boardSvg() {
  const L = [];
  for (let y = 0; y < H; y++) L.push(`<line x1="5" y1="${5 + y * 10}" x2="85" y2="${5 + y * 10}"/>`);
  for (let x = 0; x < W; x++) L.push(`<line x1="${5 + x * 10}" y1="5" x2="${5 + x * 10}" y2="95"/>`);
  for (const y0 of [0, 7]) {
    L.push(`<line x1="35" y1="${5 + y0 * 10}" x2="55" y2="${25 + y0 * 10}"/>`);
    L.push(`<line x1="55" y1="${5 + y0 * 10}" x2="35" y2="${25 + y0 * 10}"/>`);
  }
  return `<svg class="jg-lines" viewBox="0 0 90 100" aria-hidden="true">${L.join('')}</svg>`;
}

export default {
  id: 'janggi',
  name: '장기',
  guide: {
    players: '1~2명 (1명이면 컴퓨터와)', time: '20~60분',
    intro: '초(楚)와 한(漢)이 궁을 지키며 상대 궁을 꼼짝 못 하게(외통) 만드는 우리나라 전통 전략 게임이에요. 한 폰으로 번갈아 두거나, 혼자면 컴퓨터와 둬요.',
    rules: [
      '먼저 고른 사람이 초(아래, 파란 기물)로 먼저 둬요. 기물을 누르면 갈 수 있는 자리가 점으로 보여요.',
      '궁·사: 궁성(× 표시된 9칸) 안에서만 선을 따라 한 칸씩 움직여요.',
      '차: 가로·세로로 막히지 않은 만큼 가요. 궁성 안에서는 대각선 선을 따라서도 가요.',
      '포: 기물 하나를 꼭 뛰어넘어 가요. 포끼리는 넘을 수도 잡을 수도 없어요.',
      '마: 한 칸 곧게 간 뒤 바깥쪽 대각선 한 칸(日 모양). 첫 칸이 막히면 못 가요.',
      '상: 한 칸 곧게 간 뒤 대각선 두 칸(用 모양). 지나가는 자리가 막히면 못 가요.',
      '졸·병: 앞이나 옆으로 한 칸. 뒤로는 못 가고, 상대 궁성 안에서는 앞 대각선 선을 따라서도 가요.',
      '상대 궁을 잡을 수 있게 노리는 것이 장군이에요. 장군을 피할 방법이 없으면 외통으로 져요. 내 궁이 장군 상태로 남는 수는 둘 수 없어요.',
      '상차림(마·상 자리)은 새 게임 화면에서 초·한 각각 고를 수 있어요. 빅장과 한 수 쉬기 규칙은 넣지 않았어요.',
    ],
    scoring: [
      '외통·기권으로 이기면 승, 지면 패로 전적에 남아요.',
      '끝까지 가기 어려우면 "점수로 끝내기"를 눌러 남은 기물 점수로 승부를 정할 수 있어요. 차 13, 포 7, 마 5, 상 3, 사 3, 졸·병 2, 한은 덤 1.5점이에요.',
      '컴퓨터는 전적 목록에 나오지 않아요.',
    ],
    tips: [
      '차는 가장 센 기물이에요. 초반에 길을 열어 차를 빨리 움직이세요.',
      '포는 넘을 기물이 있어야 움직여요. 앞을 막는 졸을 옮겨 포다리를 만들어 주세요.',
      '상대 마·상이 지나가는 길목을 막으면 그 기물이 쓸모없어져요.',
      '궁 주변 사를 함부로 움직이지 마세요. 궁성 대각선으로 들어오는 차·포를 조심하세요.',
    ],
  },
  minPlayers: 1,
  maxPlayers: 2,
  pickHint: '두 사람을 고르면 먼저 고른 사람이 초(먼저 둠)예요. 1명만 고르면 컴퓨터와 둬요.',
  settingsFields: [
    { key: 'choSetup', label: '초 상차림', default: 'HEHE', options: setupOpts },
    { key: 'hanSetup', label: '한 상차림', default: 'HEHE', options: setupOpts },
    { key: 'cpuSide', label: '내 쪽', default: 'c', show: ({ count }) => count === 1, options: [{ value: 'c', label: '초 (먼저)' }, { value: 'h', label: '한 (나중, 덤 1.5)' }] },
    levelField(),
  ],
  preparePlayers(ps, settings) {
    if (ps.length !== 1) return ps;
    return settings?.cpuSide === 'h' ? [...cpuPlayers(1), ...ps] : [...ps, ...cpuPlayers(1)];
  },
  roundLabel: '대국',
  tieIsNoWin: true,

  initData() { return { moves: [], winner: null, draw: false, reason: null }; },
  computeTotals(session) {
    const d = session.data;
    return session.players.map((_, i) => (d.draw ? 0.5 : d.winner == null ? 0 : d.winner === i ? 1 : -1));
  },
  totalLabel(t) { return t === 1 ? '승' : t === 0.5 ? '무' : t === -1 ? '패' : ''; },
  incompleteCount(session) { return session.data.winner == null && !session.data.draw ? 1 : 0; },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const players = session.players;
    const st = session.settings || {};
    const cs = st.choSetup || 'HEHE';
    const hs = st.hanSetup || 'HEHE';
    const over = () => d.winner != null || d.draw || session.status === 'finished';
    const cpuSeat = players.findIndex(isCpu);
    const level = levelOf(session);
    let thinking = false;
    let sel = null;
    let flipped = cpuSeat === 0; // 컴퓨터가 초면 내가 한 → 한을 아래로
    const humanTurn = () => cpuSeat < 0 || seatOf(turnOf(d.moves)) !== cpuSeat;

    const draw = () => {
      const b = replay(d.moves, cs, hs);
      const turn = turnOf(d.moves);
      const last = d.moves.length ? d.moves[d.moves.length - 1] : null;
      const lf = last == null ? -1 : Math.floor(last / 100); const lt = last == null ? -1 : last % 100;
      const targets = sel != null ? legalMovesFrom(b, sel) : [];
      const check = !over() && inCheck(b, turn);
      const kingSq = check ? kingAt(b, turn) : -1;
      const pos = (i) => { let [x, y] = xy(i); if (flipped) { x = W - 1 - x; y = H - 1 - y; } return `left:${((x + 0.5) / W) * 100}%;top:${((y + 0.5) / H) * 100}%`; };
      const pts = [];
      for (let i = 0; i < W * H; i++) {
        const p = b[i];
        const can = !over() && humanTurn() && !thinking;
        const cls = ['jg-pt', i === sel ? 'sel' : '', i === lf || i === lt ? 'last' : '', targets.includes(i) ? (p ? 'cap' : 'dot') : '', i === kingSq ? 'check' : ''].join(' ');
        const piece = p ? `<span class="jg-pc ${p[0]} t${p[1]}">${CHAR[p[0]][p[1]]}</span>` : '';
        pts.push(`<button class="${cls}" style="${pos(i)}" data-i="${i}" ${can ? '' : 'disabled'} aria-label="${p ? SIDE_NAME[p[0]] + ' ' + CHAR[p[0]][p[1]] : '빈 자리'}">${piece}</button>`);
      }
      const name = (seat) => esc(players[seat]?.name || '?');
      const status = d.winner != null ? `${name(d.winner)} 승리${d.reason ? ` (${esc(d.reason)})` : ''}`
        : d.draw ? `무승부${d.reason ? ` (${esc(d.reason)})` : ''}`
        : thinking ? '컴퓨터가 생각 중…'
        : `${SIDE_NAME[turn]} ${name(seatOf(turn))} 차례${check ? ' · 장군!' : ''}`;
      const bar = (seat) => `<div class="chess-player ${!over() && seatOf(turn) === seat ? 'turn' : ''}"><span><i class="jg-dot ${sideOf(seat)}"></i>${SIDE_NAME[sideOf(seat)]} ${name(seat)}${isCpu(players[seat]) ? ` <small class="muted">${LEVEL_NAMES[level]}</small>` : ''}</span><span class="muted">${material(b, sideOf(seat))}점</span></div>`;
      const top = flipped ? 0 : 1;
      root.innerHTML = `<section class="card jg-card">
        <div class="chess-status ${over() ? 'done' : check ? 'check' : ''}">${status}</div>
        ${bar(top)}
        <div class="jg-board ${thinking ? 'busy' : ''}">${boardSvg()}${pts.join('')}</div>
        ${bar(1 - top)}
        <div class="chess-actions">
          ${session.status === 'finished' ? '' : `<button class="btn small" data-act="undo" ${canUndo() ? '' : 'disabled'}>무르기</button>
          ${over() ? '<button class="btn primary small" data-act="finish">전적에 기록</button>' : `<button class="btn small" data-act="score">점수로 끝내기</button>${cpuSeat < 0 ? '<button class="btn small" data-act="draw">무승부</button>' : ''}<button class="btn small danger" data-act="resign">기권</button>`}`}
          <button class="btn small ghost" data-act="flip">판 돌리기</button>
        </div>
        <p class="muted center">${d.moves.length}수 · 상차림 초 ${SETUPS.find((x) => x.id === cs)?.label} / 한 ${SETUPS.find((x) => x.id === hs)?.label}</p>
      </section>`;
    };

    const canUndo = () => !thinking && (cpuSeat < 0 ? d.moves.length > 0 : d.moves.length > (cpuSeat === 0 ? 1 : 0));

    const end = (r) => { if (!r) return; if (r.winner == null) { d.draw = true; } else d.winner = seatOf(r.winner); d.reason = r.reason; };

    const move = (from, to) => {
      d.moves.push(from * 100 + to);
      sel = null;
      const b = replay(d.moves, cs, hs);
      end(gameOver(b, turnOf(d.moves)));
      ctx.save(); draw();
      if (over()) setTimeout(() => { if (root.isConnected) ctx.finish({ ask: false }); }, 1200);
      else maybeComputer();
    };

    const maybeComputer = () => {
      if (cpuSeat < 0 || over() || humanTurn() || thinking) return;
      thinking = true; draw();
      setTimeout(() => {
        if (!root.isConnected) return;
        let m = null;
        try { m = pickMove(replay(d.moves, cs, hs), turnOf(d.moves), level); } catch (err) { console.error(err); }
        thinking = false;
        if (!m || over()) return draw();
        move(m[0], m[1]);
      }, 300);
    };

    root.onclick = (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'flip') { flipped = !flipped; return draw(); }
      if (act === 'finish') return ctx.finish({ ask: false });
      if (session.status === 'finished' || thinking) return;
      if (act === 'undo') {
        if (!canUndo()) return;
        d.moves.pop();
        if (cpuSeat >= 0 && !humanTurn()) d.moves.pop();
        d.winner = null; d.draw = false; d.reason = null; sel = null; ctx.save(); draw(); return maybeComputer();
      }
      if (act === 'resign') {
        const me = cpuSeat >= 0 ? 1 - cpuSeat : seatOf(turnOf(d.moves));
        if (!confirm(`${players[me].name}님이 기권할까요?`)) return;
        d.winner = 1 - me; d.reason = '기권'; ctx.save(); draw(); return ctx.finish({ ask: false });
      }
      if (act === 'draw') {
        if (!confirm('무승부로 끝낼까요?')) return;
        d.draw = true; d.reason = '합의'; ctx.save(); draw(); return ctx.finish({ ask: false });
      }
      if (act === 'score') {
        const b = replay(d.moves, cs, hs);
        const c = material(b, 'c'); const h = material(b, 'h');
        if (!confirm(`남은 기물 점수: 초 ${c}점, 한 ${h}점 (덤 포함)\n${c > h ? '초' : '한'}의 승리로 끝낼까요?`)) return;
        d.winner = seatOf(c > h ? 'c' : 'h'); d.reason = `점수 ${c} : ${h}`; ctx.save(); draw(); return ctx.finish({ ask: false });
      }
      if (btn.dataset.i == null || over() || !humanTurn()) return;
      const i = Number(btn.dataset.i);
      const b = replay(d.moves, cs, hs);
      const turn = turnOf(d.moves);
      if (sel != null && legalMovesFrom(b, sel).includes(i)) return move(sel, i);
      sel = b[i] && b[i][0] === turn && sel !== i ? i : null;
      draw();
    };
    draw();
    maybeComputer();
  },
};

