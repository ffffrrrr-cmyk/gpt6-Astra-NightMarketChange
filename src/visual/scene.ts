const PALETTE = { ink: '#2d3027', paper: '#E8DCC7', sage: '#8B9D83', clay: '#B08B6E', rust: '#C66B3D', gold: '#C08E3A', moss: '#606C38' };
const clothes = ['#8B9D83', '#B08B6E', '#C66B3D', '#606C38', '#8c797c', '#887c60', '#769395', '#b59c76'];
type Context = CanvasRenderingContext2D;
function round(context: Context, left: number, top: number, width: number, height: number, radius: number | number[], fill: string, stroke?: string): void {
  context.beginPath(); context.roundRect(left, top, width, height, radius); context.fillStyle = fill; context.fill();
  if (stroke) { context.strokeStyle = stroke; context.lineWidth = 2; context.stroke(); }
}
function ellipse(context: Context, left: number, top: number, radiusX: number, radiusY: number, fill: string): void {
  context.beginPath(); context.ellipse(left, top, radiusX, radiusY, 0, 0, Math.PI * 2); context.fillStyle = fill; context.fill();
}
function line(context: Context, points: number[][], color: string, width = 2): void {
  context.beginPath(); points.forEach(([left, top], index) => index ? context.lineTo(left, top) : context.moveTo(left, top)); context.strokeStyle = color; context.lineWidth = width; context.stroke();
}
function label(context: Context, text: string, left: number, top: number, size: number, color = PALETTE.paper): void {
  context.fillStyle = color; context.font = `600 ${size}px "KaiTi", "STKaiti", "Microsoft YaHei", serif`; context.textAlign = 'center'; context.fillText(text, left, top);
}

export function drawPerson(context: Context, left: number, top: number, scale: number, look: number, time = 0): void {
  context.save(); context.translate(left, top + Math.sin(time * 0.001 + look) * 1.4); context.scale(scale, scale);
  ellipse(context, 0, 143, 57, 12, 'rgba(25,28,22,.18)');
  round(context, -24, 103, 19, 45, 8, '#49483d'); round(context, 7, 103, 19, 45, 8, '#49483d');
  round(context, -30, 138, 25, 12, 5, '#33382d'); round(context, 7, 138, 25, 12, 5, '#33382d');
  round(context, -43, 37, 86, 84, 25, clothes[look % clothes.length], '#4e5141');
  round(context, -53, 49, 21, 66, 10, clothes[look % clothes.length]); round(context, 32, 49, 21, 66, 10, clothes[look % clothes.length]);
  ellipse(context, -42, 112, 10, 10, '#d4ab82'); ellipse(context, 42, 112, 10, 10, '#d4ab82');
  round(context, -12, 24, 24, 24, 8, '#c89b73');
  ellipse(context, -31, 5, 7, 11, '#d4ab82'); ellipse(context, 31, 5, 7, 11, '#d4ab82');
  ellipse(context, 0, 0, 33, 39, '#deb68e');
  context.beginPath(); context.ellipse(0, -14, 35, 31, 0, Math.PI, Math.PI * 2); context.lineTo(32, 1); context.lineTo(18, -16); context.quadraticCurveTo(-7, -1, -32, -7); context.closePath(); context.fillStyle = look % 3 === 0 ? '#5a4c3e' : '#383a31'; context.fill();
  if (look % 3 === 1) { round(context, -39, -38, 77, 14, 6, PALETTE.moss); ellipse(context, 0, -40, 29, 10, PALETTE.sage); }
  if (look === 3 || look === 7) ellipse(context, 31, -25, 12, 15, '#4b4438');
  ellipse(context, -11, 4, 2.5, 3.5, '#3d3b2f'); ellipse(context, 12, 4, 2.5, 3.5, '#3d3b2f');
  if (look % 4 === 1) {
    context.strokeStyle = '#635b43'; context.lineWidth = 2;
    context.strokeRect(-23, -3, 19, 15); context.strokeRect(4, -3, 19, 15); line(context, [[-4, 2], [4, 2]], '#635b43');
  }
  ellipse(context, -20, 16, 7, 4, 'rgba(198,107,61,.25)'); ellipse(context, 20, 16, 7, 4, 'rgba(198,107,61,.25)');
  context.beginPath(); context.moveTo(-7, 23); context.quadraticCurveTo(0, 28, 8, 22); context.strokeStyle = '#91664c'; context.lineWidth = 2; context.stroke();
  line(context, [[-15, 41], [0, 54], [15, 41]], '#dbcaac', 4);
  line(context, [[0, 55], [0, 112]], 'rgba(45,48,39,.25)', 2);
  for (let button = 0; button < 3; button++) ellipse(context, 7, 64 + button * 16, 2, 2, '#d0c1a3');
  if (look % 2 === 0) {
    round(context, 24, 96, 32, 35, 5, '#cab58b', '#8b7857');
    context.beginPath(); context.arc(40, 97, 9, Math.PI, 0); context.strokeStyle = '#8b7857'; context.stroke();
  }
  context.restore();
}

export function portrait(look: number): string {
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
  const context = canvas.getContext('2d')!;
  ellipse(context, 50, 50, 48, 48, '#ded0b5');
  drawPerson(context, 50, 47, 0.8, look);
  return canvas.toDataURL();
}

export class NightScene {
  canvas: HTMLCanvasElement;
  context: Context;
  backdrop: HTMLCanvasElement;
  observer: ResizeObserver;
  frame = 0;
  width = 1200;
  height = 600;
  look = 0;
  served = 0;
  mode: 'title' | 'game';
  reduceMotion = false;
  paused = false;
  last = 0;
  histogram = new Uint32Array(10001);
  sampleCount = 0;
  frameTimeTotal = 0;
  longFrames = 0;
  startedAt = performance.now();
  pulse = 0;
  constructor(canvas: HTMLCanvasElement, mode: 'title' | 'game', reduceMotion: boolean) {
    this.canvas = canvas; this.context = canvas.getContext('2d')!; this.mode = mode; this.reduceMotion = reduceMotion;
    this.backdrop = document.createElement('canvas');
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas);
    this.resize(); this.frame = requestAnimationFrame(time => this.draw(time));
  }
  resize(): void {
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = bounds.width; this.height = bounds.height;
    this.canvas.width = Math.round(bounds.width * ratio); this.canvas.height = Math.round(bounds.height * ratio);
    this.backdrop.width = this.canvas.width; this.backdrop.height = this.canvas.height;
    const context = this.backdrop.getContext('2d')!;
    context.scale(ratio, ratio); this.paintBackdrop(context);
  }
  paintBackdrop(context: Context): void {
    const width = this.width; const height = this.height;
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#343e36'); sky.addColorStop(0.6, '#667360'); sky.addColorStop(1, '#B08B6E');
    context.fillStyle = sky; context.fillRect(0, 0, width, height);
    ellipse(context, width * 0.81, height * 0.14, 26, 26, '#d3c095');
    for (let star = 0; star < 40; star++) ellipse(context, ((star * 157 + 71) % 997) / 997 * width, ((star * 31 + 17) % 151) / 500 * height, star % 3 ? 0.8 : 1.4, 1, 'rgba(232,220,199,.45)');
    const street = height * 0.69;
    for (let building = 0; building < 13; building++) {
      const left = width * building / 12 - 28;
      const buildingWidth = width / 11;
      const top = height * (0.25 + ((building * 7) % 5) * 0.035);
      round(context, left, top, buildingWidth, street - top, 4, building % 2 ? '#485347' : '#3e4b40');
      line(context, [[left - 10, top], [left + buildingWidth * 0.5, top - 20], [left + buildingWidth + 10, top]], '#303e34', 9);
      for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 2; column++) {
          const windowLeft = left + 14 + column * buildingWidth * 0.45;
          const windowTop = top + 22 + row * 36;
          round(context, windowLeft, windowTop, buildingWidth * 0.23, 24, 2, (building + row + column) % 3 ? '#8a8460' : '#b8a16d');
          line(context, [[windowLeft + buildingWidth * 0.115, windowTop], [windowLeft + buildingWidth * 0.115, windowTop + 24]], '#455041');
        }
      }
    }
    context.fillStyle = '#8b8064'; context.fillRect(0, street, width, height - street);
    for (let row = 0; row < 6; row++) {
      const stoneTop = street + row * (height - street) / 5;
      line(context, [[0, stoneTop], [width, stoneTop + row * 3]], 'rgba(66,64,46,.22)', 2);
      for (let column = 0; column < 15; column++) line(context, [[column * width / 13 + row % 2 * 40, stoneTop], [column * width / 13 + row % 2 * 40 + 7, stoneTop + 26]], 'rgba(66,64,46,.18)', 1);
    }
    for (let stall = 0; stall < 7; stall++) {
      const left = stall * width / 6 - 45;
      const stallWidth = width / 7.7;
      const stallTop = street - height * 0.19;
      round(context, left, stallTop, stallWidth, height * 0.24, 5, '#715c42');
      context.beginPath(); context.moveTo(left - 14, stallTop); context.lineTo(left + 5, stallTop - 34); context.lineTo(left + stallWidth - 5, stallTop - 34); context.lineTo(left + stallWidth + 14, stallTop); context.closePath(); context.fillStyle = stall % 2 ? '#936448' : '#7e8b65'; context.fill();
      for (let stripe = 0; stripe < 5; stripe++) line(context, [[left + stripe * stallWidth / 4, stallTop], [left + 5 + stripe * (stallWidth - 10) / 4, stallTop - 32]], 'rgba(222,203,165,.28)', 10);
      round(context, left + 10, stallTop + 12, stallWidth - 20, 21, 3, '#c6ab7c');
      label(context, ['桂花糕', '糖水', '热栗子', '手作', '米酒', '葱油饼', '烤红薯'][stall], left + stallWidth / 2, stallTop + 28, Math.min(stallWidth / 4, 17), '#5d533d');
      for (let bowl = 0; bowl < 5; bowl++) { ellipse(context, left + 15 + bowl * (stallWidth - 28) / 4, stallTop + 56, 9, 5, '#bd9864'); }
    }
    context.beginPath(); context.moveTo(-20, height * 0.12); context.quadraticCurveTo(width / 2, height * 0.52, width + 20, height * 0.12); context.strokeStyle = '#343d2f'; context.lineWidth = 2; context.stroke();
    for (let lamp = 0; lamp < 10; lamp++) {
      const fraction = (lamp + 0.5) / 10;
      const left = width * fraction;
      const top = height * (0.12 + 0.8 * fraction * (1 - fraction));
      line(context, [[left, top], [left, top + 16]], '#5c5137');
      const glow = context.createRadialGradient(left, top + 31, 1, left, top + 31, 53);
      glow.addColorStop(0, 'rgba(214,165,80,.22)'); glow.addColorStop(1, 'rgba(214,165,80,0)'); context.fillStyle = glow; context.fillRect(left - 53, top - 22, 106, 106);
      ellipse(context, left, top + 31, 13, 17, lamp % 3 ? '#bd8450' : '#c49e64');
      line(context, [[left - 9, top + 17], [left + 9, top + 17]], '#765139', 3);
      line(context, [[left - 9, top + 46], [left + 9, top + 46]], '#765139', 3);
      line(context, [[left, top + 48], [left, top + 60]], '#a87443', 3);
      ellipse(context, left, top + 31, 6, 16, 'rgba(232,220,199,.13)');
    }
    for (let person = 0; person < 7; person++) drawPerson(context, width * (person + 0.5) / 7, street - 4, Math.min(height / 950, 0.48), person, 0);
    if (this.mode === 'title') this.paintCart(context, width * 0.66, height * 0.5, Math.min(width / 1100, height / 650));
    else {
      const awningHeight = Math.min(37, height * 0.13);
      for (let stripe = 0; stripe < Math.ceil(width / 48); stripe++) round(context, stripe * 48, -12, 48, awningHeight + 12, [0, 0, 14, 14], stripe % 2 ? '#B08B6E' : '#606C38');
      round(context, 24, 58, 120, 70, 10, '#E8DCC7', '#7c6c4e'); label(context, '每份 3元', 84, 89, 23, '#606C38'); label(context, '收10 · 找7', 84, 114, 16, '#66563e');
      this.paintCounter(context, width, height);
    }
    let noiseSeed = 3127;
    for (let dot = 0; dot < 4200; dot++) {
      noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0; const left = noiseSeed / 4294967296 * width;
      noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0; const top = noiseSeed / 4294967296 * height;
      context.fillStyle = dot % 2 ? 'rgba(232,220,199,.025)' : 'rgba(45,48,39,.025)'; context.fillRect(left, top, 2, 2);
    }
  }
  paintCart(context: Context, left: number, top: number, scale: number): void {
    context.save(); context.translate(left, top); context.scale(scale, scale);
    ellipse(context, 10, 260, 236, 30, 'rgba(38,43,32,.24)');
    round(context, -185, -80, 14, 315, 4, '#6c5235'); round(context, 185, -80, 14, 315, 4, '#6c5235');
    round(context, -210, 105, 430, 132, 12, '#a67e51', '#695035');
    for (let board = 0; board < 10; board++) line(context, [[-185 + board * 42, 110], [-185 + board * 42, 232]], '#8c6845', 2);
    round(context, -224, 96, 454, 20, 5, '#c5a575', '#6f5436');
    for (const wheel of [-135, 142]) { ellipse(context, wheel, 243, 28, 28, '#394034'); ellipse(context, wheel, 243, 17, 17, '#a48b5d'); ellipse(context, wheel, 243, 6, 6, '#55513a'); }
    context.beginPath(); context.moveTo(-232, -60); context.lineTo(-192, -128); context.lineTo(194, -128); context.lineTo(234, -60); context.closePath(); context.fillStyle = '#606C38'; context.fill();
    for (let stripe = 0; stripe < 10; stripe++) {
      const stripeLeft = -230 + stripe * 46;
      round(context, stripeLeft, -64, 46, 32, [0, 0, 14, 14], stripe % 2 ? '#B08B6E' : '#606C38');
      if (stripe % 2) { context.beginPath(); context.moveTo(stripeLeft, -64); context.lineTo(-192 + stripe * 39, -127); context.lineTo(-192 + (stripe + 1) * 39, -127); context.lineTo(stripeLeft + 46, -64); context.closePath(); context.fillStyle = '#B08B6E'; context.fill(); }
    }
    round(context, -112, -102, 224, 56, 8, '#E8DCC7', '#8f7751'); label(context, '夜 市 小 食', 0, -65, 30, '#606C38');
    context.save(); context.beginPath(); context.rect(-200, -100, 400, 196); context.clip(); drawPerson(context, 60, 32, 0.82, 3); context.restore();
    for (let basket = 0; basket < 3; basket++) {
      const basketLeft = -142 + basket * 62;
      round(context, basketLeft, 66, 55, 30, 8, '#9c7947', '#6f5636');
      ellipse(context, basketLeft + 27, 66, 28, 10, '#bfa16d');
      for (let bun = 0; bun < 5; bun++) ellipse(context, basketLeft + 9 + bun % 3 * 17, 62 - Math.floor(bun / 3) * 9, 9, 7, '#d8c292');
    }
    round(context, 111, 43, 70, 54, 12, '#7d887b', '#4d5d4b'); ellipse(context, 146, 43, 36, 9, '#adb49b'); ellipse(context, 146, 37, 10, 5, '#4d5d4b');
    round(context, -75, 140, 150, 65, 7, '#E8DCC7'); label(context, '一份小食', 0, 166, 22, '#606C38'); label(context, '三元，刚刚好', 0, 193, 20, '#856742');
    context.restore();
  }
  paintCounter(context: Context, width: number, height: number): void {
    const top = height * 0.83;
    round(context, -5, top, width + 10, height - top + 10, 6, '#a6855d');
    round(context, 0, top, width, 10, 2, '#c8ad7e');
    for (let plank = 0; plank < 10; plank++) line(context, [[plank * width / 10, top + 12], [plank * width / 10 + 10, height]], '#96744f');
    for (let basket = 0; basket < 3; basket++) {
      const left = width * 0.12 + basket * 62;
      ellipse(context, left, top - 3, 29, 12, '#765d37');
      for (let bun = 0; bun < 5; bun++) ellipse(context, left - 18 + bun % 3 * 17, top - 8 - Math.floor(bun / 3) * 10, 9, 8, '#d0b581');
    }
    round(context, width - 128, top - 38, 85, 43, 10, '#85917b', '#485a46'); ellipse(context, width - 85, top - 38, 43, 10, '#b2b79a'); ellipse(context, width - 85, top - 44, 12, 5, '#606C38');
  }
  draw(time: number): void {
    const context = this.context;
    if (!this.paused) {
      if (this.last && !document.hidden) {
        const delta = time - this.last;
        if (delta > 0) { this.histogram[Math.min(10000, Math.round(delta * 10))]++; this.sampleCount++; this.frameTimeTotal += delta; if (delta > 50) this.longFrames++; }
      }
      const ratio = this.canvas.width / this.width;
      context.setTransform(1, 0, 0, 1, 0, 0); context.drawImage(this.backdrop, 0, 0);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const animationTime = this.reduceMotion ? 0 : time;
      if (this.mode === 'game') {
        drawPerson(context, this.width * 0.57, this.height * 0.37, Math.min(this.height / 300, 1.6), this.look, animationTime);
        this.paintCounter(context, this.width, this.height);
      }
      const steamLeft = this.mode === 'title' ? this.width * 0.66 + 146 * Math.min(this.width / 1100, this.height / 650) : this.width - 85;
      const steamTop = this.mode === 'title' ? this.height * 0.5 + 20 : this.height * 0.83 - 45;
      for (let strand = 0; strand < 3; strand++) {
        context.beginPath(); context.moveTo(steamLeft - 12 + strand * 12, steamTop);
        context.bezierCurveTo(steamLeft + Math.sin(animationTime * 0.001 + strand) * 10, steamTop - 17, steamLeft - 20 + strand * 9, steamTop - 32, steamLeft + strand * 7, steamTop - 48);
        context.strokeStyle = 'rgba(232,220,199,.32)'; context.lineWidth = 3; context.stroke();
      }
      if (time < this.pulse && !this.reduceMotion) {
        const progress = 1 - (this.pulse - time) / 650;
        context.globalAlpha = 1 - progress; label(context, '+3元', this.width * 0.57, this.height * 0.37 - progress * 35, 28, '#E8DCC7'); context.globalAlpha = 1;
      }
    }
    this.last = this.paused ? 0 : time;
    this.frame = requestAnimationFrame(next => this.draw(next));
  }
  celebrate(): void { this.pulse = performance.now() + 650; }
  metrics(): { durationSeconds: number; activeSeconds: number; frames: number; p95Ms: number; averageFps: number; longFrames: number; activeRenderers: number } {
    let accumulated = 0;
    let percentile = 0;
    for (let bucket = 0; bucket < this.histogram.length; bucket++) {
      accumulated += this.histogram[bucket];
      if (accumulated >= this.sampleCount * 0.95) { percentile = bucket / 10; break; }
    }
    return { durationSeconds: (performance.now() - this.startedAt) / 1000, activeSeconds: this.frameTimeTotal / 1000, frames: this.sampleCount, p95Ms: percentile, averageFps: this.frameTimeTotal ? this.sampleCount * 1000 / this.frameTimeTotal : 0, longFrames: this.longFrames, activeRenderers: 1 };
  }
  dispose(): void { cancelAnimationFrame(this.frame); this.observer.disconnect(); }
}
