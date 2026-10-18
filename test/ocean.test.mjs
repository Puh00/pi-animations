import test from 'node:test';
import assert from 'node:assert/strict';
import { renderOcean } from '../animations/ocean.ts';
import { createAnimation } from '../index.ts';
import fs from 'node:fs';
const reference = JSON.parse(fs.readFileSync(new URL('../testdata/ocean-reference.json', import.meta.url), 'utf8'));

function decodeAnsi(lines) {
  return lines.map(line => {
    let fg, bg;
    const cells = [];
    for (const match of line.matchAll(/\x1b\[([0-9;]*)m|([\s\S])/g)) {
      if (match[2] !== undefined) {
        const cell = { glyph: match[2] };
        if (fg) cell.fg = fg;
        if (bg) cell.bg = bg;
        cells.push(cell);
        continue;
      }
      const codes = match[1].split(';').map(Number);
      for (let i = 0; i < codes.length; i++) {
        if (codes[i] === 0) { fg = undefined; bg = undefined; }
        else if (codes[i] === 39) fg = undefined;
        else if (codes[i] === 49) bg = undefined;
        else if ((codes[i] === 38 || codes[i] === 48) && codes[i + 1] === 2) {
          const color = codes.slice(i + 2, i + 5);
          if (codes[i] === 38) fg = color; else bg = color;
          i += 4;
        }
      }
    }
    return cells;
  });
}

function cellsFromReference(item) {
  return item.rows.map(row => [...row.glyphs].map((glyph, x) => {
    const cell = { glyph, mono: row.mono[x] };
    if (row.fg[x]) cell.fg = row.fg[x];
    if (row.bg[x]) cell.bg = row.bg[x];
    return cell;
  }));
}

function foamRows(frame) {
  return [...Array(frame[0].length)].map((_, x) => {
    const row = frame.findIndex(cells => [cells[x].fg, cells[x].bg].some(color => color && color.reduce((sum, value) => sum + value, 0) > 400));
    return row < 0 ? '.' : String(row);
  }).join('');
}

test('Ocean adaptation differs from the pinned upstream baseline while retaining half-block output', () => {
  assert.equal(reference.revision, 'f2f2a3abe818bc0f85986c66de5750ef13cd1e59');
  const source = reference.cases.find(item => item.width === 40 && item.height === 5 && item.seconds === .5);
  const original = cellsFromReference(source);
  const adapted = renderOcean(source.width, source.height, source.seconds);
  assert.notDeepEqual(adapted, original, 'adaptation deliberately changes upstream composition');
  const sourceCrest = foamRows(original);
  const adaptedCrest = foamRows(adapted);
  assert.notEqual(adaptedCrest, sourceCrest);
  assert.ok([...adaptedCrest].filter(row => row === '2').length > [...sourceCrest].filter(row => row === '2').length,
    'wave crest spans more columns at the upper surface');
  assert.deepEqual([adapted[2][24].bg, adapted[4][32].fg], [[5, 106, 125], [1, 20, 58]], 'cyan contour transitions to deep blue');
  assert.ok(adapted.flat().every(cell => cell.glyph.length === 1 && [cell.fg, cell.bg].every(color => !color || color.every(v => Number.isInteger(v) && v >= 0 && v <= 255))));
  for (const height of [5, 6, 10]) for (const seconds of [.5, 1.25, 3]) {
    const frame = renderOcean(80, height, seconds);
    assert.equal(frame.length, height);
    assert.ok(frame.every(row => row.length === 80));
    assert.ok(frame.flat().every(cell => cell.glyph === ' ' || cell.glyph === '▀'));
    const crest = foamRows(frame);
    assert.ok([...crest].every(row => row !== '.' && Number(row) < height), 'surface stays within the frame');
    assert.ok(new Set(crest).size > 1, `surface remains curved at ${height} rows and ${seconds}s`);
    assert.deepEqual(frame, renderOcean(80, height, seconds), 'adapted frame remains deterministic');
  }
  assert.ok(original.flat().some(cell => cell.glyph === ' '), 'upstream baseline fixture covers sky');
  assert.throws(() => renderOcean(1, 1, NaN), RangeError);
});

test('Ocean keeps sky, foam, and water visible through a long run', () => {
  for (const height of [5, 6, 10]) {
    let frameAt584;
    for (let tick = 0; tick <= 1200; tick++) {
      const seconds = tick / 10;
      const frame = renderOcean(80, height, seconds);
      assert.ok(frame[0].some(cell => cell.glyph === ' '), `sky clipped at ${height} rows and ${seconds}s`);
      assert.ok(frame.at(-1).some(cell => cell.glyph === '▀'), `water clipped at ${height} rows and ${seconds}s`);
      assert.ok(frame.flat().some(cell => [cell.fg, cell.bg].some(color => color && color.reduce((sum, value) => sum + value, 0) > 400)),
        `foam disappeared at ${height} rows and ${seconds}s`);
      if (tick === 584) frameAt584 = frame;
    }
    const crest = foamRows(frameAt584);
    assert.ok([...crest].every(row => row !== '.' && Number(row) < height), `${height}-row crest vanished at 58.4s`);
    assert.ok(new Set(crest).size > 1, `${height}-row crest flattened at 58.4s`);
  }
});

test('Pi player ANSI formatting matches the adapted Ocean frame', () => {
  const expected = renderOcean(40, 8, 0).map(row => row.map(({ glyph, fg, bg }) => {
    const cell = { glyph };
    if (fg) cell.fg = fg;
    if (bg) cell.bg = bg;
    return cell;
  }));
  const env = Object.fromEntries(['NO_COLOR', 'TERM', 'ASCIIFX_REDUCED_MOTION'].map(name => [name, process.env[name]]));
  const setInterval = globalThis.setInterval, clearInterval = globalThis.clearInterval;
  let timer;
  globalThis.setInterval = callback => { timer = callback; return 1; };
  globalThis.clearInterval = () => {};
  delete process.env.NO_COLOR;
  delete process.env.ASCIIFX_REDUCED_MOTION;
  process.env.TERM = 'xterm-256color';
  try {
    const component = createAnimation({ requestRender() {} }, { fg: (_name, text) => text, getColorMode: () => 'truecolor' }, 'ocean');
    const lines = component.render(40);
    assert.deepEqual(decodeAnsi(lines), expected);
    assert.ok(lines.some(line => /\x1b\[38;2;/.test(line) && /\x1b\[[0-9;]*48;2;/.test(line)));
    component.dispose();
    assert.equal(typeof timer, 'function');
  } finally {
    globalThis.setInterval = setInterval;
    globalThis.clearInterval = clearInterval;
    for (const [name, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("NO_COLOR keeps Ocean's monochrome half-block rendering", () => {
  const oldNoColor = process.env.NO_COLOR;
  const oldMotion = process.env.ASCIIFX_REDUCED_MOTION;
  process.env.NO_COLOR = '';
  process.env.ASCIIFX_REDUCED_MOTION = '1';
  try {
    const component = createAnimation({ requestRender() {} }, { fg: (_name, text) => text, getColorMode: () => 'truecolor' }, 'ocean');
    const text = component.render(40).join('');
    assert.match(text, /[▀▄█]/);
    assert.doesNotMatch(text, /[.:-=+*#%@]{8}/);
    component.dispose();
  } finally {
    if (oldNoColor === undefined) delete process.env.NO_COLOR; else process.env.NO_COLOR = oldNoColor;
    if (oldMotion === undefined) delete process.env.ASCIIFX_REDUCED_MOTION; else process.env.ASCIIFX_REDUCED_MOTION = oldMotion;
  }
});
