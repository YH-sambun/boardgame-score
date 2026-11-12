// 체스 엔진 계산을 화면과 따로 돌리는 웹 워커 (계산 중에도 화면이 멈추지 않게)
import * as E from './chess-engine.js?v=202611121216';

const fns = {
  search: ({ fen, opts }) => E.search(fen, opts),
  mateMoves: ({ fen, n }) => E.mateMoves(fen, n),
  isForcedMate: ({ fen, n }) => E.isForcedMate(fen, n),
  bestDefense: ({ fen, n }) => E.bestDefense(fen, n),
  mateLine: ({ fen, n }) => E.mateLine(fen, n),
};

self.onmessage = (e) => {
  const { id, type, args } = e.data;
  try { self.postMessage({ id, result: fns[type](args) }); } catch (err) { self.postMessage({ id, error: String(err?.message || err) }); }
};
