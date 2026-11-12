// 컴퓨터 상대 공통 (오목·윷놀이·요트다이스). 체스는 chess.js 에 따로 있음.
//  참가자를 1명만 고르면 컴퓨터가 상대로 들어가고, 실력은 새 게임 화면의 '컴퓨터 실력'으로 정함 (settings.cpuLevel 0~2)
//  컴퓨터 자리의 id 는 'cpu' 라 전적·레이팅·업적 집계에서 빠짐 (stats.js 의 CPU_ID 와 같은 값)
export const CPU_ID = 'cpu';
export const isCpu = (p) => p?.id === CPU_ID;
export const LEVEL_NAMES = ['쉬움', '보통', '어려움'];

// 새 게임 화면 설정 칸: 혼자 고를 때만 보임
export const levelField = (show = ({ count }) => count === 1) => ({
  key: 'cpuLevel', label: '컴퓨터 실력', default: 1, show,
  options: LEVEL_NAMES.map((label, value) => ({ value, label })),
});

export function cpuPlayers(n) {
  return Array.from({ length: n }, (_, k) => ({ id: CPU_ID, name: n > 1 ? `컴퓨터 ${k + 1}` : '컴퓨터', email: null }));
}

export const levelOf = (session) => Math.max(0, Math.min(2, Number(session.settings?.cpuLevel ?? 1)));
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
