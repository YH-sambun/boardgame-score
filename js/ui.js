// 화면 공통 부품: ? 설명 버튼 · 드롭다운(선택) · ⋯ 메뉴
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 제목 옆 ? 버튼. 설명(tipBody)은 그 제목 바로 다음에 둠 → 누를 때만 펼쳐짐
export const tipBtn = () => '<button type="button" class="qbtn" data-tip aria-label="설명 보기" aria-expanded="false">?</button>';
export const tipBody = (html) => `<div class="tip" hidden>${html}</div>`;

// 드롭다운: opts = [[값, 글자], ...]
export const selectHtml = (attrs, opts, cur) => `<select ${attrs}>${opts.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;

// 게임 고르기 드롭다운 (바꾸면 그 주소로 이동)
export const navSelect = (opts, cur, label = '') => `<label class="pick">${label ? `<span>${esc(label)}</span>` : ''}${selectHtml('data-nav', opts, cur)}</label>`;

// ⋯ 메뉴: items = [{ act?, href?, label, danger? }]
export const menuHtml = (items, { label = '⋯', cls = '' } = {}) => {
  const list = items.filter(Boolean);
  if (!list.length) return '';
  return `<details class="dd ${cls}"><summary class="btn ghost small ${label === '⋯' ? 'dots' : ''}" aria-label="메뉴">${label}</summary><div class="dd-menu">${list.map((x) => (x.href
    ? `<a href="${x.href}" class="${x.danger ? 'danger' : ''}">${esc(x.label)}</a>`
    : x.text ? `<div class="dd-text">${x.text}</div>`
      : `<button type="button" data-act="${x.act}" class="${x.danger ? 'danger' : ''}">${esc(x.label)}</button>`)).join('')}</div></details>`;
};

let bound = false;
export function bindUi() {
  if (bound) return; bound = true;
  document.addEventListener('click', (e) => {
    // 열린 ⋯ 메뉴는 바깥이나 항목을 누르면 닫힘
    document.querySelectorAll('details.dd[open]').forEach((d) => {
      if (!d.contains(e.target) || e.target.closest('.dd-menu a, .dd-menu button')) d.open = false;
    });
    const b = e.target.closest('[data-tip]');
    if (!b) return;
    const head = b.closest('h1,h2,h3,.tip-anchor');
    const t = head?.nextElementSibling;
    if (!t || !t.classList.contains('tip')) return;
    t.hidden = !t.hidden;
    b.setAttribute('aria-expanded', String(!t.hidden));
    b.classList.toggle('on', !t.hidden);
  });
  document.addEventListener('change', (e) => {
    const s = e.target.closest('select[data-nav]');
    if (s && s.value) location.hash = s.value;
  });
  addEventListener('hashchange', () => document.querySelectorAll('details.dd[open]').forEach((d) => { d.open = false; }));
}
