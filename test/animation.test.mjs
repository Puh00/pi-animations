import test from 'node:test';
import assert from 'node:assert/strict';
import extension, { createAnimation, parseMode } from '../index.ts';
import { createAnimationComponent } from '../animations/player.ts';
import { visibleWidth } from '@earendil-works/pi-tui';

const theme = { fg: (_color, text) => text, getColorMode: () => 'truecolor' };

function fakeTimers(run) {
  const originalSet = globalThis.setInterval;
  const originalClear = globalThis.clearInterval;
  const timers = new Map();
  const callbacks = new Map();
  const cleared = [];
  const intervals = new Map();
  let next = 0;
  globalThis.setInterval = (callback, interval) => {
    const id = ++next;
    timers.set(id, callback);
    callbacks.set(id, callback);
    intervals.set(id, interval);
    assert.ok(interval >= 1000 / 24);
    return id;
  };
  globalThis.clearInterval = id => { cleared.push(id); timers.delete(id); };
  return Promise.resolve().then(() => run({ timers, callbacks, cleared, intervals })).finally(() => {
    globalThis.setInterval = originalSet;
    globalThis.clearInterval = originalClear;
  });
}

test('registered animation modes remain available', () => {
  assert.equal(parseMode(' AURORA '), 'aurora');
  assert.equal(parseMode('ocean'), 'ocean');
  assert.equal(parseMode('off'), 'off');
  for (const removed of ['cat', 'sail', 'orbit', 'unknown', 'constructor', 'toString', '__proto__']) assert.equal(parseMode(removed), undefined);
});

test('generic player handles frame time, resize, cache, monochrome text, and disposal', () => fakeTimers(({ timers, callbacks, cleared, intervals }) => {
  const requests = [];
  const set = process.env.NO_COLOR;
  process.env.NO_COLOR = '';
  try {
    const component = createAnimationComponent({ requestRender() {} }, theme, { renderFrame(request) {
      requests.push(request);
      return Array.from({ length: request.height }, () => Array.from({ length: request.width }, () => ({ glyph: 'x' })));
    } });
    const id = [...timers.keys()][0];
    assert.equal(component.render(40)[0], 'x'.repeat(40));
    assert.equal(component.render(40)[0], 'x'.repeat(40));
    assert.equal(requests.length, 1);
    callbacks.get(id)();
    assert.equal(component.render(24)[0], 'x'.repeat(24));
    assert.deepEqual(requests[1], { width: 24, height: 4, seconds: intervals.get(id) / 1000 });
    component.dispose();
    assert.deepEqual(cleared, [id]);
    assert.equal(timers.size, 0);
  } finally {
    if (set === undefined) delete process.env.NO_COLOR; else process.env.NO_COLOR = set;
  }
}));

test('Aurora fills the available width, caches frames, and disposes its timer', () => fakeTimers(({ timers, callbacks, cleared }) => {
  let requested = 0;
  let colorMode = 'truecolor';
  const component = createAnimation({ requestRender: () => requested++ }, { ...theme, getColorMode: () => colorMode }, 'aurora');
  const id = [...timers.keys()][0];
  for (const width of [0, 1, 3, 24, 60, 90, 120, 240, 320, 512]) {
    const lines = component.render(width);
    assert.ok(lines.length <= 10);
    assert.ok(lines.every(line => visibleWidth(line) === width), `full width ${width}`);
    if (width) assert.strictEqual(component.render(width), lines, 'repeated renders use cached lines');
  }
  const first = component.render(120);
  callbacks.get(id)();
  assert.equal(requested, 1);
  assert.notDeepEqual(component.render(120), first);
  const truecolor = component.render(120);
  colorMode = '256color';
  component.invalidate();
  const reduced = component.render(120);
  assert.notDeepEqual(reduced, truecolor, 'theme invalidation rebuilds colors');
  assert.match(reduced.join(''), /\x1b\[38;5;/);
  component.dispose(); component.dispose();
  assert.deepEqual(cleared, [id]);
  assert.equal(timers.size, 0);
  callbacks.get(id)();
  assert.equal(requested, 1);
  assert.strictEqual(component.render(120), reduced);
  assert.equal(timers.size, 0);
}));

test('Ocean player fits tiny and wide widths and advances animation time', () => fakeTimers(({ timers, callbacks }) => {
  const component = createAnimation({ requestRender() {} }, theme, 'ocean');
  const id = [...timers.keys()][0];
  for (const width of [1, 2, 3, 12, 240]) assert.ok(component.render(width).every(line => visibleWidth(line) === width));
  const first = component.render(90);
  callbacks.get(id)();
  assert.notDeepEqual(component.render(90), first);
  component.dispose();
}));

test('commands, session migration, preview, non-TUI guards, and idle cleanup', () => fakeTimers(async ({ timers, callbacks }) => {
  const handlers = {}, commands = {}, entries = [], indicators = [], notifications = [], previews = [];
  const widgets = new Map();
  extension({
    on: (name, handler) => { handlers[name] = handler; },
    registerCommand: (name, command) => { commands[name] = command; },
    appendEntry: (...args) => entries.push(args),
  });
  assert.deepEqual(Object.keys(commands), ['animation']);
  const complete = commands.animation.getArgumentCompletions;
  assert.deepEqual(complete(''), ['aurora', 'ocean', 'preview', 'off'].map(name => ({ value: name, label: name })));
  assert.deepEqual(complete('o').map(item => item.value), ['ocean', 'off']);
  assert.deepEqual(complete(' AUR').map(item => item.value), ['aurora']);
  assert.equal(complete('unknown'), null);
  assert.equal(complete('ocean preview'), null);
  const plain = value => value.replace(/\x1b\[[0-9;]*m/g, '');
  const context = (mode = 'tui', saved = []) => ({
    mode, hasUI: mode === 'tui', sessionManager: { getBranch: () => saved },
    ui: {
      setWorkingIndicator: value => indicators.push(value),
      setWidget: (key, content) => {
        widgets.get(key)?.dispose(); widgets.delete(key);
        if (content) widgets.set(key, content({ requestRender() {} }, theme));
      },
      notify: (...args) => notifications.push(args),
      custom: async factory => {
        let finished = false;
        const component = factory({ requestRender() {} }, theme, {}, () => { finished = true; });
        const rendered = component.render(90).join('');
        assert.ok(rendered.includes('Preview'));
        previews.push(rendered);
        component.handleInput('x');
        assert.ok(finished);
        component.dispose();
      },
    },
  });
  await handlers.session_start({}, context());
  assert.equal(timers.size, 0);
  await commands.animation.handler('preview', context());
  assert.match(previews.at(-1), /[▀▄█]/);
  assert.equal(timers.size, 0);
  await handlers.agent_start({}, context());
  assert.equal(widgets.size, 1);
  assert.equal(timers.size, 1);
  assert.deepEqual(indicators.at(-1), { frames: [''] });
  await commands.animation.handler('ocean', context());
  assert.deepEqual(entries.at(-1), ['nap-animation', { mode: 'ocean' }]);
  await commands.animation.handler('preview', context());
  assert.match(plain(previews.at(-1)), /▀/);
  assert.equal(timers.size, 1);
  await handlers.agent_start({}, context());
  const activeOcean = widgets.get('pi-loading-animation-scene').render(50).join('');
  assert.match(activeOcean, /▀/);
  await handlers.session_start({}, context('tui', [{ type: 'custom', customType: 'nap-animation', data: { mode: 'ocean' } }]));
  await handlers.agent_start({}, context());
  assert.equal(widgets.size, 1);
  const restoredOcean = widgets.get('pi-loading-animation-scene').render(50).join('');
  assert.equal(restoredOcean, activeOcean, 'session restoration selects Ocean instead of default Aurora');
  await commands.animation.handler('aurora', context());
  assert.equal(timers.size, 1);
  const entryCount = entries.length;
  await commands.animation.handler('cat', context());
  assert.equal(notifications.at(-1)[1], 'error');
  for (const removed of ['still', 'static']) await commands.animation.handler(removed, context());
  assert.equal(notifications.at(-1)[1], 'error');
  assert.equal(entries.length, entryCount, 'removed designs are rejected');
  await commands.animation.handler('off', context());
  await commands.animation.handler('preview', context());
  assert.match(previews.at(-1), /[▀▄█]/);
  assert.equal(timers.size, 0);
  assert.equal(widgets.size, 0);
  assert.equal(indicators.at(-1), undefined);
  for (const finish of ['agent_settled', 'session_shutdown']) {
    await commands.animation.handler('aurora', context());
    await handlers.agent_start({}, context());
    await handlers[finish]({}, context());
    assert.equal(widgets.size, 0);
    assert.equal(timers.size, 0);
  }
  for (const savedMode of ['cat', 'ocean', 'aurora-still', 'off']) {
    await handlers.session_start({}, context('tui', [{ type: 'custom', customType: 'nap-animation', data: { mode: savedMode } }]));
    await handlers.agent_start({}, context());
    assert.equal(widgets.size, savedMode === 'off' ? 0 : 1);
    assert.equal(timers.size, savedMode === 'off' ? 0 : 1);
    await handlers.agent_settled({}, context());
  }
  const previousTimers = callbacks.size;
  for (const mode of ['print', 'json', 'rpc']) {
    await handlers.session_start({}, context(mode));
    await handlers.agent_start({}, context(mode));
    await commands.animation.handler('preview', context(mode));
    await handlers.agent_settled({}, context(mode));
    await handlers.session_shutdown({}, context(mode));
  }
  assert.equal(callbacks.size, previousTimers);
  assert.equal(timers.size, 0);
}));
