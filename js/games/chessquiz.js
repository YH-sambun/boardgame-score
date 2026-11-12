// 체스 퀴즈: 무작위로 만든 상황에서 이기는 수를 찾기
//  - 메이트 퍼즐(1·2·3수): 정답 첫 수가 하나뿐인 위치. 상대(컴퓨터)는 가장 오래 버티는 수로 응수
//  - 엔드게임 도전: 퀸·룩·비숍 둘로 킹만 남은 컴퓨터를 제한 수 안에 메이트
// 여러 명이면 문제를 번갈아 풀고, 푼 문제 점수 합계로 순위를 매깁니다. 힌트를 쓰거나 틀리면 점수 절반(내림).
// session.data = { level(1~10, 0이면 직접 고르기), types:[종류], started, cur,
//   problems:[{ type, grade, pts, limit, noHint, oneShot, fen, color, first, player, moves:[uci], status:null|'ok'|'fail', hint, mistakes, points }] }
import { Chess, createBoard, engine, mirrorFen, mirrorUci, uciObj, gameOverInfo } from './chess-board.js?v=202611121529';
import { randomEndgame, Q, R, B } from './chess-engine.js?v=202611121529';
import { MATE_PUZZLES } from './chess-puzzles.js?v=202611121529';

export const TYPES = {
  m1: { label: '1수 메이트', pts: 1, n: 1 },
  m2: { label: '2수 메이트', pts: 2, n: 2 },
  m3: { label: '3수 메이트', pts: 3, n: 3 },
  kq: { label: '퀸으로 몰아 잡기', pts: 2, pieces: [Q], limit: 15 },
  kr: { label: '룩으로 몰아 잡기', pts: 3, pieces: [R], limit: 25 },
  kbb: { label: '비숍 둘로 몰아 잡기', pts: 5, pieces: [B, B], limit: 40 },
};

// 난이도 단계: 단계마다 나오는 문제(종류·퍼즐 난이도·제한 수)와 점수가 다름
//  grade: 0 쉬운 편 / 1 어려운 편 / 없으면 전체 (1수: 체크할 수 있는 수가 많을수록, 2·3수: 첫 수가 체크가 아닌 조용한 수)
export const LEVELS = [
  { name: '입문', icon: '🐣', desc: '쉬운 1수 메이트', items: [{ type: 'm1', grade: 0, pts: 1 }] },
  { name: '초급', icon: '🌱', desc: '1수 메이트, 퀸으로 25수', items: [{ type: 'm1', pts: 1 }, { type: 'kq', limit: 25, pts: 1 }] },
  { name: '초중급', icon: '🙂', desc: '헷갈리는 1수 메이트, 쉬운 2수 메이트, 퀸으로 20수', items: [{ type: 'm1', grade: 1, pts: 2 }, { type: 'm2', grade: 0, pts: 2 }, { type: 'kq', limit: 20, pts: 2 }] },
  { name: '중급', icon: '📘', desc: '쉬운 2수 메이트, 퀸 15수, 룩 35수', items: [{ type: 'm2', grade: 0, pts: 2 }, { type: 'kq', limit: 15, pts: 2 }, { type: 'kr', limit: 35, pts: 2 }] },
  { name: '중상급', icon: '📗', desc: '2수 메이트, 룩으로 30수', items: [{ type: 'm2', pts: 3 }, { type: 'kr', limit: 30, pts: 3 }] },
  { name: '상급', icon: '📕', desc: '조용한 첫 수 2수 메이트, 쉬운 3수 메이트, 룩 25수', items: [{ type: 'm2', grade: 1, pts: 3 }, { type: 'm3', grade: 0, pts: 3 }, { type: 'kr', limit: 25, pts: 3 }] },
  { name: '고급', icon: '🎯', desc: '3수 메이트, 룩으로 20수', items: [{ type: 'm3', pts: 4 }, { type: 'kr', limit: 20, pts: 4 }] },
  { name: '고수', icon: '🔥', desc: '조용한 첫 수 3수 메이트, 비숍 둘로 50수', items: [{ type: 'm3', grade: 1, pts: 5 }, { type: 'kbb', limit: 50, pts: 5 }] },
  { name: '마스터', icon: '🏆', desc: '고수 문제 + 더 짧은 제한(비숍 40수), 힌트 없음', noHint: true, items: [{ type: 'm3', grade: 1, pts: 6 }, { type: 'm2', grade: 1, pts: 6 }, { type: 'kbb', limit: 40, pts: 6 }] },
  { name: '그랜드마스터', icon: '👑', desc: '힌트 없음, 한 번 틀리면 실패, 비숍 35수', noHint: true, oneShot: true, items: [{ type: 'm3', grade: 1, pts: 8 }, { type: 'kbb', limit: 35, pts: 8 }] },
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sideName = (c) => (c === 'w' ? '⚪ 백' : '⚫ 흑');

// 문제 하나 만들기. item: 종류 이름 또는 { type, grade, limit, pts, noHint, oneShot }, used: 이미 낸 퍼즐 FEN 집합
export function makeProblem(item0, player, used = new Set()) {
  const it = typeof item0 === 'string' ? { type: item0 } : item0;
  const type = it.type;
  const t = TYPES[type];
  const flip = Math.random() < 0.5;
  const extra = { grade: it.grade ?? null, pts: it.pts ?? t.pts, limit: it.limit ?? t.limit ?? null, noHint: !!it.noHint, oneShot: !!it.oneShot };
  if (t.n) {
    const all = MATE_PUZZLES[t.n];
    const graded = it.grade == null ? all : all.filter((x) => (x[2] || 0) === it.grade);
    const bank = graded.length ? graded : all;
    let item = bank[Math.floor(Math.random() * bank.length)];
    for (let i = 0; i < 30 && used.has(item[0]); i++) item = bank[Math.floor(Math.random() * bank.length)];
    used.add(item[0]);
    const fen = item[0] + ' - - 0 1';
    return { type, ...extra, player, fen: flip ? mirrorFen(fen) : fen, first: flip ? mirrorUci(item[1]) : item[1], color: flip ? 'b' : 'w', moves: [], status: null, hint: false, mistakes: 0, points: 0 };
  }
  const fen = randomEndgame(t.pieces);
  return { type, ...extra, player, fen: flip ? mirrorFen(fen) : fen, color: flip ? 'b' : 'w', moves: [], status: null, hint: false, mistakes: 0, points: 0 };
}

// 문제의 실제 설정 (단계에서 바꾼 점수·제한 수 반영)
export const spec = (p) => ({ ...TYPES[p.type], pts: p.pts ?? TYPES[p.type].pts, limit: p.limit ?? TYPES[p.type].limit,
  label: TYPES[p.type].label + (p.grade === 1 ? ' (어려운 편)' : p.grade === 0 ? ' (쉬운 편)' : '') });
export const scoreOf = (p) => { const pts = spec(p).pts; return p.status !== 'ok' ? 0 : p.hint || p.mistakes ? Math.floor(pts / 2) : pts; };

export default {
  id: 'chessquiz',
  name: '체스 퀴즈',
  emoji: '🧩',
  guide: {
    players: '1~4명', time: '5~20분',
    intro: '무작위로 고른 체스 상황에서 이기는 수를 찾는 퀴즈예요. 정해진 수 안에 체크메이트하는 퍼즐과, 킹만 남은 컴퓨터를 몰아 잡는 도전이 있어요.',
    rules: [
      '시작 전에 난이도 1~10단계(입문·초급·초중급·중급·중상급·상급·고급·고수·마스터·그랜드마스터) 중 하나를 고르거나, 직접 문제 종류를 골라 섞을 수 있어요. 여러 명이면 문제를 번갈아 풀어요.',
      '단계가 올라갈수록 더 긴 메이트, 첫 수가 체크가 아닌 조용한 수, 더 짧은 제한 수가 나오고 점수도 커져요. 9단계부터는 힌트가 없고, 10단계는 한 번 틀리면 바로 실패예요.',
      '메이트 퍼즐(1·2·3수): 정해진 수 안에 체크메이트하세요. 첫 수 정답은 하나뿐이고, 상대는 가장 오래 버티는 수로 막아요. 틀린 수를 두면 되돌려서 다시 해 볼 수 있어요.',
      '몰아 잡기: 퀸·룩·비숍 둘로 킹만 남은 컴퓨터를 제한 수 안에 메이트하세요(제한 수는 단계마다 달라요). 스테일메이트가 되거나 기물을 빼앗기면 실패예요.',
      '💡 힌트는 옮길 기물과 칸을 초록색으로 보여 줘요. 👀 정답 보기는 정답 수순을 차례로 보여 줘요(그 문제는 실패).',
    ],
    scoring: ['단계별 문제당 점수: 1단계 1점 … 7단계 4점, 8단계 5점, 9단계 6점, 10단계 8점', '직접 고르기: 1·2·3수 메이트 1·2·3점, 퀸 2점, 룩 3점, 비숍 둘 5점', '힌트를 쓰거나 틀린 수를 두면 그 문제 점수는 절반(내림)', '모든 문제를 풀고 전적에 기록하면 점수 합계로 순위가 남아요.'],
    tips: [
      '메이트 퍼즐은 체크, 잡기, 위협 순서로 후보 수를 살펴보세요. 첫 수가 조용한 수일 때도 있어요.',
      '퀸·룩으로 몰아 잡을 땐 상대 킹이 갈 수 있는 칸을 상자처럼 줄여 가장자리로 밀고, 내 킹도 가까이 데려오세요.',
      '스테일메이트를 조심하세요. 상대 킹이 움직일 칸이 하나도 없는데 체크가 아니면 무승부예요.',
    ],
  },
  minPlayers: 1,
  maxPlayers: 4,
  settingsFields: [{ key: 'count', label: '1인당 문제 수', default: 5, min: 1, max: 20 }],
  roundLabel: '문제',

  initData() {
    return { level: 2, types: ['m1', 'm2', 'kq'], started: false, cur: 0, problems: [] };
  },

  computeTotals(session) {
    const t = session.players.map(() => 0);
    for (const p of session.data.problems || []) t[p.player] += scoreOf(p);
    return t;
  },
  incompleteCount(session) { return (session.data.problems || []).filter((p) => !p.status).length; },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const players = session.players;
    const readonly = session.status === 'finished';
    let chess = null;
    let busy = false;
    let token = 0; // 엔진 응답이 늦게 와도 문제가 바뀌었으면 버림
    let msg = '', msgCls = '';
    let hintSq = [];
    let marks = {};

    const board = createBoard(document.createElement('div'), { onMove: (m) => onMove(m) });
    const P = () => d.problems[d.cur];
    const say = (text, cls = '') => { msg = text; msgCls = cls; };

    const load = () => {
      const p = P();
      chess = new Chess(p.fen);
      for (const u of p.moves) { try { chess.move(uciObj(u)); } catch { break; } }
      hintSq = []; marks = {};
    };
    // 공격 쪽이 이미 둔 수
    const myMovesMade = (p) => Math.ceil(p.moves.length / 2);

    const gain = (p) => { const pts = scoreOf({ ...p, status: 'ok' }); return pts === spec(p).pts ? `(+${pts}점)` : `(힌트·실수가 있어 +${pts}점)`; };
    const finishProblem = (status, text) => {
      const p = P();
      p.status = status; p.points = scoreOf(p);
      say(text, status === 'ok' ? 'ok' : 'no');
      ctx.save();
    };

    async function onMove(m) {
      const p = P();
      if (busy || p.status) return;
      let res;
      try { res = chess.move(m); } catch { return; }
      const u = res.from + res.to + (res.promotion || '');
      p.moves.push(u);
      hintSq = []; marks = {};
      const t = spec(p);
      const my = ++token;
      busy = true; say('');
      draw();
      try {
        if (t.n) {
          if (chess.isCheckmate()) { finishProblem('ok', `정답! 체크메이트 🎉 ${gain(p)}`); return; }
          const left = t.n - myMovesMade(p) + 1; // 이 수를 포함해 남은 수
          const ok = left > 1 && await engine('isForcedMate', { fen: chess.fen(), n: left });
          if (my !== token) return;
          if (!ok) {
            p.mistakes++;
            if (p.oneShot) { marks = { [res.to]: 'bad' }; finishProblem('fail', '틀렸어요. 이 단계는 한 번 틀리면 실패예요 😢'); return; }
            marks = { [res.to]: 'bad' };
            say(left > 1 ? `그 수로는 ${t.n}수 안에 메이트가 안 돼요. 다시 해 보세요.` : '메이트가 아니에요. 다시 해 보세요.', 'no');
            draw();
            await new Promise((r) => setTimeout(r, 900));
            if (my !== token) return;
            p.moves.pop(); chess.undo(); marks = {};
            ctx.save(); return;
          }
          marks = { [res.to]: 'good' };
          say('좋아요! 상대가 응수합니다…', 'ok'); draw();
          const reply = await engine('bestDefense', { fen: chess.fen(), n: left - 1 });
          await new Promise((r) => setTimeout(r, 350));
          if (my !== token || !reply) return;
          const rr = chess.move(uciObj(reply)); p.moves.push(reply);
          marks = {};
          say(`상대: ${rr.san} · 남은 수 ${left - 1}`);
          ctx.save();
        } else {
          const over = gameOverInfo(chess);
          if (over?.winner) { finishProblem('ok', `체크메이트! 성공 🎉 ${gain(p)}`); return; }
          if (over) { finishProblem('fail', `${over.reason}로 비겼어요. 실패 😢`); return; }
          if (myMovesMade(p) >= t.limit) { finishProblem('fail', `${t.limit}수 안에 메이트하지 못했어요. 실패 😢`); return; }
          const r = await engine('search', { fen: chess.fen(), opts: { depth: 5, timeMs: 500 } });
          await new Promise((ok) => setTimeout(ok, 250));
          if (my !== token || !r.move) return;
          const rr = chess.move(uciObj(r.move)); p.moves.push(r.move);
          const over2 = gameOverInfo(chess);
          if (over2) { finishProblem('fail', `${over2.reason}! 상대가 ${rr.san}(으)로 버텨서 실패 😢`); return; }
          say(`상대: ${rr.san} · 남은 수 ${t.limit - myMovesMade(p)}`);
          ctx.save();
        }
      } catch (err) { console.error(err); say('계산 오류: ' + err.message, 'no'); } finally { if (my === token) { busy = false; draw(); } }
    }

    async function hint() {
      const p = P();
      if (busy || p.status || p.noHint) return;
      const t = spec(p);
      p.hint = true; ctx.save();
      const my = ++token; busy = true; say('힌트 계산 중…'); draw();
      try {
        let u;
        if (t.n) u = !p.moves.length ? p.first : (await engine('mateMoves', { fen: chess.fen(), n: t.n - myMovesMade(p) }))[0];
        else u = (await engine('search', { fen: chess.fen(), opts: { depth: 7, timeMs: 1500 } })).move;
        if (my !== token) return;
        hintSq = u ? [u.slice(0, 2), u.slice(2, 4)] : [];
        say(u ? '초록 칸의 기물을 초록 칸으로 옮겨 보세요 (힌트를 써서 점수는 절반)' : '힌트를 찾지 못했어요');
      } catch (err) { console.error(err); say('힌트 오류'); } finally { if (my === token) { busy = false; draw(); } }
    }

    async function showAnswer() {
      const p = P();
      const t = spec(p);
      if (busy) return;
      if (!p.status && !confirm('정답을 보면 이 문제는 실패로 기록돼요. 볼까요?')) return;
      if (!p.status) finishProblem('fail', '정답 수순을 보여 드릴게요');
      const my = ++token; busy = true; draw();
      try {
        const line = await engine('mateLine', { fen: p.fen, n: t.n });
        chess = new Chess(p.fen); hintSq = []; marks = {}; draw();
        for (const u of line) {
          await new Promise((r) => setTimeout(r, 800));
          if (my !== token) return;
          chess.move(uciObj(u)); draw();
        }
        say(`정답 수순: ${chess.history().join(' ')}`, 'ok');
      } catch (err) { console.error(err); } finally { if (my === token) { busy = false; draw(); } }
    }

    const setupHtml = () => `
      <section class="card">
        <h3>🧩 난이도</h3>
        <div class="quiz-levels">
          ${LEVELS.map((l, i) => `<button class="quiz-level ${d.level === i + 1 ? 'on' : ''}" data-level="${i + 1}"><b>${l.icon} ${i + 1}단계 · ${l.name}</b><small>${esc(l.desc)} · 문제당 ${[...new Set(l.items.map((x) => x.pts))].join('~')}점</small></button>`).join('')}
          <button class="quiz-level ${!d.level ? 'on' : ''}" data-level="0"><b>🛠️ 직접 고르기</b><small>문제 종류를 마음대로 섞기</small></button>
        </div>
        ${!d.level ? `<div class="chips">${Object.entries(TYPES).map(([k, t]) => `<button class="chip ${d.types.includes(k) ? 'on' : ''}" data-type="${k}">${t.label} <small>${t.pts}점</small></button>`).join('')}</div>` : ''}
        <p class="muted">메이트 퍼즐: 정해진 수 안에 체크메이트. 첫 수 정답은 하나뿐이고, 상대는 가장 오래 버티는 수로 막아요.<br>
        몰아 잡기: 킹만 남은 컴퓨터를 제한 수 안에 메이트. 스테일메이트나 기물을 빼앗기면 실패.<br>
        힌트를 쓰거나 틀린 수를 두면 그 문제 점수는 절반(내림)이에요. 9단계부터는 힌트가 없고, 10단계는 한 번 틀리면 실패예요.</p>
        <p class="muted">${players.length > 1 ? `${players.map((p) => esc(p.name)).join(' → ')} 순서로 번갈아 풀어요. ` : ''}1인당 ${session.settings.count}문제, 모두 ${session.settings.count * players.length}문제.</p>
        <button class="btn primary block" data-act="start" ${d.level || d.types.length ? '' : 'disabled'}>퀴즈 시작</button>
      </section>`;

    const dotsHtml = () => `<div class="quiz-dots">${d.problems.map((p, i) => `<span class="${i === d.cur ? 'cur' : ''} ${p.status === 'ok' ? (p.points === spec(p).pts ? 'ok' : 'half') : p.status === 'fail' ? 'no' : ''}" data-go="${i}" title="${esc(players[p.player].name)} · ${spec(p).label}">${i + 1}</span>`).join('')}</div>`;

    function draw() {
      if (!d.started) { root.innerHTML = readonly ? '' : setupHtml(); return; }
      const p = P();
      const t = spec(p);
      const allDone = d.problems.every((x) => x.status);
      const goal = t.n
        ? `${sideName(p.color)} 차례 — ${t.n}수 만에 체크메이트!`
        : `${sideName(p.color)}으로 ${t.limit}수 안에 체크메이트! (남은 수 ${t.limit - myMovesMade(p)})`;
      const scores = players.map((pl, i) => `${esc(pl.name)} <b>${d.problems.filter((x) => x.player === i).reduce((a, x) => a + scoreOf(x), 0)}</b>`).join(' · ');
      const btns = [];
      if (!p.status) {
        if (!p.noHint) btns.push(`<button class="btn ghost small" data-act="hint" ${busy ? 'disabled' : ''}>💡 힌트</button>`);
        if (p.moves.length) btns.push(`<button class="btn ghost small" data-act="reset" ${busy ? 'disabled' : ''}>↺ 처음부터</button>`);
        btns.push(t.n ? '<button class="btn ghost small" data-act="answer">👀 정답 보기</button>' : '<button class="btn ghost small danger" data-act="giveup">🏳️ 포기</button>');
      } else if (t.n && !busy) btns.push('<button class="btn ghost small" data-act="answer">👀 정답 수순</button>');
      const next = d.problems.findIndex((x, i) => i > d.cur && !x.status);
      const anyLeft = d.problems.findIndex((x) => !x.status);
      root.innerHTML = `
        <section class="card chess-card">
          <div class="quiz-head"><b>${LEVELS[d.level - 1] ? `${LEVELS[d.level - 1].icon} ${d.level}단계 · ` : ''}문제 ${d.cur + 1} / ${d.problems.length} · ${t.label}</b>${players.length > 1 ? `<span class="badge">${esc(players[p.player].name)} 차례</span>` : ''}</div>
          ${dotsHtml()}
          <div class="quiz-goal">${goal}</div>
          <div id="cb"></div>
          <div class="quiz-msg ${msgCls}">${esc(msg)}</div>
          <div class="chess-actions">${btns.join('')}</div>
          ${p.status && !busy ? (anyLeft >= 0 ? `<button class="btn primary block" data-go="${next >= 0 ? next : anyLeft}">다음 문제 ▶</button>` : '') : ''}
          <p class="muted center">점수: ${scores}</p>
          ${allDone && !readonly ? '<button class="btn primary block" data-act="finish">모두 풀었어요 · 전적에 기록</button>' : ''}
        </section>`;
      board.mount(root.querySelector('#cb'));
      board.set({ chess, orientation: p.color, hint: hintSq, marks, canMove: (c) => !readonly && !busy && !p.status && c === p.color });
    }

    root.onclick = (e) => {
      const t = e.target.closest('button,[data-go]');
      if (!t || t.disabled || t.closest('#cb')) return;
      const ds = t.dataset;
      if (ds.level != null) { d.level = Number(ds.level); return draw(); }
      if (ds.type) { const i = d.types.indexOf(ds.type); if (i >= 0) d.types.splice(i, 1); else d.types.push(ds.type); return draw(); }
      if (ds.go != null) { token++; busy = false; d.cur = Number(ds.go); load(); say(''); ctx.save(); return draw(); }
      if (ds.act === 'start') {
        const used = new Set();
        const n = session.settings.count * players.length;
        const lv = LEVELS[d.level - 1];
        const pool = lv ? lv.items.map((x) => ({ ...x, noHint: lv.noHint, oneShot: lv.oneShot })) : d.types;
        d.problems = Array.from({ length: n }, (_, k) => makeProblem(pool[Math.floor(Math.random() * pool.length)], k % players.length, used));
        d.started = true; d.cur = 0; load(); ctx.save(); return draw();
      }
      if (ds.act === 'hint') return hint();
      if (ds.act === 'answer') return showAnswer();
      if (ds.act === 'reset') { token++; busy = false; P().moves = []; load(); say('처음 위치로 돌렸어요'); ctx.save(); return draw(); }
      if (ds.act === 'giveup') { if (confirm('이 문제를 포기할까요?')) { token++; busy = false; finishProblem('fail', '포기했어요'); draw(); } return; }
      if (ds.act === 'finish') ctx.finish({ ask: false });
    };

    if (d.started) load();
    draw();
  },
};
