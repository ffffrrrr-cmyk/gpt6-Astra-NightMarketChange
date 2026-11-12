import { EMPTY_CASH, RULE_VERSION } from './types.ts';
import type { Cash, Change, Command, GameEvent, GameState, Guest, Level, Preview, Solution, Step, TurnSnapshot } from './types.ts';

export const cashValue = (cash: Cash): number => cash.ones + cash.fives * 5 + cash.tens * 10;
export const traySize = (cash: Cash): number => cash.ones + cash.fives;
export const changeValue = (change: Change): number => change.ones + change.fives * 5;
export const changeWays = (cash: Cash): Change[] => [
  ...(cash.ones >= 2 && cash.fives >= 1 ? [{ ones: 2, fives: 1 }] : []),
  ...(cash.ones >= 7 ? [{ ones: 7, fives: 0 }] : []),
];
export const cashText = (cash: Cash): string => [
  cash.ones ? `1元×${cash.ones}` : '',
  cash.fives ? `5元×${cash.fives}` : '',
  cash.tens ? `10元×${cash.tens}` : '',
].filter(Boolean).join(' + ') || '空';
export const changeText = (change: Change): string => cashText({ ...change, tens: 0 });
export const validCash = (cash: Cash): boolean => [cash.ones, cash.fives, cash.tens].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 10000);

export function initialState(level: Level): GameState {
  return {
    ruleVersion: RULE_VERSION,
    levelId: level.id,
    initialSeed: `${level.id}:fixed:rmb-1`,
    cash: { ...level.initial },
    served: [],
    cycle: 0,
    piecesGiven: 0,
    status: 'playing',
    committedIds: [],
    events: [],
    pendingPayment: null,
    committedOrder: null,
    facility: 'open',
    failure: null,
    failureEventId: null,
  };
}

export function guestBlock(level: Level, served: string[], guest: Guest): string | null {
  if (served.includes(guest.id)) return '这位客人已经结账';
  const missing = guest.after.filter(id => !served.includes(id));
  if (missing.length) return `需先服务${missing.map(id => level.guests.find(item => item.id === id)?.name ?? id).join('、')}`;
  const turn = served.length + 1;
  if (turn < guest.earliest) return `第${guest.earliest}客起可服务`;
  if (turn > guest.latest) return `已错过第${guest.latest}客前的约定`;
  return null;
}

export function transactCash(cash: Cash, incoming: Cash, change: Change): Cash {
  return { ones: cash.ones - change.ones + incoming.ones, fives: cash.fives - change.fives + incoming.fives, tens: cash.tens + incoming.tens };
}

export function preview(level: Level, state: GameState, guestId: string | null, change: Change): Preview {
  const result: Preview = { legal: false, risk: false, reason: '', available: { ...state.cash }, incoming: { ...EMPTY_CASH }, next: null, nextWays: 0, pieces: change.ones + change.fives };
  if (state.status !== 'playing') return { ...result, reason: '本次营业已结算' };
  const guest = level.guests.find(item => item.id === guestId);
  if (!guest) return { ...result, reason: '先从候客区选择一位客人' };
  if (!validCash(guest.payment) || cashValue(guest.payment) !== 10) return { ...result, reason: '顾客付款必须恰好10元，当前订单配置无效' };
  result.incoming = { ...guest.payment };
  const blocked = guestBlock(level, state.served, guest);
  if (blocked) return { ...result, reason: blocked };
  if (!changeWays(state.cash).length) return { ...result, risk: true, reason: '零钱不足；确认接单会导致本次营业失败' };
  if (![change.ones, change.fives].every(value => Number.isSafeInteger(value) && value >= 0)) return { ...result, reason: '找零数量必须是非负整数' };
  if (change.ones > state.cash.ones || change.fives > state.cash.fives) return { ...result, reason: '钱盘中没有这么多零钱' };
  if (changeValue(change) !== 7) return { ...result, reason: `应找7元，当前选了${changeValue(change)}元` };
  const next = transactCash(state.cash, guest.payment, change);
  if (traySize(next) > level.capacity) return { ...result, next, reason: `入账后零钱盘${traySize(next)}张/枚，超过容量${level.capacity}；调整找法或客人顺序` };
  return { ...result, legal: true, next, nextWays: changeWays(next).length, reason: '找零正确，确认后这位客人的付款才能进入钱盘' };
}

export function solve(level: Level, cash: Cash = level.initial, served: string[] = [], mode: 'first' | 'efficient' | 'safe' = 'first'): Solution | null {
  const memo = new Map<string, Solution | null>();
  let safetyFloor = 0;
  function visit(current: Cash, completed: string[]): Solution | null {
    if (current.ones < safetyFloor) return null;
    if (completed.length === 8) return { steps: [], pieces: 0, minimumOnes: current.ones };
    const mask = level.guests.reduce((value, guest, index) => value | (completed.includes(guest.id) ? 1 << index : 0), 0);
    const key = `${mask}:${current.ones}:${current.fives}`;
    if (memo.has(key)) return memo.get(key) ?? null;
    let best: Solution | null = null;
    for (const guest of level.guests) {
      if (guestBlock(level, completed, guest)) continue;
      for (const change of changeWays(current)) {
        const next = transactCash(current, guest.payment, change);
        if (traySize(next) > level.capacity) continue;
        const suffix = visit(next, [...completed, guest.id]);
        if (!suffix) continue;
        const candidate: Solution = { steps: [{ guestId: guest.id, change }, ...suffix.steps], pieces: change.ones + change.fives + suffix.pieces, minimumOnes: Math.min(current.ones, suffix.minimumOnes) };
        if (mode === 'first') { memo.set(key, candidate); return candidate; }
        if (!best || (mode === 'efficient' ? candidate.pieces < best.pieces || candidate.pieces === best.pieces && candidate.minimumOnes > best.minimumOnes : candidate.pieces > best.pieces)) best = candidate;
      }
    }
    memo.set(key, best);
    return best;
  }
  if (mode !== 'safe') return visit(cash, served);
  for (safetyFloor = cash.ones; safetyFloor >= 0; safetyFloor--) {
    memo.clear();
    const result = visit(cash, served);
    if (result) return result;
  }
  return null;
}

const snapshot = (state: GameState): TurnSnapshot => ({ cash: { ...state.cash }, served: [...state.served], cycle: state.cycle, piecesGiven: state.piecesGiven, status: state.status });

export function commit(level: Level, state: GameState, command: Command): { state: GameState; accepted: boolean; message: string } {
  if (!command.commandId || command.commandId.length > 120) return { state, accepted: false, message: '无效的指令编号' };
  if (state.committedIds.includes(command.commandId)) return { state, accepted: false, message: '这条指令已处理，未重复结算' };
  if (state.levelId !== level.id || state.ruleVersion !== RULE_VERSION) return { state, accepted: false, message: '规则或关卡版本不匹配' };
  const check = preview(level, state, command.guestId, command.change);
  if (!check.legal && !check.risk) return { state, accepted: false, message: check.reason };
  const guest = level.guests.find(item => item.id === command.guestId)!;
  const next: GameState = {
    ...state,
    cash: { ...(check.next ?? state.cash) },
    served: check.risk ? [...state.served] : [...state.served, guest.id],
    cycle: state.cycle + 1,
    piecesGiven: state.piecesGiven + (check.risk ? 0 : check.pieces),
    committedIds: [...state.committedIds, command.commandId],
    events: [...state.events],
    committedOrder: check.risk ? guest.id : null,
    pendingPayment: null,
  };
  if (check.risk) {
    next.status = 'lost';
    next.failure = '零钱不足却接单：现有零钱无法凑出7元，不能借用当前客人的付款。';
  } else if (next.served.length < 8 && (!level.guests.some(candidate => !guestBlock(level, next.served, candidate)) || changeWays(next.cash).length > 0 && !solve(level, next.cash, next.served))) {
    next.status = 'lost';
    next.failure = '目标不可达：余下客人的顺序、约定或零钱盘容量已无法同时满足。';
  } else if (next.served.length >= 8) {
    next.status = 'won';
  }
  if (next.status !== 'playing') next.facility = 'closed';
  const eventId = `${level.id}:event:${next.events.length + 1}`;
  if (next.status === 'lost') next.failureEventId = eventId;
  const event: GameEvent = {
    id: eventId,
    commandId: command.commandId,
    cycle: next.cycle,
    target: guest.id,
    kind: check.risk ? 'failure' : 'service',
    before: snapshot(state),
    after: snapshot(next),
    payment: check.risk ? { ...EMPTY_CASH } : { ...guest.payment },
    change: check.risk ? { ones: 0, fives: 0 } : { ...command.change },
    reason: next.failure ?? `${guest.name}已结账：收10元，找7元，净收入3元。`,
  };
  next.events.push(event);
  return { state: next, accepted: true, message: event.reason };
}

export function replay(level: Level, steps: Step[], prefix = 'replay'): GameState {
  return steps.reduce((state, step, index) => commit(level, state, { ...step, commandId: `${prefix}-${index + 1}` }).state, initialState(level));
}

export function validateState(level: Level, input: unknown): input is GameState {
  try {
    const state = input as GameState;
    if (!state || state.ruleVersion !== RULE_VERSION || state.levelId !== level.id || !Array.isArray(state.events) || state.events.length > 9 || !validCash(state.cash)) return false;
    let expected = initialState(level);
    for (const event of state.events) {
      if (!event || typeof event.commandId !== 'string' || !event.change) return false;
      const result = commit(level, expected, { commandId: event.commandId, guestId: event.target, change: event.change });
      if (!result.accepted) return false;
      expected = result.state;
    }
    return JSON.stringify(expected) === JSON.stringify(state);
  } catch { return false; }
}
