// 인디언 포커 — 1~10 카드 두 벌(20장). 한 장씩 받아 이마에 붙이듯, 남의 카드는 보이고 내 카드만 안 보임
//  한 번 베팅한 뒤 숫자가 가장 큰 사람이 판돈을 가져감. 10을 들고 다이하면 기본 판돈 ×5 벌칙(판돈에 들어감)

import { makePokerGame } from './poker-core.js?v=202611180618';

const deck = () => Array.from({ length: 10 }, (_, k) => k + 1).flatMap((n) => [{ n, c: 0 }, { n, c: 1 }]);
const key = (x) => `${x.n}-${x.c}`;
const cardHtml = (x) => `<span class="pk-card ind ${x.c ? 'red' : ''}"><b>${x.n}</b></span>`;

const resolve = (hands) => {
  const top = Math.max(...hands.map((h) => h.cards[0].n));
  return { winners: hands.filter((h) => h.cards[0].n === top).map((h) => h.i), names: Object.fromEntries(hands.map((h) => [h.i, String(h.cards[0].n)])) };
};

export default makePokerGame({
  id: 'indianpoker',
  name: '인디언 포커',
  maxPlayers: 6,
  holeCount: 1,
  indian: true,
  deck, key, cardHtml, resolve,
  foldPenalty: (cards, ante) => (cards[0]?.n === 10 ? ante * 5 : 0),
  steps: [{ deal: [false] }, { bet: true }],
  stageNames: ['베팅'],
  guide: {
    players: '1~6명 (혼자면 컴퓨터와)', time: '10분',
    intro: '카드를 이마에 붙여서, 남의 숫자는 보이는데 내 숫자만 모르는 심리 게임이에요. 돈 대신 칩으로만 하고, 끝났을 때 남은 칩이 점수가 돼요.',
    rules: [
      '1~10 카드 두 벌(20장)을 써요. 판마다 기본 판돈을 내고 한 장씩 받아요.',
      '내 카드는 뒷면으로, 다른 사람 카드는 앞면으로 보여요. 남의 숫자와 베팅을 보고 내 숫자를 짐작해요.',
      '한 번 베팅해요: 다이·체크·콜·삥·따당·하프·올인. 남은 사람 중 숫자가 가장 큰 사람이 판돈을 가져가요(같으면 나눔).',
      '10을 들고 다이하면 벌칙으로 기본 판돈의 5배를 판돈에 내야 해요. 판이 끝나면 내 카드도 보여 줘요.',
      '여럿이 한 기기로 할 땐 차례마다 \'카드 보기\'를 누르면 그 사람 카드만 가려지고 남의 카드가 보여요.',
    ],
    scoring: [
      '숫자가 큰 사람이 이겨요: 10 > 9 > … > 1.',
      '한 판에 낼 수 있는 칩은 살아 있는 사람 중 가장 적게 가지고 시작한 사람의 칩까지예요.',
      '끝났을 때 남은 칩이 점수예요.',
    ],
    tips: [
      '상대 카드가 1~3이면 내가 이길 가능성이 높아요. 상대가 9·10이면 일찍 다이하는 게 좋아요(단, 내가 10일 수도 있어요).',
      '이미 보이는 카드는 덱에서 빠져 있어요. 10이 두 장 다 보이면 내 카드는 10이 아니에요.',
      '컴퓨터는 보이는 카드로 자기 카드를 어림해 베팅하고, 어려움은 가끔 허세를 부려요.',
    ],
  },
});
