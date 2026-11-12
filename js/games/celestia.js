// 셀레스티아 점수표
//  항해(라운드)마다 각자 받은 보물 카드 점수를 입력 → 누적 합계. 누군가 목표 점수(기본 50)를 넘으면
//  그 항해가 끝날 때 게임 종료, 합계가 가장 높은 사람이 승리.
// session.data = { voyages:[{ gains:[점수|null], last:끝까지 남은 자리|null }], current }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newVoyage = (n) => ({ gains: Array(n).fill(null), last: null });

export function totalsOf(session) {
  return session.players.map((_, i) => session.data.voyages.reduce((a, v) => a + (Number(v.gains[i]) || 0), 0));
}
const isDone = (v) => v.gains.every((x) => x != null);

export default {
  id: 'celestia',
  name: '셀레스티아',
  guide: {
    players: '2~6명', time: '30분',
    intro: '비행선을 타고 구름 위 도시를 차례로 지나며 보물을 모으는 눈치 게임이에요. 다음 도시까지 같이 갈지, 지금 내려서 보물을 챙길지 매번 고민해요.',
    rules: [
      '선장이 도시 칸에 적힌 수만큼 위험 주사위를 굴려요. 나온 위험마다 선장이 맞는 장비 카드를 내야 무사히 넘어가요.',
      '선장이 카드를 내기 전에, 나머지 사람은 이 도시에서 내릴지 정해요. 내린 사람은 그 도시의 보물 카드를 한 장 가져가요.',
      '선장이 위험을 못 막으면 비행선이 떨어지고, 타고 있던 사람은 이번 항해에서 아무것도 못 받아요.',
      '모두 내리거나 비행선이 떨어지면 항해가 끝나고 새 항해를 시작해요.',
      '누군가 목표 점수(기본 50점)를 넘으면 그 항해가 끝난 뒤 게임이 끝나요.',
      '도구 탭의 셀레스티아 위험 주사위로 실물 주사위 대신 굴릴 수 있어요.',
    ],
    scoring: [
      '항해가 끝날 때마다 각자 이번 항해에 받은 보물 카드 점수 합을 입력해요. 못 받았으면 0.',
      '끝까지 남은 사람을 고르면 업적(끝까지 간 사람)에 반영돼요. 고르지 않아도 돼요.',
      '보물 카드 점수와 위험 주사위 구성은 판본마다 다를 수 있어요. 가지고 있는 룰북을 기준으로 해 주세요.',
    ],
    tips: [
      '앞쪽 도시의 보물은 점수가 낮아요. 너무 일찍 내리면 큰 점수를 놓쳐요.',
      '선장의 손에 장비 카드가 몇 장 남았는지 보면 위험을 넘을지 짐작할 수 있어요.',
      '내가 선장일 때 일부러 못 막는 척하기는 안 돼요. 낼 수 있으면 내야 해요(판본에 따라 다름).',
    ],
  },
  minPlayers: 2,
  maxPlayers: 6,
  settingsFields: [{ key: 'target', label: '목표 점수', default: 50, min: 10, max: 200 }],
  roundLabel: '항해',

  initData(players) { return { voyages: [newVoyage(players.length)], current: 0 }; },
  computeTotals: totalsOf,
  incompleteCount(session) { return session.data.voyages.filter((v) => !isDone(v) && v.gains.some((x) => x != null)).length; },

  renderPlay(root, session, ctx) {
    const players = session.players;
    const d = session.data;
    const target = session.settings?.target || 50;
    const readonly = session.status === 'finished';

    const draw = () => {
      const vi = d.current;
      const v = d.voyages[vi];
      const totals = totalsOf(session);
      const over = totals.some((t) => t >= target);
      root.innerHTML = `
        <div class="round-tabs">
          ${d.voyages.map((x, i) => `<button class="pill ${i === vi ? 'active' : ''} ${isDone(x) ? 'done' : ''}" data-v="${i}">${i + 1}</button>`).join('')}
          ${readonly ? '' : '<button class="pill" data-act="add" title="새 항해">+</button>'}
        </div>
        <div class="play-grid">
        <section class="card input-card">
          <div class="round-head">
            <h2>${vi + 1}번째 항해</h2>
            ${over && !readonly ? `<span class="warn">목표 ${target}점을 넘은 사람이 있어요. 이번 항해가 끝나면 게임 종료</span>` : `<span class="muted">목표 ${target}점</span>`}
          </div>
          ${players.map((p, pi) => `<div class="prow cel-row">
              <div class="pname">${esc(p.name)}<span class="ptotal">${totals[pi]}점</span></div>
              <div class="cel-in">
                <div class="bonus-box"><input type="number" inputmode="numeric" min="0" max="99" data-g="${pi}" value="${v.gains[pi] ?? ''}" placeholder="받은 점수" ${readonly ? 'disabled' : ''}></div>
                ${readonly ? '' : `<button class="btn small ghost" data-zero="${pi}">0</button>`}
                <button class="chip ${v.last === pi ? 'on' : ''}" data-last="${pi}" ${readonly ? 'disabled' : ''}>끝까지</button>
              </div>
            </div>`).join('')}
          <div class="round-nav">
            <button class="btn ghost" data-nav="-1" ${vi === 0 ? 'disabled' : ''}>이전</button>
            ${readonly ? (vi < d.voyages.length - 1 ? '<button class="btn" data-nav="1">다음</button>' : '')
              : `<button class="btn" data-act="next" ${isDone(v) ? '' : 'disabled'}>${vi < d.voyages.length - 1 ? '다음 항해' : '새 항해 시작'}</button>
                 <button class="btn primary" data-act="finish">게임 종료</button>`}
          </div>
          <p class="muted">빈 칸 없이 모두 입력해야 다음 항해로 넘어가요. 못 받은 사람은 0을 누르세요.</p>
        </section>
        <section class="card board-card">
          <h3>점수표</h3>
          <div class="table-wrap"><table class="score">
            <thead><tr><th>항해</th>${players.map((p) => `<th>${esc(p.name)}</th>`).join('')}</tr></thead>
            <tbody>${d.voyages.map((x, i) => `<tr class="${i === vi ? 'cur' : ''}" data-v="${i}"><td>${i + 1}</td>${players.map((_, pi) => `<td>${x.gains[pi] ?? ''}${x.last === pi ? '<small class="muted"> 끝</small>' : ''}</td>`).join('')}</tr>`).join('')}</tbody>
            <tfoot><tr><td>합계</td>${totals.map((t) => `<td class="${t >= target ? 'pos' : ''}"><b>${t}</b></td>`).join('')}</tr></tfoot>
          </table></div>
        </section></div>`;
    };

    root.oninput = (e) => {
      const pi = e.target.dataset.g;
      if (pi == null) return;
      const raw = e.target.value;
      d.voyages[d.current].gains[pi] = raw === '' ? null : Math.max(0, Math.min(99, Math.round(Number(raw)) || 0));
      ctx.save();
      // 입력 중에는 다시 그리지 않고 합계만 갱신
      const totals = totalsOf(session);
      root.querySelectorAll('.cel-row .ptotal').forEach((el, i) => { el.textContent = totals[i] + '점'; });
      const nx = root.querySelector('[data-act="next"]');
      if (nx) nx.disabled = !isDone(d.voyages[d.current]);
    };
    root.onchange = (e) => { if (e.target.dataset.g != null) draw(); };
    root.onclick = (e) => {
      const b = e.target.closest('button,tr[data-v]');
      if (!b) return;
      if (b.dataset.act === 'finish') { ctx.finish(); return; }
      if (b.dataset.v != null) { d.current = Number(b.dataset.v); return draw(); }
      if (b.dataset.nav) { d.current = Math.max(0, Math.min(d.voyages.length - 1, d.current + Number(b.dataset.nav))); return draw(); }
      if (readonly) return;
      const v = d.voyages[d.current];
      if (b.dataset.zero != null) { v.gains[b.dataset.zero] = 0; ctx.save(); return draw(); }
      if (b.dataset.last != null) { const i = Number(b.dataset.last); v.last = v.last === i ? null : i; ctx.save(); return draw(); }
      if (b.dataset.act === 'next') {
        if (d.current === d.voyages.length - 1) d.voyages.push(newVoyage(players.length));
        d.current++; ctx.save(); return draw();
      }
      if (b.dataset.act === 'add') { d.voyages.push(newVoyage(players.length)); d.current = d.voyages.length - 1; ctx.save(); return draw(); }
    };
    draw();
  },
};
