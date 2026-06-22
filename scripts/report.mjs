#!/usr/bin/env node
// crucible HTML report generator. Reads ./.loop state and writes a single,
// self-contained ./.loop/report.html (inline CSS, base64-embedded screenshots):
// an iteration timeline, the acceptance-criteria table, UI thumbnails per
// iteration, and the recorded failed approaches. Best-effort: missing inputs
// just omit their section.
import fs from 'node:fs';
import path from 'node:path';

const LOOP = path.resolve(process.cwd(), '.loop');
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const readJSON = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const budget = readJSON(path.join(LOOP, 'budget.json')) || {};
const verdict = read(path.join(LOOP, 'verdict.md'));
const progress = read(path.join(LOOP, 'progress.md'));

const iters = budget.iterations || [];

const crits = [];
const critRe = /^\s*\d+\.\s*(.+?)\s*[—-]\s*(PASS|FAIL)\b/gim;
let m;
while ((m = critRe.exec(verdict))) crits.push({ text: m[1], status: m[2].toUpperCase() });

let failed = '';
const fm = progress.match(/##\s*Failed approaches[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
if (fm) failed = fm[1].trim();

function collectScreens() {
  const out = [];
  const dir = path.join(LOOP, 'screens');
  const ord = (d) => { const n = parseInt(d.slice(5), 10); return isNaN(n) ? Infinity : n; };
  let iterDirs = [];
  try { iterDirs = fs.readdirSync(dir).filter((d) => /^iter-(\d+|manual)$/.test(d)).sort((a, b) => ord(a) - ord(b)); } catch { return out; }
  for (const d of iterDirs) {
    const imgs = [];
    let pngs = [];
    try { pngs = fs.readdirSync(path.join(dir, d)).filter((f) => /\.(png|jpe?g)$/i.test(f)); } catch {}
    for (const f of pngs) {
      try {
        const b64 = fs.readFileSync(path.join(dir, d, f)).toString('base64');
        const mime = /\.png$/i.test(f) ? 'image/png' : 'image/jpeg';
        imgs.push({ name: f, src: `data:${mime};base64,${b64}` });
      } catch {}
    }
    if (imgs.length) out.push({ iter: d, imgs });
  }
  return out;
}
const screens = collectScreens();

const elapsedMin = budget.started_at ? Math.round((Math.floor(Date.now() / 1000) - budget.started_at) / 60) : null;
const green = crits.filter((c) => c.status === 'PASS').length;

const timelineRows = iters.map((it) => {
  const g = Math.max(0, it.green || 0);
  const t = Math.max(0, it.total || 0);
  return `<tr><td>${it.iter}</td><td>${g}/${t}</td><td>${'█'.repeat(g)}${'░'.repeat(Math.max(0, t - g))}</td></tr>`;
}).join('');
const critRows = crits.map((c) => `<tr><td>${esc(c.text)}</td><td class="${c.status === 'PASS' ? 'pass' : 'fail'}">${c.status}</td></tr>`).join('');
const screenBlocks = screens.map((s) => `<section class="iter"><h3>${esc(s.iter)}</h3><div class="thumbs">${s.imgs.map((i) => `<figure><img src="${i.src}" alt="${esc(i.name)}"><figcaption>${esc(i.name)}</figcaption></figure>`).join('')}</div></section>`).join('');

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Crucible report</title>
<style>
:root{color-scheme:light dark}
body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:2rem;max-width:1000px;margin-inline:auto;background:#0b0d12;color:#e6e9ef}
h1{font-size:1.6rem;margin:0 0 .25rem} .sub{color:#8b93a7;margin:0 0 1.5rem}
h2{font-size:1.1rem;margin:2rem 0 .5rem;border-bottom:1px solid #232838;padding-bottom:.3rem}
table{border-collapse:collapse;width:100%;margin:.5rem 0} td,th{padding:.4rem .6rem;border-bottom:1px solid #1c2130;text-align:left;vertical-align:top}
.pass{color:#3fb950;font-weight:600} .fail{color:#f85149;font-weight:600}
.bars{font-family:ui-monospace,monospace;color:#3fb950;letter-spacing:-1px}
.cards{display:flex;gap:1rem;flex-wrap:wrap;margin:.5rem 0}
.card{background:#11141c;border:1px solid #232838;border-radius:10px;padding:.8rem 1.1rem;min-width:120px}
.card b{display:block;font-size:1.5rem} .card span{color:#8b93a7;font-size:.85rem}
.thumbs{display:flex;gap:.8rem;flex-wrap:wrap} figure{margin:0;max-width:240px}
img{max-width:240px;border:1px solid #232838;border-radius:8px;display:block} figcaption{color:#8b93a7;font-size:.8rem;margin-top:.3rem;word-break:break-all}
pre{white-space:pre-wrap;background:#11141c;border:1px solid #232838;border-radius:8px;padding:1rem;color:#cdd3e0}
</style></head><body>
<h1>Crucible report</h1>
<p class="sub">${esc(budget.goal || 'autonomous plan → build → judge loop')}</p>
<div class="cards">
  <div class="card"><b>${iters.length}</b><span>iterations</span></div>
  <div class="card"><b>${green}/${crits.length || (budget.current?.total ?? 0)}</b><span>criteria green</span></div>
  <div class="card"><b>${budget.bestof || 1}×</b><span>builders / step</span></div>
  ${elapsedMin != null ? `<div class="card"><b>${elapsedMin}m</b><span>elapsed</span></div>` : ''}
</div>
${iters.length ? `<h2>Iteration timeline</h2><table><thead><tr><th>iter</th><th>green</th><th class="bars">progress</th></tr></thead><tbody>${timelineRows}</tbody></table>` : ''}
${crits.length ? `<h2>Acceptance criteria (latest verdict)</h2><table><thead><tr><th>criterion</th><th>result</th></tr></thead><tbody>${critRows}</tbody></table>` : ''}
${screenBlocks ? `<h2>UI evolution</h2>${screenBlocks}` : ''}
${failed ? `<h2>Failed approaches</h2><pre>${esc(failed)}</pre>` : ''}
</body></html>`;

fs.mkdirSync(LOOP, { recursive: true });
fs.writeFileSync(path.join(LOOP, 'report.html'), html);
console.log(path.join(LOOP, 'report.html'));
