import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { renderGalaxy } from '../animations/galaxy.ts';
import { animations } from '../animations/registry.ts';

const fixtures = JSON.parse(fs.readFileSync(new URL('../testdata/galaxy-reference.json', import.meta.url)));
test('Galaxy frames are deterministic, framed and pinned', () => {
  for (const { w, h, t, sha256 } of fixtures) {
    const frame = renderGalaxy(w, h, t);
    assert.equal(createHash('sha256').update(JSON.stringify(frame)).digest('hex'), sha256);
    assert.deepEqual(frame, renderGalaxy(w, h, t));
    assert.equal(frame.length, h);
    assert.ok(frame.every(row => row.length === w));
    assert.ok(frame.flat().every(cell => /^[ ▀▄]$/u.test(cell.glyph) && /^[ .:\-=+*#%@]$/u.test(cell.mono)));
    assert.ok(frame.flat().some(cell => cell.bg));
    assert.ok(frame.flat().some(cell => cell.mono !== ' '));
    assert.notDeepEqual(frame, renderGalaxy(w, h, t + 2));
    if (w >= 80) assert.ok(frame.every(row => row[0].glyph === ' ' && row[w - 1].glyph === ' '));
  }
  assert.deepEqual(animations.galaxy.renderFrame({width: 80, height: 10, seconds: 0}), renderGalaxy(80, 10, 0));
  const visibleWidth = frame => {
    const xs = [];
    frame.forEach(row => row.forEach((cell, x) => {
      if ([...(cell.fg ?? []), ...(cell.bg ?? [])].some(channel => channel >= 40)) xs.push(x);
    }));
    return Math.max(...xs) - Math.min(...xs) + 1;
  };
  const normalWidth = visibleWidth(renderGalaxy(80, 10, 0));
  const wideWidth = visibleWidth(renderGalaxy(160, 10, 0));
  assert.ok(normalWidth >= 48 && normalWidth <= 60);
  assert.ok(wideWidth > normalWidth && wideWidth < 100);
  const core = renderGalaxy(80, 10, 0);
  const sum = color => color.reduce((total, channel) => total + channel, 0);
  const highlight = core[4][39].bg, lane = core[5][39].bg, below = core[6][39].fg;
  assert.ok(highlight[0] > highlight[1] && highlight[1] > highlight[2], 'core highlight is ivory');
  assert.ok(sum(highlight) > sum(lane) * 3 && sum(below) > sum(lane) * 1.5, 'lane occludes glow with light below');
  assert.ok(highlight.every(channel => channel < 255), 'core highlight does not clip');
  const small = renderGalaxy(20, 4, 0);
  const shades = ' .:-=+*#%@';
  assert.ok(shades.indexOf(small[1][9].mono) > shades.indexOf(small[2][9].mono));
  const brightness = cell => (cell.fg ?? [0, 0, 0]).reduce((a, b) => a + b, 0);
  assert.ok(brightness(small[1][9]) > brightness(small[2][9]));
  for (const [w, h] of [[1, 1], [5, 50], [0, 3], [5, 0]]) {
    const frame = renderGalaxy(w, h, 0);
    assert.equal(frame.length, h);
    assert.ok(frame.every(row => row.length === w));
  }
  assert.throws(() => renderGalaxy(80, 10, NaN), RangeError);
});
