import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/content/levels.ts';
import { cashValue, changeValue, changeWays, commit, initialState, preview, replay, solve, traySize, validateState } from '../src/core/rules.ts';

const first = LEVELS[0];
const goodChange = { ones: 2, fives: 1 };
const command = (guestId, change = goodChange, commandId = 'test-1') => ({ guestId, change, commandId });
function frozen(value) { Object.freeze(value); Object.values(value).forEach(item => { if (item && typeof item === 'object' && !Object.isFrozen(item)) frozen(item); }); return value; }

test('A01: 找零使用旧库存，成功后前客付款才可用且金额守恒', () => {
  const state = frozen(initialState(first));
  const result = commit(first, state, command(first.guests[1].id));
  assert.equal(result.accepted, true);
  assert.deepEqual(result.state.cash, { ones: 10, fives: 0, tens: 0 });
  assert.equal(cashValue(result.state.cash), cashValue(state.cash) + 3);
  assert.deepEqual(result.state.events[0].before.cash, first.initial);
  assert.equal(result.state.served.length, 1);
  assert.deepEqual(state, initialState(first));
  const borrowed = commit(first, state, command(first.guests[1].id, { ones: 7, fives: 0 }));
  assert.equal(borrowed.accepted, false);
  assert.strictEqual(borrowed.state, state);
});

test('A02: 6/7/8元边界、非法数量与UI预览一致', () => {
  const state = initialState(LEVELS[2]);
  for (const amount of [6, 7, 8]) {
    const change = { ones: amount, fives: 0 };
    const check = preview(LEVELS[2], state, LEVELS[2].guests[0].id, change);
    const result = commit(LEVELS[2], state, command(LEVELS[2].guests[0].id, change));
    assert.equal(check.legal, amount === 7);
    assert.equal(result.accepted, check.legal);
    if (result.accepted) assert.deepEqual(result.state.cash, check.next);
  }
  for (const change of [{ ones: -3, fives: 2 }, { ones: 1.5, fives: 1.1 }, { ones: NaN, fives: 1 }, { ones: Infinity, fives: 1 }]) {
    const result = commit(LEVELS[2], state, command(LEVELS[2].guests[0].id, change));
    assert.equal(result.accepted, false);
    assert.strictEqual(result.state, state);
  }
});

test('A02: 两种找法独立枚举验证且没有负库存', () => {
  for (let ones = 0; ones <= 12; ones++) for (let fives = 0; fives <= 4; fives++) {
    const expected = [];
    for (let useFives = 0; useFives <= fives; useFives++) for (let useOnes = 0; useOnes <= ones; useOnes++) {
      if (useOnes + useFives * 5 === 7) expected.push(JSON.stringify({ ones: useOnes, fives: useFives }));
    }
    assert.deepEqual(changeWays({ ones, fives, tens: 100 }).map(value => JSON.stringify(value)).sort(), expected.sort());
  }
});

test('A02: 顾客支付9/10/11元只有10元可被接收', () => {
  for (const amount of [9, 10, 11]) {
    const fixture = { ...first, capacity: 20, guests: first.guests.map((guest, index) => index === 0 ? { ...guest, payment: { ones: amount, fives: 0, tens: 0 } } : guest) };
    const result = commit(fixture, initialState(fixture), command(fixture.guests[0].id));
    assert.equal(result.accepted, amount === 10);
  }
});

test('钱不足且下一回合没有合规客人时立即给出不可达，不能软锁', () => {
  const fixture = { ...first, guests: first.guests.map((guest, index) => ({ ...guest, payment: index === 0 ? { ones: 0, fives: 0, tens: 1 } : guest.payment, earliest: index === 0 ? 1 : 3 })) };
  const result = commit(fixture, initialState(fixture), command(fixture.guests[0].id));
  assert.equal(result.state.status, 'lost');
  assert.match(result.state.failure, /不可达/);
});

test('A02: 钱盘容量刚低于、等于、高于；10元不占零钱盘', () => {
  const guest = first.guests[1];
  const state = initialState(first);
  for (const capacity of [9, 10, 11]) {
    const check = preview({ ...first, capacity }, state, guest.id, goodChange);
    assert.equal(check.legal, capacity >= 10);
  }
  assert.equal(traySize({ ones: 2, fives: 1, tens: 20 }), 3);
});

test('A03: 第7客仍进行、第8客唯一胜利、终局后不可提交', () => {
  const solution = solve(first);
  assert.ok(solution);
  const seven = replay(first, solution.steps.slice(0, 7));
  assert.equal(seven.status, 'playing');
  assert.equal(seven.served.length, 7);
  const finish = commit(first, seven, { ...solution.steps[7], commandId: 'finish' });
  assert.equal(finish.state.status, 'won');
  assert.equal(finish.state.served.length, 8);
  assert.equal(finish.state.events.filter(event => event.after.status === 'won').length, 1);
  const repeat = commit(first, finish.state, { ...solution.steps[7], commandId: 'new-finish-id' });
  assert.equal(repeat.accepted, false);
  assert.strictEqual(repeat.state, finish.state);
});

test('A04: 现金10元但无法找7元，接单失败且不借新客钱', () => {
  const emptyingGuest = first.guests.find(guest => guest.payment.tens === 1);
  const firstResult = commit(first, initialState(first), command(emptyingGuest.id));
  assert.equal(firstResult.state.status, 'playing');
  assert.equal(cashValue(firstResult.state.cash), 10);
  assert.equal(changeWays(firstResult.state.cash).length, 0);
  const failed = commit(first, firstResult.state, command(first.guests[1].id, { ones: 0, fives: 0 }, 'accept-empty'));
  assert.equal(failed.accepted, true);
  assert.equal(failed.state.status, 'lost');
  assert.match(failed.state.failure, /零钱不足却接单/);
  assert.deepEqual(failed.state.cash, firstResult.state.cash);
  assert.equal(failed.state.failureEventId, failed.state.events.at(-1).id);
  assert.equal(failed.state.events.at(-1).kind, 'failure');
  assert.equal(validateState(first, failed.state), true);
});

test('A04: 构造同时达人数条件与零钱失败的状态，失败优先', () => {
  const fixture = { ...first, guests: first.guests.map(guest => ({ ...guest, latest: 9 })) };
  const both = { ...initialState(fixture), served: Array.from({ length: 8 }, (_, index) => `fixture-${index}`), cash: { ones: 0, fives: 0, tens: 10 } };
  const result = commit(fixture, both, command(fixture.guests[0].id, { ones: 0, fives: 0 }));
  assert.equal(result.state.status, 'lost');
});

test('A05: 预览/取消不改状态，同ID和双击不会重复增减', () => {
  const state = frozen(initialState(first));
  const before = JSON.stringify(state);
  preview(first, state, first.guests[0].id, goodChange);
  preview(first, state, first.guests[1].id, { ones: 0, fives: 0 });
  assert.equal(JSON.stringify(state), before);
  const next = commit(first, state, command(first.guests[0].id));
  const duplicate = commit(first, next.state, command(first.guests[1].id));
  assert.equal(duplicate.accepted, false);
  assert.strictEqual(duplicate.state, next.state);
  const repeatedTarget = commit(first, next.state, command(first.guests[0].id, goodChange, 'other-id'));
  assert.equal(repeatedTarget.accepted, false);
  assert.strictEqual(repeatedTarget.state, next.state);
});

test('A06: JSON往返后相同指令产生相同完整事件与状态，重试无分支收益', () => {
  const solution = solve(first);
  let state = replay(first, solution.steps.slice(0, 3));
  const restored = JSON.parse(JSON.stringify(state));
  const next = { ...solution.steps[3], commandId: 'after-restore' };
  assert.deepEqual(commit(first, state, next), commit(first, restored, next));
  assert.equal(validateState(first, restored), true);
  restored.cash.ones += 1;
  assert.equal(validateState(first, restored), false);
  restored.cash.ones -= 1;
  restored.committedIds.push('invented');
  assert.equal(validateState(first, restored), false);
  state = initialState(first);
  assert.equal(state.cycle, 0);
  assert.equal(state.piecesGiven, 0);
  assert.deepEqual(state.cash, first.initial);
});

test('公开前置关系和窗口不能通过选客绕过', () => {
  const dependent = LEVELS[3];
  const state = initialState(dependent);
  const blocked = commit(dependent, state, command(dependent.guests[2].id));
  assert.equal(blocked.accepted, false);
  assert.match(blocked.message, /需先服务/);
  const windowLevel = LEVELS[8];
  const early = commit(windowLevel, initialState(windowLevel), command(windowLevel.guests[2].id));
  assert.equal(early.accepted, false);
  assert.match(early.message, /第3客/);
});

test('12关真实规则入口重放所有合法解；安全解和效率解均合法', () => {
  for (const level of LEVELS) {
    for (const mode of ['efficient', 'safe']) {
      const solution = solve(level, level.initial, [], mode);
      assert.ok(solution, `${level.id}/${mode}`);
      const final = replay(level, solution.steps);
      assert.equal(final.status, 'won', `${level.id}/${mode}`);
      assert.equal(cashValue(final.cash), cashValue(level.initial) + 24);
      assert.equal(final.piecesGiven, solution.pieces);
      assert.equal(validateState(level, final), true);
      for (const event of final.events) {
        assert.equal(changeValue(event.change), 7);
        assert.equal(cashValue(event.payment), 10);
        assert.ok(event.change.ones <= event.before.cash.ones && event.change.fives <= event.before.cash.fives);
        assert.ok(traySize(event.after.cash) <= level.capacity);
      }
    }
  }
});

test('首关容量最小；组合关04–06有不同顺序；10–11双解成本不同', () => {
  assert.ok(solve(first));
  assert.equal(solve({ ...first, capacity: first.capacity - 1 }), null);
  const branch = LEVELS[3];
  const forward = solve(branch);
  const reverse = solve({ ...branch, guests: [...branch.guests].reverse() });
  assert.notDeepEqual(forward.steps.map(step => step.guestId), reverse.steps.map(step => step.guestId));
  for (const level of LEVELS.slice(9, 11)) {
    assert.ok(solve(level, level.initial, [], 'efficient').pieces < solve(level, level.initial, [], 'safe').pieces);
  }
});
