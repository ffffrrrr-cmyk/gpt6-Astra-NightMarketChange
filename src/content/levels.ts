import type { Cash, Guest, Level } from '../core/types.ts';

const payments: Record<string, Cash> = {
  A: { ones: 5, fives: 1, tens: 0 },
  B: { ones: 10, fives: 0, tens: 0 },
  C: { ones: 0, fives: 2, tens: 0 },
  D: { ones: 0, fives: 0, tens: 1 },
};
const names = ['阿禾', '林叔', '小满', '陈姨', '阿岚', '周伯', '小陶', '许姐'];
const items = ['糖炒栗子', '桂花米糕', '烤年糕', '热豆花', '芝麻汤圆', '烤红薯', '酒酿圆子', '葱油饼'];
type Brief = Omit<Level, 'id' | 'number' | 'guests'> & { payments: string; relations?: number[][]; windows?: Record<number, [number, number]> };
const briefs: Brief[] = [
  { name: '第一盏灯', district: '巷口 · 初入夜市', description: '一盘前客留下的零钱，接住今晚的第一笔生意。', lesson: '先给出7元，再收下客人的10元。', difference: '付款来源与收付时序，开放队列教学；容量11为可解的最小值。', initial: { ones: 2, fives: 1, tens: 0 }, capacity: 11, payments: 'ABACADBD' },
  { name: '整钱也会难倒人', district: '巷口 · 认清钱盘', description: '手里有钱，不一定找得开。把整钞客留到合适的时候。', lesson: '10元纸币不能拿来找7元；注意1元余量。', difference: '增加整钞顾客比例，需先积累小面额缓冲。', initial: { ones: 4, fives: 2, tens: 0 }, capacity: 24, payments: 'DABCDABD' },
  { name: '两种找法', district: '巷口 · 留一手零钱', description: '给出七枚硬币，还是留下一张五元？', lesson: '可以用5+1+1，也可以用七枚1元。', difference: '可同时使用两种找法，零钱盘容量促使使用七枚硬币。', initial: { ones: 7, fives: 1, tens: 0 }, capacity: 16, payments: 'BABACDAD' },
  { name: '熟客相约', district: '灯街 · 安排顺序', description: '有些人等朋友先买完。把找零与先后约定一起安排。', lesson: '订单上的“之后”是公开的先后约定。', difference: '两条独立前置链，可交错服务，存在不同顺序解。', initial: { ones: 5, fives: 2, tens: 0 }, capacity: 20, payments: 'ABCDABAD', relations: [[1, 3], [3, 6], [2, 4], [4, 8]] },
  { name: '顺手的人情', district: '灯街 · 分岔与汇合', description: '两组客人买齐了，最后的熟客才来结账。', lesson: '先看汇合点，别只看眼前哪位方便。', difference: '双分岔汇合依赖结构，末位需要两条链同时完成。', initial: { ones: 4, fives: 2, tens: 0 }, capacity: 20, payments: 'ABACADBD', relations: [[1, 3], [1, 4], [2, 5], [3, 6], [4, 7], [6, 8], [7, 8]] },
  { name: '两边都要顾', district: '灯街 · 交错服务', description: '左右两列各有先后。整钞与零钱，得交替进盘。', lesson: '拖动候客卡安排次序，约定本身不会改变。', difference: '两条四人链交错，不能一口气做完某一列。', initial: { ones: 6, fives: 2, tens: 0 }, capacity: 20, payments: 'ACBDABAD', relations: [[1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8]] },
  { name: '末班车之前', district: '桥头 · 公开约定', description: '有两位客人赶着回家。承诺写在卡上，别错过。', lesson: '“第N客前”是硬约定，回合只在结账时推进。', difference: '加入早期截止窗口，与整钞缓冲共同约束。', initial: { ones: 6, fives: 2, tens: 0 }, capacity: 20, payments: 'DABACABD', windows: { 1: [1, 3], 4: [1, 5] } },
  { name: '小小的钱盘', district: '桥头 · 装得下的生意', description: '钱盘不大，收一把硬币前，先给它们腾个位置。', lesson: '容量只数1元与5元的张枚；10元放入收入格。', difference: '紧容量形成“腾位—入账”次序限制，两种找法权衡。', initial: { ones: 7, fives: 2, tens: 0 }, capacity: 13, payments: 'BACDABAD', relations: [[2, 5]] },
  { name: '约好的时辰', district: '桥头 · 不可逆的选择', description: '有人晚些才来，有人要准时走。每次结账都把夜晚往前推一步。', lesson: '服务窗口内再接单；已完成的订单不能撤回。', difference: '开始与结束窗口共同作用，需预留中段付款来源。', initial: { ones: 6, fives: 2, tens: 0 }, capacity: 20, payments: 'ABDACABD', windows: { 3: [3, 5], 5: [4, 7], 8: [6, 8] }, relations: [[2, 4], [4, 7]] },
  { name: '从容与利落', district: '深巷 · 收摊前的功夫', description: '从容地留足零钱，也可以利落地少递几张。选自己的节奏。', lesson: '通关后比较递出的总张枚数；少递不是唯一正确答案。', difference: '充足初始缓冲与分支链，安全路径和最少张枚路径代价不同。', initial: { ones: 10, fives: 3, tens: 0 }, capacity: 26, payments: 'ABACABCD', relations: [[1, 5], [2, 6], [3, 7], [5, 8]] },
  { name: '灯火渐阑珊', district: '深巷 · 稳中求快', description: '赶路的客人、有限的钱盘，还有最后几张五元。', lesson: '同时考虑约定、容量和找零的余地。', difference: '窗口与容量叠加双链，保守余量和效率解比较。', initial: { ones: 9, fives: 3, tens: 0 }, capacity: 22, payments: 'BAACABDD', relations: [[1, 3], [3, 6], [2, 4], [4, 7]], windows: { 5: [2, 5], 8: [6, 8] } },
  { name: '这一夜，刚刚好', district: '收官 · 八位客人', description: '从第一盏灯到最后一位客人，把整晚学会的手艺用一遍。', lesson: '全部规则都已学过。先看清，再接单。', difference: '分岔汇合、窗口、容量与两种找法的最终综合。', initial: { ones: 7, fives: 2, tens: 0 }, capacity: 18, payments: 'ABACABDD', relations: [[1, 3], [2, 4], [3, 6], [4, 7], [6, 8], [7, 8]], windows: { 5: [2, 5], 8: [7, 8] } },
];

export const LEVELS: Level[] = briefs.map((brief, index) => {
  const levelId = `night-${String(index + 1).padStart(2, '0')}`;
  const guests: Guest[] = [...brief.payments].map((payment, guestIndex) => ({
    id: `${levelId}-guest-${guestIndex + 1}`,
    name: names[guestIndex],
    item: items[(guestIndex + index) % items.length],
    look: (guestIndex + index) % 8,
    payment: { ...payments[payment] },
    after: (brief.relations ?? []).filter(relation => relation[1] === guestIndex + 1).map(relation => `${levelId}-guest-${relation[0]}`),
    earliest: brief.windows?.[guestIndex + 1]?.[0] ?? 1,
    latest: brief.windows?.[guestIndex + 1]?.[1] ?? 8,
  }));
  return { id: levelId, number: index + 1, name: brief.name, district: brief.district, description: brief.description, lesson: brief.lesson, difference: brief.difference, initial: { ...brief.initial }, capacity: brief.capacity, guests };
});

export function getLevel(id: string): Level {
  const level = LEVELS.find(item => item.id === id);
  if (!level) throw new Error(`未知关卡：${id}`);
  return level;
}
