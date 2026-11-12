// 클루(Clue / Cluedo) 추리 노트
//  - 카드 구성(용의자·도구·장소)은 게임 전체가 공유: session.data.items
//  - 각자의 체크표와 메모는 본인 계정에만 저장: ctx.note (Firestore sessions/{id}/notes/{uid})
//  - 전적: 정답을 맞힌 사람 1, 나머지 0 → 맞힌 횟수가 곧 1등 횟수
// 카드 이름은 언제든 '목록 편집'으로 바꿀 수 있습니다 (판본·언어마다 이름이 달라서).

export const CATS = [
  ['suspects', '용의자'],
  ['weapons', '도구'],
  ['rooms', '장소'],
];

export const PRESETS = {
  classic: {
    label: '오리지널',
    suspects: ['스칼렛', '머스타드 대령', '화이트 부인', '그린', '피콕 부인', '플럼 교수'],
    weapons: ['촛대', '단검', '납 파이프', '권총', '밧줄', '렌치'],
    rooms: ['부엌', '무도회장', '온실', '식당', '당구장', '도서관', '라운지', '홀', '서재'],
  },
  // 오리지널 2016년 이후 판: 화이트 부인 대신 오키드 박사
  orchid: {
    label: '오리지널 (2016~)',
    suspects: ['스칼렛', '머스타드 대령', '오키드 박사', '그린', '피콕 부인', '플럼 교수'],
  },
  // 심슨 에디션: 판본에 따라 용의자가 다름 (도구·장소는 같음)
  simpsons1: {
    label: '심슨 (1판)',
    suspects: ['호머', '마지', '바트', '리사', '크러스티', '스미더스'],
  },
  simpsons2: {
    label: '심슨 (2판)',
    suspects: ['호머', '마지', '바트', '리사', '팻 토니', '에드나 크라바펠'],
  },
};
const SIMPSONS_COMMON = {
  weapons: ['목걸이', '독 도넛', '늘어나는 장갑', '새총', '색소폰', '플루토늄 막대'],
  rooms: ['심슨네 집', '번즈 저택', '원자력 발전소', '퀵이마트', '바니 볼링장', '크러스티 스튜디오', '프라잉 더치맨', '안드로이드 던전', '양로원'],
};
Object.assign(PRESETS.orchid, { weapons: PRESETS.classic.weapons, rooms: PRESETS.classic.rooms });
Object.assign(PRESETS.simpsons1, SIMPSONS_COMMON);
Object.assign(PRESETS.simpsons2, SIMPSONS_COMMON);

const presetItems = (key) => Object.fromEntries(CATS.map(([c]) => [c, [...PRESETS[key][c]]]));

// 칸 표시: 빈칸 → ✗(없음) → ✓(가짐) → ?(의심) → 빈칸
export const MARKS = ['', 'x', 'o', '?'];
const MARK_TEXT = { '': '', x: '✗', o: '✓', '?': '?' };
export const nextMark = (m) => MARKS[(MARKS.indexOf(m || '') + 1) % MARKS.length];
// 항목 이름 표시: 보통 → 취소선(범인 아님) → ⭐(정답 후보)
const ROW_STATES = ['', 'out', 'star'];
export const nextRow = (r) => ROW_STATES[(ROW_STATES.indexOf(r || '') + 1) % ROW_STATES.length];

export const emptyNote = () => ({ marks: {}, rows: {}, memo: '' });

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
  id: 'clue',
  name: '클루',
  emoji: '🔍',
  // 소개·도움말 (직접 정리한 요약)
  guide: {
    players: '3~6명 (앱은 2명부터)', time: '45~60분',
    intro: '저택에서 일어난 사건의 범인, 도구, 장소를 추리하는 게임이에요. 다른 사람이 가진 카드를 하나씩 지워 가며 봉투 속 3장을 가장 먼저 맞히면 이겨요. 이 앱은 점수 대신 나만 보는 추리 노트를 제공해요.',
    rules: [
      '용의자·도구·장소 카드를 한 장씩 몰래 봉투에 넣고, 나머지 카드를 모두에게 나눠요.',
      '차례에 주사위를 굴려 방으로 이동하고, 그 방에서 "누가 어떤 도구로" 했는지 제안(추측)해요.',
      '왼쪽 사람부터 차례로, 제안한 카드 중 하나라도 가진 사람은 그중 한 장을 제안한 사람에게만 몰래 보여 줘요. 한 명이 보여 주면 확인은 끝나요.',
      '확신이 들면 "고발"을 하고 봉투를 확인해요. 맞으면 승리, 틀리면 더 이상 이길 수 없지만 카드는 계속 보여 줘야 해요.',
      '판본에 따라 인물·도구·방 이름이나 개수가 달라요. 앱에서 판본을 고르거나 목록을 직접 고칠 수 있어요.',
    ],
    scoring: [
      '클루는 점수 게임이 아니라서, 이 앱에서는 정답을 맞힌 사람이 1등으로 전적에 기록돼요.',
      '게임을 끝낼 때 정답자를 고르면 돼요.',
      '추리 노트의 체크와 메모는 내 계정에만 저장돼서 다른 사람에게는 보이지 않아요.',
    ],
    tips: [
      '내 손에 있는 카드부터 노트에 모두 지워 두세요.',
      '누가 "카드가 없다"고 넘긴 것도 중요한 정보예요. 그 사람은 제안된 세 장 중 어느 것도 없어요.',
      '내 카드를 섞어서 제안하면, 남이 무엇을 보여 주는지로 원하는 한 가지만 확인할 수 있어요.',
      '다른 사람의 제안이 계속 반복되는 카드는 봉투 속에 있을 가능성이 높아요.',
    ],
  },
  minPlayers: 2,
  maxPlayers: 6,
  settingsFields: [],

  initData() {
    return { edition: 'classic', items: presetItems('classic'), winner: null };
  },

  computeTotals(session) {
    return session.players.map((_, i) => (session.data.winner === i ? 1 : 0));
  },

  // 기록·결과 화면에서 숫자 대신 보여줄 글자
  totalLabel(t) { return t ? '정답' : ''; },

  // 종료 버튼에서 정답자를 먼저 고르게 하므로 빈 칸 경고는 없음
  incompleteCount() { return 0; },

  renderPlay(root, session, ctx) {
    const players = session.players;
    const d = session.data;
    const readonly = session.status === 'finished';
    const myEmail = String(ctx.me?.email || '').toLowerCase();
    const meIdx = myEmail ? players.findIndex((p) => (p.email || '').toLowerCase() === myEmail) : -1;
    let note = null; // 불러오는 중
    let editing = false;
    let hidden = false;

    const saveNote = () => ctx.note.save(note);

    const noteTable = () => `
      <div class="table-wrap">
        <table class="clue-table">
          <thead><tr><th class="cat"></th>${players.map((p, i) => `<th class="${i === meIdx ? 'me' : ''}">${esc(p.name)}${i === meIdx ? '<br><small>나</small>' : ''}</th>`).join('')}</tr></thead>
          <tbody>
            ${CATS.map(([c, label]) => `
              <tr class="clue-sec"><th class="cat" colspan="${players.length + 1}">${label}</th></tr>
              ${d.items[c].map((name, i) => {
                const k = c + i;
                const rs = note.rows[k] || '';
                return `<tr class="${rs}">
                  <th class="cat"><button class="clue-name ${rs}" data-row="${k}">${rs === 'star' ? '⭐ ' : ''}${esc(name)}</button></th>
                  ${players.map((_, pi) => { const m = note.marks[k]?.[pi] || ''; return `<td class="${pi === meIdx ? 'me' : ''}"><button class="clue-cell m-${m === '?' ? 'q' : m}" data-cell="${k}" data-p="${pi}">${MARK_TEXT[m]}</button></td>`; }).join('')}
                </tr>`;
              }).join('')}`).join('')}
          </tbody>
        </table>
      </div>`;

    const draw = () => {
      const ed = d.edition || 'custom';
      root.innerHTML = `
        <section class="card">
          <div class="round-head"><h3>카드 구성</h3>${readonly ? '' : `<button class="btn ghost small" data-act="edit">${editing ? '닫기' : '목록 편집'}</button>`}</div>
          <div class="chips">
            ${Object.entries(PRESETS).map(([k, p]) => `<button class="chip ${ed === k ? 'on' : ''}" data-ed="${k}" ${readonly ? 'disabled' : ''}>${p.label}</button>`).join('')}
            ${ed === 'custom' ? '<span class="chip on">직접 입력</span>' : ''}
          </div>
          ${editing ? `<div class="clue-edit">
              ${CATS.map(([c, label]) => `<label>${label} <span class="muted">(한 줄에 하나)</span><textarea data-items="${c}" rows="${Math.max(6, d.items[c].length)}">${esc(d.items[c].join('\n'))}</textarea></label>`).join('')}
              <button class="btn primary block" data-act="apply">목록 저장</button>
            </div>` : '<p class="muted">카드 목록은 함께하는 모두가 같이 써요. 다른 폰에서는 게임을 다시 열면 바뀐 목록이 보여요.</p>'}
        </section>

        <section class="card clue-note ${hidden ? 'hidden' : ''}">
          <div class="round-head">
            <h3>🔒 내 추리 노트</h3>
            <button class="btn ghost small" data-act="hide">${hidden ? '보이기' : '가리기'}</button>
          </div>
          <p class="muted">${ctx.note.private ? '이 노트는 내 계정에만 저장되고 다른 사람에게는 보이지 않아요.' : '이 노트는 이 기기에만 저장돼요.'}
            칸을 누를 때마다 <b>✗</b> 없음 → <b>✓</b> 가짐 → <b>?</b> 의심 → 빈칸, 이름을 누르면 <s>지우기</s> → ⭐ 후보.</p>
          <div class="clue-body">
            ${note ? `${noteTable()}
              <label class="clue-memo">메모<textarea data-memo="1" rows="4" placeholder="누가 무엇을 물어봤는지, 누가 카드를 보여줬는지 등">${esc(note.memo)}</textarea></label>
              <button class="btn ghost small danger" data-act="clear">내 노트 지우기</button>`
              : '<p class="muted">노트 불러오는 중…</p>'}
          </div>
        </section>

        <section class="card">
          <h3>정답을 맞힌 사람</h3>
          <div class="chips">
            ${players.map((p, i) => `<button class="chip ${d.winner === i ? 'on' : ''}" data-win="${i}" ${readonly ? 'disabled' : ''}>${d.winner === i ? '👑 ' : ''}${esc(p.name)}</button>`).join('')}
          </div>
          ${readonly ? '' : '<button class="btn primary block" data-act="finish">게임 종료</button>'}
        </section>`;
    };

    root.onclick = (e) => {
      const t = e.target.closest('button');
      if (!t || t.disabled) return;
      const ds = t.dataset;
      if (ds.act === 'hide') { hidden = !hidden; return draw(); }
      if (note && ds.cell) {
        const row = (note.marks[ds.cell] ||= {});
        const m = nextMark(row[ds.p]);
        if (m) row[ds.p] = m; else delete row[ds.p];
        saveNote(); return draw();
      }
      if (note && ds.row) {
        const r = nextRow(note.rows[ds.row]);
        if (r) note.rows[ds.row] = r; else delete note.rows[ds.row];
        saveNote(); return draw();
      }
      if (note && ds.act === 'clear') {
        if (!confirm('내 노트의 표시와 메모를 모두 지울까요?')) return;
        note = emptyNote(); saveNote(); return draw();
      }
      if (ds.act === 'finish') {
        if (d.winner == null) { alert('정답을 맞힌 사람을 먼저 골라 주세요.'); return; }
        ctx.finish(); return;
      }
      if (readonly) return;
      if (ds.act === 'edit') { editing = !editing; return draw(); }
      if (ds.ed) {
        if (ds.ed === d.edition) return;
        if (!confirm(`카드 구성을 '${PRESETS[ds.ed].label}'(으)로 바꿀까요?\n함께하는 모두의 목록이 바뀌어요.`)) return;
        d.edition = ds.ed; d.items = presetItems(ds.ed);
        ctx.save(); return draw();
      }
      if (ds.act === 'apply') {
        const next = {};
        for (const [c, label] of CATS) {
          const lines = root.querySelector(`[data-items="${c}"]`).value.split('\n').map((x) => x.trim()).filter(Boolean);
          if (!lines.length) { alert(`${label} 목록이 비어 있어요.`); return; }
          next[c] = lines;
        }
        const same = Object.entries(PRESETS).find(([, p]) => CATS.every(([c]) => p[c].join('\n') === next[c].join('\n')));
        d.items = next; d.edition = same ? same[0] : 'custom';
        editing = false; ctx.save(); return draw();
      }
      if (ds.win != null) {
        const i = Number(ds.win);
        d.winner = d.winner === i ? null : i;
        ctx.save(); return draw();
      }
    };
    root.oninput = (e) => {
      if (note && e.target.dataset.memo) { note.memo = e.target.value; saveNote(); }
    };

    draw();
    ctx.note.load().then((n) => { note = { ...emptyNote(), ...(n || {}) }; draw(); })
      .catch((err) => { console.error(err); note = emptyNote(); draw(); });
  },
};
