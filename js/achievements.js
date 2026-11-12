// 업적: 완료된 게임 기록으로 자동 계산 (따로 저장하지 않음)
//  각 업적의 test(entries) 는 그 사람의 참가 기록(오래된 순)을 받아, 달성한 시각(ms) 또는 null 을 돌려줌
//  entry = { s: 세션, i: 그 사람 자리, rank, n: 인원, win, draw, t: 끝난 시각 }
import { rankedSessions, seats } from './stats.js?v=202611121222';

const sum = (xs) => xs.reduce((a, b) => a + (b || 0), 0);
const wins = (es) => es.filter((e) => e.win && e.n >= 2);
// 조건을 만족한 n번째 기록의 시각
const nth = (es, n, pred = () => true) => { let c = 0; for (const e of es) { c += pred(e) ? 1 : 0; if (c >= n) return e.t; } return null; };
// 누적 카운트가 n 을 넘는 시각 (한 게임에서 여러 번 셀 수 있을 때)
const reach = (es, n, count) => { let c = 0; for (const e of es) { c += count(e); if (c >= n) return e.t; } return null; };
const of = (gid) => (es) => es.filter((e) => e.s.gameId === gid);

export const ACHIEVEMENTS = [
  // 공통
  { id: 'first-win', mark: '첫', name: '첫 승리', desc: '처음으로 1등 하기', test: (es) => nth(wins(es), 1) },
  { id: 'streak3', mark: '3', name: '3연승', desc: '참가한 게임에서 세 번 연속 1등', test: (es) => { let c = 0; for (const e of es.filter((x) => x.n >= 2)) { c = e.win ? c + 1 : 0; if (c >= 3) return e.t; } return null; } },
  { id: 'games10', mark: '10', name: '단골', desc: '게임 10판 참가', test: (es) => nth(es, 10) },
  { id: 'games50', mark: '50', name: '터줏대감', desc: '게임 50판 참가', test: (es) => nth(es, 50) },
  { id: 'variety5', mark: '5', name: '팔방미인', desc: '서로 다른 게임 5가지 해 보기', test: (es) => { const seen = new Set(); for (const e of es) { seen.add(e.s.gameId); if (seen.size >= 5) return e.t; } return null; } },
  { id: 'wins10', mark: '승', name: '승부사', desc: '1등 10번', test: (es) => nth(wins(es), 10) },
  // 스컬킹
  { id: 'sk-zero5', game: 'skullking', mark: '0', name: '빈손의 달인', desc: '0 예측 성공 누적 5번', test: (es) => reach(of('skullking')(es), 5, (e) => (e.s.data.rounds || []).filter((r) => r.bids?.[e.i] === 0 && r.wins?.[e.i] === 0).length) },
  { id: 'sk-perfect', game: 'skullking', mark: '완', name: '완벽한 항해', desc: '한 게임의 모든 라운드 예측 성공', test: (es) => nth(of('skullking')(es), 1, (e) => { const rs = (e.s.data.rounds || []).filter((r) => r.wins?.[e.i] != null); return rs.length >= 3 && rs.every((r) => r.bids[e.i] === r.wins[e.i]); }) },
  // 루미큐브
  { id: 'rk-big', game: 'rummikub', mark: '50', name: '싹쓸이', desc: '한 판에 50점 이상 따내며 승리', test: (es) => nth(of('rummikub')(es), 1, (e) => (e.s.data.rounds || []).some((r) => r.winner === e.i && sum((r.left || []).filter((_, j) => j !== e.i)) - (r.left?.[e.i] || 0) * ((r.left || []).length - 1) >= 50)) },
  // 요트다이스
  { id: 'yc-yacht', game: 'yacht', mark: '요', name: '요트!', desc: '요트 칸 50점 기록', test: (es) => nth(of('yacht')(es), 1, (e) => e.s.data.scores?.yacht?.[e.i] === 50) },
  { id: 'yc-bonus', game: 'yacht', mark: '+', name: '보너스 수집가', desc: '상단 보너스(63점) 달성', test: (es) => nth(of('yacht')(es), 1, (e) => sum(['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'].map((k) => e.s.data.scores?.[k]?.[e.i])) >= 63) },
  { id: 'yc-250', game: 'yacht', mark: '250', name: '250점 클럽', desc: '요트다이스 총점 250점 이상', test: (es) => nth(of('yacht')(es), 1, (e) => e.s.totals[e.i] >= 250) },
  // 참새작
  { id: 'sp-yakuman', game: 'sparrow', mark: '역', name: '역만', desc: '역만으로 화료', test: (es) => nth(of('sparrow')(es), 1, (e) => (e.s.data.hands || []).some((h) => h.result === 'win' && h.winner === e.i && h.yakuman)) },
  // 셀레스티아
  { id: 'ce-big', game: 'celestia', mark: '보', name: '보물 사냥꾼', desc: '한 항해에서 15점 이상 획득', test: (es) => nth(of('celestia')(es), 1, (e) => (e.s.data.voyages || []).some((v) => (v.gains?.[e.i] || 0) >= 15)) },
  { id: 'ce-last', game: 'celestia', mark: '끝', name: '끝까지 간 사람', desc: '한 항해에서 혼자 끝까지 남아 점수 획득', test: (es) => nth(of('celestia')(es), 1, (e) => (e.s.data.voyages || []).some((v) => v.last === e.i && (v.gains?.[e.i] || 0) > 0)) },
  // 다빈치 코드
  { id: 'dv-triple', game: 'davinci', mark: '3', name: '해독가', desc: '한 게임에서 세 판 연속 마지막까지 생존', test: (es) => nth(of('davinci')(es), 1, (e) => { let c = 0; for (const r of e.s.data.rounds || []) { c = r.winner === e.i ? c + 1 : 0; if (c >= 3) return true; } return false; }) },
  { id: 'dv-guess', game: 'davinci', mark: '!', name: '연속 적중', desc: '한 차례에 연속 3번 맞히기 (판 기록에서 체크)', test: (es) => nth(of('davinci')(es), 1, (e) => (e.s.data.rounds || []).some((r) => r.streak3?.includes(e.i))) },
  // 체스
  { id: 'ch-cpu', game: 'chess', mark: '기', name: '기계를 넘어', desc: '컴퓨터 "어려움" 이상을 이기기', test: (es) => nth(of('chess')(es), 1, (e) => e.s.data.mode === 'ai' && e.s.data.level >= 3 && e.s.data.result?.winner === e.i) },
  { id: 'ch-win10', game: 'chess', mark: '10', name: '체스 10승', desc: '체스 10번 이기기', test: (es) => nth(of('chess')(es), 10, (e) => e.s.data.result?.winner === e.i) },
  // 오목
  { id: 'om-fast', game: 'omok', mark: '속', name: '속공', desc: '15수 안에 오목 완성', test: (es) => nth(of('omok')(es), 1, (e) => e.s.data.winner === e.i && Math.ceil((e.s.data.moves || []).length / 2) <= 15) },
  // 윷놀이
  { id: 'yt-clean', game: 'yut', mark: '무', name: '무사귀환', desc: '한 번도 안 잡히고 승리', test: (es) => nth(of('yut')(es), 1, (e) => e.win && !(e.s.data.caught?.[e.i])) },
  { id: 'yt-hunter', game: 'yut', mark: '잡', name: '사냥꾼', desc: '한 게임에서 상대 말 3번 잡기', test: (es) => nth(of('yut')(es), 1, (e) => (e.s.data.catches?.[e.i] || 0) >= 3) },
];

// 사람별 달성 업적: Map(personKey → { name, earned: Map(업적 id → 시각) })
export function computeAchievements(sessions, { activeIds = null } = {}) {
  const per = new Map();
  for (const s of rankedSessions(sessions)) {
    const n = s.players.length;
    for (const x of seats(s, activeIds)) {
      const p = per.get(x.key) || { key: x.key, name: x.name, entries: [] };
      p.name = x.name;
      p.entries.push({ s, i: x.i, rank: x.rank, n, win: x.win, draw: x.draw, t: s.finishedAt || s.createdAt });
      per.set(x.key, p);
    }
  }
  for (const p of per.values()) {
    p.earned = new Map();
    for (const a of ACHIEVEMENTS) {
      let t = null;
      try { t = a.test(p.entries); } catch (e) { console.error(a.id, e); }
      if (t != null) p.earned.set(a.id, t);
    }
  }
  return per;
}

// 방금 끝난 게임 s 로 새로 얻은 업적 [{ name, a }]
export function newlyEarned(othersBefore, s) {
  const before = computeAchievements(othersBefore);
  const after = computeAchievements([...othersBefore, s]);
  const out = [];
  for (const [key, p] of after) {
    if (!p.entries.some((e) => e.s === s)) continue;
    for (const a of ACHIEVEMENTS) if (p.earned.has(a.id) && !before.get(key)?.earned.has(a.id)) out.push({ name: p.name, a });
  }
  return out;
}
