// 루미큐브(Rummikub) 점수 규칙
// 근거: Pressman / Kodkod 공식 룰북 "Scoring" 항목
//  - 한 판(라운드)에서 먼저 타일을 다 내려놓은 사람(루미큐브!)이 승리
//  - 진 사람: 자기 받침대에 남은 타일 숫자의 합만큼 마이너스 (조커는 30점)
//  - 이긴 사람: 진 사람들의 마이너스 합계만큼 플러스 → 한 판 점수 합은 항상 0
//  - 더미 타일이 다 떨어져 아무도 못 끝낸 경우: 남은 합이 가장 적은 사람이 승리하고,
//    이긴 사람은 (각 상대의 남은 합 − 자기 남은 합)의 합계를 받음, 진 사람은 자기 남은 합만큼 마이너스
// 여러 판의 점수를 누적해 합계가 가장 높은 사람이 최종 1등

export const JOKER = 30;

function emptyRound(n) {
  return { winner: null, left: Array(n).fill(null) };
}

// 라운드 점수. 승자와 진 사람 전원의 남은 합이 입력돼야 계산 (미완성이면 null)
export function scoreRound(r) {
  const n = r.left.length;
  if (r.winner == null) return Array(n).fill(null);
  const w = r.winner;
  const wl = Number(r.left[w]) || 0;
  const done = r.left.every((v, i) => i === w || v != null);
  if (!done) return r.left.map((v, i) => (i === w || v == null ? null : -Number(v)));
  return r.left.map((v, i) => (i === w
    ? r.left.reduce((a, x, j) => (j === w ? a : a + Number(x) - wl), 0)
    : -Number(v)));
}

const isDone = (r) => r.winner != null && r.left.every((v, i) => i === r.winner || v != null);
const isEmpty = (r) => r.winner == null && r.left.every((v) => v == null);

export function computeTotals(session) {
  const n = session.players.length;
  const totals = Array(n).fill(0);
  const perRound = session.data.rounds.map((r) => {
    const sc = isDone(r) ? scoreRound(r) : scoreRound(r).map(() => null);
    sc.forEach((s, i) => { if (s != null) totals[i] += s; });
    return sc;
  });
  return { totals, perRound };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
  id: 'rummikub',
  name: '루미큐브',
  emoji: '🀄',
  minPlayers: 2,
  maxPlayers: 6,
  settingsFields: [],

  initData(players) {
    return { rounds: [emptyRound(players.length)], current: 0 };
  },

  computeTotals(session) { return computeTotals(session).totals; },

  // 종료 시 '입력이 덜 된 라운드' 개수 (빈 라운드는 종료할 때 지워지므로 제외)
  roundLabel: '판',
  incompleteCount(session) {
    return session.data.rounds.filter((r) => !isDone(r) && !isEmpty(r)).length;
  },

  renderPlay(root, session, ctx) {
    const players = session.players;
    const d = session.data;
    const readonly = session.status === 'finished';
    // 타일 계산기가 열린 사람 번호
    let open = null;

    const draw = () => {
      const ri = d.current;
      const r = d.rounds[ri];
      const { totals, perRound } = computeTotals(session);
      const done = isDone(r);
      const wl = r.winner != null ? Number(r.left[r.winner]) || 0 : 0;
      const lowerThanWinner = r.winner != null && r.left.some((v, i) => i !== r.winner && v != null && Number(v) < wl);

      root.innerHTML = `
        <div class="round-tabs">
          ${d.rounds.map((rr, i) => `<button class="pill ${i === ri ? 'active' : ''} ${isDone(rr) ? 'done' : ''}" data-round="${i}">${i + 1}</button>`).join('')}
          ${readonly ? '' : `<button class="pill" data-act="add" title="새 판 추가">＋</button>`}
        </div>
        <div class="play-grid">
        <section class="card input-card">
          <div class="round-head">
            <h2>${ri + 1}판</h2>
            ${r.winner == null ? '<span class="muted">먼저 다 내려놓은 사람(승자)을 고르세요</span>'
              : lowerThanWinner ? '<span class="warn">승자보다 남은 합이 적은 사람이 있어요</span>'
              : done ? '<span class="muted">이 판 점수 합계 0 ✓</span>' : '<span class="muted">나머지 사람의 남은 타일 합을 입력하세요</span>'}
          </div>
          <div class="players-grid">
          ${players.map((p, pi) => {
            const s = perRound[ri][pi];
            const isW = r.winner === pi;
            const v = r.left[pi];
            return `
            <div class="prow" data-p="${pi}">
              <div class="pname">${esc(p.name)}<span class="ptotal">${totals[pi]}점</span></div>
              <div class="fields rk-fields">
                <div class="field">
                  <label>승자</label>
                  <button class="numfield rk-win ${isW ? 'open' : 'empty'}" data-act="winner" data-p="${pi}" ${readonly ? 'disabled' : ''}>${isW ? '🏆' : '·'}</button>
                </div>
                <div class="field">
                  <label>${isW ? '남은 합 (보통 0)' : '남은 타일 합'}</label>
                  <div class="bonus-box">
                    <input type="number" inputmode="numeric" min="0" data-k="left" data-p="${pi}" value="${v == null ? '' : v}" placeholder="·" ${readonly ? 'disabled' : ''}>
                    ${readonly ? '' : `<button class="mini" data-act="pad" data-p="${pi}" title="타일로 더하기">＋</button>`}
                  </div>
                </div>
                <div class="rscore ${s == null ? '' : s >= 0 ? 'pos' : 'neg'}">${s == null ? '–' : (s > 0 ? '+' : '') + s}</div>
              </div>
              ${open === pi ? tilePad(pi, v, p.name) : ''}
            </div>`;
          }).join('')}
          </div>
          <div class="round-nav">
            <button class="btn ghost" data-nav="-1" ${ri === 0 ? 'disabled' : ''}>◀ 이전</button>
            ${readonly
              ? (ri < d.rounds.length - 1 ? '<button class="btn" data-nav="1">다음 판 ▶</button>' : '')
              : `<button class="btn" data-act="next" ${done ? '' : 'disabled'}>${ri < d.rounds.length - 1 ? '다음 판 ▶' : '새 판 시작 ▶'}</button>
                 <button class="btn primary" data-act="finish">게임 종료</button>`}
          </div>
        </section>
        <section class="card board-card">
          <h3>점수표</h3>
          <div class="table-wrap">
            <table class="score">
              <thead><tr><th>판</th>${players.map((p) => `<th>${esc(p.name)}</th>`).join('')}</tr></thead>
              <tbody>
                ${d.rounds.map((rr, i) => `<tr class="${i === ri ? 'cur' : ''}" data-round="${i}"><td>${i + 1}</td>${players.map((_, pi) => {
                  const s = perRound[i][pi];
                  if (s == null) return `<td>${rr.winner === pi ? '🏆' : ''}</td>`;
                  return `<td><span class="${s >= 0 ? 'pos' : 'neg'}">${rr.winner === pi ? '🏆' : ''}${s}</span></td>`;
                }).join('')}</tr>`).join('')}
              </tbody>
              <tfoot><tr><td>합계</td>${totals.map((t) => `<td><b>${t}</b></td>`).join('')}</tr></tfoot>
            </table>
          </div>
          <p class="muted">진 사람은 남은 타일 숫자 합만큼 −, 승자는 그 합계만큼 + (조커 ${JOKER}점)</p>
        </section>
        </div>`;
    };

    const showPad = () => root.querySelector('.numpad')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const go = (i) => { open = null; d.current = i; ctx.save(); draw(); };

    root.onclick = (e) => {
      const t = e.target.closest('button, tr[data-round]');
      if (!t) return;
      if (t.dataset.round != null) { go(Number(t.dataset.round)); return; }
      if (t.dataset.nav) { go(Math.max(0, Math.min(d.rounds.length - 1, d.current + Number(t.dataset.nav)))); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      if (readonly) return;
      const act = t.dataset.act;
      if (act === 'finish') {
        // 아무것도 입력 안 한 판은 지우고 종료
        const keep = d.rounds.filter((rr) => !isEmpty(rr));
        if (keep.length && keep.length !== d.rounds.length) { d.rounds = keep; d.current = Math.min(d.current, keep.length - 1); }
        ctx.finish(); return;
      }
      if (act === 'add' || act === 'next') {
        if (act === 'next' && d.current < d.rounds.length - 1) { go(d.current + 1); }
        else {
          const last = d.rounds[d.rounds.length - 1];
          if (!isEmpty(last)) d.rounds.push(emptyRound(players.length));
          go(d.rounds.length - 1);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const r = d.rounds[d.current];
      const pi = Number(t.dataset.p);
      if (act === 'winner') {
        r.winner = r.winner === pi ? null : pi;
        if (r.winner === pi && r.left[pi] == null) r.left[pi] = 0;
        // 진 사람 중 첫 빈칸에 계산기 열기
        const next = r.left.findIndex((v, i) => i !== r.winner && v == null);
        open = r.winner != null && next >= 0 ? next : null;
        ctx.save(); draw(); showPad(); return;
      }
      if (act === 'pad') { open = open === pi ? null : pi; draw(); showPad(); return; }
      if (t.dataset.tile != null) {
        const k = t.dataset.tile;
        if (k === 'clear') r.left[pi] = null;
        else if (k === 'zero') r.left[pi] = 0;
        else r.left[pi] = (Number(r.left[pi]) || 0) + Number(k);
        ctx.save(); draw(); showPad(); return;
      }
      if (t.dataset.act === 'pad-next') {
        const next = r.left.findIndex((v, i) => i !== r.winner && i > pi && v == null);
        open = next >= 0 ? next : null;
        draw(); showPad();
      }
    };
    root.onchange = (e) => {
      const el = e.target;
      if (el.dataset.k === 'left') {
        const v = el.value.trim();
        d.rounds[d.current].left[Number(el.dataset.p)] = v === '' ? null : Math.max(0, Math.round(Number(v)) || 0);
        ctx.save(); draw();
      }
    };
    draw();
  },
};

// 남은 타일을 하나씩 눌러 더하는 계산기 (1~13, 조커 30)
function tilePad(pi, v, name) {
  return `<div class="numpad">
    <div class="numpad-label">${esc(name)} · 남은 타일을 하나씩 누르면 더해져요 (현재 ${v ?? 0})</div>
    <div class="numpad-keys">
      ${Array.from({ length: 13 }, (_, i) => `<button class="key" data-tile="${i + 1}" data-p="${pi}">${i + 1}</button>`).join('')}
      <button class="key rk-joker" data-tile="${JOKER}" data-p="${pi}">🃏 ${JOKER}</button>
      <button class="key ghost" data-tile="zero" data-p="${pi}">0으로</button>
      <button class="key ghost" data-tile="clear" data-p="${pi}">지우기</button>
      <button class="key ghost" data-act="pad-next" data-p="${pi}">다음 사람 ▶</button>
    </div>
  </div>`;
}
