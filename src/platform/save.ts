import { getLevel, LEVELS } from '../content/levels.ts';
import { validateState } from '../core/rules.ts';
import type { GameState } from '../core/types.ts';

export type Settings = { master: number; effects: number; reduceMotion: boolean };
export type Progress = {
  schemaVersion: 1;
  ruleVersion: 'rmb-1';
  current: GameState | null;
  unlocked: number;
  best: Record<string, number>;
  settings: Settings;
  tutorialDone: boolean;
  lastEventSequence: number;
};
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const PREFIX = 'night-market-0003';
export const defaultProgress = (): Progress => ({ schemaVersion: 1, ruleVersion: 'rmb-1', current: null, unlocked: 1, best: {}, settings: { master: 0.65, effects: 0.65, reduceMotion: false }, tutorialDone: false, lastEventSequence: 0 });
export const checksum = (text: string): string => {
  let hash = 2166136261;
  for (const character of text) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
};

function validProgress(input: unknown): input is Progress {
  try {
    const data = input as Progress;
    if (!data || data.schemaVersion !== 1 || data.ruleVersion !== 'rmb-1' || !Number.isInteger(data.unlocked) || data.unlocked < 1 || data.unlocked > 12 || typeof data.tutorialDone !== 'boolean') return false;
    if (!data.settings || ![data.settings.master, data.settings.effects].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) || typeof data.settings.reduceMotion !== 'boolean') return false;
    if (!data.best || Object.entries(data.best).some(([key, value]) => !LEVELS.some(level => level.id === key) || !Number.isInteger(value) || value < 24 || value > 56)) return false;
    if (data.current && !validateState(getLevel(data.current.levelId), data.current)) return false;
    return data.lastEventSequence === (data.current?.events.length ?? 0);
  } catch { return false; }
}

export class SaveStore {
  storage: StorageLike | null;
  notice = '';
  memory: Progress = defaultProgress();
  preserveIncompatible = false;
  constructor(storage?: StorageLike | null) {
    try {
      this.storage = storage === undefined ? window.localStorage : storage;
      if (!this.storage) throw new Error('storage unavailable');
      this.storage.setItem(`${PREFIX}:probe`, '1');
    } catch { this.storage = null; this.notice = '浏览器存储不可用：本次进度仅保留在内存。'; }
  }

  load(): Progress {
    if (!this.storage) return this.memory;
    try {
      const pointer = this.storage.getItem(`${PREFIX}:active`) === 'b' ? 'b' : 'a';
      let foundData = false;
      let sawIncompatible = false;
      for (const slot of [pointer, pointer === 'a' ? 'b' : 'a']) {
        const text = this.storage.getItem(`${PREFIX}:${slot}`);
        if (!text) continue;
        foundData = true;
        try {
          const envelope = JSON.parse(text) as { payload: string; checksum: string };
          if (typeof envelope.payload !== 'string' || checksum(envelope.payload) !== envelope.checksum) continue;
          const data = JSON.parse(envelope.payload);
          if (data.schemaVersion !== 1 || data.ruleVersion !== 'rmb-1') { sawIncompatible = true; continue; }
          if (!validProgress(data)) continue;
          this.memory = data;
          if (slot !== pointer) {
            this.notice = '最近存档损坏，已恢复上一份可用进度。';
            this.storage.setItem(`${PREFIX}:active`, slot);
          }
          return this.memory;
        } catch { continue; }
      }
      if (sawIncompatible) {
        this.preserveIncompatible = true;
        this.notice = '旧存档版本不兼容，已保留旧记录。请新开本单元；本次进度仅保留在内存。';
      } else if (foundData) this.notice = '存档损坏且无可用备份，请重新开始。';
    } catch { this.storage = null; this.notice = '读取存档受限：本次进度仅保留在内存。'; }
    return this.memory;
  }

  save(progress: Progress): boolean {
    if (!validProgress(progress)) { this.notice = '进度校验失败，已保留上一份可用存档。'; return false; }
    this.memory = structuredClone(progress);
    if (!this.storage || this.preserveIncompatible) return false;
    try {
      const active = this.storage.getItem(`${PREFIX}:active`) === 'b' ? 'b' : 'a';
      const target = active === 'a' ? 'b' : 'a';
      const payload = JSON.stringify(progress);
      const encoded = JSON.stringify({ payload, checksum: checksum(payload) });
      this.storage.setItem(`${PREFIX}:${target}`, encoded);
      if (this.storage.getItem(`${PREFIX}:${target}`) !== encoded) throw new Error('write verification failed');
      this.storage.setItem(`${PREFIX}:active`, target);
      return true;
    } catch { this.storage = null; this.notice = '保存失败：本次进度仅保留在内存，已有存档仍保留。'; return false; }
  }
}
