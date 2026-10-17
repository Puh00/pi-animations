import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuroraComponent } from '../index.ts';
import { renderAurora } from '../animations/aurora.ts';

const theme = { fg: (_, text) => text, getColorMode: () => '256color' };

test('reduced motion is static, NO_COLOR is readable ASCII, and Pi selects 256 colors', () => {
  const original = { ...process.env };
  const set = globalThis.setInterval;
  const clear = globalThis.clearInterval;
  let timers = 0;
  globalThis.setInterval = () => ++timers;
  globalThis.clearInterval = () => {};
  try {
    delete process.env.NO_COLOR;
    process.env.TERM = 'xterm-256color';
    process.env.ASCIIFX_REDUCED_MOTION = '1';
    let component = createAuroraComponent({ requestRender() {} }, theme, 'aurora');
    assert.equal(timers, 0);
    const colored = component.render(60).join('\n');
    assert.match(colored, /\x1b\[38;5;/);
    assert.doesNotMatch(colored, /\x1b\[38;2;/);
    component.dispose();
    process.env.NO_COLOR = '';
    component = createAuroraComponent({ requestRender() {} }, theme, 'aurora');
    const plain = component.render(60).join('\n');
    assert.match(plain, /^[\x20-\x7e\n]+$/);
    assert.match(plain, /[+*#%@]/);
    assert.equal(timers, 0);
    component.dispose();
    delete process.env.ASCIIFX_REDUCED_MOTION;
    process.env.TERM = 'dumb';
    component = createAuroraComponent({ requestRender() {} }, theme, 'aurora');
    assert.equal(timers, 0);
    component.dispose();
  } finally {
    process.env = original;
    globalThis.setInterval = set;
    globalThis.clearInterval = clear;
  }
});

test('public renderer rejects nonfinite inputs and invalid palettes', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => renderAurora(value, 8, 0), RangeError);
    assert.throws(() => renderAurora(40, 8, value), RangeError);
    assert.throws(() => renderAurora(40, 8, 0, 1n, { curtains: value }), RangeError);
  }
  assert.throws(() => renderAurora(1_000_001, 10, 0), RangeError);
  assert.throws(() => renderAurora(40, 8, 0, 1n, { palette: [] }), RangeError);
  assert.throws(() => renderAurora(40, 8, 0, 1n, { palette: [[256, 0, 0]] }), RangeError);
});
