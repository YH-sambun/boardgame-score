// 텍사스 홀덤 — 각자 2장 + 바닥 공용 5장, 7장 중 가장 좋은 5장으로 겨룸
//  진행: 2장 받고 베팅(프리플랍) → 바닥 3장(플랍) 베팅 → 1장(턴) 베팅 → 1장(리버) 베팅 → 결과
//  블라인드 대신 모두 같은 기본 판돈(앤티)을 냄. 백스트레이트(A-2-3-4-5)는 가장 낮은 스트레이트

import { makePokerGame, pokerDeck, pokerKey, pokerCardHtml, evalPoker, resolveByValue } from './poker-core.js?v=202611121529';

export default makePokerGame({
  id: 'holdem',
  name: '텍사스 홀덤',
  maxPlayers: 8,
  holeCount: 2,
  boardCount: 5,
  deck: pokerDeck, key: pokerKey, cardHtml: pokerCardHtml,
  resolve: (hands, board) => resolveByValue(hands, (cs) => evalPoker([...cs, ...board])),
  describe: (cs, board) => evalPoker([...cs, ...board]).name,
  steps: [{ deal: [false, false] }, { bet: true }, { board: 3 }, { bet: true }, { board: 1 }, { bet: true }, { board: 1 }, { bet: true }],
  stageNames: ['프리플랍', '플랍', '턴', '리버'],
  guide: {
    players: '1~8명 (혼자면 컴퓨터와)', time: '15~30분',
    intro: '내 카드 2장과 모두가 함께 쓰는 바닥 카드 5장으로 가장 좋은 5장을 만드는 포커예요. 돈 대신 칩으로만 해요.',
    rules: [
      '판마다 모두 기본 판돈(앤티)을 내고 2장씩 받아요(나만 봄). 블라인드 대신 모두 같은 판돈을 내는 방식이에요.',
      '프리플랍 베팅 → 바닥에 3장(플랍) → 베팅 → 1장(턴) → 베팅 → 1장(리버) → 마지막 베팅 순서예요.',
      '베팅: 다이·체크·콜·삥·따당·하프·올인. 한 바퀴에 올리기는 4번까지예요.',
      '한 판에 낼 수 있는 칩은 살아 있는 사람 중 가장 적게 가지고 시작한 사람의 칩까지예요(사이드 팟 없음).',
      '남은 사람끼리 내 2장 + 바닥 5장 중 가장 좋은 5장을 비교해요. 같으면 판돈을 나눠요.',
    ],
    scoring: [
      '로열 스트레이트 플러시 > 스트레이트 플러시 > 포카드 > 풀하우스 > 플러시 > 스트레이트 > 트리플 > 투페어 > 원페어 > 탑',
      '스트레이트 중 10-J-Q-K-A(마운틴)가 가장 높고 A-2-3-4-5(백스트레이트)가 가장 낮아요.',
      '같은 족보끼리는 높은 숫자, 그다음 남은 카드(키커) 순서로 비교해요.',
    ],
    tips: [
      '같은 숫자 두 장(포켓 페어)이나 A·K 같은 높은 카드는 프리플랍에서 강한 출발이에요.',
      '바닥 카드는 모두의 것이에요. 바닥에 페어가 깔리면 상대도 그 페어를 가진 셈이에요.',
      '컴퓨터는 아직 안 나온 카드를 수백 번 채워 보고 이길 확률을 어림해요.',
    ],
  },
});
