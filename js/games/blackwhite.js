// 흑과 백: 두 사람이 0~8 숫자 타일을 한 장씩 비공개로 내고 큰 숫자가 이기는 9라운드 대결
//  짝수(0·2·4·6·8)는 검은 타일, 홀수(1·3·5·7)는 흰 타일. 상대에게는 색만 보이고, 승패만 알려 줘요 (숫자는 끝나고 공개)
//  한 기기를 넘겨 가며 둠: 자기 차례에만 가림막을 열고 고름. 혼자 고르면 컴퓨터와 대결
// session.data = { rounds:[{ lead, t:[자리0 타일|null, 자리1 타일|null], win:0|1|null }], winner, draw }
import { isCpu, levelField, cpuPlayers, levelOf, LEVEL_NAMES } from './cpu.js?v=202611180813';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TILES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const isBlack = (n) => n % 2 === 0;
const tileHtml = (n, { hide = false, cls = '' } = {}) => `<span class="bw-tile ${isBlack(n) ? 'blk' : 'wht'} ${cls}">${hide ? '' : n}</span>`;

const usedBy = (d, seat) => d.rounds.map((r) => r.t[seat]).filter((x) => x != null);
const leftOf = (d, seat) => TILES.filter((n) => !usedBy(d, seat).includes(n));
const winsOf = (d) => [0, 1].map((s) => d.rounds.filter((r) => r.win === s).length);
const doneRounds = (d) => d.rounds.filter((r) => r.t[0] != null && r.t[1] != null).length;

// 남은 라운드를 다 이겨도 따라잡을 수 없으면 일찍 끝남
function settle(d) {
  const w = winsOf(d);
  const left = 9 - doneRounds(d);
  if (w[0] > w[1] + left) d.winner = 0;
  else if (w[1] > w[0] + left) d.winner = 1;
  else if (!left) { if (w[0] === w[1]) d.draw = true; else d.winner = w[0] > w[1] ? 0 : 1; }
}

// 컴퓨터: 쉬움은 아무거나, 보통·어려움은 상대 색으로 남은 숫자를 보고 이길 만한 가장 작은 숫자를 냄
function cpuPick(d, seat, level) {
  const mine = leftOf(d, seat);
  const rnd = (xs) => xs[Math.floor(Math.random() * xs.length)];
  if (level === 0) return rnd(mine);
  const r = d.rounds[d.rounds.length - 1];
  const opp = 1 - seat;
  const oppLeft = leftOf(d, opp);
  if (r.lead !== seat && r.t[opp] != null) {
    // 상대가 이미 낸 경우: 그 색으로 가능한 숫자들 (이번에 낸 것 포함, 이미 쓴 것 제외)
    const played = r.t[opp];
    const cand = TILES.filter((n) => isBlack(n) === isBlack(played) && (!usedBy(d, opp).includes(n) || n === played));
    const beatAll = mine.filter((m) => cand.every((c) => m > c));
    const beatMost = mine.filter((m) => cand.filter((c) => m > c).length * 2 > cand.length);
    if (level === 2 && beatAll.length) return Math.min(...beatAll);
    if (beatMost.length && Math.random() < (level === 2 ? 0.85 : 0.6)) return Math.min(...beatMost);
    return Math.min(...mine); // 질 것 같으면 가장 작은 숫자를 버림
  }
  // 먼저 낼 때: 어려움은 상대 남은 숫자의 가운데쯤을 이길 숫자, 보통은 섞어서
  const mid = oppLeft.slice().sort((a, b) => a - b)[Math.floor(oppLeft.length / 2)] ?? 4;
  const good = mine.filter((m) => m > mid);
  if (level === 2 && good.length && Math.random() < 0.6) return Math.min(...good);
  return Math.random() < 0.5 ? rnd(mine) : Math.min(...mine);
}

export default {
  id: 'blackwhite',
  name: '흑과 백',
  guide: {
    players: '1~2명 (1명이면 컴퓨터와)', time: '10분',
    intro: '0부터 8까지 숫자 타일 아홉 장을 한 장씩 몰래 내서 큰 숫자가 이기는 심리전이에요. 상대에게는 내 타일의 색만 보이고, 라운드가 끝나도 누가 이겼는지만 알려 줘요.',
    rules: [
      '두 사람 모두 0~8 타일을 한 장씩 가져요. 짝수(0·2·4·6·8)는 검은 타일, 홀수(1·3·5·7)는 흰 타일이에요.',
      '선이 먼저 한 장을 몰래 내면, 후는 그 타일의 색만 보고 자기 타일을 골라요.',
      '숫자가 큰 사람이 그 라운드를 이겨요. 같으면 무승부예요. 숫자는 공개하지 않고 승패만 알려 줘요.',
      '라운드를 이긴 사람이 다음 라운드의 선이 돼요. 비기면 선이 그대로예요.',
      '9라운드에서 더 많이 이긴 사람이 승리해요. 남은 라운드를 다 이겨도 따라잡을 수 없으면 일찍 끝나요.',
      '한 기기로 할 때는 자기 차례에만 "보기"를 눌러 고르고, 고른 뒤 기기를 상대에게 넘겨요.',
    ],
    scoring: ['이긴 라운드가 많은 사람이 승, 같으면 무승부로 전적에 남아요.', '게임이 끝나면 라운드마다 낸 숫자를 모두 공개해요.'],
    tips: [
      '상대가 낸 색과 지금까지 승패를 보면 상대에게 남은 숫자를 꽤 좁힐 수 있어요.',
      '이기기 어려운 라운드에는 0이나 1 같은 작은 숫자를 버리세요. 큰 숫자를 아껴 두는 게 핵심이에요.',
      '8은 무조건 이기지만, 상대가 0을 버린 라운드에 쓰면 아까워요.',
    ],
  },
  minPlayers: 1,
  maxPlayers: 2,
  pickHint: '두 사람을 고르면 먼저 고른 사람이 첫 라운드 선이에요. 1명만 고르면 컴퓨터와 해요.',
  settingsFields: [levelField()],
  preparePlayers(ps) { return ps.length === 1 ? [...ps, ...cpuPlayers(1)] : ps; },
  roundLabel: '대결',

  initData() { return { rounds: [{ lead: 0, t: [null, null], win: null }], winner: null, draw: false }; },
  computeTotals(session) {
    const d = session.data;
    return [0, 1].map((i) => (d.draw ? 0.5 : d.winner == null ? 0 : d.winner === i ? 1 : -1));
  },
  totalLabel(t) { return t === 1 ? '승' : t === 0.5 ? '무' : t === -1 ? '패' : ''; },
  incompleteCount(session) { return session.data.winner == null && !session.data.draw ? 1 : 0; },

  renderPlay(root, session, ctx) {
    const d = session.data;
    const players = session.players;
    const cpuSeat = players.findIndex(isCpu);
    const level = levelOf(session);
    const over = () => d.winner != null || d.draw || session.status === 'finished';
    let open = false; // 가림막이 열려 있는지 (사람끼리 할 때만)
    let pick = null;
    let msg = '';
    let thinking = false;

    const cur = () => d.rounds[d.rounds.length - 1];
    // 지금 고를 자리
    const turnSeat = () => { const r = cur(); return r.t[r.lead] == null ? r.lead : 1 - r.lead; };
    const needCurtain = () => cpuSeat < 0;

    const play = (seat, n) => {
      const r = cur();
      r.t[seat] = n;
      if (r.t[0] != null && r.t[1] != null) {
        r.win = r.t[0] === r.t[1] ? null : r.t[0] > r.t[1] ? 0 : 1;
        msg = r.win == null ? `${doneRounds(d)}라운드: 무승부` : `${doneRounds(d)}라운드: ${players[r.win].name} 승리`;
        settle(d);
        if (!over()) d.rounds.push({ lead: r.win == null ? r.lead : r.win, t: [null, null], win: null });
      } else msg = '';
      open = false; pick = null;
      ctx.save(); draw();
      if (over()) setTimeout(() => ctx.finish({ ask: false }), 1200);
      else maybeCpu();
    };

    const maybeCpu = () => {
      if (cpuSeat < 0 || over() || turnSeat() !== cpuSeat || thinking) return;
      thinking = true; draw();
      setTimeout(() => {
        if (!root.isConnected) return;
        thinking = false;
        play(cpuSeat, cpuPick(d, cpuSeat, level));
      }, 600 + Math.random() * 500);
    };

    const sideHtml = (s) => {
      const left = leftOf(d, s);
      const b = left.filter(isBlack).length;
      return `<div class="bw-side ${!over() && turnSeat() === s ? 'turn' : ''}"><b>${esc(players[s].name)}</b>
        <span class="muted">${winsOf(d)[s]}승 · 남은 타일 검 ${b} / 흰 ${left.length - b}</span></div>`;
    };

    const historyHtml = () => {
      const rows = d.rounds.filter((r) => r.t[0] != null && r.t[1] != null);
      if (!rows.length) return '';
      const reveal = over();
      return `<div class="bw-hist">${rows.map((r, k) => `<div class="bw-row"><span class="muted">${k + 1}</span>
        ${[0, 1].map((s) => `<span class="bw-cell ${r.win === s ? 'won' : ''}">${tileHtml(r.t[s], { hide: !reveal })}${r.lead === s ? '<small>선</small>' : ''}</span>`).join('')}
        <span class="muted">${r.win == null ? '무' : esc(players[r.win].name) + ' 승'}</span></div>`).join('')}</div>`;
    };

    const pickHtml = () => {
      const s = turnSeat();
      const r = cur();
      const other = 1 - s;
      if (cpuSeat >= 0 && s === cpuSeat) return `<div class="chess-status">${thinking ? '컴퓨터가 고르는 중…' : ''}</div>`;
      if (needCurtain() && !open) {
        return `<div class="bw-curtain"><p><b>${esc(players[s].name)}</b> 차례예요.<br>${esc(players[other].name)}님은 화면을 보지 마세요.</p>
          <button class="btn primary" data-act="open">보기</button></div>`;
      }
      const theirs = r.t[other];
      return `<div class="bw-pick">
        <p class="center">${theirs != null ? `${esc(players[other].name)}님이 낸 타일: ${tileHtml(theirs, { hide: true })} ${isBlack(theirs) ? '검은색' : '흰색'}` : '내가 먼저 내요. 상대는 색만 봐요.'}</p>
        <div class="bw-hand">${TILES.map((n) => `<button class="bw-key ${pick === n ? 'sel' : ''}" data-n="${n}" ${leftOf(d, s).includes(n) ? '' : 'disabled'}>${tileHtml(n)}</button>`).join('')}</div>
        <div class="chess-actions"><button class="btn primary" data-act="play" ${pick == null ? 'disabled' : ''}>이 타일 내기</button></div>
      </div>`;
    };

    const draw = () => {
      const w = winsOf(d);
      root.innerHTML = `<section class="card bw-card">
        <div class="bw-sides">${sideHtml(0)}<span class="bw-vs">${w[0]} : ${w[1]}</span>${sideHtml(1)}</div>
        <div class="chess-status ${over() ? 'done' : ''}">${d.winner != null ? `${esc(players[d.winner].name)} 승리!` : d.draw ? '무승부' : `${doneRounds(d) + 1}라운드 · ${esc(players[turnSeat()].name)} 차례${cpuSeat >= 0 ? ` <small class="muted">· 컴퓨터 ${LEVEL_NAMES[level]}</small>` : ''}`}</div>
        <p class="quiz-msg ok">${esc(msg)}</p>
        ${over() ? '' : pickHtml()}
        ${historyHtml()}
        ${over() && session.status !== 'finished' ? '<button class="btn primary block" data-act="finish">전적에 기록</button>' : ''}
        ${over() ? '<p class="muted center">끝났으니 라운드마다 낸 숫자를 공개해요.</p>' : ''}
      </section>`;
    };

    root.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'finish') return ctx.finish({ ask: false });
      if (over() || thinking) return;
      if (act === 'open') { open = true; return draw(); }
      if (b.dataset.n != null) { pick = Number(b.dataset.n); return draw(); }
      if (act === 'play' && pick != null) {
        const s = turnSeat();
        if (!leftOf(d, s).includes(pick)) return;
        play(s, pick);
      }
    };
    draw();
    maybeCpu();
  },
};
