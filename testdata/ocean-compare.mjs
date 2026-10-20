import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { renderOcean as improved } from '../animations/ocean.ts';
import { renderAurora } from '../animations/aurora.ts';
import ts from 'typescript';

const priorSource = execFileSync('git', ['show', 'd097ac3:animations/ocean.ts'], { encoding: 'utf8' });
const priorCompiled = ts.transpileModule(priorSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const prior = new Function(`${priorCompiled.replace(/^export /gm, '')}; return renderOcean;`)();
const upstream = JSON.parse(fs.readFileSync(new URL('./ocean-reference.json', import.meta.url), 'utf8'));
const times = [0, .5, 1.25, 3, 58.4];
const cases = [];
function upstreamFixture(width, height, seconds) {
  const item = upstream.cases.find(c => c.width === width && c.height === height && c.seconds === seconds);
  if (!item) return null;
  return item.rows.map(row => [...row.glyphs].map((glyph, x) => ({ glyph, fg: row.fg[x], bg: row.bg[x] })));
}
function original(width, height, seconds) {
  const fixture = upstreamFixture(width, height, seconds);
  if (fixture) return fixture;
  const h = height * 2, pixels = Array.from({ length: h }, () => Array.from({ length: width }, () => ({ brightness: 0, color: [255,255,255] })));
  for (let x = 0; x < width; x++) {
    const fx=x/width;
    const surface=h*.35+Math.sin(fx*6+seconds*1.5)*h*.08+Math.sin(fx*12+seconds*2.5)*h*.04+Math.sin(fx*3+seconds*.8)*h*.12+Math.sin(fx*18+seconds*3.5)*h*.02;
    for(let y=0;y<h;y++){
      const depth=y-surface;
      if(depth < -2) continue;
      if(depth < 0){const foam=Math.max(0,Math.min(1,Math.sin(fx*20+seconds*3)*.5+.5));pixels[y][x]={brightness:.7+foam*.3,color:[220,240,255]};}
      else {const ratio=Math.max(0,Math.min(1,depth/(h*.65)));const underwater=Math.sin(fx*8+y*.05+seconds*1.2)*.1;pixels[y][x]={brightness:Math.max(.1,Math.min(.7,.6-ratio*.45+underwater)),color:[Math.trunc(20+30*(1-ratio)),Math.trunc(80+80*(1-ratio)+underwater*30),Math.trunc(150+105*(1-ratio*.5))]};}
    }
  }
  const scale=(c,b)=>Math.trunc(c*Math.max(0,Math.min(1,b)));
  return Array.from({length:height},(_,row)=>Array.from({length:width},(_,x)=>{const a=pixels[row*2][x],b=pixels[row*2+1][x],ad=a.brightness<.02,bd=b.brightness<.02;return {glyph:ad&&bd?' ':'▀',fg:ad&&bd?null:a.color.map(c=>scale(c,a.brightness)),bg:ad&&bd?null:b.color.map(c=>scale(c,b.brightness))};}));
}
for (const height of [5,6]) for (const seconds of times) {
  const width=80;
  cases.push({height,seconds,frames:[original(width,height,seconds),prior(width,height,seconds),improved(width,height,seconds),renderAurora(width,height,seconds)]});
}
const content=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ocean shading comparison</title><style>
:root{color-scheme:dark;background:#10131b;color:#d7dde8;font:16px/1.5 system-ui}*{box-sizing:border-box}body{margin:0}main{max-width:1500px;padding:32px;margin:auto}h1{font-size:clamp(28px,4vw,42px);margin:0 0 8px}p{color:#abb6c8;max-width:80ch}.controls{display:flex;gap:18px;flex-wrap:wrap;padding:16px 0}select{background:#202a38;color:#e7ecf2;padding:8px;border:1px solid #465468;border-radius:6px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.panel{min-width:0;border:1px solid #344454;border-radius:8px;overflow:auto;padding:12px;background:#0b0e14}h2{font-size:16px;margin:8px 0 14px}.panel h3{font-size:14px;color:#93d5d3;margin:0 0 10px}pre{font:16px/1 monospace;white-space:pre;width:max-content;margin:0}span{display:inline-block;width:10px;height:20px;text-align:center;font-size:16px}#meta{color:#8493a8;font:12px monospace;margin-bottom:8px}@media(min-width:1050px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}span{width:9px;height:18px;font-size:14px}}
</style></head><body><main><div id="meta">PI ANIMATIONS / RENDERER COMPARISON</div><h1>Ocean shading, four renderers</h1><p>Frames share width, height, and timestamp. The first panel uses the checked-in pinned upstream fixture where available and an independent translation of upstream Ocean equations at other timestamps. The other panels show the port before this change, the improved renderer, and Aurora.</p><div class="controls"><label>Height <select id="height"><option>5</option><option selected>6</option></select> rows</label><label>Time <select id="time"><option>0</option><option>0.5</option><option>1.25</option><option>3</option><option>58.4</option></select> seconds</label></div><h2 id="caption"></h2><div id="frames" class="grid"></div></main><script>
const cases=${JSON.stringify(cases)};const labels=['Pinned upstream termflix','Prior compact port','Improved compact port','Aurora'];const root=document.querySelector('#frames');function render(){const height=+document.querySelector('#height').value,seconds=+document.querySelector('#time').value;const item=cases.find(c=>c.height===height&&c.seconds===seconds);document.querySelector('#caption').textContent='80 columns × '+height+' rows · t = '+seconds+'s';root.replaceChildren(...item.frames.map((frame,i)=>{const panel=document.createElement('article');panel.className='panel';const title=document.createElement('h3');title.textContent=labels[i];const pre=document.createElement('pre');pre.innerHTML=frame.map(row=>row.map(cell=>{const span=document.createElement('span');span.textContent=cell.glyph===' '?' ':cell.glyph;if(cell.fg)span.style.color='rgb('+cell.fg.join(',')+')';if(cell.bg)span.style.backgroundColor='rgb('+cell.bg.join(',')+')';return span.outerHTML}).join('')).join('\\n');panel.append(title,pre);return panel}))}document.querySelectorAll('select').forEach(e=>e.addEventListener('change',render));render();</script></body></html>`;
fs.mkdirSync(new URL('../.lavish/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../.lavish/ocean-comparison.html',import.meta.url),content);fs.writeFileSync(new URL('../.lavish/ocean-comparison-frames.json',import.meta.url),JSON.stringify(cases));
