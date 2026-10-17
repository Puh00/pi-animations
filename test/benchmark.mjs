import { performance } from 'node:perf_hooks';
import { createAuroraComponent } from '../index.ts';
import { renderAurora } from '../animations/aurora.ts';

const theme = { fg: (_, text) => text, getColorMode: () => 'truecolor' };
const results = [];
const oldEnvironment = { ...process.env };
delete process.env.ASCIIFX_REDUCED_MOTION;
delete process.env.NO_COLOR;
process.env.TERM = 'xterm-256color';
const oldSet = globalThis.setInterval;
const oldClear = globalThis.clearInterval;
let tick;
globalThis.setInterval = callback => { tick = callback; return 1; };
globalThis.clearInterval = () => {};

function measure(action) {
  for (let i = 0; i < 30; i++) action(i);
  const samples = [];
  for (let i = 0; i < 120; i++) {
    const start = performance.now();
    action(i);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return { median_ms: samples[60], p95_ms: samples[114] };
}

try {
  for (const width of [60, 120, 240, 320]) {
    const renderer = measure(i => renderAurora(width, 10, i / 24));
    const component = createAuroraComponent({ requestRender() {} }, theme, 'aurora');
    const full = measure(() => { tick(); component.render(width); });
    const cached = measure(() => component.render(width));
    const ansiBytes = Buffer.byteLength(component.render(width).join('\n'));
    component.dispose();
    results.push({ width, rows: 10, renderer, frame_with_ansi: full, cached_render: cached, ansi_bytes: ansiBytes });
  }
} finally {
  globalThis.setInterval = oldSet;
  globalThis.clearInterval = oldClear;
  process.env = oldEnvironment;
}
console.log(JSON.stringify({ node: process.version, note: 'CPU render cost only; excludes Pi terminal diffing and terminal output', results }, null, 2));
