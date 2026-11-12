// 요트다이스(Yacht Dice) 점수 규칙 — 국내에서 흔히 쓰는 12칸 규칙
//  상단(Upper): 1~6 → 해당 눈의 합. 상단 합계 63점 이상이면 보너스 +35
//  하단(Lower):
//   - 초이스(Choice): 주사위 5개 합
//   - 포카드(4 of a Kind): 같은 눈 4개 이상이면 주사위 5개 합
//   - 풀하우스(Full House): 3개+2개면 주사위 5개 합
//   - 스몰 스트레이트(S. Straight): 4개 연속이면 15
//   - 라지 스트레이트(L. Straight): 5개 연속이면 30
//   - 요트(Yacht): 5개 모두 같으면 50
//  조건을 못 맞춘 칸에 기록하면 0점. 매 차례 반드시 한 칸을 채워야 하며, 12번 차례면 끝.

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const uniqSorted = (xs) => [...new Set(xs)].sort((a, b) => a - b);
const dice = range(1, 6);

// 칸마다 나올 수 있는 점수만 버튼으로 보여 줌
export const CATEGORIES = [
  ...dice.map((n) => ({ key: ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'][n - 1], label: `${n}`, long: `${n} (${n}의 합)`, upper: true, face: n, options: range(0, 5).map((c) => c * n) })),
  { key: 'choice', label: '초이스', long: '초이스 (5개 합)', options: range(5, 30) },
  { key: 'fourKind', label: '포카드', long: '포카드 (5개 합)', options: [0, ...uniqSorted(dice.flatMap((a) => dice.map((b) => 4 * a + b)))] },
  { key: 'fullHouse', label: '풀하우스', long: '풀하우스 (5개 합)', options: [0, ...uniqSorted(dice.flatMap((a) => dice.filter((b) => b !== a).map((b) => 3 * a + 2 * b)))] },
  { key: 'smallStraight', label: 'S. 스트레이트', long: '스몰 스트레이트 (15점)', options: [0, 15] },
  { key: 'largeStraight', label: 'L. 스트레이트', long: '라지 스트레이트 (30점)', options: [0, 30] },
  { key: 'yacht', label: '요트', long: '요트 (50점)', options: [0, 50] },
];
const UPPER = CATEGORIES.filter((c) => c.upper);
const LOWER = CATEGORIES.filter((c) => !c.upper);
export const BONUS_LINE = 63;
export const BONUS = 35;

const val = (session, key, pi) => session.data.scores[key]?.[pi];
const filled = (v) => v != null;

export function computeTotals(session) {
  return session.players.map((_, pi) => {
    const upper = UPPER.reduce((a, c) => a + (val(session, c.key, pi) || 0), 0);
    const lower = LOWER.reduce((a, c) => a + (val(session, c.key, pi) || 0), 0);
    const bonus = upper >= BONUS_LINE ? BONUS : 0;
    // 아직 보너스를 받을 수 있는지: 남은 상단 칸을 모두 5개로 채워도 63 미만이면 불가
    const maxUpper = upper + UPPER.filter((c) => !filled(val(session, c.key, pi))).reduce((a, c) => a + c.face * 5, 0);
    const done = CATEGORIES.filter((c) => filled(val(session, c.key, pi))).length;
    return { upper, lower, bonus, total: upper + bonus + lower, bonusLost: maxUpper < BONUS_LINE, done };
  });
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
  id: 'yacht',
  name: '요트다이스',
  emoji: '🎲',
  minPlayers: 2,
  maxPlayers: 8,
  settingsFields: [],

  initData(players) {
    return { scores: Object.fromEntries(CATEGORIES.map((c) => [c.key, Array(players.length).fill(null)])) };
  },

  computeTotals(session) { return computeTotals(session).map((t) => t.total); },

  // 아직 비어 있는 칸 수 (게임 종료 확인용)
  incompleteCount(session) {
    return computeTotals(session).reduce((a, t) => a + (CATEGORIES.length - t.done), 0);
  },

  renderPlay(root, session, ctx) {
    const players = session.players;
    const d = session.data;
    const readonly = session.status === 'finished';
    let open = null; // { key, pi }

    const draw = () => {
      const t = computeTotals(session);
      // 다음 차례: 채운 칸이 가장 적은 사람 중 자리 순서가 빠른 사람
      const minDone = Math.min(...t.map((x) => x.done));
      const turn = minDone >= CATEGORIES.length ? -1 : t.findIndex((x) => x.done === minDone);
      const allDone = turn === -1;

      const cell = (c, pi) => {
        const v = val(session, c.key, pi);
        const isOpen = open && open.key === c.key && open.pi === pi;
        return `<td class="${pi === turn ? 'turn' : ''}"><button class="ycell ${isOpen ? 'open' : ''} ${filled(v) ? '' : 'empty'} ${v === 0 ? 'zero' : ''}" data-cell="${c.key}" data-p="${pi}" ${readonly ? 'disabled' : ''}>${filled(v) ? v : '·'}</button></td>`;
      };
      const row = (c) => `<tr><th class="cat">${esc(c.label)}</th>${players.map((_, pi) => cell(c, pi)).join('')}</tr>`;
      const pc = open && CATEGORIES.find((c) => c.key === open.key);

      root.innerHTML = `
        <section class="card yacht-card">
          <div class="round-head">
            <h2>점수표</h2>
            ${readonly ? '' : allDone ? '<span class="muted">모든 칸을 채웠어요</span>' : `<span class="ynext">다음 차례 <b>${esc(players[turn].name)}</b> · ${minDone + 1}/${CATEGORIES.length}턴</span>`}
          </div>
          <div class="table-wrap">
            <table class="ytable">
              <thead><tr><th></th>${players.map((p, pi) => `<th class="${pi === turn ? 'turn' : ''}">${esc(p.name)}</th>`).join('')}</tr></thead>
              <tbody>
                ${UPPER.map(row).join('')}
                <tr class="sub"><th class="cat">소계</th>${t.map((x, pi) => `<td class="${pi === turn ? 'turn' : ''}">${x.upper}<span class="muted">/${BONUS_LINE}</span></td>`).join('')}</tr>
                <tr class="sub"><th class="cat">보너스 +${BONUS}</th>${t.map((x, pi) => `<td class="${pi === turn ? 'turn' : ''}">${x.bonus ? `<b class="pos">+${BONUS}</b>` : x.bonusLost ? '<span class="muted">✕</span>' : `<span class="muted">${BONUS_LINE - x.upper} 남음</span>`}</td>`).join('')}</tr>
                ${LOWER.map(row).join('')}
              </tbody>
              <tfoot><tr><th class="cat">총점</th>${t.map((x, pi) => `<td class="${pi === turn ? 'turn' : ''}"><b>${x.total}</b></td>`).join('')}</tr></tfoot>
            </table>
          </div>
          ${pc ? `<div class="numpad">
            <div class="numpad-label">${esc(players[open.pi].name)} · ${esc(pc.long)}</div>
            <div class="numpad-keys">
              ${pc.options.map((n) => `<button class="key ${val(session, pc.key, open.pi) === n ? 'on' : ''} ${n === 0 ? 'zero' : ''}" data-num="${n}">${n}</button>`).join('')}
              <button class="key ghost" data-num="clear">지우기</button>
            </div>
          </div>` : ''}
          ${readonly ? '' : `<div class="round-nav"><span class="muted">칸을 눌러 점수를 고르세요. 못 맞춘 칸은 0.</span><button class="btn primary" data-act="finish">게임 종료</button></div>`}
        </section>`;
    };

    root.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'finish') { ctx.finish(); return; }
      if (readonly) return;
      if (b.dataset.cell) {
        const k = b.dataset.cell; const pi = Number(b.dataset.p);
        open = open && open.key === k && open.pi === pi ? null : { key: k, pi };
        draw();
        root.querySelector('.numpad')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      if (b.dataset.num != null && open) {
        d.scores[open.key][open.pi] = b.dataset.num === 'clear' ? null : Number(b.dataset.num);
        open = null;
        ctx.save(); draw();
      }
    };
    draw();
  },
};
