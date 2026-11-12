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
  // 소개·도움말 (직접 정리한 요약)
  guide: {
    players: '2~8명', time: '30~60분',
    intro: '매 라운드 내가 몇 번 이길지(트릭 수)를 미리 맞히는 해적 카드 게임이에요. 1라운드는 카드 1장, 10라운드는 10장으로 점점 길어지고, 예측이 딱 맞아야 점수를 받아요.',
    rules: [
      '라운드 번호만큼 카드를 받아요(1라운드 1장 … 10라운드 10장).',
      '카드를 본 뒤 모두 동시에 "이번 라운드에 몇 번 이길지"를 손가락으로 내밀어 예측해요. 0도 가능해요.',
      '선 플레이어가 낸 카드의 색을 따라 내야 해요. 그 색이 없을 때만 다른 카드를 낼 수 있어요.',
      '같은 색끼리는 높은 숫자가 이기고, 검정(해적 깃발) 카드는 다른 색 숫자 카드를 모두 이겨요.',
      '특수 카드: 도망(백기)은 항상 져요. 해적은 숫자 카드를, 스컬킹은 해적을, 인어는 스컬킹을 이겨요. 해적·스컬킹·인어가 한 트릭에 모두 나오면 인어가 가져가요.',
      '트릭을 이긴 사람이 다음 트릭의 선이 되고, 10라운드가 끝나면 합계가 가장 높은 사람이 우승이에요.',
      '판(에디션)에 따라 티그리스·크라켄·흰고래 같은 카드가 더 있을 수 있어요. 그 카드 효과는 가지고 있는 룰북을 따라 주세요.',
    ],
    scoring: [
      '예측 1 이상, 성공: 예측한 수 × 20점 + 보너스',
      '예측 1 이상, 실패: 차이 1개당 −10점',
      '예측 0, 성공: 라운드 번호 × 10점 + 보너스 / 실패: 라운드 번호 × −10점',
      '보너스(예측 성공 시에만): 색 14 +10, 검정 14 +20, 해적으로 인어 +20, 스컬킹으로 해적 +30, 인어로 스컬킹 +40, 약탈품 동맹 +20',
      '이 앱에서는 라운드마다 예측·획득 수와 보너스만 누르면 점수가 자동으로 계산돼요. 시작·종료 라운드를 바꿔 짧게 할 수도 있어요.',
    ],
    tips: [
      '초반 라운드의 0 예측은 성공해도 점수가 작지만, 후반 0 예측은 크게 벌거나 크게 잃어요. 손에 특수 카드가 많으면 0은 위험해요.',
      '도망 카드는 "지고 싶을 때" 쓰는 안전장치예요. 예측 수를 이미 채웠다면 아껴 두세요.',
      '스컬킹과 인어가 아직 안 나왔는지 기억해 두면 마지막 트릭 계산이 쉬워져요.',
      '보너스는 예측이 맞을 때만 들어오니, 욕심보다 예측 적중이 먼저예요.',
    ],
  },
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
