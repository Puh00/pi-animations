import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../animations/aurora.ts', import.meta.url), 'utf8');
const oceanSource = fs.readFileSync(new URL('../animations/ocean.ts', import.meta.url), 'utf8');
const compileRenderer = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace(/^export /gm, "").replace(/^const (?:aurora|ocean) = \{[\s\S]*?^\};?\s*$/gm, "");
const renderer = compileRenderer(source);
const oceanRenderer = compileRenderer(oceanSource);
for (const [name, code] of [['renderAurora', renderer], ['renderOcean', oceanRenderer]]) {
  const render = new Function(`${code}; return ${name};`)();
  const frame = render(12, 4, 0);
  assert.equal(frame.length, 4);
  assert.ok(frame.every(row => row.length === 12));
}
const content = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pi animations</title><style>
:root{color-scheme:dark;background:#10131b;color:#d7dde8}*{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui}main{max-width:960px;padding:40px 20px;margin:auto}h1{font-size:clamp(28px,5vw,46px);line-height:1.2}p{max-width:70ch;color:#aeb9ca}a{color:#7ee081}button{font:inherit;background:#263648;color:#e8f7a1;border:1px solid #52736f;border-radius:6px;padding:8px 18px;cursor:pointer}.terminal{min-width:0;background:#10131b;border:1px solid #344454;border-radius:10px;padding:24px 12px;margin:24px 0;overflow:auto}pre{font:clamp(8px,1.8vw,15px)/1 monospace;white-space:pre;margin:0;min-height:10em}.working{color:#7ee081;margin:12px 0;border-bottom:1px solid #344454}.prompt{font:14px monospace;color:#aeb9ca}code{overflow-wrap:anywhere}small{color:#8e9bad}button:focus-visible{outline:2px solid #7ee081}
</style></head><body><main>
<small>PI ANIMATIONS</small><h1>Aurora and Ocean</h1>
<p>Aurora's flowing curtains and Ocean's moving waves, rendered at full width. This preview uses the package renderers and colors at 15 frames per second.</p>
<label>Renderer <select id="select"><option value="renderAurora">Aurora</option><option value="renderOcean">Ocean</option></select></label><div class="terminal"><pre id="frame" aria-label="Aurora animation"></pre><div class="working">Working</div><div class="prompt">› Your message to Pi</div></div>
<button id="toggle" type="button">Pause animation</button>
<p>In Pi, use <code>/animation aurora</code> or <code>/animation ocean</code> to select a renderer, <code>/animation preview</code> to preview it, or <code>/animation off</code> to restore the normal spinner.</p>
<p>Aurora is ported from <a href="https://github.com/cyperx84/ascii-animations">cyperx84/ascii-animations</a>. Ocean is ported from <a href="https://github.com/paulrobello/termflix">paulrobello/termflix</a>. Both are MIT licensed.</p>
<small>Dark terminal styling follows Pi's widget layout. The browser preview honors reduced-motion preferences.</small>
<script type="module">
const renderAurora = (() => { ${renderer}\nreturn renderAurora; })();
const renderOcean = (() => { ${oceanRenderer}\nreturn renderOcean; })();
const el = document.querySelector('#frame');
const button = document.querySelector('#toggle');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reduced.matches, seconds = 0, columns = 52;
const measure = document.createElement('canvas').getContext('2d');
function draw() {
  const selected = document.querySelector('#select').value;
  el.setAttribute('aria-label', selected === 'renderAurora' ? 'Aurora animation' : 'Ocean animation');
  const rows = Math.max(3, Math.min(10, Math.floor(columns / 5)));
  const frame = renderers[document.querySelector('#select').value](columns, rows, seconds);
  el.replaceChildren(...frame.flatMap((row, y) => {
    const spans = row.map(cell => {
      const span = document.createElement('span'); span.textContent = cell.glyph;
      if (cell.fg) span.style.color = 'rgb(' + cell.fg.join(',') + ')';
      if (cell.bg) span.style.backgroundColor = 'rgb(' + cell.bg.join(',') + ')';
      return span;
    });
    return y < frame.length - 1 ? [...spans, document.createTextNode('\\n')] : spans;
  }));
}
function label() { button.textContent = paused ? 'Play animation' : 'Pause animation'; }
button.onclick = () => { paused = !paused; label(); };
document.querySelector('#select').onchange = draw;
const renderers = { renderAurora, renderOcean };
reduced.addEventListener('change', () => { paused = reduced.matches; label(); });
label();
new ResizeObserver(() => {
  measure.font = getComputedStyle(el).font;
  columns = Math.max(4, Math.floor(el.clientWidth / measure.measureText('M').width));
  draw();
}).observe(el);
setInterval(() => { if (!paused && !document.hidden) { seconds += 1 / 15; draw(); } }, 1000 / 15);
</script></main></body></html>`;
fs.mkdirSync(new URL('../.lavish/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../.lavish/preview.html', import.meta.url), content);
