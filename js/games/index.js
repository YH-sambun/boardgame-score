// 게임 등록부. 새 보드게임을 추가하려면 js/games/<id>.js 를 만들고 아래 GAME_META 에 한 줄 추가하세요.
// 게임 파일은 그 게임을 열 때만 불러옵니다 (첫 화면을 가볍게).
//  - modes: 'record' = 실물로 하고 점수만 기록, 'play' = 화면에서 직접 플레이 (둘 다 가능한 게임도 있음)
//  - color: 아이콘 바탕색, img: img/games/ 안의 그림 파일 (없으면 이름 첫 글자로 표시)
//  - tieIsNoWin: 모두 같은 점수(무승부)는 1등으로 치지 않음, ranked:false 면 순위·전적 집계에서 뺌
// 각 게임 모듈은 { id, name, minPlayers, maxPlayers, settingsFields,
//   initData(players, settings), computeTotals(session), renderPlay(root, session, ctx) } 를 제공합니다.
export const GAME_META = [
  { id: 'skullking', name: '스컬킹', modes: ['record'], color: '#3b3f4a', load: () => import('./skullking.js?v=202611121017') },
  { id: 'rummikub', name: '루미큐브', modes: ['record'], color: '#b8452f', load: () => import('./rummikub.js?v=202611121017') },
  { id: 'yacht', name: '요트다이스', modes: ['record', 'play'], color: '#2f6f9f', load: () => import('./yacht.js?v=202611121017') },
  { id: 'sparrow', name: '참새작', modes: ['record'], color: '#3d7a4a', load: () => import('./sparrow.js?v=202611121017') },
  { id: 'celestia', name: '셀레스티아', modes: ['record'], color: '#4a78b5', load: () => import('./celestia.js?v=202611121017') },
  { id: 'davinci', name: '다빈치 코드', modes: ['record'], color: '#2b2b2b', load: () => import('./davinci.js?v=202611121017') },
  { id: 'clue', name: '클루', modes: ['record'], color: '#7a4b8c', load: () => import('./clue.js?v=202611121017') },
  { id: 'chess', name: '체스', modes: ['play'], color: '#6b4f2a', tieIsNoWin: true, load: () => import('./chess.js?v=202611121017') },
  { id: 'chessquiz', name: '체스 퀴즈', modes: ['play'], color: '#8a6d3b', load: () => import('./chessquiz.js?v=202611121017') },
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

// 아이콘: 그림이 있으면 그림, 없으면 게임 색 바탕에 이름 첫 글자
export function gameIcon(g, cls = '') {
  if (!g) return '';
  const inner = g.img ? `<img src="img/games/${g.img}" alt="">` : `<b>${g.name[0]}</b>`;
  return `<span class="gmark ${cls}" style="--gc:${g.color || '#555'}" aria-hidden="true">${inner}</span>`;
}
