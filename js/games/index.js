// 게임 등록부. 새 보드게임을 추가하려면 js/games/<id>.js 를 만들고 여기에 등록하세요.
// 각 게임 모듈은 { id, name, emoji, minPlayers, maxPlayers, settingsFields,
//   initData(players, settings), computeTotals(session), renderPlay(root, session, ctx) } 를 제공합니다.
import skullking from './skullking.js?v=202611120723';

export const GAMES = [skullking];
export const getGame = (id) => GAMES.find((g) => g.id === id);
