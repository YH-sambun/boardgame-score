// 수식 100: 라운드마다 똑같이 받은 숫자 카드와 연산 카드로 목표 수(기본 100)에 가장 가까운 식을 만드는 게임
//  숫자 카드를 붙여 놓으면 두 자리 수가 됨 (1 다음 2 → 12). 카드는 한 번씩만, 곱셈·나눗셈 먼저 계산
//  여럿이면 한 기기를 돌려 가며 자기 차례에만 가림막을 열고 식을 만듦. 모두 내면 한꺼번에 공개
// session.data = { target, maxRounds, rounds:[{ digits:[숫자], ops:['+','-','×','÷'], subs:{ 자리: { cards:[카드 번호], val:값|null } } }] }
//  카드 번호: 0~(숫자 개수-1) 은 숫자 카드, 그 뒤는 연산 카드
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const OPS = ['+', '-', '×', '÷'];
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const frac = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d) || 1; return [n / g, d / g]; };
const mul = ([a, b], [c, d]) => frac(a * c, b * d);
const div = ([a, b], [c, d]) => (c === 0 ? null : frac(a * d, b * c));
const add = ([a, b], [c, d]) => frac(a * d + c * b, b * d);
const sub = ([a, b], [c, d]) => frac(a * d - c * b, b * d);

// 카드 번호 목록 → 토큰 (붙은 숫자는 하나의 수). 형식이 틀리면 null
export function tokens(cards, round) {
  const nd = round.digits.length;
  const out = [];
  for (const c of cards) {
    if (c < nd) {
      const v = round.digits[c];
      if (typeof out[out.length - 1] === 'number') out[out.length - 1] = out[out.length - 1] * 10 + v; else out.push(v);
    } else {
      if (typeof out[out.length - 1] !== 'number') return null;
      out.push(round.ops[c - nd]);
    }
  }
  if (!out.length || typeof out[out.length - 1] !== 'number') return null;
  return out;
}
// 값 계산 (분수로 정확하게). 0으로 나누면 null
export function evaluate(tk) {
  if (!tk) return null;
  const terms = []; const signs = [];
  let cur = frac(tk[0]);
  for (let k = 1; k < tk.length; k += 2) {
    const op = tk[k]; const v = frac(tk[k + 1]);
    if (op === '×') cur = mul(cur, v);
    else if (op === '÷') { cur = div(cur, v); if (!cur) return null; } else { terms.push(cur); signs.push(op); cur = v; }
  }
  terms.push(cur);
  let acc = terms[0];
  signs.forEach((s, k) => { acc = s === '+' ? add(acc, terms[k + 1]) : sub(acc, terms[k + 1]); });
  return acc;
}
const valText = (f) => (!f ? '' : f[1] === 1 ? String(f[0]) : `${f[0]}/${f[1]}`);
const valNum = (f) => (f ? f[0] / f[1] : null);
export function pointsFor(val, target) {
  if (val == null) return 0;
  const diff = Math.abs(val - target);
  return diff === 0 ? 10 : diff <= 2 ? 7 : diff <= 5 ? 5 : diff <= 10 ? 3 : diff <= 20 ? 1 : 0;
}

function dealRound(target) {
  const n = target >= 100 ? 6 : 5;
  const digits = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 9));
  return { digits, ops: OPS.slice(), subs: {} };
}
const roundPts = (r, seat, target) => { const s = r.subs[seat]; return s ? pointsFor(s.val, target) : 0; };

export default {
  id: 'equation',
  name: '수식 100',
  guide: {
    players: '1~6명', time: '10~15분',
    intro: '모두 똑같은 숫자 카드와 연산 카드(+ − × ÷)를 받아, 목표 수(기본 100)에 가장 가까운 식을 만드는 계산 게임이에요.',
    rules: [
      '라운드마다 숫자 카드 몇 장과 + − × ÷ 카드가 한 장씩 나와요. 모두 같은 카드를 써요.',
      '카드를 눌러 식을 만들어요. 숫자 카드를 연달아 누르면 붙어서 두 자리 수가 돼요(1, 2 → 12).',
      '카드는 한 번씩만 쓸 수 있고, 모두 쓸 필요는 없어요. 곱셈·나눗셈을 먼저 계산해요.',
      '여럿이 할 때는 자기 차례에 "보기"를 눌러 몰래 식을 만들고 "제출"한 뒤 기기를 넘겨요. 모두 내면 한꺼번에 공개해요.',
      '못 만들겠으면 "패스"해도 돼요(0점).',
    ],
    scoring: ['목표와 같으면 10점, 차이가 2 이하면 7점, 5 이하면 5점, 10 이하면 3점, 20 이하면 1점이에요.', '정한 라운드가 끝나면 점수 합이 가장 높은 사람이 이겨요.'],
    tips: [
      '먼저 큰 수를 곱해서 목표 근처로 간 뒤, 남은 카드로 더하고 빼서 맞추세요. 예: 12 × 8 = 96, + 4 → 100',
      '두 자리 수를 만들 때 어떤 숫자를 앞에 둘지가 중요해요.',
      '÷는 딱 나누어떨어지지 않아도 돼요. 분수 값도 그대로 계산해요.',
    ],
  },
  minPlayers: 1,
  maxPlayers: 6,
  pickHint: '함께 할 사람을 모두 고르세요. 혼자 해도 돼요.',
  settingsFields: [
    { key: 'target', label: '목표 수', default: 100, options: [{ value: 100, label: '100 (기본)' }, { value: 24, label: '24 (쉬움, 숫자 5장)' }] },
    { key: 'rounds', label: '라운드 수', default: 5, options: [3, 5, 7].map((v) => ({ value: v, label: `${v}라운드` })) },
  ],
  roundLabel: '라운드',

  initData(players, settings) {
    const target = Number(settings?.target ?? 100);
    return { target, maxRounds: Number(settings?.rounds ?? 5), rounds: [dealRound(target)] };
  },
  computeTotals(session) {
    const d = session.data;
    return session.players.map((_, i) => d.rounds.reduce((a, r) => a + roundPts(r, i, d.target), 0));
  },
  incompleteCount(session) {
    const d = session.data; const n = session.players.length;
    const full = d.rounds.filter((r) => Object.keys(r.subs).length >= n).length;
    return d.maxRounds - full;
  },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const players = session.players;
    const n = players.length;
    const readonly = session.status === 'finished';
    let open = n === 1;
    let cards = [];
    let msg = '';
    const cur = () => d.rounds[d.rounds.length - 1];
    const allIn = (r = cur()) => Object.keys(r.subs).length >= n;
    const seat = () => [...Array(n).keys()].find((i) => !cur().subs[i]);
    const allDone = () => d.rounds.length >= d.maxRounds && allIn();

    const cardHtml = (r, c, used) => {
      const nd = r.digits.length;
      const label = c < nd ? r.digits[c] : r.ops[c - nd];
      return `<button class="eq-card ${c < nd ? 'num' : 'op'}" data-c="${c}" ${used ? 'disabled' : ''}>${label}</button>`;
    };
    const exprText = (r, cs) => { const tk = tokens(cs, r); if (!tk) return cs.length ? '(식이 아직 끝나지 않았어요)' : ''; return tk.join(' '); };

    const builder = () => {
      const r = cur(); const s = seat();
      if (!open) {
        return `<div class="bw-curtain"><p><b>${esc(players[s].name)}</b> 차례예요.<br>다른 사람은 화면을 보지 마세요.</p><button class="btn primary" data-act="open">보기</button></div>`;
      }
      const tk = tokens(cards, r);
      const val = evaluate(tk);
      const nCards = r.digits.length + r.ops.length;
      return `<div class="eq-build">
        <div class="eq-expr">${esc(exprText(r, cards)) || '<span class="muted">카드를 눌러 식을 만드세요</span>'}${val ? ` <b>= ${valText(val)}</b>` : ''}</div>
        <div class="eq-cards">${[...Array(nCards).keys()].map((c) => cardHtml(r, c, cards.includes(c))).join('')}</div>
        <div class="chess-actions">
          <button class="btn small" data-act="back" ${cards.length ? '' : 'disabled'}>하나 지우기</button>
          <button class="btn small" data-act="clear" ${cards.length ? '' : 'disabled'}>모두 지우기</button>
          <button class="btn small" data-act="pass">패스</button>
          <button class="btn primary small" data-act="submit" ${val ? '' : 'disabled'}>제출${val ? ` (${pointsFor(valNum(val), d.target)}점)` : ''}</button>
        </div></div>`;
    };

    const resultTable = (r) => `<table class="eq-res"><tbody>${players.map((p, i) => {
      const s = r.subs[i];
      const tk = s ? tokens(s.cards, r) : null;
      return `<tr><td>${esc(p.name)}</td><td>${tk ? esc(tk.join(' ')) : '<span class="muted">패스</span>'}</td><td>${s?.val != null ? valText(evaluate(tk)) : ''}</td><td><b>${roundPts(r, i, d.target)}점</b></td></tr>`;
    }).join('')}</tbody></table>`;

    const draw = () => {
      const r = cur();
      const totals = players.map((_, i) => d.rounds.reduce((a, x) => a + roundPts(x, i, d.target), 0));
      root.innerHTML = `<section class="card eqn-card">
        <div class="quiz-head"><b>${d.rounds.length} / ${d.maxRounds} 라운드 · 목표 ${d.target}</b><span class="muted">${players.map((p, i) => `${esc(p.name)} ${totals[i]}`).join(' · ')}</span></div>
        ${!allIn() && n > 1 ? `<p class="muted center">제출: ${players.map((p, i) => `${esc(p.name)} ${r.subs[i] ? '✓' : '…'}`).join(' · ')}</p>` : ''}
        ${readonly ? '' : allIn() ? `${resultTable(r)}<div class="chess-actions">${allDone() ? '<button class="btn primary" data-act="finish">전적에 기록</button>' : '<button class="btn primary" data-act="next">다음 라운드</button>'}</div>` : builder()}
        <p class="quiz-msg no">${esc(msg)}</p>
        ${d.rounds.length > 1 || readonly ? `<details class="eq-past"><summary class="muted">지난 라운드 보기</summary>${d.rounds.filter((x) => allIn(x) && (x !== r || readonly)).map((x, k) => `<p class="muted">${k + 1}라운드 · 카드 ${x.digits.join(' ')}</p>${resultTable(x)}`).join('')}</details>` : ''}
      </section>`;
    };

    const submit = (val) => {
      const s = seat();
      cur().subs[s] = { cards: val ? cards.slice() : [], val: val ? valNum(val) : null };
      cards = []; open = n === 1; msg = '';
      ctx.save(); draw();
      if (allDone()) setTimeout(() => ctx.finish({ ask: false }), 1500);
    };

    root.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'finish') return ctx.finish({ ask: false });
      if (readonly) return;
      if (act === 'next') { if (!allIn() || d.rounds.length >= d.maxRounds) return; d.rounds.push(dealRound(d.target)); open = n === 1; cards = []; ctx.save(); return draw(); }
      if (allIn()) return;
      if (act === 'open') { open = true; return draw(); }
      if (b.dataset.c != null) {
        const c = Number(b.dataset.c);
        if (cards.includes(c)) return;
        const r = cur();
        const isOp = c >= r.digits.length;
        const lastIsOp = cards.length && cards[cards.length - 1] >= r.digits.length;
        if (isOp && (!cards.length || lastIsOp)) { msg = '연산 카드는 숫자 다음에만 놓을 수 있어요'; return draw(); }
        // 세 자리 이상은 막음
        if (!isOp && (tokens([...cards, c], r) || []).pop() > 99) { msg = '숫자는 두 자리까지 붙일 수 있어요'; return draw(); }
        msg = ''; cards.push(c); return draw();
      }
      if (act === 'back') { cards.pop(); msg = ''; return draw(); }
      if (act === 'clear') { cards = []; msg = ''; return draw(); }
      if (act === 'pass') { if (!confirm('이번 라운드를 패스할까요? 0점이에요.')) return; return submit(null); }
      if (act === 'submit') { const v = evaluate(tokens(cards, cur())); if (!v) return; return submit(v); }
    };
    draw();
  },
};
