import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveStore, checksum, defaultProgress } from '../src/platform/save.ts';
import { LEVELS } from '../src/content/levels.ts';
import { initialState, replay, solve } from '../src/core/rules.ts';

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, value); }
}
const envelope = data => { const payload = JSON.stringify(data); return JSON.stringify({ payload, checksum: checksum(payload) }); };

test('A06/A08: 双槽保存、精确恢复、损坏时回退上一份有效档', () => {
  const storage = new MemoryStorage();
  const store = new SaveStore(storage);
  const data = defaultProgress();
  data.current = initialState(LEVELS[0]);
  assert.equal(store.save(data), true);
  const older = structuredClone(data);
  data.current = replay(LEVELS[0], solve(LEVELS[0]).steps.slice(0, 2));
  data.lastEventSequence = data.current.events.length;
  assert.equal(store.save(data), true);
  assert.deepEqual(new SaveStore(storage).load(), data);
  const active = storage.getItem('night-market-0003:active');
  storage.setItem(`night-market-0003:${active}`, 'damaged');
  const reader = new SaveStore(storage);
  assert.deepEqual(reader.load(), older);
  assert.match(reader.notice, /恢复上一份/);
  assert.equal(reader.save(older), true);
  assert.deepEqual(new SaveStore(storage).load(), older);
});

test('A08: 禁用存储仍可内存通关，进度不伪称已保存', () => {
  const store = new SaveStore({ getItem() { throw new Error('disabled'); }, setItem() { throw new Error('disabled'); } });
  const progress = store.load();
  progress.current = replay(LEVELS[0], solve(LEVELS[0]).steps);
  progress.lastEventSequence = 8;
  assert.equal(store.save(progress), false);
  assert.equal(store.memory.current.status, 'won');
  assert.match(store.notice, /仅保留在内存/);
});

test('A08: 不兼容旧档保留，不能用新档覆盖', () => {
  const storage = new MemoryStorage();
  const legacy = envelope({ ...defaultProgress(), schemaVersion: 7 });
  storage.setItem('night-market-0003:a', legacy);
  storage.setItem('night-market-0003:active', 'a');
  const store = new SaveStore(storage);
  assert.deepEqual(store.load(), defaultProgress());
  assert.match(store.notice, /不兼容/);
  assert.equal(store.save(defaultProgress()), false);
  assert.equal(storage.getItem('night-market-0003:a'), legacy);
});

test('A08: 写后校验失败保留有效指针与旧档', () => {
  const storage = new MemoryStorage();
  const store = new SaveStore(storage);
  assert.equal(store.save(defaultProgress()), true);
  const active = storage.getItem('night-market-0003:active');
  const original = storage.setItem.bind(storage);
  storage.setItem = (key, value) => original(key, key.endsWith(':a') ? 'truncated' : value);
  assert.equal(store.save(defaultProgress()), false);
  assert.equal(storage.getItem('night-market-0003:active'), active);
  assert.match(store.notice, /保存失败/);
});

test('篡改事件和金额即使重算校验和也被状态重放拒绝', () => {
  const storage = new MemoryStorage();
  const data = defaultProgress();
  data.current = initialState(LEVELS[0]);
  data.current.cash.ones = 900;
  storage.setItem('night-market-0003:a', envelope(data));
  const store = new SaveStore(storage);
  assert.equal(store.load().current, null);
  assert.match(store.notice, /损坏/);
});
