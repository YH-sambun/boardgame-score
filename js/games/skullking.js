// 스컬킹(Skull King) 점수 규칙
// 근거: Grandpa Beck's Games 공식 룰북 (2021 개정판) "Scoring" 항목
//  - 1 이상 예측 성공: 예측 승수 × 20 + 보너스
//  - 1 이상 예측 실패: |예측 - 실제| × -10 (보너스 없음)
//  - 0 예측 성공: 라운드 번호 × 10 + 보너스 (보너스는 예측 성공 시에만 인정)
//  - 0 예측 실패: 라운드 번호 × -10
// 보너스 (예측 성공 시에만):
//  - 노랑/보라/초록 14: 각 +10, 검정(졸리로저) 14: +20
//  - 해적으로 잡은 인어: 각 +20, 스컬킹으로 잡은 해적: 각 +30, 인어로 잡은 스컬킹: +40
//  - 약탈품(Loot) 동맹: 두 사람 모두 예측 성공 시 각 +20

export const BONUS_CHIPS = [
  { label: '색 14', value: 10 },
  { label: '검정 14', value: 20 },
  { label: '인어 포획', value: 20 },
  { label: '해적 포획', value: 30 },
  { label: '스컬킹 포획', value: 40 },
  { label: '약탈품', value: 20 },
];

export function scoreRound(roundNo, bid, won, bonus = 0) {
  if (bid == null || won == null || bid === '' || won === '') return null;
  bid = Number(bid); won = Number(won); bonus = Number(bonus) || 0;
  if (bid === 0) return won === 0 ? roundNo * 10 + bonus : -roundNo * 10;
  if (bid === won) return bid * 20 + bonus;
  return -Math.abs(won - bid) * 10;
}

function emptyRound(n) {
  return { bids: Array(n).fill(null), wins: Array(n).fill(null), bonus: Array(n).fill(0) };
}

// 시작 라운드 (예전 기록은 1부터)
const startOf = (session) => Number(session.settings?.startRound) || 1;

export function computeTotals(session) {
  const n = session.players.length;
  const start = startOf(session);
  const totals = Array(n).fill(0);
  const perRound = session.data.rounds.map((r, ri) =>
    session.players.map((_, pi) => {
      const s = scoreRound(start + ri, r.bids[pi], r.wins[pi], r.bonus[pi]);
      if (s != null) totals[pi] += s;
      return s;
    }));
  return { totals, perRound };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
  id: 'skullking',
  name: '스컬킹',
  emoji: '🏴‍☠️',
  minPlayers: 2,
  maxPlayers: 8,
  settingsFields: [
    { key: 'startRound', label: '시작 라운드', type: 'number', default: 1, min: 1, max: 10 },
    { key: 'endRound', label: '종료 라운드', type: 'number', default: 10, min: 1, max: 10 },
  ],

  // 시작 > 종료가 되지 않도록 보정. changed: 방금 바뀐 항목
  normalizeSettings(st, changed) {
    if (st.startRound > st.endRound) {
      if (changed === 'startRound') st.endRound = st.startRound; else st.startRound = st.endRound;
    }
    return st;
  },

  initData(players, settings) {
    const len = settings.endRound - settings.startRound + 1;
    return { rounds: Array.from({ length: len }, () => emptyRound(players.length)), current: 0 };
  },

  computeTotals(session) { return computeTotals(session).totals; },

  // 진행 화면. ctx.save(), ctx.finish() 제공
  renderPlay(root, session, ctx) {
    const players = session.players;
    const d = session.data;
    const readonly = session.status === 'finished';

    const start = startOf(session);
    // 열려 있는 숫자 버튼 줄: { pi, k } (k = 'bids' | 'wins')
    let open = null;
    const draw = () => {
      const ri = d.current;
      const roundNo = start + ri;
      const r = d.rounds[ri];
      const { totals, perRound } = computeTotals(session);
      const wonSum = r.wins.reduce((a, b) => a + (Number(b) || 0), 0);
      const allWins = r.wins.every((w) => w != null);

      root.innerHTML = `
        <div class="round-tabs">
          ${d.rounds.map((_, i) => `<button class="pill ${i === ri ? 'active' : ''} ${perRound[i].every((s) => s != null) ? 'done' : ''}" data-round="${i}">${start + i}</button>`).join('')}
        </div>
        <div class="play-grid">
        <section class="card input-card">
          <div class="round-head">
            <h2>${roundNo}라운드 <small>(카드 ${roundNo}장)</small></h2>
            ${allWins && wonSum !== roundNo ? `<span class="warn">승수 합계 ${wonSum} ≠ ${roundNo}${wonSum < roundNo ? ' (크라켄?)' : ''}</span>` : ''}
          </div>
          <div class="players-grid">
          ${players.map((p, pi) => {
            const s = perRound[ri][pi];
            return `
            <div class="prow" data-p="${pi}">
              <div class="pname">${esc(p.name)}<span class="ptotal">${totals[pi]}점</span></div>
              <div class="fields">
                ${numField('예측', 'bids', pi, r.bids[pi], open, readonly)}
                ${numField('획득', 'wins', pi, r.wins[pi], open, readonly)}
                <div class="field bonus">
                  <label>보너스</label>
                  <div class="bonus-box">
                    <input type="number" inputmode="numeric" step="10" data-k="bonus" data-p="${pi}" value="${r.bonus[pi] || 0}" ${readonly ? 'disabled' : ''}>
                    ${readonly ? '' : `<button class="mini" data-act="bonus-menu" data-p="${pi}">＋</button>`}
                  </div>
                </div>
                <div class="rscore ${s == null ? '' : s >= 0 ? 'pos' : 'neg'}">${s == null ? '–' : (s > 0 ? '+' : '') + s}</div>
              </div>
              ${open && open.pi === pi ? numPad(open.k, pi, r[open.k][pi], roundNo, p.name) : ''}
              <div class="chips hidden" data-chips="${pi}">
                ${BONUS_CHIPS.map((c) => `<button class="chip" data-chip="${c.value}" data-p="${pi}">${c.label} +${c.value}</button>`).join('')}
                <button class="chip ghost" data-chip="reset" data-p="${pi}">0으로</button>
              </div>
            </div>`;
          }).join('')}
          </div>
          <div class="round-nav">
            <button class="btn ghost" data-nav="-1" ${ri === 0 ? 'disabled' : ''}>◀ 이전</button>
            ${ri < d.rounds.length - 1
              ? `<button class="btn" data-nav="1">다음 라운드 ▶</button>`
              : readonly ? '' : `<button class="btn primary" data-act="finish">게임 종료</button>`}
          </div>
        </section>
        <section class="card board-card">
          <h3>점수표</h3>
          <div class="table-wrap">
            <table class="score">
              <thead><tr><th>R</th>${players.map((p) => `<th>${esc(p.name)}</th>`).join('')}</tr></thead>
              <tbody>
                ${d.rounds.map((rr, i) => `<tr class="${i === ri ? 'cur' : ''}" data-round="${i}"><td>${start + i}</td>${players.map((_, pi) => {
                  const s = perRound[i][pi];
                  const bid = rr.bids[pi];
                  return `<td>${s == null ? (bid != null ? `<span class="muted">${bid}예측</span>` : '') : `<span class="${s >= 0 ? 'pos' : 'neg'}">${s}</span><span class="muted"> ${rr.wins[pi]}/${bid}</span>`}</td>`;
                }).join('')}</tr>`).join('')}
              </tbody>
              <tfoot><tr><td>합계</td>${totals.map((t) => `<td><b>${t}</b></td>`).join('')}</tr></tfoot>
            </table>
          </div>
        </section>
        </div>`;
    };

    // 숫자 버튼 줄이 화면 밖에 있으면 보이도록 스크롤
    const showPad = () => root.querySelector('.numpad')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    root.onclick = (e) => {
      const t = e.target.closest('button, tr[data-round]');
      if (!t) return;
      if (t.dataset.round != null) { open = null; d.current = Number(t.dataset.round); ctx.save(); draw(); return; }
      if (t.dataset.nav) { open = null; d.current = Math.max(0, Math.min(d.rounds.length - 1, d.current + Number(t.dataset.nav))); ctx.save(); draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      if (t.dataset.act === 'finish') { ctx.finish(); return; }
      if (readonly) return;
      const r = d.rounds[d.current];
      const pi = Number(t.dataset.p);
      if (t.dataset.open) {
        const k = t.dataset.open;
        open = open && open.pi === pi && open.k === k ? null : { pi, k };
        draw(); showPad(); return;
      }
      if (t.dataset.num != null) {
        const k = t.dataset.k;
        r[k][pi] = t.dataset.num === 'clear' ? null : Number(t.dataset.num);
        // 다음 사람 같은 칸으로 자동 이동, 마지막 사람이면 닫기
        open = t.dataset.num !== 'clear' && pi < players.length - 1 ? { pi: pi + 1, k } : null;
        ctx.save(); draw(); showPad(); return;
      }
      if (t.dataset.act === 'bonus-menu') { root.querySelector(`[data-chips="${pi}"]`).classList.toggle('hidden'); return; }
      if (t.dataset.chip) {
        r.bonus[pi] = t.dataset.chip === 'reset' ? 0 : (Number(r.bonus[pi]) || 0) + Number(t.dataset.chip);
        ctx.save(); draw();
        root.querySelector(`[data-chips="${pi}"]`).classList.remove('hidden');
      }
    };
    root.onchange = (e) => {
      const el = e.target;
      if (el.dataset.k === 'bonus') {
        d.rounds[d.current].bonus[Number(el.dataset.p)] = Number(el.value) || 0;
        ctx.save(); draw();
      }
    };
    draw();
  },
};

function numField(label, k, pi, v, open, readonly) {
  const isOpen = open && open.pi === pi && open.k === k;
  return `<div class="field">
    <label>${label}</label>
    <button class="numfield ${isOpen ? 'open' : ''} ${v == null ? 'empty' : ''}" data-open="${k}" data-p="${pi}" ${readonly ? 'disabled' : ''}>${v == null ? '·' : v}</button>
  </div>`;
}

function numPad(k, pi, v, max, name) {
  return `<div class="numpad">
    <div class="numpad-label">${esc(name)} · ${k === 'bids' ? '예측' : '획득'} 승수</div>
    <div class="numpad-keys">
      ${Array.from({ length: max + 1 }, (_, n) => `<button class="key ${v === n ? 'on' : ''}" data-num="${n}" data-k="${k}" data-p="${pi}">${n}</button>`).join('')}
      <button class="key ghost" data-num="clear" data-k="${k}" data-p="${pi}">지우기</button>
    </div>
  </div>`;
}
