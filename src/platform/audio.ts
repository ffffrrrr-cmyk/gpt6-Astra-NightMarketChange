import type { Settings } from './save.ts';
type Cue = 'select' | 'reject' | 'commit' | 'warning' | 'win' | 'lose';
export class GameAudio {
  context: AudioContext | null = null;
  settings: Settings;
  constructor(settings: Settings) { this.settings = settings; }
  unlock(): void {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
    } catch { this.context = null; }
  }
  play(cue: Cue): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const notes: Record<Cue, number[]> = { select: [740], reject: [180, 150], commit: [523, 784], warning: [330, 294], win: [523, 659, 784, 1047], lose: [392, 330, 262] };
    for (const [index, frequency] of notes[cue].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.095;
      const volume = this.settings.master * this.settings.effects * 0.12;
      oscillator.type = cue === 'reject' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.23);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.25);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  }
  pause(): void { if (this.context?.state === 'running') void this.context.suspend().catch(() => undefined); }
}
