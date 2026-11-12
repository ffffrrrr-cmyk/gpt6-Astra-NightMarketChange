import { mkdir, writeFile } from 'node:fs/promises';
import { LEVELS } from '../src/content/levels.ts';
import { cashValue, changeWays, commit, guestBlock, initialState, replay, solve, traySize } from '../src/core/rules.ts';

const output = new URL('../Validation/', import.meta.url);
await mkdir(output, { recursive: true });
let failed = false;
const reports = [];

function findFailure(level) {
  const visited = new Set();
  function visit(state, steps) {
    if (state.status === 'won') return null;
    if (state.status === 'lost') return { steps, state };
    const key = `${[...state.served].sort().join(',')}/${state.cash.ones}/${state.cash.fives}`;
    if (visited.has(key)) return null;
    visited.add(key);
    for (const guest of level.guests) {
      if (guestBlock(level, state.served, guest)) continue;
      const options = changeWays(state.cash);
      for (const change of options.length ? options : [{ ones: 0, fives: 0 }]) {
        const step = { guestId: guest.id, change };
        const result = commit(level, state, { ...step, commandId: `failure-${steps.length + 1}` });
        if (!result.accepted) continue;
        const found = visit(result.state, [...steps, step]);
        if (found) return found;
      }
    }
    return null;
  }
  return visit(initialState(level), []);
}

for (const level of LEVELS) {
  const efficient = solve(level, level.initial, [], 'efficient');
  const safe = solve(level, level.initial, [], 'safe');
  const failure = findFailure(level);
  const winState = efficient ? replay(level, efficient.steps) : null;
  const alternatives = [];
  for (const guest of level.guests) {
    if (guestBlock(level, [], guest)) continue;
    for (const change of changeWays(level.initial)) {
      const first = commit(level, initialState(level), { commandId: 'alternate-1', guestId: guest.id, change });
      if (!first.accepted || first.state.status === 'lost') continue;
      const suffix = solve(level, first.state.cash, first.state.served);
      if (suffix) alternatives.push([{ guestId: guest.id, change }, ...suffix.steps]);
    }
  }
  const amountCorrect = level.guests.every(guest => cashValue(guest.payment) === 10);
  const uniqueOrders = new Set(alternatives.map(steps => steps.map(step => step.guestId).join(','))).size;
  const difference = efficient && safe ? safe.pieces - efficient.pieces : null;
  const valid = Boolean(efficient && safe && failure && winState?.status === 'won' && winState.served.length === 8 && amountCorrect && cashValue(winState.cash) === cashValue(level.initial) + 24);
  if (!valid) failed = true;
  const report = { levelId: level.id, name: level.name, capacity: level.capacity, initial: level.initial, valid, efficient, safe, costDifference: difference, differentOrders: uniqueOrders, alternativeSolutions: alternatives.slice(0, 2), winningEvents: winState?.events, failureSteps: failure?.steps, failureEvents: failure?.state.events };
  reports.push(report);
  console.log(`${valid ? 'PASS' : 'FAIL'} ${level.id} ${level.name}: efficient=${efficient?.pieces} safe=${safe?.pieces} margin=${safe?.minimumOnes} orders=${uniqueOrders} failure=${failure?.state.failure}`);
}

let firstMinimumCapacity = null;
for (let capacity = traySize(LEVELS[0].initial); capacity <= LEVELS[0].capacity; capacity++) {
  if (solve({ ...LEVELS[0], capacity })) { firstMinimumCapacity = capacity; break; }
}
console.log(`首关可解的最小零钱盘容量：${firstMinimumCapacity}`);
if (![9, 10].every(index => reports[index].costDifference > 0)) {
  console.error('10–11关安全解与效率解张枚代价必须不同');
  failed = true;
}
if (!reports.slice(3, 6).some(report => report.differentOrders >= 2)) { console.error('04–06关缺少不同顺序的有效解'); failed = true; }
await writeFile(new URL('level-solutions.json', output), JSON.stringify({ ruleVersion: 'rmb-1', generatedAt: new Date().toISOString(), firstMinimumCapacity, reports }, null, 2));
await writeFile(new URL('content-differences.md', output), '# 12关结构差异\n\n' + LEVELS.map(level => `- ${level.number.toString().padStart(2, '0')} ${level.name}：${level.difference}`).join('\n') + '\n');
process.exitCode = failed ? 1 : 0;
