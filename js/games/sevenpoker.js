// 세븐 포커 (한국식) — 트럼프 52장, 7장 중 가장 좋은 5장으로 겨룸
//  진행: 4장(2장 숨김 + 2장 공개) 받고 베팅 → 5구(공개) 베팅 → 6구(공개) 베팅 → 히든(숨김) 베팅 → 결과
//  족보: 로열 스트레이트 플러시 > 스트레이트 플러시 > 포카드 > 풀하우스 > 플러시 > 마운틴 > 백스트레이트 > 스트레이트 > 트리플 > 투페어 > 원페어 > 탑

import { makePokerGame, pokerDeck, pokerKey, pokerCardHtml, evalPoker, resolveByValue } from './poker-core.js?v=202611180606';

const val = (cs) => evalPoker(cs, { backHigh: true });

export default makePokerGame({
  id: 'sevenpoker',
  name: '세븐 포커',
  maxPlayers: 7,
  holeCount: 7,
  deck: pokerDeck, key: pokerKey, cardHtml: pokerCardHtml,
  resolve: (hands) => resolveByValue(hands, val),
  describe: (cs) => (cs.length >= 2 ? val(cs).name : ''),
  steps: [{ deal: [false, false, true, true] }, { bet: true }, { deal: [true] }, { bet: true }, { deal: [true] }, { bet: true }, { deal: [false] }, { bet: true }],
  stageNames: ['4구', '5구', '6구', '히든'],
  guide: {
    players: '1~7명 (혼자면 컴퓨터와)', time: '15~30분',
    intro: '7장을 받아 그중 가장 좋은 5장으로 족보를 겨루는 한국식 포커예요. 공개된 카드로 상대 패를 읽는 재미가 있어요. 돈 대신 칩으로만 해요.',
    rules: [
      '판마다 기본 판돈을 내고 4장을 받아요(2장은 나만 보고, 2장은 모두에게 공개). 이어서 베팅해요.',
      '5구·6구는 공개 카드, 마지막 7구(히든)는 숨긴 카드로 받고, 받을 때마다 베팅해요.',
      '베팅: 다이·체크·콜·삥·따당·하프·올인. 한 바퀴에 올리기는 4번까지예요.',
      '한 판에 낼 수 있는 칩은 살아 있는 사람 중 가장 적게 가지고 시작한 사람의 칩까지예요(사이드 팟 없음).',
      '마지막까지 남은 사람끼리 가장 좋은 5장을 비교해 이긴 사람이 판돈을 가져가요. 같은 족보면 나눠요(무늬 순서는 따지지 않아요).',
    ],
    scoring: [
      '로열 스트레이트 플러시(같은 무늬 10-J-Q-K-A) > 스트레이트 플러시 > 포카드 > 풀하우스 > 플러시',
      '마운틴(10-J-Q-K-A) > 백스트레이트(A-2-3-4-5) > 스트레이트 (한국식으로 백스트레이트가 두 번째)',
      '트리플 > 투페어 > 원페어 > 탑(가장 높은 카드)',
      '같은 족보끼리는 높은 숫자, 그다음 남은 카드(키커) 순서로 비교해요.',
    ],
    tips: [
      '내 자리 아래에 지금 족보가 나와요. 공개 카드 4장으로 상대가 노릴 수 있는 족보를 함께 살펴보세요.',
      '4구에서 페어도 없고 같은 무늬·연속 숫자도 없으면 일찍 다이하는 게 칩을 아끼는 길이에요.',
      '컴퓨터는 보이는 카드만으로 남은 카드를 수백 번 채워 보고 이길 확률을 어림해요.',
    ],
  },
});
