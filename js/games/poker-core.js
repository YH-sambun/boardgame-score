// 섯다·포커 계열 공통 엔진 (섯다, 인디언 포커, 세븐 포커, 텍사스 홀덤)
//  - 돈 대신 칩으로만 진행. 끝났을 때 남은 칩이 그 게임의 점수(전적·순위에 그대로 누적)
//  - 사이드 팟을 없애려고, 한 판에 낼 수 있는 칩은 '살아 있는 사람 중 가장 적게 가지고 시작한 사람'의 칩까지로 묶음
//  - 혼자 고르면 컴퓨터(1~4명)와, 여러 명이면 한 기기를 돌려 가며 (차례마다 '카드 보기'로 가림)
//  - 컴퓨터는 아직 모르는 카드를 무작위로 채워 보는 몬테카를로 계산으로 이길 확률을 어림해 베팅 (쉬움·보통·어려움)
// 각 게임은 makePokerGame(spec) 에 규칙만 넘김:
//  spec = { id, name, guide, minPlayers, maxPlayers, holeCount, boardCount, steps, stageNames,
//           deck(), key(card), cardHtml(card), resolve(hands, board) → { winners, names, redeal },
//           describe(cards, board) → 지금 족보 이름, indian(내 카드는 나만 못 봄), foldPenalty(card, ante) }
//  steps: [{ deal:[앞면?…] } | { board:n } | { bet:true }] 를 차례대로 진행
//  data = { chips:[], no, dealer, carry, h:{ 이번 판 }, log:[] }

import { isCpu, levelField, cpuPlayers, levelOf, LEVEL_NAMES, wait } from './cpu.js?v=202611180606';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ───────── 트럼프 카드 (세븐 포커·홀덤) ─────────
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANK_NAME = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const rankName = (r) => RANK_NAME[r] || String(r);
export const pokerDeck = () => [0, 1, 2, 3].flatMap((s) => Array.from({ length: 13 }, (_, k) => ({ r: k + 2, s })));
export const pokerKey = (c) => `${c.r}${'shdc'[c.s]}`;
export const pokerCardHtml = (c) => `<span class="pk-card ${c.s === 1 || c.s === 2 ? 'red' : ''}"><b>${rankName(c.r)}</b><i>${SUITS[c.s]}</i></span>`;

// 5~7장 중 가장 좋은 5장 족보. v 가 클수록 강함. backHigh: 백스트레이트(A2345)를 마운틴 다음으로 (한국식 세븐 포커)
const CAT = ['탑', '원페어', '투페어', '트리플', '스트레이트', '플러시', '풀하우스', '포카드', '스트레이트 플러시', '로열 스트레이트 플러시'];
const enc = (cat, ks) => cat * 1e8 + ks.reduce((a, k, i) => a + k * 15 ** (4 - i), 0);
function straightHigh(ranks) {
  const set = new Set(ranks);
  if (set.has(14)) set.add(1);
  for (let hi = 14; hi >= 5; hi--) {
    let ok = true;
    for (let k = 0; k < 5; k++) if (!set.has(hi - k)) { ok = false; break; }
    if (ok) return hi;
  }
  return 0;
}
export function evalPoker(cards, { backHigh = false } = {}) {
  if (!cards.length) return { v: 0, name: '' };
  const cnt = new Map();
  const suits = [[], [], [], []];
  for (const c of cards) { cnt.set(c.r, (cnt.get(c.r) || 0) + 1); suits[c.s].push(c.r); }
  const sv = (hi) => (hi === 5 && backHigh ? 13.5 : hi);
  const fl = suits.find((x) => x.length >= 5);
  if (fl) {
    const sh = straightHigh(fl);
    if (sh) return { v: enc(sh === 14 ? 9 : 8, [sv(sh)]), name: sh === 14 ? CAT[9] : sh === 5 ? '백스트레이트 플러시' : CAT[8] };
  }
  const groups = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const desc = [...cnt.keys()].sort((a, b) => b - a);
  const others = (...xs) => desc.filter((r) => !xs.includes(r));
  const [r0, c0] = groups[0];
  if (c0 === 4) return { v: enc(7, [r0, ...others(r0).slice(0, 1)]), name: `${rankName(r0)} ${CAT[7]}` };
  if (c0 === 3) {
    const pair = groups.slice(1).filter((g) => g[1] >= 2).map((g) => g[0]).sort((a, b) => b - a)[0];
    if (pair) return { v: enc(6, [r0, pair]), name: `${rankName(r0)} ${CAT[6]}` };
  }
  if (fl) { const top = fl.sort((a, b) => b - a).slice(0, 5); return { v: enc(5, top), name: `${rankName(top[0])} ${CAT[5]}` }; }
  const sh = straightHigh(desc);
  if (sh) return { v: enc(4, [sv(sh)]), name: sh === 14 ? '마운틴' : sh === 5 ? '백스트레이트' : `${rankName(sh)} ${CAT[4]}` };
  if (c0 === 3) return { v: enc(3, [r0, ...others(r0).slice(0, 2)]), name: `${rankName(r0)} ${CAT[3]}` };
  if (c0 === 2 && groups[1]?.[1] === 2) {
    const [a, b] = [r0, groups[1][0]];
    return { v: enc(2, [a, b, ...others(a, b).slice(0, 1)]), name: `${rankName(a)}·${rankName(b)} ${CAT[2]}` };
  }
  if (c0 === 2) return { v: enc(1, [r0, ...others(r0).slice(0, 3)]), name: `${rankName(r0)} ${CAT[1]}` };
  return { v: enc(0, desc.slice(0, 5)), name: `${rankName(desc[0])} ${CAT[0]}` };
}

// 가장 높은 v 를 가진 사람(들)이 이김
export function resolveByValue(hands, valueOf) {
  const vals = hands.map((h) => ({ i: h.i, ...valueOf(h.cards) }));
  const top = Math.max(...vals.map((x) => x.v));
  return { winners: vals.filter((x) => x.v === top).map((x) => x.i), names: Object.fromEntries(vals.map((x) => [x.i, x.name])) };
}

// ───────── 화면 스타일 (이 게임들을 열 때만 한 번 넣음) ─────────
const CSS = `
.pk{--cw:40px;--seat:150px;--felt:#2f6b4f;--felt-ink:#f4f1e6;padding:10px 12px}
@media (prefers-color-scheme:dark){.pk{--felt:#1f4a37}}
.pk.many{--cw:30px;--seat:178px}
.pk-head{display:flex;justify-content:space-between;align-items:center;gap:6px 10px;flex-wrap:wrap;font-size:14px}
.pk-head .btn{margin-left:auto}
.pk-table{background:var(--felt);color:var(--felt-ink);border-radius:14px;padding:8px;margin-top:8px}
.pk-seats{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--seat),1fr));gap:6px}
.pk-seat{background:rgba(0,0,0,.2);border-radius:10px;padding:5px 8px;border:2px solid transparent;min-width:0}
.pk-seat.turn{border-color:#f2c230}
.pk-seat.win{background:rgba(242,194,48,.28)}
.pk-seat.fold .pk-cards{opacity:.45}
.pk-seat.out{opacity:.4}
.pk-name{display:flex;justify-content:space-between;align-items:center;gap:6px;font-weight:700;font-size:14px;white-space:nowrap}
.pk-name>span:first-child{overflow:hidden;text-overflow:ellipsis}
.pk-chip{font-weight:600;font-variant-numeric:tabular-nums}
.pk-chip::before{content:'●';color:#f2c230;margin-right:3px;font-size:11px}
.pk-d{display:inline-block;background:#fff;color:#1d2a3a;border-radius:999px;font-size:10px;line-height:15px;padding:0 5px;margin-right:4px;font-style:normal;vertical-align:1px}
.pk-cards{display:flex;gap:3px;margin:4px 0 2px;min-height:calc(var(--cw)*1.4)}
.pk.many .pk-seat .pk-card+.pk-card{margin-left:-7px}
.pk-st{font-size:12.5px;min-height:1.25em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.92}
.pk-st b{color:#f2c230}
.pk-card{width:var(--cw);height:calc(var(--cw)*1.4);border-radius:5px;background:#fff;color:#1d2a3a;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font-weight:800;font-size:calc(var(--cw)*.42);line-height:1;flex:none;box-shadow:0 1px 2px rgba(0,0,0,.35);font-family:system-ui,sans-serif}
.pk-card i{font-style:normal;font-size:calc(var(--cw)*.38)}
.pk-card.red{color:#c0392b}
.pk-card.own{transform:translateY(-4px);box-shadow:0 3px 0 #f2c230}
.pk-card.back{background:repeating-linear-gradient(45deg,#7c2a22 0 4px,#97352b 4px 8px);border:2px solid #fff}
.pk-card.hw{background:#b8322a;color:#fff;border:2px solid #f4efe2}
.pk-card.hw i{font-size:calc(var(--cw)*.3);font-weight:700;opacity:.9}
.pk-card.hw i.g{color:#f6d04d;opacity:1}
.pk-card.ind{font-size:calc(var(--cw)*.6)}
.pk-mid{display:flex;align-items:center;justify-content:center;gap:6px 14px;flex-wrap:wrap;margin:8px 0 4px;text-align:center}
.pk-board{display:flex;gap:4px}
.pk-pot{font-size:14px}.pk-pot b{font-size:20px;margin-left:4px}
.pk-msg{width:100%;font-size:13px;min-height:1.3em}
.pk-mine{--cw:50px;background:rgba(255,255,255,.1);margin-top:6px}
.pk.many .pk-mine{--cw:42px}
.pk.many .pk-mine .pk-card+.pk-card{margin-left:0}
.pk-mine .pk-st{font-size:14px}
.pk-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.pk-actions .btn{flex:1 1 0;min-width:70px;padding:8px 6px;line-height:1.2}
.pk-actions .btn small{display:block;font-size:11px;font-weight:500;opacity:.85}
.pk-cover{text-align:center;padding:4px 0}
.pk-cover p{margin:4px 0 8px}
.pk-log{font-size:12px;color:var(--muted);margin:6px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (min-width:900px){.pk{max-width:900px;margin-left:auto!important;margin-right:auto!important}}
html.work .pk{--felt:#f2f2f2;--felt-ink:#222}
html.work .pk-seat{background:#fff;border:1px solid #ccc;border-radius:4px}
html.work .pk-seat.turn{border:2px solid #222}
html.work .pk-seat.win{background:#e4e4e4}
html.work .pk-mine{background:#fafafa}
html.work .pk-table{border:1px solid #ccc;border-radius:4px}
html.work .pk-card{box-shadow:none;border:1px solid #999;border-radius:3px}
html.work .pk-card.back{background:#bbb;border:1px solid #888}
html.work .pk-card.hw{background:#555;border-color:#555}
html.work .pk-card.own{transform:none;box-shadow:inset 0 -3px 0 #222}
html.work .pk-st b,html.work .pk-chip::before{color:inherit}
@media (max-width:420px){.pk{--cw:34px;--seat:130px}.pk.many{--cw:26px;--seat:150px}.pk-mine{--cw:44px}}
`;
function ensureStyle() {
  if (document.getElementById('pk-style')) return;
  const st = document.createElement('style');
  st.id = 'pk-style';
  st.textContent = CSS;
  document.head.appendChild(st);
}

const MAX_RAISES = 4;
const BACK = '<span class="pk-card back"></span>';

export function makePokerGame(spec) {
  const steps = spec.steps;
  const betSteps = steps.map((s, k) => (s.bet ? k : -1)).filter((k) => k >= 0);

  // ───── 상태 다루기 (화면과 무관, data 만 바꿈) ─────
  const nextSeat = (n, from, ok) => { for (let k = 1; k <= n; k++) { const j = (from + k) % n; if (ok(j)) return j; } return -1; };
  const alive = (h) => h.folded.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0);
  const capOf = (h) => Math.min(...alive(h).map((i) => h.st[i]));
  const roomOf = (h, i) => Math.max(0, capOf(h) - h.put[i]);

  function startHand(d, players, settings) {
    const n = players.length;
    const ante = Number(settings.ante) || 2;
    d.no = (d.no || 0) + 1;
    d.dealer = nextSeat(n, d.dealer ?? -1, (j) => d.chips[j] > 0);
    const h = {
      deck: shuffle(spec.deck()), cards: players.map(() => []), board: [],
      folded: d.chips.map((c) => c <= 0), out: d.chips.map((c) => c <= 0),
      st: [...d.chips], put: Array(n).fill(0), bet: Array(n).fill(0), last: Array(n).fill(''),
      step: -1, toAct: -1, cur: 0, raises: 0, acted: [], phase: 'bet', show: false, res: null,
      pot: d.carry || 0, msg: d.carry ? `지난 판 판돈 ${d.carry}칩이 넘어왔어요.` : '',
    };
    d.carry = 0;
    d.h = h;
    for (const i of alive(h)) { const a = Math.min(ante, d.chips[i]); d.chips[i] -= a; h.put[i] += a; h.pot += a; }
    advance(d, players, settings);
  }

  // 다음 단계로: 카드 돌리기 → 베팅 → … → 결과
  function advance(d, players, settings) {
    const h = d.h;
    for (;;) {
      if (alive(h).length < 2) return showdown(d, players, settings);
      h.step++;
      const st = steps[h.step];
      if (!st) return showdown(d, players, settings);
      if (st.deal) for (const up of st.deal) for (const i of alive(h)) h.cards[i].push({ c: h.deck.pop(), up });
      if (st.board) for (let k = 0; k < st.board; k++) h.board.push(h.deck.pop());
      if (!st.bet) continue;
      h.bet = h.bet.map(() => 0); h.cur = 0; h.raises = 0; h.acted = [];
      h.last = h.last.map((x, i) => (h.folded[i] ? x : ''));
      const can = alive(h).filter((i) => roomOf(h, i) > 0);
      if (can.length < 2) continue; // 모두 묶음 한도까지 냈으면 베팅 없이 다음 카드
      h.toAct = nextSeat(players.length, d.dealer, (j) => !h.folded[j] && roomOf(h, j) > 0);
      return;
    }
  }

  // 지금 차례인 사람이 할 수 있는 행동과 내야 할 칩
  function options(d, settings) {
    const h = d.h; const i = h.toAct;
    const ante = Number(settings.ante) || 2;
    const room = roomOf(h, i);
    const call = Math.min(h.cur - h.bet[i], room);
    const out = [{ kind: 'fold', label: '다이', pay: 0 }];
    out.push(call > 0 ? { kind: 'call', label: call >= room ? '콜 (올인)' : '콜', pay: call } : { kind: 'check', label: '체크', pay: 0 });
    if (room > call && h.raises < MAX_RAISES) {
      const raise = (label, target) => {
        const pay = Math.min(target - h.bet[i], room);
        if (pay > call && !out.some((o) => o.pay === pay)) out.push({ kind: 'raise', label: pay >= room ? '올인' : label, pay });
      };
      if (h.cur === 0) raise('삥', h.bet[i] + ante);
      else raise('따당', h.cur * 2);
      raise('하프', h.cur + Math.max(ante, Math.floor((h.pot + h.cur - h.bet[i]) / 2)));
      raise('올인', h.bet[i] + room);
    }
    return out;
  }

  function act(d, players, settings, o) {
    const h = d.h; const i = h.toAct;
    const name = players[i].name;
    if (o.kind === 'fold') {
      h.folded[i] = true; h.last[i] = '다이';
      const pen = spec.foldPenalty ? Math.min(d.chips[i], spec.foldPenalty(h.cards[i].map((x) => x.c), Number(settings.ante) || 2)) : 0;
      if (pen > 0) { d.chips[i] -= pen; h.pot += pen; h.last[i] = `다이 (벌칙 ${pen})`; }
      h.msg = `${name} 다이${pen > 0 ? ` · 10을 들고 죽어서 벌칙 ${pen}칩` : ''}`;
    } else {
      const pay = o.pay;
      d.chips[i] -= pay; h.put[i] += pay; h.bet[i] += pay; h.pot += pay;
      if (h.bet[i] > h.cur) { h.cur = h.bet[i]; h.raises++; h.acted = []; }
      h.last[i] = o.kind === 'check' ? '체크' : `${o.label} ${h.bet[i]}`;
      h.msg = o.kind === 'check' ? `${name} 체크` : `${name} ${o.label} (+${pay})`;
    }
    h.acted.push(i);
    if (alive(h).length < 2) return showdown(d, players, settings);
    const need = (j) => !h.folded[j] && roomOf(h, j) > 0 && (!h.acted.includes(j) || h.bet[j] < h.cur);
    const nx = nextSeat(players.length, i, need);
    if (nx < 0) { h.toAct = -1; advance(d, players, settings); } else h.toAct = nx;
  }

  function showdown(d, players, settings) {
    const h = d.h;
    h.toAct = -1; h.phase = 'done';
    const live = alive(h);
    let res;
    if (live.length === 1) {
      res = { winners: live, names: {}, byFold: true };
    } else {
      h.show = true;
      res = spec.resolve(live.map((i) => ({ i, cards: h.cards[i].map((x) => x.c) })), h.board);
    }
    h.res = res;
    if (res.redeal) {
      d.carry = h.pot;
      h.msg = `${res.redealWhy || '재경기'} · 판돈 ${h.pot}칩은 다음 판으로 넘어가요.`;
    } else {
      const w = res.winners;
      const share = Math.floor(h.pot / w.length);
      w.forEach((i) => { d.chips[i] += share; });
      const rest = h.pot - share * w.length;
      if (rest) d.chips[nextSeat(players.length, d.dealer, (j) => w.includes(j))] += rest;
      const who = w.map((i) => players[i].name).join(', ');
      const hn = res.names?.[w[0]];
      h.msg = res.byFold ? `${who} 승 · 모두 다이해서 판돈 ${h.pot}칩` : `${who} 승${hn ? ` (${hn})` : ''} · 판돈 ${h.pot}칩${w.length > 1 ? ' 나눠 가짐' : ''}`;
    }
    d.log = [{ no: d.no, msg: h.msg }, ...(d.log || [])].slice(0, 20);
    // 끝까지 갔는데 판돈이 넘어가야 하면, 남은 사람끼리 나눔
    if (isOver(d, players, settings) && d.carry) {
      const w = live.filter((i) => d.chips[i] >= 0);
      const share = Math.floor(d.carry / w.length);
      w.forEach((i, k) => { d.chips[i] += share + (k === 0 ? d.carry - share * w.length : 0); });
      d.carry = 0;
    }
  }

  function isOver(d, players, settings) {
    const hands = Number(settings.hands) || 0;
    const left = d.chips.filter((c) => c > 0).length + (d.carry ? 1 : 0);
    const humans = players.some((p, i) => !isCpu(p) && d.chips[i] > 0);
    if (left < 2 || !humans) return true;
    return hands > 0 && d.no >= hands && !d.carry;
  }

  // ───── 컴퓨터 ─────
  // seat 이 볼 수 있는 카드만 알고, 나머지는 덱에서 무작위로 채워 이기는 몫을 셈
  function equity(d, seat, iters) {
    const h = d.h;
    const known = new Set(h.board.map(spec.key));
    const mine = [];
    const theirs = h.cards.map(() => []);
    h.cards.forEach((cs, j) => cs.forEach((x) => {
      const sees = j === seat ? !spec.indian || x.up : x.up || spec.indian;
      if (!sees) return;
      known.add(spec.key(x.c));
      if (j === seat) mine.push(x.c); else theirs[j].push(x.c);
    }));
    const pool = spec.deck().filter((c) => !known.has(spec.key(c)));
    const live = alive(h);
    let won = 0;
    for (let t = 0; t < iters; t++) {
      let k = pool.length;
      const draw = () => { const r = Math.floor(Math.random() * k); const c = pool[r]; pool[r] = pool[--k]; pool[k] = c; return c; };
      const hands = live.map((j) => {
        const cs = j === seat ? [...mine] : [...theirs[j]];
        while (cs.length < spec.holeCount) cs.push(draw());
        return { i: j, cards: cs };
      });
      const board = [...h.board];
      while (board.length < (spec.boardCount || 0)) board.push(draw());
      const r = spec.resolve(hands, board);
      if (r.redeal) won += 1 / live.length;
      else if (r.winners.includes(seat)) won += 1 / r.winners.length;
    }
    return won / iters;
  }

  function cpuChoice(d, settings, level) {
    const h = d.h; const i = h.toAct;
    const opts = options(d, settings);
    const n = alive(h).length;
    let e = equity(d, i, [80, 250, 600][level]);
    e = Math.max(0, Math.min(1, e + (Math.random() - 0.5) * [0.3, 0.12, 0.05][level]));
    const rel = e * n; // 1 = 평균
    const callOpt = opts.find((o) => o.kind === 'call' || o.kind === 'check');
    const raises = opts.filter((o) => o.kind === 'raise');
    const bluff = Math.random() < [0.04, 0.07, 0.1][level];
    const late = h.step >= betSteps[betSteps.length - 1];
    const pick = (strong) => (raises.length ? raises[Math.min(raises.length - 1, strong ? 1 : 0)] : callOpt);
    if (callOpt.kind === 'check') {
      if (rel > [1.5, 1.35, 1.3][level] || bluff) return pick(rel > 2.2);
      return callOpt;
    }
    const odds = callOpt.pay / (h.pot + callOpt.pay);
    if (e < odds * [0.65, 0.9, 1][level] && !bluff) return opts[0];
    if ((rel > [1.9, 1.7, 1.55][level] || (bluff && !late)) && raises.length) return pick(rel > 2.6);
    return callOpt;
  }

  // 끝났을 때 남은 칩(판 도중이면 이번 판에 낸 칩은 돌려준 셈으로)
  function totals(session) {
    const d = session.data;
    return session.players.map((_, i) => (d.chips?.[i] ?? 0) + (d.h && d.h.phase !== 'done' ? d.h.put[i] : 0));
  }

  return {
    id: spec.id,
    name: spec.name,
    guide: spec.guide,
    minPlayers: 1,
    maxPlayers: spec.maxPlayers,
    pickHint: `참가자를 순서대로 눌러 주세요 (1~${spec.maxPlayers}명). 혼자 고르면 컴퓨터와, 여럿이면 한 기기를 돌려 가며 해요. 돈 대신 칩으로만 해요.`,
    settingsFields: [
      { key: 'cpus', label: '컴퓨터 상대', default: 2, options: [0, 1, 2, 3, 4].map((v) => ({ value: v, label: v ? `${v}명` : '없음 (사람끼리)' })) },
      levelField(({ count, settings }) => settings.cpus > 0 || count === 1),
      { key: 'chips', label: '시작 칩', default: 100, options: [50, 100, 200, 500].map((v) => ({ value: v, label: `${v}칩` })) },
      { key: 'ante', label: '기본 판돈', default: 2, options: [1, 2, 5, 10].map((v) => ({ value: v, label: `${v}칩` })) },
      { key: 'hands', label: '판 수', default: 10, options: [[5, '5판'], [10, '10판'], [20, '20판'], [30, '30판'], [0, '한 명 남을 때까지']].map(([value, label]) => ({ value, label })) },
    ],
    preparePlayers(ps, settings) {
      const want = Number(settings?.cpus) || 0;
      const k = Math.max(ps.length === 1 ? 1 : 0, Math.min(want, spec.maxPlayers - ps.length));
      return k ? [...ps, ...cpuPlayers(k)] : ps;
    },
    initData(players, settings) {
      return { chips: players.map(() => Number(settings?.chips) || 100), no: 0, dealer: -1, carry: 0, h: null, log: [] };
    },
    computeTotals: (s) => totals(s),
    incompleteCount: () => 0,
    engine: { startHand, act, options, cpuChoice, isOver, equity }, // 시험용

    renderPlay(root, session, ctx) {
      ensureStyle();
      const players = session.players;
      const d = session.data;
      const settings = session.settings || {};
      const level = levelOf(session);
      const readonly = session.status === 'finished';
      const cpu = players.map(isCpu);
      const humans = players.map((_, i) => i).filter((i) => !cpu[i]);
      const single = humans.length === 1;
      let viewer = single ? humans[0] : null; // 지금 화면을 보는 사람 (여럿이면 차례마다 '카드 보기')
      let busy = false;

      if (!readonly && !d.h) { startHand(d, players, settings); ctx.save(); }

      const sees = (seat, x) => {
        const h = d.h;
        if (x.up) return true;
        if (h.phase === 'done' && (spec.indian || (h.show && !h.folded[seat]))) return true;
        if (viewer == null) return false;
        return spec.indian ? seat !== viewer : seat === viewer;
      };
      const seatHtml = (i, mine = false) => {
        const h = d.h;
        const p = players[i];
        const win = h.phase === 'done' && h.res && !h.res.redeal && h.res.winners.includes(i);
        const cls = ['pk-seat', mine && 'pk-mine', h.toAct === i && h.phase === 'bet' && 'turn', h.folded[i] && 'fold', h.out[i] && 'out', win && 'win'].filter(Boolean).join(' ');
        // 공개 카드가 섞이는 게임(세븐 포커)은 나만 보는 카드를 살짝 띄워 구분
        const lift = (x) => !x.up && h.cards[i].some((y) => y.up) && h.phase === 'bet';
        const cards = h.cards[i].map((x) => (sees(i, x) ? (lift(x) ? spec.cardHtml(x.c).replace('pk-card', 'pk-card own') : spec.cardHtml(x.c)) : BACK)).join('');
        let st = esc(h.out[i] ? '탈락' : h.last[i]);
        if (h.phase === 'done' && h.show && !h.folded[i] && h.res?.names?.[i]) st = `${win ? '<b>승</b> ' : ''}${esc(h.res.names[i])}`;
        else if (win) st = '<b>승</b>';
        else if (mine && !h.folded[i] && spec.describe) {
          const vis = h.cards[i].filter((x) => sees(i, x)).map((x) => x.c);
          const nm = vis.length ? spec.describe(vis, h.board) : '';
          if (nm) st = `${st ? `${st} · ` : ''}지금 <b>${esc(nm)}</b>`;
        }
        if (!h.out[i] && h.put[i] && h.phase === 'bet') st += ` <span style="opacity:.75">${st ? '· ' : ''}낸 칩 ${h.put[i]}</span>`;
        return `<div class="${cls}">
          <div class="pk-name"><span>${i === d.dealer ? '<i class="pk-d">선</i>' : ''}${esc(p.name)}${mine && single ? ' <small>(나)</small>' : ''}</span><span class="pk-chip">${d.chips[i]}</span></div>
          <div class="pk-cards">${cards}</div>
          <div class="pk-st">${st || '&nbsp;'}</div>
        </div>`;
      };

      const over = () => isOver(d, players, settings);
      const draw = () => {
        const h = d.h;
        if (!h) { root.innerHTML = '<section class="card pk"><p class="muted">기록이 없어요.</p></section>'; return; }
        const turn = h.phase === 'bet' ? h.toAct : -1;
        const humanTurn = turn >= 0 && !cpu[turn] && !readonly;
        if (!single && h.phase === 'bet' && viewer !== null && viewer !== turn) viewer = null;
        const me = viewer != null && !h.out[viewer] ? viewer : -1;
        const stage = h.phase === 'done' ? '결과' : spec.stageNames?.[betSteps.indexOf(h.step)] || '';
        const hands = Number(settings.hands) || 0;
        let bottom = '';
        if (readonly) bottom = '';
        else if (h.phase === 'done') {
          bottom = `<div class="pk-actions">${over() ? '<button class="btn primary" data-act="end">결과 보기 (전적에 기록)</button>' : '<button class="btn primary" data-act="next">다음 판</button>'}</div>`;
        } else if (humanTurn && viewer !== turn) {
          bottom = `<div class="pk-cover"><p><b>${esc(players[turn].name)}</b> 차례예요. 다른 사람은 화면을 보지 말아 주세요.</p><button class="btn primary" data-act="peek">${esc(players[turn].name)} 카드 보기</button></div>`;
        } else if (humanTurn) {
          bottom = `<div class="pk-actions">${options(d, settings).map((o, k) => `<button class="btn ${o.kind === 'raise' ? 'primary' : ''}" data-opt="${k}">${o.label}${o.pay ? `<small>${o.pay}칩</small>` : '<small>&nbsp;</small>'}</button>`).join('')}</div>`;
        } else if (turn >= 0) {
          bottom = `<p class="muted center pk-cover">${esc(players[turn].name)} 생각하는 중… <small>(${LEVEL_NAMES[level]})</small></p>`;
        }
        const others = players.map((_, i) => i).filter((i) => i !== me);
        root.innerHTML = `<section class="card pk ${spec.holeCount > 4 ? 'many' : ''}">
          <div class="pk-head">
            <span><b>${d.no}${hands ? `/${hands}` : ''}판</b> · ${esc(stage)}</span>
            <span class="muted">기본 판돈 ${Number(settings.ante) || 2}칩</span>
            ${readonly ? '' : '<button class="btn small ghost" data-act="finish">그만하기</button>'}
          </div>
          <div class="pk-table">
            <div class="pk-seats">${others.map((i) => seatHtml(i)).join('')}</div>
            <div class="pk-mid">
              ${spec.boardCount ? `<div class="pk-board">${Array.from({ length: spec.boardCount }, (_, k) => (h.board[k] ? spec.cardHtml(h.board[k]) : '<span class="pk-card back" style="opacity:.25"></span>')).join('')}</div>` : ''}
              <div class="pk-pot">판돈<b>${h.pot}</b></div>
              <div class="pk-msg">${esc(h.msg || '')}</div>
            </div>
            ${me >= 0 ? seatHtml(me, true) : ''}
          </div>
          ${bottom}
          ${d.log?.length > 1 ? `<p class="pk-log">지난 판: ${esc(d.log.slice(1, 4).map((x) => `${x.no}판 ${x.msg}`).join(' / '))}</p>` : ''}
        </section>`;
      };

      const runCpu = async () => {
        if (busy) return;
        busy = true;
        try {
          while (!readonly && root.isConnected && d.h?.phase === 'bet' && cpu[d.h.toAct]) {
            draw();
            await wait(650 + Math.random() * 350);
            if (!root.isConnected) break;
            act(d, players, settings, cpuChoice(d, settings, level));
            ctx.save();
          }
        } catch (err) { console.error(err); ctx.toast?.('컴퓨터 계산 오류'); } finally { busy = false; }
        if (root.isConnected) draw();
      };

      root.onclick = (e) => {
        const b = e.target.closest('button');
        if (!b || readonly) return;
        const h = d.h;
        const a = b.dataset.act;
        if (a === 'finish') { ctx.finish(); return; }
        if (busy) return;
        if (a === 'end') { ctx.finish({ ask: false }); return; }
        if (a === 'next') { if (!single) viewer = null; startHand(d, players, settings); ctx.save(); draw(); runCpu(); return; }
        if (a === 'peek') { viewer = h.toAct; draw(); return; }
        if (b.dataset.opt != null && h.phase === 'bet' && !cpu[h.toAct] && viewer === h.toAct) {
          const o = options(d, settings)[Number(b.dataset.opt)];
          if (!o) return;
          act(d, players, settings, o);
          if (!single) viewer = null;
          ctx.save(); draw(); runCpu();
        }
      };
      draw();
      runCpu();
    },
  };
}
