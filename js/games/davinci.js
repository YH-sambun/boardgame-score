// 다빈치 코드: 탈락 순서 기록 + 개인 추리 도우미
//  기록: 판마다 탈락한 순서대로 사람을 누르면, 마지막에 남은 사람이 그 판 승자.
//        판 점수 = 나보다 먼저 탈락한 사람 수 (승자는 인원-1). 여러 판의 합계로 순위.
//  추리 도우미(내 계정에만 저장): 상대 타일 줄을 흑/백으로 적어 두면, 오름차순 규칙
//        (같은 숫자는 흑이 왼쪽)과 공개된 숫자, 틀린 추측으로 숨은 타일마다 가능한 숫자를 좁혀 줌.
// session.data = { rounds:[{ order:[탈락 순서 자리], winner, streak3:[자리] }], current }
// note = { me:자리|null, joker:bool, rows:{ [자리]: [{ c:'b'|'w', v:null|0~11|'J', not:[숫자] }] }, memo }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NUMS = Array.from({ length: 12 }, (_, i) => i);
const newRound = () => ({ order: [], winner: null, streak3: [] });

function roundPoints(r, n) {
  const pts = Array(n).fill(null);
  if (r.winner == null) return pts;
  r.order.forEach((pi, k) => { pts[pi] = k; });
  pts[r.winner] = n - 1;
  return pts;
}
function totalsOf(session) {
  const n = session.players.length;
  const t = Array(n).fill(0);
  for (const r of session.data.rounds) roundPoints(r, n).forEach((p, i) => { t[i] += p || 0; });
  return t;
}

// ── 후보 계산 ──
const key = (v, c) => v * 2 + (c === 'b' ? 0 : 1);
export function candidates(note) {
  const known = new Set();
  const all = Object.values(note.rows || {}).flat();
  for (const t of all) if (t.v != null) known.add(t.c + t.v);
  // 각 타일의 후보: 숫자 목록 (+ 조커 가능하면 'J')
  const cand = new Map();
  for (const t of all) {
    if (t.v != null) { cand.set(t, [t.v]); continue; }
    const xs = NUMS.filter((v) => !known.has(t.c + v) && !(t.not || []).includes(v));
    if (note.joker && !known.has(t.c + 'J') && !(t.not || []).includes('J')) xs.push('J');
    cand.set(t, xs);
  }
  const nums = (t) => cand.get(t).filter((v) => v !== 'J');
  const fixedOrder = (t) => !cand.get(t).includes('J') && nums(t).length > 0; // 조커일 수 있으면 순서 제약에서 뺌
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (const row of Object.values(note.rows || {})) {
      // 왼쪽에서: 앞 타일의 최소보다 커야 함
      let lo = -1;
      for (const t of row) {
        if (t.v == null) {
          const before = cand.get(t).length;
          cand.set(t, cand.get(t).filter((v) => v === 'J' || key(v, t.c) > lo));
          if (cand.get(t).length !== before) changed = true;
        }
        if (fixedOrder(t)) lo = Math.max(lo, Math.min(...nums(t).map((v) => key(v, t.c))));
      }
      // 오른쪽에서: 뒤 타일의 최대보다 작아야 함
      let hi = 99;
      for (const t of [...row].reverse()) {
        if (t.v == null) {
          const before = cand.get(t).length;
          cand.set(t, cand.get(t).filter((v) => v === 'J' || key(v, t.c) < hi));
          if (cand.get(t).length !== before) changed = true;
        }
        if (fixedOrder(t)) hi = Math.min(hi, Math.max(...nums(t).map((v) => key(v, t.c))));
      }
    }
    // 후보가 하나뿐인 숨은 타일의 숫자는 다른 같은 색 타일 후보에서 뺌
    for (const t of all) {
      const c = cand.get(t);
      if (t.v != null || c.length !== 1) continue;
      for (const o of all) {
        if (o === t || o.c !== t.c || o.v != null) continue;
        const before = cand.get(o).length;
        cand.set(o, cand.get(o).filter((v) => v !== c[0]));
        if (cand.get(o).length !== before) changed = true;
      }
    }
    if (!changed) break;
  }
  return cand;
}

const candText = (xs) => {
  if (!xs.length) return '모순';
  const n = xs.filter((v) => v !== 'J');
  const j = xs.includes('J') ? '·J' : '';
  if (n.length > 5) return `${n[0]}~${n[n.length - 1]}${j}`;
  return n.join('·') + j;
};

export default {
  id: 'davinci',
  name: '다빈치 코드',
  guide: {
    players: '2~4명', time: '15~20분',
    intro: '흑과 백 숫자 타일을 오름차순으로 세워 두고, 상대 타일의 숫자를 맞혀 하나씩 뒤집는 추리 게임이에요. 내 타일이 모두 뒤집히면 탈락하고, 마지막까지 남은 사람이 이겨요.',
    rules: [
      '흑·백 각각 0~11 타일을 섞어 엎어 두고, 인원에 따라 3~4개씩 가져가요(2~3명 4개, 4명 3개).',
      '내 타일은 작은 숫자가 왼쪽에 오게 세워요. 같은 숫자면 흑이 왼쪽이에요.',
      '내 차례에 타일을 하나 가져와 내 줄의 맞는 자리에 넣고, 상대 타일 하나를 골라 숫자를 말해요.',
      '맞히면 그 타일이 뒤집혀요. 계속 맞힐지, 멈추고 가져온 타일을 숨긴 채 둘지 정해요.',
      '틀리면 방금 가져온 내 타일을 공개해 세워야 해요.',
      '조커(─)를 쓰는 규칙이면 조커는 아무 자리에나 둘 수 있어요.',
    ],
    scoring: [
      '판마다 탈락한 순서대로 사람을 누르면 마지막에 남은 사람이 그 판 승자가 돼요.',
      '판 점수는 나보다 먼저 탈락한 사람 수예요(승자는 인원-1점). 여러 판을 해서 합계로 순위를 정해요.',
      '한 차례에 3번 연속 맞힌 사람은 그 판에서 체크해 두면 업적(연속 적중)에 반영돼요.',
    ],
    tips: [
      '추리 도우미에 상대 타일 줄을 흑/백 순서대로 적어 두면, 숨은 타일마다 가능한 숫자를 자동으로 좁혀 보여 줘요.',
      '틀린 추측("이 타일은 5가 아님")도 기록해 두세요. 후보가 확 줄어요.',
      '후보가 하나만 남은 타일부터 맞히면 안전하게 연속으로 갈 수 있어요.',
    ],
  },
  minPlayers: 2,
  maxPlayers: 4,
  settingsFields: [],
  roundLabel: '판',

  initData() { return { rounds: [newRound()], current: 0 }; },
  computeTotals: totalsOf,
  incompleteCount(session) { return session.data.rounds.filter((r) => r.winner == null && r.order.length).length; },

  renderPlay(root, session, ctx) {
    const players = session.players;
    const n = players.length;
    const d = session.data;
    const readonly = session.status === 'finished';
    let note = null;
    let sel = null; // { row, idx }
    let tapMode = 'reveal'; // reveal | not
    const saveNote = () => ctx.note.save(note);

    const recordHtml = () => {
      const ri = d.current; const r = d.rounds[ri];
      const totals = totalsOf(session);
      const pts = roundPoints(r, n);
      return `<section class="card">
        <div class="round-tabs">${d.rounds.map((x, i) => `<button class="pill ${i === ri ? 'active' : ''} ${x.winner != null ? 'done' : ''}" data-round="${i}">${i + 1}</button>`).join('')}
          ${readonly ? '' : '<button class="pill" data-act="add">+</button>'}</div>
        <div class="round-head"><h2>${ri + 1}판</h2><span class="muted">${r.winner != null ? `${esc(players[r.winner].name)} 승리` : '탈락한 순서대로 누르세요'}</span></div>
        <div class="dv-order">${players.map((p, pi) => {
          const k = r.order.indexOf(pi);
          const win = r.winner === pi;
          return `<button class="dv-p ${k >= 0 ? 'out' : ''} ${win ? 'win' : ''}" data-out="${pi}" ${readonly || win ? 'disabled' : ''}>
            <b>${esc(p.name)}</b><small>${win ? '승리' : k >= 0 ? `${k + 1}번째 탈락` : '생존'}</small><span class="dv-pts">${pts[pi] != null ? '+' + pts[pi] : ''}</span><span class="muted">${totals[pi]}점</span></button>`;
        }).join('')}</div>
        ${r.winner != null ? `<div class="chips"><span class="muted">연속 3번 적중:</span>${players.map((p, pi) => `<button class="chip ${r.streak3?.includes(pi) ? 'on' : ''}" data-streak="${pi}" ${readonly ? 'disabled' : ''}>${esc(p.name)}</button>`).join('')}</div>` : ''}
        <div class="round-nav">
          ${readonly ? '<span></span>' : `<button class="btn ghost" data-act="undo" ${r.order.length || r.winner != null ? '' : 'disabled'}>되돌리기</button>`}
          ${readonly ? '' : `<button class="btn" data-act="next" ${r.winner != null ? '' : 'disabled'}>다음 판</button><button class="btn primary" data-act="finish">게임 종료</button>`}
        </div>
      </section>`;
    };

    const helperHtml = () => {
      if (!note) return '<section class="card"><p class="muted">추리 노트 불러오는 중…</p></section>';
      const cand = candidates(note);
      const tile = (t, row, idx) => {
        const on = sel && sel.row === row && sel.idx === idx;
        const c = cand.get(t) || [];
        return `<button class="dv-tile ${t.c} ${t.v != null ? 'open' : ''} ${on ? 'sel' : ''} ${!c.length ? 'bad' : ''}" data-tile="${row}:${idx}">
          <b>${t.v != null ? (t.v === 'J' ? '─' : t.v) : '?'}</b>${t.v == null ? `<small>${candText(c)}</small>` : ''}</button>`;
      };
      const rowHtml = (row, label) => {
        const ts = note.rows[row] || [];
        return `<div class="dv-row"><div class="dv-row-h"><b>${label}</b>
          <span><button class="btn small ghost" data-addt="${row}:b">+흑</button><button class="btn small ghost" data-addt="${row}:w">+백</button></span></div>
          <div class="dv-tiles">${ts.map((t, i) => tile(t, row, i)).join('') || '<span class="muted">타일을 왼쪽부터 순서대로 추가하세요</span>'}</div></div>`;
      };
      const st = sel && note.rows[sel.row]?.[sel.idx];
      return `<section class="card dv-note ${ctx.note.private ? '' : ''}">
        <div class="round-head"><h3>추리 도우미</h3><label class="muted"><input type="checkbox" data-joker ${note.joker ? 'checked' : ''}> 조커 사용</label></div>
        <div class="chips"><span class="muted">나는</span>${players.map((p, pi) => `<button class="chip ${note.me === pi ? 'on' : ''}" data-me="${pi}">${esc(p.name)}</button>`).join('')}</div>
        ${note.me == null ? '<p class="muted">먼저 내가 누구인지 고르세요.</p>' : `
          ${rowHtml('me', '내 타일 (숫자를 모두 입력)')}
          ${players.map((p, pi) => (pi === note.me ? '' : rowHtml(String(pi), esc(p.name)))).join('')}
          ${st ? `<div class="dv-panel">
            <div class="chips"><button class="chip ${tapMode === 'reveal' ? 'on' : ''}" data-tm="reveal">${sel.row === 'me' ? '숫자' : '공개된 숫자'}</button>${sel.row === 'me' ? '' : `<button class="chip ${tapMode === 'not' ? 'on' : ''}" data-tm="not">틀린 추측(아님)</button>`}</div>
            <div class="numpad-keys">${[...NUMS, ...(note.joker ? ['J'] : [])].map((v) => `<button class="key ${tapMode === 'reveal' ? (st.v === v ? 'on' : '') : ((st.not || []).includes(v) ? 'on no' : '')}" data-num="${v}">${v === 'J' ? '─' : v}</button>`).join('')}</div>
            <div class="row-btns"><button class="btn small" data-mv="-1">왼쪽으로</button><button class="btn small" data-mv="1">오른쪽으로</button><button class="btn small" data-ins="b">왼쪽에 흑 끼우기</button><button class="btn small" data-ins="w">왼쪽에 백 끼우기</button><button class="btn small" data-flip>흑/백 바꾸기</button><button class="btn small danger" data-deltile>삭제</button></div>
          </div>` : '<p class="muted">타일을 누르면 숫자 입력, 틀린 추측 표시, 위치 이동을 할 수 있어요. 숨은 타일 아래 작은 글씨가 가능한 숫자예요.</p>'}`}
        <label class="clue-memo">메모<textarea data-memo rows="2">${esc(note.memo || '')}</textarea></label>
        <p class="muted">${ctx.note.private ? '이 노트는 내 계정에만 저장되고 다른 사람에게는 보이지 않아요.' : '이 노트는 이 기기에만 저장돼요.'}</p>
      </section>`;
    };

    const draw = () => { root.innerHTML = recordHtml() + (readonly ? '' : helperHtml()); };

    root.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const ds = b.dataset;
      const r = d.rounds[d.current];
      if (ds.act === 'finish') return ctx.finish();
      if (ds.round != null) { d.current = Number(ds.round); return draw(); }
      if (readonly) return;
      if (ds.act === 'add' || ds.act === 'next') {
        if (ds.act === 'add' || d.current === d.rounds.length - 1) d.rounds.push(newRound());
        d.current = ds.act === 'add' ? d.rounds.length - 1 : d.current + 1; ctx.save(); return draw();
      }
      if (ds.out != null) {
        const pi = Number(ds.out);
        if (r.winner != null) return;
        const k = r.order.indexOf(pi);
        if (k >= 0) r.order.splice(k, 1); else r.order.push(pi);
        if (r.order.length === n - 1) r.winner = [...Array(n).keys()].find((i) => !r.order.includes(i));
        ctx.save(); return draw();
      }
      if (ds.act === 'undo') { if (r.winner != null) r.winner = null; else r.order.pop(); r.streak3 = []; ctx.save(); return draw(); }
      if (ds.streak != null) { const i = Number(ds.streak); r.streak3 = r.streak3?.includes(i) ? r.streak3.filter((x) => x !== i) : [...(r.streak3 || []), i]; ctx.save(); return draw(); }
      if (!note) return;
      if (ds.me != null) { note.me = Number(ds.me); sel = null; saveNote(); return draw(); }
      if (ds.addt) { const [row, c] = ds.addt.split(':'); (note.rows[row] ||= []).push({ c, v: null, not: [] }); sel = { row, idx: note.rows[row].length - 1 }; tapMode = 'reveal'; saveNote(); return draw(); }
      if (ds.tile) { const [row, idx] = ds.tile.split(':'); sel = sel && sel.row === row && sel.idx === Number(idx) ? null : { row, idx: Number(idx) }; if (sel?.row === 'me') tapMode = 'reveal'; return draw(); }
      if (ds.tm) { tapMode = ds.tm; return draw(); }
      const row = sel && note.rows[sel.row]; const t = row?.[sel.idx];
      if (!t) return;
      if (ds.num != null) {
        const v = ds.num === 'J' ? 'J' : Number(ds.num);
        if (tapMode === 'reveal') t.v = t.v === v ? null : v;
        else t.not = (t.not || []).includes(v) ? t.not.filter((x) => x !== v) : [...(t.not || []), v];
      } else if (ds.mv) {
        const j = sel.idx + Number(ds.mv);
        if (j < 0 || j >= row.length) return;
        [row[sel.idx], row[j]] = [row[j], row[sel.idx]]; sel.idx = j;
      } else if (ds.ins) { row.splice(sel.idx, 0, { c: ds.ins, v: null, not: [] }); }
      else if (ds.flip != null) { t.c = t.c === 'b' ? 'w' : 'b'; }
      else if (ds.deltile != null) { row.splice(sel.idx, 1); sel = null; }
      saveNote(); draw();
    };
    root.onchange = (e) => { if (note && e.target.dataset.joker != null) { note.joker = e.target.checked; saveNote(); draw(); } };
    root.oninput = (e) => { if (note && e.target.dataset.memo != null) { note.memo = e.target.value; saveNote(); } };
    draw();
    if (!readonly) ctx.note.load().then((x) => { note = { me: null, joker: false, rows: {}, memo: '', ...(x || {}) }; draw(); }).catch(() => { note = { me: null, joker: false, rows: {}, memo: '' }; draw(); });
  },
};
