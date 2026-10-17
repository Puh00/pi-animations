import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAurora } from '../animations/aurora.ts';
import fs from 'node:fs';
const fixtures = JSON.parse(fs.readFileSync(new URL('../testdata/aurora-reference.json', import.meta.url), 'utf8'));

test('Aurora renderer is deterministic, sized, colored, and changes by tick', () => {
  for (const [w, h] of [[4, 3], [40, 8], [60, 10], [240, 10], [512, 10]]) {
    const a = renderAurora(w, h, 0, 7n), b = renderAurora(w, h, 0, 7n);
    assert.deepEqual(a, b);
    assert.equal(a.length, h);
    assert.ok(a.every(row => row.length === w));
    assert.ok(a.flat().some(cell => cell.fg));
    assert.notDeepEqual(a, renderAurora(w, h, 30, 7n));
    assert.ok(a.flat().filter(c => c.fg).every(c => c.fg.every(n => Number.isInteger(n) && n >= 0 && n <= 255)));
  }
  assert.equal(fixtures.length, 27);
  assert.deepEqual(fixtures.map(({ w, h, seed, tick }) => [w, h, seed, tick]),
    [[4,3],[40,8],[60,10]].flatMap(([w,h]) => [1,7,42].flatMap(seed => [0,30,90].map(tick => [w,h,seed,tick]))));
  for (const expected of fixtures) {
    const actual = renderAurora(expected.w, expected.h, expected.tick / 24, BigInt(expected.seed));
    for (let y = 0; y < expected.h; y++) for (let x = 0; x < expected.w; x++) {
      const got = actual[y][x], want = expected.rows[y][x];
      assert.equal(got.glyph, want.glyph, `${expected.w}x${expected.h} seed=${expected.seed} tick=${expected.tick} cell=${x},${y}`);
      for (const key of ['fg', 'bg']) assert.deepEqual(got[key] ?? null, want[key] ?? null, `${key} ${expected.w}x${expected.h} seed=${expected.seed} tick=${expected.tick} cell=${x},${y}`);
    }
  }
  assert.deepEqual(renderAurora(4, 3, 0, 1n, { stars: false }), renderAurora(4, 3, 0, 1n, { stars: false }));
});
