// 몽타주: 그림이 한 장씩 지나가다가 앞에서 나온 그림이 처음으로 다시 나오면 먼저 자기 버튼을 누르는 기억 게임
//  맞게 누르면 +1, 아직 반복되지 않았는데 누르면 -1 (그 라운드는 더 못 누름)
// session.data = { maxRounds, speed, rounds:[{ seq:[그림 번호], rep:반복이 나오는 위치, log:[{ p, ok, at }], end:'hit'|'miss' }] }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const PICS = ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦉', '🐴', '🦄', '🐝', '🐞', '🦋', '🐢', '🐍', '🐙', '🦀', '🐟', '🐬', '🐳', '🦒', '🐘', '🦔', '🍎', '🍌', '🍇', '🍓', '🍒', '🍑', '🥕', '🌽', '🍄', '🌵', '🌻', '🌙', '⭐', '☂️', '⚽', '🎈', '🚗', '🚲', '✈️', '🚀', '⏰', '🎸', '📚', '✏️', '🔑', '🎁'];
const SPEEDS = { 0: 1600, 1: 1100, 2: 750 };
const MISS_AFTER = 3; // 반복 그림 뒤로 이만큼 더 지나가도록 아무도 안 누르면 놓침

// 앞쪽은 서로 다른 그림, rep 번째에 앞에서 나온 그림 하나를 다시, 그 뒤는 새 그림
export function makeRound(minLen = 5, maxLen = 16) {
  const order = [...PICS.keys()];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const rep = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
  const seq = order.slice(0, rep);
  seq.push(seq[Math.floor(Math.random() * Math.max(1, rep - 1))]); // 바로 앞 그림은 너무 쉬우니 빼고
  seq.push(...order.slice(rep, rep + MISS_AFTER));
  return { seq, rep, log: [], end: null };
}

const scoresOf = (session) => {
  const sc = session.players.map(() => 0);
  for (const r of session.data.rounds) for (const l of r.log) sc[l.p] += l.ok ? 1 : -1;
  return sc;
};

export default {
  id: 'montage',
  name: '몽타주',
  guide: {
    players: '1~6명', time: '5~10분',
    intro: '그림이 한 장씩 빠르게 지나가요. 앞에서 이미 나온 그림이 처음으로 다시 나오는 순간, 가장 먼저 자기 버튼을 누르는 사람이 점수를 얻는 기억력·순발력 게임이에요.',
    rules: [
      '"시작"을 누르면 그림이 한 장씩 나와요. 모두 화면을 같이 보세요.',
      '앞에서 나온 그림이 다시 나오면 바로 자기 이름 버튼을 누르세요. 가장 먼저 누른 사람이 1점을 얻고 라운드가 끝나요.',
      '아직 다시 나온 그림이 없는데 누르면 1점을 잃고, 그 라운드에서는 더 누를 수 없어요.',
      `다시 나온 그림 뒤로 ${MISS_AFTER}장이 더 지나도록 아무도 못 누르면 그 라운드는 아무도 점수를 못 얻어요.`,
      '빠르기는 새 게임 화면에서 고를 수 있어요. 아이와 할 때는 "느리게"를 추천해요.',
    ],
    scoring: ['맞게 누르면 +1점, 너무 일찍 누르면 -1점이에요. 라운드가 다 끝나면 점수가 높은 사람이 이겨요.'],
    tips: [
      '그림 이름을 마음속으로 짧게 불러 보면 더 잘 기억나요. "개, 사과, 별…"',
      '뒤로 갈수록 헷갈려요. 처음 몇 장을 특히 잘 기억해 두세요.',
    ],
  },
  minPlayers: 1,
  maxPlayers: 6,
  pickHint: '함께 화면을 보는 사람을 모두 고르세요. 혼자 해도 돼요.',
  settingsFields: [
    { key: 'rounds', label: '라운드 수', default: 5, options: [3, 5, 8, 10].map((v) => ({ value: v, label: `${v}라운드` })) },
    { key: 'speed', label: '빠르기', default: 1, options: [{ value: 0, label: '느리게' }, { value: 1, label: '보통' }, { value: 2, label: '빠르게' }] },
  ],
  roundLabel: '라운드',

  initData(players, settings) {
    return { maxRounds: Number(settings?.rounds ?? 5), speed: Number(settings?.speed ?? 1), rounds: [] };
  },
  computeTotals(session) { return scoresOf(session); },
  incompleteCount(session) { const d = session.data; return d.maxRounds - d.rounds.filter((r) => r.end).length; },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const players = session.players;
    const readonly = session.status === 'finished';
    let shown = -1; // 지금 보이는 그림 위치
    let timer = null;
    let msg = ''; let ok = false;
    const cur = () => d.rounds[d.rounds.length - 1];
    const running = () => timer != null;
    const finishedRounds = () => d.rounds.filter((r) => r.end).length;
    const allDone = () => finishedRounds() >= d.maxRounds;

    const stop = () => { clearInterval(timer); timer = null; };
    const endRound = (how) => {
      stop();
      cur().end = how;
      ctx.save(); draw();
      if (allDone()) setTimeout(() => ctx.finish({ ask: false }), 1400);
    };
    const step = () => {
      if (!root.isConnected) return stop();
      shown++;
      const r = cur();
      if (shown >= r.seq.length) { msg = `놓쳤어요. ${shown > r.rep ? `${r.rep + 1}번째 그림이 다시 나온 그림이었어요` : ''}`; ok = false; return endRound('miss'); }
      const pic = root.querySelector('#mt-pic');
      if (pic) { pic.textContent = PICS[r.seq[shown]]; pic.classList.remove('pop'); void pic.offsetWidth; pic.classList.add('pop'); }
      const cnt = root.querySelector('#mt-count');
      if (cnt) cnt.textContent = `${shown + 1}장째`;
    };
    const start = () => {
      d.rounds.push(makeRound());
      shown = -1; msg = ''; ctx.save();
      timer = setInterval(step, SPEEDS[d.speed] ?? 1100);
      draw();
      step();
    };
    const press = (p) => {
      const r = cur();
      if (!running() || r.end || r.log.some((l) => l.p === p)) return;
      const good = shown >= r.rep;
      r.log.push({ p, ok: good, at: shown });
      if (good) { msg = `${players[p].name} 정답! +1`; ok = true; return endRound('hit'); }
      msg = `${players[p].name} 너무 빨라요 -1`; ok = false;
      ctx.save();
      // 모두 틀렸으면 라운드 끝
      if (r.log.length >= players.length) return endRound('miss');
      drawButtons();
    };

    const buttonsHtml = () => {
      const r = cur();
      return players.map((p, i) => {
        const out = r && !r.end && r.log.some((l) => l.p === i);
        return `<button class="mt-btn" data-p="${i}" ${!running() || out ? 'disabled' : ''}>${players.length === 1 ? '나왔다!' : esc(p.name)}</button>`;
      }).join('');
    };
    const drawButtons = () => { const el = root.querySelector('.mt-btns'); if (el) el.innerHTML = buttonsHtml(); const m = root.querySelector('.quiz-msg'); if (m) { m.textContent = msg; m.className = `quiz-msg ${ok ? 'ok' : 'no'}`; } };

    const draw = () => {
      const sc = scoresOf(session);
      const r = cur();
      const lastPic = r && r.end ? PICS[r.seq[r.rep]] : '';
      root.innerHTML = `<section class="card mt-card">
        <div class="quiz-head"><b>${Math.min(finishedRounds() + (running() ? 1 : 0), d.maxRounds) || 0} / ${d.maxRounds} 라운드</b><span class="muted">${players.map((p, i) => `${esc(p.name)} ${sc[i]}`).join(' · ')}</span></div>
        <div class="mt-stage"><span id="mt-pic" class="mt-pic">${running() && r ? PICS[r.seq[Math.max(0, shown)]] : r?.end ? lastPic : '❔'}</span><small id="mt-count" class="muted">${running() ? `${shown + 1}장째` : r?.end ? `다시 나온 그림 (${r.rep + 1}번째)` : ''}</small></div>
        <p class="quiz-msg ${ok ? 'ok' : 'no'}">${esc(msg)}</p>
        <div class="mt-btns" style="--n:${Math.min(players.length, 3)}">${buttonsHtml()}</div>
        <div class="chess-actions">
          ${readonly ? '' : allDone() ? '<button class="btn primary" data-act="finish">전적에 기록</button>' : running() ? '' : `<button class="btn primary" data-act="start">${d.rounds.length ? '다음 라운드 시작' : '시작'}</button>`}
        </div>
      </section>`;
    };

    root.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'finish') return ctx.finish({ ask: false });
      if (readonly) return;
      if (b.dataset.act === 'start' && !running() && !allDone()) return start();
      if (b.dataset.p != null) press(Number(b.dataset.p));
    };
    // 버튼은 누르는 순간 반응하도록 pointerdown 으로도 받음
    root.onpointerdown = (e) => { const b = e.target.closest('.mt-btn'); if (b && !b.disabled) { e.preventDefault(); press(Number(b.dataset.p)); } };
    // 라운드 도중 화면을 떠났다 오면 그 라운드는 무효로 다시 시작
    if (cur() && !cur().end) { d.rounds.pop(); ctx.save(); }
    draw();
  },
};
