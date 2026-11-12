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

import { dieFace } from '../tools.js?v=202611121529';
import { isCpu, levelField, cpuPlayers, levelOf, LEVEL_NAMES, wait } from './cpu.js?v=202611121529';
import { chooseHold, chooseCategory } from './yacht-ai.js?v=202611121529';

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

// 주사위 5개로 각 칸에 들어갈 점수 (직접 플레이 모드)
export function scoreFor(key, dice) {
  const cnt = [0, 0, 0, 0, 0, 0, 0];
  dice.forEach((v) => { cnt[v]++; });
  const sum = dice.reduce((a, b) => a + b, 0);
  const has = (...xs) => xs.every((x) => cnt[x] > 0);
  const c = CATEGORIES.find((x) => x.key === key);
  if (c.upper) return cnt[c.face] * c.face;
  switch (key) {
    case 'choice': return sum;
    case 'fourKind': return cnt.some((x) => x >= 4) ? sum : 0;
    case 'fullHouse': return cnt.includes(3) && cnt.includes(2) ? sum : 0;
    case 'smallStraight': return has(1, 2, 3, 4) || has(2, 3, 4, 5) || has(3, 4, 5, 6) ? 15 : 0;
    case 'largeStraight': return has(1, 2, 3, 4, 5) || has(2, 3, 4, 5, 6) ? 30 : 0;
    case 'yacht': return cnt.includes(5) ? 50 : 0;
    default: return 0;
  }
}

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
  // 소개·도움말 (직접 정리한 요약)
  guide: {
    players: '1명 이상 (플레이 모드는 혼자 또는 컴퓨터와)', time: '20~30분',
    intro: '주사위 5개를 최대 세 번 굴려 족보를 만들고, 12칸짜리 점수표를 하나씩 채우는 주사위 게임이에요. 12칸을 모두 채웠을 때 합계가 높은 사람이 이겨요.',
    rules: [
      '내 차례에 주사위 5개를 굴려요. 마음에 드는 주사위는 남기고 나머지를 다시 굴릴 수 있어요(한 차례 최대 3번).',
      '굴리기가 끝나면 점수표에서 아직 비어 있는 칸 하나를 반드시 골라 기록해요. 조건이 안 맞으면 그 칸은 0점이에요.',
      '한 번 기록한 칸은 바꿀 수 없어요. 모두 12번씩 차례를 돌면 끝이에요.',
      '플레이 모드에서는 앱 주사위를 굴리고, 주사위를 눌러 남긴 뒤 다시 굴려요. 표의 흐린 숫자가 지금 주사위로 받을 점수이고, 누르면 바로 기록돼요.',
      '플레이 모드에서 혼자 고르면 컴퓨터(1~3명)와 겨룰 수 있어요. 컴퓨터 차례에는 컴퓨터가 알아서 굴리고 기록해요. 컴퓨터 없이 혼자 최고 점수에 도전할 수도 있어요.',
    ],
    scoring: [
      '1~6: 그 눈이 나온 주사위의 합 (예: 4가 3개면 12).',
      '상단(1~6) 합이 63점 이상이면 보너스 +35.',
      '초이스: 주사위 5개의 합 (조건 없음).',
      '포카드: 같은 눈 4개 이상이면 주사위 5개 합.',
      '풀하우스: 같은 눈 3개 + 2개면 주사위 5개 합.',
      '스몰 스트레이트: 4개 연속(예: 1-2-3-4) 15점 / 라지 스트레이트: 5개 연속 30점.',
      '요트: 5개 모두 같은 눈 50점.',
      '이 앱에서는 칸을 누르면 그 칸에 나올 수 있는 점수만 버튼으로 보여 줘요. 다음 차례인 사람도 표시돼요.',
    ],
    tips: [
      '보너스 63점은 "각 눈마다 3개씩" 모은 것과 같아요. 5·6에서 4개를 얻으면 1·2에서 조금 모자라도 괜찮아요.',
      '초이스는 망한 차례를 받아 주는 칸이에요. 너무 일찍 쓰지 마세요.',
      '버릴 칸이 필요하면 요트나 1 칸에 0점을 넣는 것도 방법이에요.',
      '어려움 컴퓨터는 남길 주사위마다 기대 점수를 계산하고 보너스 63점도 챙겨요. 이기려면 보너스를 놓치지 마세요.',
      '스트레이트를 노릴 땐 3·4가 핵심이에요. 가운데 숫자를 남기고 굴려 보세요.',
    ],
  },
  minPlayers: 1,
  maxPlayers: 8,
  settingsFields: [
    { key: 'cpus', label: '컴퓨터 상대', default: 1, show: ({ count, mode }) => mode === 'play' && count === 1, options: [{ value: 0, label: '없음 (혼자 기록)' }, ...[1, 2, 3].map((n) => ({ value: n, label: `${n}명` }))] },
    levelField(({ count, mode, settings }) => mode === 'play' && count === 1 && settings.cpus > 0),
  ],
  // 플레이 모드에서 1명만 고르면 컴퓨터를 뒤에 추가
  preparePlayers(ps, settings) {
    const n = Math.max(0, Math.min(3, Number(settings?.cpus) || 0));
    return settings?.mode === 'play' && ps.length === 1 && n ? [...ps, ...cpuPlayers(n)] : ps;
  },

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
    const playMode = session.settings?.mode === 'play';
    if (playMode && !d.play) d.play = { dice: [null, null, null, null, null], held: [false, false, false, false, false], rolls: 0 };
    const P = d.play;
    let open = null; // { key, pi }
    let rolling = false;
    const cpuSeat = players.map(isCpu);
    const hasCpu = playMode && cpuSeat.some(Boolean);
    const level = levelOf(session);
    let cpuBusy = false;
    // 다음 차례: 채운 칸이 가장 적은 사람 중 자리 순서가 빠른 사람 (모두 채웠으면 -1)
    const turnOf = () => {
      const t = computeTotals(session);
      const minDone = Math.min(...t.map((x) => x.done));
      return minDone >= CATEGORIES.length ? -1 : t.findIndex((x) => x.done === minDone);
    };
    const cpuTurn = () => hasCpu && !readonly && session.status !== 'finished' && cpuSeat[turnOf()] === true;

    const draw = () => {
      const t = computeTotals(session);
      // 다음 차례: 채운 칸이 가장 적은 사람 중 자리 순서가 빠른 사람
      const minDone = Math.min(...t.map((x) => x.done));
      const turn = minDone >= CATEGORIES.length ? -1 : t.findIndex((x) => x.done === minDone);
      const allDone = turn === -1;

      const rolled = playMode && P.rolls > 0 && !rolling;
      const cell = (c, pi) => {
        const v = val(session, c.key, pi);
        const isOpen = open && open.key === c.key && open.pi === pi;
        if (playMode) {
          const can = !readonly && rolled && pi === turn && !filled(v) && !cpuSeat[pi];
          const preview = can ? scoreFor(c.key, P.dice) : null;
          return `<td class="${pi === turn ? 'turn' : ''}"><button class="ycell ${filled(v) ? '' : 'empty'} ${v === 0 ? 'zero' : ''} ${can ? 'preview' : ''}" data-pick="${c.key}" ${can ? '' : 'disabled'}>${filled(v) ? v : can ? preview : '·'}</button></td>`;
        }
        return `<td class="${pi === turn ? 'turn' : ''}"><button class="ycell ${isOpen ? 'open' : ''} ${filled(v) ? '' : 'empty'} ${v === 0 ? 'zero' : ''}" data-cell="${c.key}" data-p="${pi}" ${readonly ? 'disabled' : ''}>${filled(v) ? v : '·'}</button></td>`;
      };
      const tray = playMode && !readonly && !allDone ? `<div class="ytray">
          <div class="dice-tray">${P.dice.map((v, i) => `<button class="die ${P.held[i] ? 'held' : ''} ${rolling && !P.held[i] ? 'rolling' : ''}" data-hold="${i}" ${P.rolls && P.rolls < 3 && !rolling && !cpuSeat[turn] ? '' : 'disabled'}>${v == null ? '' : dieFace(v)}</button>`).join('')}</div>
          <div class="row-btns"><button class="btn primary" data-act="roll" ${P.rolls >= 3 || rolling || cpuSeat[turn] ? 'disabled' : ''}>${P.rolls === 0 ? '굴리기' : `다시 굴리기 (${3 - P.rolls}번 남음)`}</button></div>
          <p class="muted center">${cpuSeat[turn] ? `${esc(players[turn].name)} 차례예요. 컴퓨터가 굴리는 중… <small>(${LEVEL_NAMES[level]})</small>` : P.rolls === 0 ? `${esc(players[turn].name)} 차례예요. 주사위를 굴리세요.` : P.rolls < 3 ? '남길 주사위를 누르고 다시 굴리거나, 표에서 기록할 칸을 누르세요.' : '표에서 기록할 칸을 누르세요.'}</p>
        </div>` : '';
      const row = (c) => `<tr><th class="cat">${esc(c.label)}</th>${players.map((_, pi) => cell(c, pi)).join('')}</tr>`;
      const pc = open && CATEGORIES.find((c) => c.key === open.key);

      root.innerHTML = `
        <section class="card yacht-card">
          <div class="round-head">
            <h2>점수표</h2>
            ${readonly ? '' : allDone ? '<span class="muted">모든 칸을 채웠어요</span>' : `<span class="ynext">다음 차례 <b>${esc(players[turn].name)}</b> · ${minDone + 1}/${CATEGORIES.length}턴</span>`}
          </div>
          ${tray}
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
          ${readonly ? '' : `<div class="round-nav"><span class="muted">${playMode ? '칸의 흐린 숫자가 지금 주사위로 받을 점수예요.' : '칸을 눌러 점수를 고르세요. 못 맞춘 칸은 0.'}</span><button class="btn primary" data-act="finish">게임 종료</button></div>`}
        </section>`;
    };

    // 굴리기 (애니메이션이 끝나면 resolve)
    const roll = () => new Promise((resolve) => {
      rolling = true; let k = 0;
      const tick = () => {
        P.dice = P.dice.map((v, i) => (P.held[i] && v != null ? v : 1 + Math.floor(Math.random() * 6)));
        if (k++ < 6) { draw(); setTimeout(tick, 60); return; }
        rolling = false; P.rolls++; ctx.save(); draw(); resolve();
      };
      tick();
    });
    const record = (key, turn) => {
      d.scores[key][turn] = scoreFor(key, P.dice);
      Object.assign(P, { dice: [null, null, null, null, null], held: [false, false, false, false, false], rolls: 0 });
      ctx.save(); draw();
      if (computeTotals(session).every((x) => x.done >= CATEGORIES.length)) setTimeout(() => ctx.finish({ ask: false }), 700);
    };

    // 컴퓨터 차례: 굴리고 → 남길 주사위 고르고 → 다시 굴리고 → 칸에 기록, 사람이 따라볼 수 있게 천천히
    const runCpu = async () => {
      if (cpuBusy || !cpuTurn()) return;
      cpuBusy = true;
      try {
        while (cpuTurn() && root.isConnected) {
          const pi = turnOf();
          await wait(600);
          if (!root.isConnected) break;
          if (P.rolls === 0) { await roll(); continue; }
          if (P.rolls < 3) {
            const hold = chooseHold(P.dice, d.scores, pi, level);
            if (!hold.every(Boolean)) {
              P.held = hold; draw();
              await wait(500);
              if (!root.isConnected) break;
              await roll();
              continue;
            }
          }
          P.held = P.dice.map(() => true); draw();
          await wait(400);
          if (!root.isConnected) break;
          record(chooseCategory(P.dice, d.scores, pi, level), pi);
        }
      } catch (err) { console.error(err); ctx.toast?.('컴퓨터 계산 오류'); } finally { cpuBusy = false; }
    };

    root.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'finish') { ctx.finish(); return; }
      if (readonly) return;
      if (playMode) {
        if (cpuTurn() || cpuBusy) return;
        const turn = turnOf();
        if (b.dataset.act === 'roll' && P.rolls < 3 && !rolling) { roll(); return; }
        if (b.dataset.hold != null) { const i = Number(b.dataset.hold); P.held[i] = !P.held[i]; ctx.save(); draw(); return; }
        if (b.dataset.pick && P.rolls > 0 && turn >= 0) { record(b.dataset.pick, turn); runCpu(); }
        return;
      }
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
    runCpu();
  },
};
