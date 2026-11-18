// 섯다 (두 장 섯다) — 화투 20장(1~10월 두 장씩)으로 두 장의 족보를 겨룸
//  광: 1·3·8월, 열끗: 4·7·9월 (특수 족보 판정용)
//  순서: 38광땡 > 18광땡 > 13광땡 > 장땡(10땡) > 9땡 … 1땡 > 알리(1·2) > 독사(1·4) > 구삥(1·9) > 장삥(1·10) > 장사(4·10) > 세륙(4·6) > 갑오(9끗) > 8끗 … 1끗 > 망통(0끗)
//  특수: 암행어사(4·7 열끗) — 13·18광땡을 잡음, 아니면 1끗
//        땡잡이(3광·7열끗) — 1~9땡을 잡음(장땡·광땡 제외), 아니면 망통
//        구사(4·9) — 가장 높은 상대가 알리 이하면 재경기, 아니면 3끗
//        멍텅구리 구사(4·9 둘 다 열끗) — 가장 높은 상대가 장땡 이하면 재경기, 아니면 3끗
//  진행: 한 장씩 받고 베팅 → 한 장 더 받고 베팅 → 결과 (재경기면 판돈은 다음 판으로)

import { makePokerGame } from './poker-core.js?v=202611180618';

const GWANG = [1, 3, 8];
const YEOL = [4, 7, 9];
const deck = () => Array.from({ length: 10 }, (_, k) => k + 1).flatMap((m) => [
  { m, k: GWANG.includes(m) ? 'g' : YEOL.includes(m) ? 'y' : 'a' },
  { m, k: m === 8 ? 'y' : 'b' }, // 8월은 광과 열끗(기러기)
]);
const key = (c) => `${c.m}${c.k}`;
const TAG = { g: '<i class="g">광</i>', y: '<i>열</i>', a: '<i>&nbsp;</i>', b: '<i>&nbsp;</i>' };
const cardHtml = (c) => `<span class="pk-card hw"><b>${c.m}</b>${TAG[c.k]}</span>`;

const PAIR = { '1-2': ['알리', 700], '1-4': ['독사', 690], '1-9': ['구삥', 680], '1-10': ['장삥', 670], '4-10': ['장사', 660], '4-6': ['세륙', 650] };

export function seotdaValue([a, b]) {
  const [x, y] = a.m <= b.m ? [a, b] : [b, a];
  const g = x.k === 'g' && y.k === 'g';
  const yy = x.k === 'y' && y.k === 'y';
  if (g && x.m === 3 && y.m === 8) return { v: 1000, name: '38광땡' };
  if (g && x.m === 1 && y.m === 8) return { v: 920, name: '18광땡' };
  if (g && x.m === 1 && y.m === 3) return { v: 910, name: '13광땡' };
  if (x.m === y.m) return { v: 800 + x.m, name: x.m === 10 ? '장땡' : `${x.m}땡` };
  const pk = `${x.m}-${y.m}`;
  if (pk === '4-7' && yy) return { v: 601, name: '암행어사', sp: 'amh' };
  if (pk === '3-7' && x.k === 'g' && y.k === 'y') return { v: 600, name: '땡잡이', sp: 'ddj' };
  if (pk === '4-9') return { v: 603, name: yy ? '멍텅구리 구사' : '구사', sp: yy ? 'mg' : 'gs' };
  if (PAIR[pk]) return { v: PAIR[pk][1], name: PAIR[pk][0] };
  const k = (x.m + y.m) % 10;
  return { v: 600 + k, name: k === 9 ? '갑오' : k === 0 ? '망통' : `${k}끗` };
}

export function resolve(hands) {
  const vals = hands.map((h) => ({ i: h.i, ...seotdaValue(h.cards) }));
  const names = Object.fromEntries(vals.map((x) => [x.i, x.name]));
  for (const x of vals) {
    if (x.sp !== 'mg' && x.sp !== 'gs') continue;
    const best = Math.max(...vals.filter((o) => o !== x).map((o) => o.v));
    if (x.sp === 'mg' && best <= 810) return { redeal: true, redealWhy: '멍텅구리 구사로 재경기', winners: [], names };
    if (x.sp === 'gs' && best <= 700) return { redeal: true, redealWhy: '구사로 재경기', winners: [], names };
  }
  const top = Math.max(...vals.map((x) => x.v));
  const catcher = (sp) => vals.filter((x) => x.sp === sp).map((x) => x.i);
  if ((top === 910 || top === 920) && catcher('amh').length) return { winners: catcher('amh'), names };
  if (top > 800 && top < 810 && catcher('ddj').length) return { winners: catcher('ddj'), names };
  return { winners: vals.filter((x) => x.v === top).map((x) => x.i), names };
}

export default makePokerGame({
  id: 'seotda',
  name: '섯다',
  maxPlayers: 6,
  holeCount: 2,
  deck, key, cardHtml, resolve,
  describe: (cs) => (cs.length >= 2 ? seotdaValue(cs).name : ''),
  steps: [{ deal: [false] }, { bet: true }, { deal: [false] }, { bet: true }],
  stageNames: ['첫 장', '두 장'],
  guide: {
    players: '1~6명 (혼자면 컴퓨터와)', time: '10~20분',
    intro: '화투 20장으로 두 장의 족보를 겨루는 게임이에요. 돈 대신 칩으로만 하고, 끝났을 때 남은 칩이 점수가 돼요.',
    rules: [
      '판마다 모두 기본 판돈을 내고, 한 장씩 받아 베팅한 뒤 한 장을 더 받아 한 번 더 베팅해요.',
      '베팅: 다이(포기), 체크(그냥 넘김), 콜(앞 사람만큼 맞춤), 삥(기본 판돈만큼 처음 걸기), 따당(앞 베팅의 두 배), 하프(판돈의 절반만큼 더), 올인.',
      '한 판에 낼 수 있는 칩은 살아 있는 사람 중 가장 적게 가지고 시작한 사람의 칩까지예요. 그래서 따로 판(사이드 팟)이 생기지 않아요.',
      '마지막까지 남은 사람끼리 패를 펴서 족보가 높은 사람이 판돈을 가져가요. 모두 다이하면 남은 한 사람이 가져가요.',
      '정한 판 수를 다 하거나 한 명만 칩이 남으면 끝나요. 혼자 고르면 컴퓨터(1~4명)와, 여럿이면 한 기기를 돌려 가며 차례마다 \'카드 보기\'를 눌러요.',
    ],
    scoring: [
      '광땡: 38광땡 > 18광땡 > 13광땡 (광은 1·3·8월)',
      '땡: 장땡(10·10) > 9땡 > … > 1땡',
      '알리(1·2) > 독사(1·4) > 구삥(1·9) > 장삥(1·10) > 장사(4·10) > 세륙(4·6)',
      '끗: 두 장 합의 끝자리. 갑오(9끗) > 8끗 > … > 1끗 > 망통(0끗)',
      '암행어사(4·7 열끗): 13·18광땡을 잡아요. 그 밖에는 1끗.',
      '땡잡이(3광·7열끗): 1~9땡을 잡아요(장땡·광땡은 못 잡음). 그 밖에는 망통.',
      '구사(4·9): 가장 높은 상대가 알리 이하면 재경기. 멍텅구리 구사(4·9 모두 열끗)는 장땡 이하면 재경기. 재경기 판돈은 다음 판으로 넘어가요.',
      '같은 족보면 판돈을 나눠 가져요. 특수 족보의 세부 규칙은 지역마다 달라서, 이 앱은 위 규칙을 써요.',
    ],
    tips: [
      '첫 장이 10이나 광(1·3·8)이면 좋은 출발이에요. 끗이 낮게 나오면 일찍 다이해 칩을 아끼세요.',
      '컴퓨터는 아직 모르는 카드를 수백 번 무작위로 채워 보고 이길 확률을 어림해요. 어려움은 더 정확하고 가끔 허세도 부려요.',
      '판돈이 클수록 콜에 필요한 승률은 낮아져요. 콜할 칩 ÷ (판돈 + 콜할 칩)보다 이길 확률이 높으면 따라가 볼 만해요.',
    ],
  },
});
