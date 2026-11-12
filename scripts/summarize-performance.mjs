import { readFile, writeFile } from 'node:fs/promises';
const directory = new URL('../Validation/', import.meta.url);
const samples = (await readFile(new URL('performance-samples.jsonl', directory), 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line.replace(/^\uFEFF/, '')));
const first = samples[0];
const last = samples.at(-1);
const elapsedSeconds = (Date.parse(last.capturedAt) - Date.parse(first.capturedAt)) / 1000;
const activeSeconds = last.diagnostics.metrics.activeSeconds - first.diagnostics.metrics.activeSeconds;
const frames = last.diagnostics.metrics.frames - first.diagnostics.metrics.frames;
const measuredBuild = JSON.parse((await readFile(new URL('performance-build.json', directory), 'utf8')).replace(/^\uFEFF/, ''));
const counts = key => samples.map(sample => sample.dom[key]);
const stable = values => Math.max(...values) === Math.min(...values);
const heap = samples.map(sample => sample.heap.usedSize);
const result = {
  status: elapsedSeconds >= 899 && activeSeconds >= 899 && samples.length >= 16 && samples.every(sample => sample.diagnostics.levelId === 'night-12' && sample.diagnostics.modal === null && !sample.diagnostics.documentHidden) && last.diagnostics.metrics.p95Ms <= 20 && frames / activeSeconds >= 60 && stable(counts('nodes')) && stable(counts('jsEventListeners')) ? 'PASS_MEASURED_SCENE' : 'FAIL_OR_INCOMPLETE',
  startedAt: first.capturedAt,
  endedAt: last.capturedAt,
  elapsedSeconds,
  activeSeconds,
  sampleCount: samples.length,
  frames,
  averageFps: frames / activeSeconds,
  p95FrameIntervalMs: last.diagnostics.metrics.p95Ms,
  longFramesOver50ms: last.diagnostics.metrics.longFrames - first.diagnostics.metrics.longFrames,
  dom: { nodes: counts('nodes'), listeners: counts('jsEventListeners'), documents: counts('documents') },
  heapBytesAfterExplicitGC: { first: heap[0], last: heap.at(-1), minimum: Math.min(...heap), maximum: Math.max(...heap) },
  environment: { cpu: 'Intel Core i5-14400F', logicalProcessors: 16, ramGiB: 32, windows: '10.0.19044 x64', browser: first.browser, viewport: first.viewport, headless: true },
  measuredBuild,
  method: '独立Chrome固定第12关、8客与蒸气动画、无业务输入，每60秒一次CDP采样；每次显式GC后记录JS堆及DOM数量。帧间隔直方图0.1ms精度、固定内存，覆盖该场景整个生命周期（含正式采样前约38秒）；平均FPS用首末采样差计算。',
  limitations: '后台固定场景观测，不替代用户前台手感，不覆盖所有设备。测量版本随后仅增加存储警告状态下的布局处理；普通无警告第12关绘制逻辑无改动，最终归档的完整15分钟未重跑。'
};
await writeFile(new URL('performance-summary.json', directory), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
