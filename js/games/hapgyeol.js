// 결! 합!: 타일 9장에서 "합"(세 속성이 각각 모두 같거나 모두 다른 3장)을 찾아 외치고, 더 없으면 "결!"
//  타일 27장 = 도형 3 × 도형색 3 × 배경색 3. 라운드마다 9장을 새로 깔아요.
//  한 화면을 같이 보고, 외친 사람 이름을 먼저 누른 뒤 타일 3장(또는 결!)을 고름
// session.data = { maxRounds, rounds:[{ tiles:[9], found:['0,3,7'], log:[{ p, kind:'hap'|'gyul', cells?, ok, pts }], done }] }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SHAPES = ['동그라미', '세모', '네모'];
const COLORS = ['#d8342c', '#f2c200', '#2453b8'];
const COLOR_NAMES = ['빨강', '노랑', '파랑'];
const BGS = ['#ffffff', '#9aa0a8', '#222831'];
const BG_NAMES = ['흰', '회색', '검정'];
const attrs = (t) => [t % 3, Math.floor(t / 3) % 3, Math.floor(t / 9)];

export const isHap = (a, b, c) => {
  const x = attrs(a); const y = attrs(b); const z = attrs(c);
  return [0, 1, 2].every((k) => (x[k] + y[k] + z[k]) % 3 === 0);
};
// 판에 있는 모든 합 (칸 번호 0~8 세 개, 작은 순)
export function allHaps(tiles) {
  const out = [];
  for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) for (let k = j + 1; k < 9; k++) if (isHap(tiles[i], tiles[j], tiles[k])) out.push(`${i},${j},${k}`);
  return out;
}
function deal() {
  const xs = [...Array(27).keys()];
  for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; }
  return xs.slice(0, 9);
}

export function tileSvg(t) {
  const [s, c, b] = attrs(t);
  const fill = COLORS[c];
  const stroke = b === 2 ? '#fff' : '#1d2a3a';
  const shape = s === 0 ? `<circle cx="50" cy="50" r="30" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`
    : s === 1 ? `<polygon points="50,16 86,80 14,80" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>`
      : `<rect x="20" y="20" width="60" height="60" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
  return `<svg viewBox="0 0 100 100" aria-label="${BG_NAMES[b]} 바탕 ${COLOR_NAMES[c]} ${SHAPES[s]}"><rect x="2" y="2" width="96" height="96" rx="10" fill="${BGS[b]}" stroke="#8a8f98" stroke-width="2"/>${shape}</svg>`;
}

const scoresOf = (session) => {
  const sc = session.players.map(() => 0);
  for (const r of session.data.rounds) for (const l of r.log) sc[l.p] += l.pts;
  return sc;
};

export default {
  id: 'hapgyeol',
  name: '결! 합!',
  guide: {
    players: '1~6명', time: '10~20분',
    intro: '타일 9장을 보고 규칙에 맞는 세 장 묶음 "합"을 찾아 외치는 순발력 게임이에요. 더 찾을 합이 없다고 생각되면 "결!"을 외쳐요.',
    rules: [
      '타일은 도형(동그라미·세모·네모), 도형 색(빨강·노랑·파랑), 배경 색(흰·회색·검정) 세 가지 속성이 있어요.',
      '세 장을 골랐을 때 도형, 도형 색, 배경 색이 각각 "셋 다 같거나 셋 다 다르면" 합이에요. 하나라도 두 개만 같으면 합이 아니에요.',
      '찾았으면 "합!"을 외치고, 외친 사람 이름을 누른 뒤 타일 세 장을 누르세요. 앱이 맞는지 판정해요.',
      '이미 나온 합을 또 외치거나 틀리면 1점을 잃어요.',
      '남은 합이 없다고 생각되면 이름을 누르고 "결!"을 눌러요. 맞으면 3점을 얻고 다음 라운드로 넘어가요. 틀리면 1점을 잃어요.',
    ],
    scoring: ['합 +1점, 결 +3점, 틀리거나 이미 나온 합은 -1점이에요.', '정한 라운드가 끝나면 점수가 가장 높은 사람이 이겨요.'],
    tips: [
      '한 속성씩 보세요. 예를 들어 배경이 모두 흰색인 타일들 안에서 먼저 찾으면 빨라요.',
      '두 장을 정하면 합을 완성하는 세 번째 장은 딱 한 종류로 정해져요. 그 타일이 판에 있는지만 확인하면 돼요.',
      '결은 3점이라 크지만, 틀리면 감점이에요. 남은 합을 끝까지 확인하고 외치세요.',
    ],
  },
  minPlayers: 1,
  maxPlayers: 6,
  pickHint: '함께 화면을 보는 사람을 모두 고르세요. 혼자 해도 돼요.',
  settingsFields: [
    { key: 'rounds', label: '라운드 수', default: 5, options: [3, 5, 7, 10].map((v) => ({ value: v, label: `${v}라운드` })) },
  ],
  roundLabel: '라운드',

  initData(players, settings) {
    return { maxRounds: Number(settings?.rounds ?? 5), rounds: [{ tiles: deal(), found: [], log: [], done: false }] };
  },
  computeTotals(session) { return scoresOf(session); },
  incompleteCount(session) {
    const d = session.data;
    return d.maxRounds - d.rounds.filter((r) => r.done).length;
  },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const players = session.players;
    const readonly = session.status === 'finished';
    let caller = players.length === 1 ? 0 : null;
    let picked = [];
    let msg = ''; let ok = false;
    const cur = () => d.rounds[d.rounds.length - 1];
    const allDone = () => d.rounds.length >= d.maxRounds && cur().done;

    const judgeHap = () => {
      const r = cur();
      const key = [...picked].sort((a, b) => a - b).join(',');
      const valid = isHap(...picked.map((i) => r.tiles[i]));
      const dup = r.found.includes(key);
      const good = valid && !dup;
      r.log.push({ p: caller, kind: 'hap', cells: key, ok: good, pts: good ? 1 : -1 });
      if (good) r.found.push(key);
      const name = players[caller].name;
      msg = good ? `${name}: 합! +1` : dup ? `${name}: 이미 나온 합이에요 -1` : `${name}: 합이 아니에요 -1`;
      ok = good;
      picked = []; if (players.length > 1) caller = null;
      ctx.save(); draw();
    };
    const judgeGyul = () => {
      const r = cur();
      const left = allHaps(r.tiles).filter((k) => !r.found.includes(k));
      const good = left.length === 0;
      r.log.push({ p: caller, kind: 'gyul', ok: good, pts: good ? 3 : -1 });
      const name = players[caller].name;
      if (good) { r.done = true; msg = `${name}: 결! +3`; } else msg = `${name}: 아직 합이 남아 있어요 -1`;
      ok = good;
      picked = []; if (players.length > 1) caller = null;
      ctx.save(); draw();
      if (allDone()) setTimeout(() => ctx.finish({ ask: false }), 1200);
    };

    const draw = () => {
      const r = cur();
      const sc = scoresOf(session);
      const remain = r.done ? 0 : null;
      root.innerHTML = `<section class="card hg-card">
        <div class="quiz-head"><b>${d.rounds.length} / ${d.maxRounds} 라운드</b><span class="muted">나온 합 ${r.found.length}개${remain === 0 ? ' · 끝' : ''}</span></div>
        <div class="hg-players">${players.map((p, i) => `<button class="hg-p ${caller === i ? 'on' : ''}" data-p="${i}" ${readonly || r.done ? 'disabled' : ''}>${esc(p.name)}<b>${sc[i]}</b></button>`).join('')}</div>
        <div class="chess-status">${readonly ? '끝난 게임이에요' : r.done ? (allDone() ? '모든 라운드가 끝났어요' : '라운드 끝! 다음 라운드로 넘어가세요') : caller == null ? '외친 사람 이름을 먼저 누르세요' : `${esc(players[caller].name)}: 타일 3장을 고르거나 결!`}</div>
        <div class="hg-board">${r.tiles.map((t, i) => `<button class="hg-t ${picked.includes(i) ? 'sel' : ''}" data-i="${i}" ${caller == null || r.done || readonly ? 'disabled' : ''}><span class="hg-n">${i + 1}</span>${tileSvg(t)}</button>`).join('')}</div>
        <p class="quiz-msg ${ok ? 'ok' : 'no'}">${esc(msg)}</p>
        <div class="chess-actions">
          ${readonly ? '' : r.done
    ? (allDone() ? '<button class="btn primary small" data-act="finish">전적에 기록</button>' : '<button class="btn primary small" data-act="next">다음 라운드</button>')
    : `<button class="btn primary small" data-act="gyul" ${caller == null ? 'disabled' : ''}>결!</button>
             ${players.length > 1 ? `<button class="btn small" data-act="cancel" ${caller == null ? 'disabled' : ''}>취소</button>` : ''}`}
        </div>
        ${r.found.length ? `<p class="muted center">나온 합: ${r.found.map((k) => k.split(',').map((x) => Number(x) + 1).join('-')).join(' · ')}</p>` : ''}
        ${r.done ? `<p class="muted center">이 판의 합은 모두 ${allHaps(r.tiles).length}개였어요.</p>` : ''}
      </section>`;
    };

    root.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'finish') return ctx.finish({ ask: false });
      if (readonly) return;
      if (act === 'next') {
        if (!cur().done || d.rounds.length >= d.maxRounds) return;
        d.rounds.push({ tiles: deal(), found: [], log: [], done: false });
        msg = ''; picked = []; ctx.save(); return draw();
      }
      if (act === 'cancel') { caller = null; picked = []; return draw(); }
      if (act === 'gyul') { if (caller != null) judgeGyul(); return; }
      if (b.dataset.p != null) { caller = Number(b.dataset.p); picked = []; msg = ''; return draw(); }
      if (b.dataset.i != null && caller != null) {
        const i = Number(b.dataset.i);
        picked = picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i];
        if (picked.length === 3) return judgeHap();
        return draw();
      }
    };
    draw();
  },
};
