// 게임 등록부. 새 보드게임을 추가하려면 js/games/<id>.js 를 만들고 아래 GAME_META 에 한 줄 추가하세요.
// 게임 파일은 그 게임을 열 때만 불러옵니다 (첫 화면을 가볍게).
//  - modes: 'record' = 실물로 하고 점수만 기록, 'play' = 화면에서 직접 플레이 (둘 다 가능한 게임도 있음)
//  - icon: 게임 아이콘(이모지·SVG), img: img/games/ 안의 그림 파일 이름(있으면 icon 대신), color·mark: 둘 다 없을 때 쓰는 글자 아이콘
//  - tieIsNoWin: 모두 같은 점수(무승부)는 1등으로 치지 않음, ranked:false 면 순위·전적 집계에서 뺌
// 각 게임 모듈은 { id, name, minPlayers, maxPlayers, settingsFields,
//   initData(players, settings), computeTotals(session), renderPlay(root, session, ctx) } 를 제공합니다.
// 루미큐브: 직접 그린 타일 그림, 윷놀이: 윷가락 네 개
const RK_ICON = '<svg class="gicon" viewBox="0 0 32 32" aria-hidden="true">'
  + '<rect x="5.5" y="2.5" width="21" height="27" rx="3.5" fill="#f8f2e2" stroke="#b9ad92"/>'
  + '<rect x="5.5" y="25" width="21" height="4.5" rx="2" fill="#e6dcc4"/>'
  + '<circle cx="16" cy="13.5" r="7" fill="#e8463a"/>'
  + '<circle cx="13.4" cy="11.8" r="1.2" fill="#fff"/><circle cx="18.6" cy="11.8" r="1.2" fill="#fff"/>'
  + '<path d="M12.3 15.2q3.7 4 7.4 0" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>'
  + '</svg>';
const YUT_ICON = '<svg class="gicon" viewBox="0 0 32 32" aria-hidden="true">'
  + [5, 11, 17, 23].map((x, i) => `<rect x="${x}" y="4" width="5" height="24" rx="2.5" fill="${i % 2 ? '#f3e3c1' : '#a0743c'}" stroke="#6b4a1c"/>`).join('')
  + '</svg>';

export const GAME_META = [
  { id: 'skullking', name: '스컬킹', icon: '🏴‍☠️', modes: ['record'], color: '#3b3f4a', load: () => import('./skullking.js?v=202611121133') },
  { id: 'rummikub', name: '루미큐브', icon: RK_ICON, modes: ['record'], color: '#b8452f', load: () => import('./rummikub.js?v=202611121133') },
  { id: 'yacht', name: '요트다이스', icon: '🎲', modes: ['record', 'play'], color: '#2f6f9f', load: () => import('./yacht.js?v=202611121133') },
  { id: 'sparrow', name: '참새작', icon: '🐦', modes: ['record'], color: '#3d7a4a', load: () => import('./sparrow.js?v=202611121133') },
  { id: 'celestia', name: '셀레스티아', icon: '🎈', modes: ['record'], color: '#4a78b5', load: () => import('./celestia.js?v=202611121133') },
  { id: 'davinci', name: '다빈치 코드', icon: '🔢', modes: ['record'], color: '#2b2b2b', load: () => import('./davinci.js?v=202611121133') },
  { id: 'clue', name: '클루', icon: '🔍', modes: ['record'], color: '#7a4b8c', load: () => import('./clue.js?v=202611121133') },
  { id: 'chess', name: '체스', icon: '♟️', modes: ['play'], color: '#6b4f2a', tieIsNoWin: true, load: () => import('./chess.js?v=202611121133') },
  { id: 'chessquiz', name: '체스 퀴즈', icon: '🧩', mark: '퀴', modes: ['play'], color: '#8a6d3b', load: () => import('./chessquiz.js?v=202611121133') },
  { id: 'omok', name: '오목', icon: '⚫', modes: ['play'], color: '#a0743c', tieIsNoWin: true, load: () => import('./omok.js?v=202611121133') },
  { id: 'yut', name: '윷놀이', icon: YUT_ICON, modes: ['play'], color: '#9c3d2b', load: () => import('./yut.js?v=202611121133') },
];

const loaded = new Map();

// 불러온 게임은 모듈 + 등록 정보, 아직이면 등록 정보만 (이름·색 등은 바로 쓸 수 있음)
export const getGame = (id) => loaded.get(id) || GAME_META.find((g) => g.id === id);
export const GAMES = GAME_META; // 목록·칩 표시용

export async function loadGame(id) {
  if (loaded.has(id)) return loaded.get(id);
  const meta = GAME_META.find((g) => g.id === id);
  if (!meta) return null;
  const mod = (await meta.load()).default;
  const g = { ...mod, ...meta, guide: mod.guide, minPlayers: mod.minPlayers, maxPlayers: mod.maxPlayers };
  loaded.set(id, g);
  return g;
}
export const loadGames = (ids) => Promise.all([...new Set(ids)].map(loadGame));

// 아이콘: 그림 파일(img) > 게임 아이콘(icon) > 게임 색 바탕에 이름 첫 글자
export function gameIcon(g, cls = '') {
  if (!g) return '';
  if (g.img) return `<span class="gmark ${cls}" aria-hidden="true"><img src="img/games/${g.img}" alt=""></span>`;
  if (g.icon) return `<span class="gmark ico ${cls}" aria-hidden="true">${g.icon}</span>`;
  return `<span class="gmark ${cls}" style="--gc:${g.color || '#555'}" aria-hidden="true"><b>${g.mark || g.name[0]}</b></span>`;
}

// 첫 화면이 뜬 뒤 한가할 때 나머지 게임 파일도 미리 받아 둠 (나중에 게임을 열 때 바로 뜨게)
export function prefetchGames() {
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
  idle(() => { GAME_META.reduce((p, g) => p.then(() => loadGame(g.id)).catch(() => {}), Promise.resolve()); });
}
