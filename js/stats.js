// 전적 계산 (완료된 게임 기록만으로 계산, 따로 저장하지 않음)
import { getGame } from './games/index.js?v=202611121212';

// 동점은 같은 등수 (1, 1, 3 ...)
export function ranks(totals) {
  return totals.map((t) => 1 + totals.filter((o) => o > t).length);
}

export const CPU_ID = 'cpu';

// 같은 사람 판별: 이메일이 연결된 참가자는 계정이 달라도 같은 사람
export function personKey(s, p) {
  return p.email ? 'e:' + p.email.toLowerCase() : (s.shared ? `x:${s.ownerUid}:${p.id || p.name}` : p.id || p.name);
}

const endTime = (s) => s.finishedAt || s.createdAt;

// 집계 대상 게임: 완료 + 순위가 있는 게임 + (게임별) 초기화 이후, 오래된 순
export function rankedSessions(sessions, { gameId = null, sinceMap = {} } = {}) {
  return sessions
    .filter((s) => s.status === 'finished' && (!gameId || s.gameId === gameId) && getGame(s.gameId)?.ranked !== false)
    .filter((s) => endTime(s) >= (sinceMap[s.gameId] || 0) && Array.isArray(s.totals))
    .sort((a, b) => endTime(a) - endTime(b));
}

// 한 게임의 참가자별 결과. 삭제한 참가자(내가 만든 게임 한정)와 컴퓨터는 뺌
export function seats(s, activeIds) {
  const rk = ranks(s.totals);
  const tie = getGame(s.gameId)?.tieIsNoWin && rk.every((r) => r === 1);
  return s.players.map((p, i) => ({ p, i, key: personKey(s, p), name: p.name, rank: rk[i], total: s.totals[i], win: !tie && rk[i] === 1, draw: tie }))
    .filter((x) => x.p.id !== CPU_ID && !(!s.shared && activeIds && x.p.id && !activeIds.has(x.p.id)));
}

// since: 이 시각 이후 게임만 집계(전적 초기화), activeIds: 현재 등록된 참가자만 표시(삭제한 참가자 제외)
export function computeStats(sessions, gameId, { since = 0, activeIds = null } = {}) {
  const map = new Map();
  for (const s of rankedSessions(sessions, { gameId, sinceMap: { [gameId]: since } })) {
    for (const x of seats(s, activeIds)) {
      const st = map.get(x.key) || { name: x.name, played: 0, wins: 0, draws: 0, sum: 0, best: -Infinity, rankSum: 0 };
      st.name = x.name; st.played++; st.sum += x.total; st.rankSum += x.rank;
      st.best = Math.max(st.best, x.total);
      if (x.draw) st.draws++; else if (x.win) st.wins++;
      map.set(x.key, st);
    }
  }
  return [...map.values()].map((st) => ({ ...st, winRate: st.wins / st.played, avg: st.sum / st.played, avgRank: st.rankSum / st.played }))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.avg - a.avg);
}

// 상대 전적: 같은 게임에 함께 참가한 두 사람의 등수 비교 (높은 등수 = 승, 같으면 무)
export function headToHead(sessions, { gameId = null, sinceMap = {}, activeIds = null } = {}) {
  const people = new Map();
  const pairs = new Map(); // "a|b" → { n, w, l, d, byGame }
  const bump = (a, b, gid, res) => {
    const k = a + '|' + b;
    const x = pairs.get(k) || { n: 0, w: 0, l: 0, d: 0, byGame: {} };
    const y = x.byGame[gid] || (x.byGame[gid] = { n: 0, w: 0, l: 0, d: 0 });
    x.n++; y.n++; x[res]++; y[res]++;
    pairs.set(k, x);
  };
  for (const s of rankedSessions(sessions, { gameId, sinceMap })) {
    const xs = seats(s, activeIds);
    for (const x of xs) {
      const pe = people.get(x.key) || { key: x.key, name: x.name, n: 0 };
      pe.name = x.name; pe.n++; people.set(x.key, pe);
    }
    for (const a of xs) for (const b of xs) {
      if (a.key === b.key) continue;
      bump(a.key, b.key, s.gameId, a.rank < b.rank ? 'w' : a.rank > b.rank ? 'l' : 'd');
    }
  }
  const list = [...people.values()].sort((a, b) => b.n - a.n);
  return { people: list, cell: (a, b) => pairs.get(a + '|' + b) || { n: 0, w: 0, l: 0, d: 0, byGame: {} } };
}

// 레이팅(Elo): 1000점 시작. 여럿이 한 게임은 모든 두 사람 쌍을 1:1 대결로 보고 K 를 (인원-1)로 나눔
export function eloRatings(sessions, gameId, { since = 0, activeIds = null, K = 32 } = {}) {
  const R = new Map();
  for (const s of rankedSessions(sessions, { gameId, sinceMap: { [gameId]: since } })) {
    const xs = seats(s, activeIds);
    if (xs.length < 2) continue;
    for (const x of xs) if (!R.has(x.key)) R.set(x.key, { key: x.key, name: x.name, rating: 1000, played: 0, last: 0, history: [1000] });
    const k = K / (xs.length - 1);
    const delta = xs.map((a) => xs.reduce((sum, b) => {
      if (a === b) return sum;
      const ra = R.get(a.key).rating; const rb = R.get(b.key).rating;
      const exp = 1 / (1 + 10 ** ((rb - ra) / 400));
      const score = a.rank < b.rank ? 1 : a.rank > b.rank ? 0 : 0.5;
      return sum + k * (score - exp);
    }, 0));
    xs.forEach((a, i) => {
      const r = R.get(a.key);
      r.name = a.name; r.rating += delta[i]; r.played++; r.last = delta[i]; r.history.push(r.rating);
    });
  }
  return [...R.values()].sort((a, b) => b.rating - a.rating);
}
