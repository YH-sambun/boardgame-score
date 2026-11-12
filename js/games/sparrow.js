// 참새작(すずめ雀, Sparrow Mahjong) 점수 규칙
// 근거: すごろくや 제품 소개(https://sugorokuya.jp/p/suzume-jong), GIGAZINE 리뷰(2025-08-02),
//       Reach Mahjong 포럼 규칙 요약(https://reachmahjong.com/en/forum/viewtopic.php?p=60750)
//  - 시작 점수 40점, 손패 5장 + 1장 = 6장으로 몸통(순자·커쯔) 2개를 만들면 화료
//  - 순자 1점, 커쯔 2점, 도라 1장당 1점, 적패(빨간 삭수·중) 1장당 1점
//  - 역: 탕야오(2~8만) +1, 찬타(두 몸통 모두 1·9·발·중 포함) +2
//  - 역만: 올그린(2·3·4·6·8·발만) 10, 친야오(1·9·발·중만) 15, 슈퍼레드(전부 빨강) 20  ※ 몸통·도라 점수에 더함
//  - 5점 이상이어야 화료 가능, 부친(親)이 화료하면 +2 (5점 조건에는 포함 안 됨)
//  - 론: 버린 사람이 전액 지불 / 쯔모: 나머지가 똑같이 나눠 지불(나머지 올림)
//  - 유국은 점수 이동 없음. 부친은 매 판 다음 사람에게 넘어감, 동·남·서·북 4바퀴 후 점수가 가장 높은 사람이 1등

export const SETS = { shun: { label: '순자', pts: 1 }, kou: { label: '커쯔', pts: 2 } };
export const YAKU = [
  { key: 'tanyao', label: '탕야오', pts: 1 },
  { key: 'chanta', label: '찬타', pts: 2 },
];
export const YAKUMAN = [
  { key: 'green', label: '올그린', pts: 10 },
  { key: 'chinyao', label: '친야오', pts: 15 },
  { key: 'red', label: '슈퍼레드', pts: 20 },
];
export const MIN_POINTS = 5;
export const DEALER_BONUS = 2;
const WINDS = ['동', '남', '서', '북'];

export function emptyHand() {
  return { result: null, winner: null, how: 'ron', from: null, sets: ['shun', 'shun'], dora: 0, red: 0, tanyao: false, chanta: false, yakuman: null, manual: null };
}

// 손패 점수. base: 부친 보너스 제외(5점 조건 판단용), points: 실제 받는 점수
export function handPoints(h, isDealer) {
  let base = h.sets.reduce((a, k) => a + (SETS[k]?.pts || 0), 0);
  base += (Number(h.dora) || 0) + (Number(h.red) || 0);
  for (const y of YAKU) if (h[y.key]) base += y.pts;
  const ym = YAKUMAN.find((y) => y.key === h.yakuman);
  if (ym) base += ym.pts;
  const auto = base + (isDealer ? DEALER_BONUS : 0);
  const manual = h.manual != null && h.manual !== '';
  return { base, points: manual ? Number(h.manual) : auto, manual, ok: manual || base >= MIN_POINTS };
}

// 한 판의 점수 이동. 입력이 덜 됐거나 5점 미만이면 null
export function handDeltas(h, n, dealer) {
  if (h.result === 'draw') return Array(n).fill(0);
  if (h.result !== 'win' || h.winner == null) return null;
  const { points, ok } = handPoints(h, h.winner === dealer);
  if (!ok) return null;
  const d = Array(n).fill(0);
  if (h.how === 'ron') {
    if (h.from == null || h.from === h.winner) return null;
    d[h.winner] += points; d[h.from] -= points;
  } else {
    const each = Math.ceil(points / (n - 1));
    for (let i = 0; i < n; i++) if (i !== h.winner) { d[i] -= each; d[h.winner] += each; }
  }
  return d;
}

const startPts = (session) => Number(session.settings?.startPoints ?? 40);
const dealerOf = (session, i) => i % session.players.length;
const handName = (session, i) => `${WINDS[Math.floor(i / session.players.length)] || ''}${(i % session.players.length) + 1}국`;

export function computeTotals(session) {
  const n = session.players.length;
  const totals = Array(n).fill(startPts(session));
  const perHand = session.data.hands.map((h, i) => {
    const d = handDeltas(h, n, dealerOf(session, i));
    if (d) d.forEach((v, pi) => { totals[pi] += v; });
    return d;
  });
  return { totals, perHand };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sign = (v) => (v > 0 ? '+' : '') + v;

export default {
  id: 'sparrow',
  name: '참새작',
  emoji: '🐦',
  // 소개·도움말 (직접 정리한 요약)
  guide: {
    players: '2~6명', time: '20~40분',
    intro: '마작을 아주 작게 줄인 게임이에요. 대나무(삭수) 패와 발·중으로만 하고, 손패 5장에 1장을 더해 3장짜리 몸통 2개를 만들면 끝나요. 마작을 몰라도 금방 배울 수 있어요.',
    rules: [
      '패는 삭수 1~9와 발(초록)·중(빨강)으로, 각각 4장씩이에요. 일부 패는 빨간색(적패)이에요.',
      '각자 5장을 받고, 차례마다 1장을 가져와 6장이 되면 1장을 버려요.',
      '6장이 순자(같은 종류 연속 3장, 예: 3-4-5)나 커쯔(같은 패 3장) 2개로 딱 나뉘면 화료(완성)예요.',
      '내가 가져온 패로 완성하면 쯔모, 남이 버린 패로 완성하면 론이에요.',
      '패를 다 가져올 때까지 아무도 못 끝내면 유국(무승부)이고 점수는 움직이지 않아요.',
      '부친(선)은 매 판 다음 사람에게 넘어가고, 정한 바퀴 수(기본 동·남·서·북 4바퀴)가 끝나면 점수가 가장 높은 사람이 1등이에요.',
    ],
    scoring: [
      '모두 40점으로 시작해요(설정에서 바꿀 수 있어요).',
      '순자 1점, 커쯔 2점, 도라 1장당 1점, 적패 1장당 1점.',
      '역: 탕야오(2~8로만) +1, 찬타(두 몸통 모두 1·9·발·중이 들어감) +2.',
      '역만: 올그린(2·3·4·6·8·발로만) 10, 친야오(1·9·발·중으로만) 15, 슈퍼레드(전부 빨강) 20.',
      '부친 보너스(+2)를 빼고 5점 이상이어야 끝낼 수 있어요.',
      '론은 버린 사람이 전부 내고, 쯔모는 나머지 사람이 나눠서(올림) 내요.',
      '이 앱에서는 승자·방법·몸통·도라·역만 고르면 점수 이동이 자동으로 계산돼요.',
    ],
    tips: [
      '5점을 못 넘기면 끝낼 수 없으니, 커쯔·도라·적패로 점수를 먼저 챙기세요.',
      '빨간 패는 1장만 있어도 1점이에요. 버릴지 고민되면 빨간 패를 남기세요.',
      '남이 버린 패를 잘 보면 내가 기다리는 패가 아직 남았는지 알 수 있어요.',
      '친야오·슈퍼레드는 점수가 커서 한 판에 역전이 가능해요. 초반에 노려볼 만해요.',
    ],
  },
  minPlayers: 2,
  maxPlayers: 6,
  roundLabel: '판',
  settingsFields: [
    { key: 'winds', label: '바퀴 수 (동·남·서·북)', type: 'number', default: 4, min: 1, max: 4 },
    { key: 'startPoints', label: '시작 점수', type: 'number', default: 40, min: 0, max: 200 },
  ],

  initData(players, settings) {
    const len = players.length * settings.winds;
    return { hands: Array.from({ length: len }, emptyHand), current: 0 };
  },

  computeTotals(session) { return computeTotals(session).totals; },

  // 결과를 입력하지 않은 판 수 (게임 종료 확인용)
  incompleteCount(session) {
    const { perHand } = computeTotals(session);
    return perHand.filter((d) => d == null).length;
  },

  renderPlay(root, session, ctx) {
    const players = session.players;
    const n = players.length;
    const d = session.data;
    const readonly = session.status === 'finished';
    const dis = readonly ? 'disabled' : '';

    const draw = () => {
      const hi = d.current;
      const h = d.hands[hi];
      const dealer = dealerOf(session, hi);
      const { totals, perHand } = computeTotals(session);
      const hp = h.winner != null ? handPoints(h, h.winner === dealer) : null;
      const delta = perHand[hi];
      const busted = totals.some((t) => t < 0);
      const chip = (on, attrs, label) => `<button class="chip ${on ? 'on' : ''}" ${attrs} ${dis}>${label}</button>`;
      const stepper = (k, v) => `<div class="stepper"><button class="mini" data-step="${k}" data-v="-1" ${readonly || v <= 0 ? 'disabled' : ''}>−</button><span class="val">${v}</span><button class="mini" data-step="${k}" data-v="1" ${readonly || v >= 6 ? 'disabled' : ''}>＋</button></div>`;

      let pay = '';
      if (h.result === 'win' && h.winner != null && hp) {
        if (!hp.ok) pay = `기본 ${hp.base}점 · ${MIN_POINTS}점 미만이라 화료할 수 없어요 (몸통·역을 다시 확인해 주세요)`;
        else if (h.how === 'ron' && h.from == null) pay = '<span class="muted">누가 버린 패로 났는지 골라 주세요</span>';
        else if (h.how === 'ron') pay = `<b>${esc(players[h.from].name)}</b> → <b>${esc(players[h.winner].name)}</b> ${hp.points}점`;
        else pay = `나머지 ${n - 1}명이 각 <b>${Math.ceil(hp.points / (n - 1))}점</b>씩 → <b>${esc(players[h.winner].name)}</b> +${Math.ceil(hp.points / (n - 1)) * (n - 1)}점`;
      }

      root.innerHTML = `
        <div class="round-tabs">
          ${d.hands.map((_, i) => `<button class="pill ${i === hi ? 'active' : ''} ${perHand[i] ? 'done' : ''}" data-hand="${i}">${handName(session, i)}</button>`).join('')}
        </div>
        <div class="play-grid">
        <section class="card input-card">
          <div class="round-head">
            <h2>${handName(session, hi)} <small>부친 ${esc(players[dealer].name)}</small></h2>
            ${busted ? '<span class="warn">0점 아래로 내려간 사람이 있어요</span>' : ''}
          </div>

          <div class="sp-block">
            <label>누가 났나요?</label>
            <div class="chips">
              ${players.map((p, pi) => chip(h.result === 'win' && h.winner === pi, `data-win="${pi}"`, `${esc(p.name)}${pi === dealer ? ' <i>親</i>' : ''}`)).join('')}
              ${chip(h.result === 'draw', 'data-draw="1"', '유국 (아무도 못 남)')}
            </div>
          </div>

          ${h.result === 'win' && h.winner != null ? `
          <div class="sp-block">
            <label>어떻게 났나요?</label>
            <div class="chips">
              ${chip(h.how === 'ron', 'data-how="ron"', '론 (남이 버린 패)')}
              ${chip(h.how === 'tsumo', 'data-how="tsumo"', '쯔모 (직접 뽑은 패)')}
            </div>
            ${h.how === 'ron' ? `<div class="chips">${players.map((p, pi) => pi === h.winner ? '' : chip(h.from === pi, `data-from="${pi}"`, `${esc(p.name)} 버림`)).join('')}</div>` : ''}
          </div>

          <div class="sp-block">
            <label>손패 점수</label>
            <div class="sp-row"><span>몸통 1</span><div class="chips">${Object.entries(SETS).map(([k, s]) => chip(h.sets[0] === k, `data-set="0" data-kind="${k}"`, `${s.label} ${s.pts}점`)).join('')}</div></div>
            <div class="sp-row"><span>몸통 2</span><div class="chips">${Object.entries(SETS).map(([k, s]) => chip(h.sets[1] === k, `data-set="1" data-kind="${k}"`, `${s.label} ${s.pts}점`)).join('')}</div></div>
            <div class="sp-row"><span>도라</span>${stepper('dora', h.dora)}</div>
            <div class="sp-row"><span>적패</span>${stepper('red', h.red)}<span class="muted">빨간 삭수·중</span></div>
            <div class="sp-row"><span>역</span><div class="chips">
              ${YAKU.map((y) => chip(h[y.key], `data-yaku="${y.key}"`, `${y.label} +${y.pts}`)).join('')}
              ${YAKUMAN.map((y) => chip(h.yakuman === y.key, `data-yakuman="${y.key}"`, `${y.label} +${y.pts}`)).join('')}
            </div></div>
            <div class="sp-row"><span>직접 입력</span><input type="number" inputmode="numeric" class="sp-manual" data-manual="1" placeholder="자동" value="${h.manual ?? ''}" ${dis}>
              <span class="muted">${hp && !hp.manual ? `기본 ${hp.base}점${h.winner === dealer ? ` + 부친 ${DEALER_BONUS}점` : ''} = <b>${hp.points}점</b>` : '숫자를 넣으면 계산 대신 이 점수를 써요 (부친 보너스 포함)'}</span></div>
          </div>` : ''}

          <div class="sp-pay">${h.result === 'draw' ? '점수 이동 없음' : pay}</div>

          <div class="round-nav">
            <button class="btn ghost" data-nav="-1" ${hi === 0 ? 'disabled' : ''}>◀ 이전</button>
            ${hi < d.hands.length - 1 ? `<button class="btn" data-nav="1">다음 판 ▶</button>` : ''}
            ${readonly ? '' : `<button class="btn ${hi === d.hands.length - 1 || busted ? 'primary' : 'ghost'}" data-act="finish">게임 종료</button>`}
          </div>
          <details class="sp-rules"><summary class="muted">점수 규칙 보기</summary>
            <p class="muted">순자 1점 · 커쯔 2점 · 도라/적패(빨간 삭수·중) 1장당 1점 · 탕야오(2~8만) +1 · 찬타(두 몸통 모두 1·9·발·중 포함) +2 · 올그린(2·3·4·6·8·발만) 10 · 친야오(1·9·발·중만) 15 · 슈퍼레드(전부 빨강) 20.
            부친 보너스(+2)를 빼고 ${MIN_POINTS}점 이상이어야 날 수 있어요. 론은 버린 사람이 전부, 쯔모는 나머지가 나눠서(올림) 내요.</p>
          </details>
        </section>
        <section class="card board-card">
          <h3>점수표</h3>
          <div class="table-wrap">
            <table class="score">
              <thead><tr><th>판</th>${players.map((p) => `<th>${esc(p.name)}</th>`).join('')}</tr></thead>
              <tbody>
                <tr><td>시작</td>${players.map(() => `<td class="muted">${startPts(session)}</td>`).join('')}</tr>
                ${d.hands.map((hh, i) => `<tr class="${i === hi ? 'cur' : ''}" data-hand="${i}"><td>${handName(session, i)}</td>${players.map((_, pi) => {
                  const v = perHand[i]?.[pi];
                  if (hh.result === 'draw') return '<td class="muted">유국</td>';
                  if (v == null) return '<td></td>';
                  return `<td>${v ? `<span class="${v > 0 ? 'pos' : 'neg'}">${sign(v)}</span>` : '<span class="muted">0</span>'}${hh.winner === pi ? `<span class="muted"> ${hh.how === 'ron' ? '론' : '쯔모'}</span>` : ''}</td>`;
                }).join('')}</tr>`).join('')}
              </tbody>
              <tfoot><tr><td>합계</td>${totals.map((t) => `<td><b class="${t < 0 ? 'neg' : ''}">${t}</b></td>`).join('')}</tr></tfoot>
            </table>
          </div>
        </section>
        </div>`;
    };

    const save = () => { ctx.save(); draw(); };

    root.onclick = (e) => {
      const t = e.target.closest('button, tr[data-hand]');
      if (!t || t.disabled) return;
      const ds = t.dataset;
      if (ds.hand != null) { d.current = Number(ds.hand); ctx.save(); draw(); return; }
      if (ds.nav) { d.current = Math.max(0, Math.min(d.hands.length - 1, d.current + Number(ds.nav))); ctx.save(); draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      if (ds.act === 'finish') { ctx.finish(); return; }
      if (readonly) return;
      const h = d.hands[d.current];
      if (ds.win != null) {
        const pi = Number(ds.win);
        if (h.result === 'win' && h.winner === pi) Object.assign(h, emptyHand());
        else { h.result = 'win'; h.winner = pi; if (h.from === pi) h.from = null; }
        return save();
      }
      if (ds.draw) { Object.assign(h, emptyHand(), h.result === 'draw' ? {} : { result: 'draw' }); return save(); }
      if (ds.how) { h.how = ds.how; if (ds.how === 'tsumo') h.from = null; return save(); }
      if (ds.from != null) { h.from = Number(ds.from); return save(); }
      if (ds.set != null) { h.sets[Number(ds.set)] = ds.kind; return save(); }
      if (ds.step) { h[ds.step] = Math.max(0, Math.min(6, (Number(h[ds.step]) || 0) + Number(ds.v))); return save(); }
      if (ds.yaku) {
        h[ds.yaku] = !h[ds.yaku];
        // 탕야오와 찬타는 동시에 성립할 수 없음
        if (h[ds.yaku]) { if (ds.yaku === 'tanyao') h.chanta = false; else h.tanyao = false; }
        return save();
      }
      if (ds.yakuman) { h.yakuman = h.yakuman === ds.yakuman ? null : ds.yakuman; return save(); }
    };
    root.onchange = (e) => {
      if (!e.target.dataset.manual || readonly) return;
      const v = e.target.value.trim();
      d.hands[d.current].manual = v === '' ? null : Math.max(0, Math.round(Number(v) || 0));
      save();
    };
    draw();
  },
};
