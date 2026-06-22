#!/usr/bin/env node
// crucible state utility — owns .loop/budget.json and .loop/baseline.json.
// All commands operate on ./.loop relative to the current working directory.
//
// Usage:
//   node loopctl.mjs init  --goal "..." --max 10 [--time 1800] [--bestof 1] [--approve 0]
//   node loopctl.mjs phase --phase plan|build|judge|done [--iter N]
//   node loopctl.mjs record --iter N --green G --total T
//   node loopctl.mjs check-time          # prints OK or TIMEUP (honors --time cap)
//   node loopctl.mjs status              # prints one-line summary
//   node loopctl.mjs baseline --test "npm test"   # records a regression baseline at HEAD
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const LOOP = path.resolve(process.cwd(), '.loop');
const BUDGET = path.join(LOOP, 'budget.json');
const BASELINE = path.join(LOOP, 'baseline.json');
const now = () => Math.floor(Date.now() / 1000);

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      const v = i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      o[k] = v;
    }
  }
  return o;
}
const ensureLoop = () => fs.mkdirSync(LOOP, { recursive: true });
const readBudget = () => { try { return JSON.parse(fs.readFileSync(BUDGET, 'utf8')); } catch { return null; } };
const writeBudget = (b) => { ensureLoop(); fs.writeFileSync(BUDGET, JSON.stringify(b, null, 2)); };

const cmd = process.argv[2];
const a = parseArgs(process.argv.slice(3));

if (cmd === 'init') {
  writeBudget({
    version: 1,
    goal: a.goal || '',
    max_iterations: a.max ? parseInt(a.max, 10) : 10,
    time_cap_seconds: a.time ? parseInt(a.time, 10) : null,
    bestof: a.bestof ? parseInt(a.bestof, 10) : 1,
    approve: a.approve === '1' || a.approve === 'true',
    started_at: now(),
    current: { iter: 0, phase: 'plan', green: 0, total: 0 },
    iterations: [],
  });
  console.log('initialized');
} else if (cmd === 'phase') {
  const b = readBudget() || { current: {} };
  b.current = b.current || { iter: 0, phase: 'plan', green: 0, total: 0 };
  if (a.phase) b.current.phase = a.phase;
  if (a.iter) b.current.iter = parseInt(a.iter, 10);
  writeBudget(b);
  console.log(`phase=${b.current.phase} iter=${b.current.iter}`);
} else if (cmd === 'record') {
  const b = readBudget() || { current: {}, iterations: [] };
  b.current = b.current || {};
  const iter = a.iter ? parseInt(a.iter, 10) : b.current.iter || 0;
  const green = a.green ? parseInt(a.green, 10) : 0;
  const total = a.total ? parseInt(a.total, 10) : 0;
  b.current.iter = iter; b.current.green = green; b.current.total = total;
  b.iterations = b.iterations || [];
  b.iterations.push({ iter, green, total, at: now() });
  writeBudget(b);
  console.log(`recorded iter=${iter} ${green}/${total}`);
} else if (cmd === 'check-time') {
  const b = readBudget();
  if (!b || !b.time_cap_seconds) console.log('OK');
  else console.log(now() - (b.started_at || now()) >= b.time_cap_seconds ? 'TIMEUP' : 'OK');
} else if (cmd === 'status') {
  const b = readBudget();
  if (!b) { console.log('crucible: no active loop'); }
  else {
    const c = b.current || {};
    const elapsed = now() - (b.started_at || now());
    console.log(`iter ${c.iter || 0}/${b.max_iterations} · ${c.phase || '?'} · ${c.green || 0}/${c.total || 0} ✓ · ${Math.floor(elapsed / 60)}m`);
  }
} else if (cmd === 'baseline') {
  let commit = 'unknown';
  try { commit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
  ensureLoop();
  fs.writeFileSync(BASELINE, JSON.stringify({ commit, test_command: a.test || '', at: now() }, null, 2));
  console.log(`baseline recorded @ ${commit}`);
} else {
  console.error('usage: loopctl.mjs <init|phase|record|check-time|status|baseline> [--flags]');
  process.exit(1);
}
