#!/usr/bin/env node
// crucible checkpoint hook (PostToolUse on Write|Edit).
// When .loop/verdict.md is written with an all-PASS overall verdict, create a
// restorable git checkpoint: commit the working tree and tag it loop-iter-<N>.
// Idempotent (skips if the tag already exists) and a no-op outside a git repo.
// Non-blocking: always exits 0; notes go to stderr (never stdout).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function readStdin() { try { return fs.readFileSync(0, 'utf8'); } catch { return ''; } }
let input = {};
try { input = JSON.parse(readStdin()); } catch {}

const fp = String(input?.tool_input?.file_path || '').replace(/\\/g, '/');
if (!/(^|\/)\.loop\/verdict\.md$/i.test(fp)) process.exit(0); // only the loop's own verdict

const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const git = (c) => execSync(c, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

let verdict = '';
try { verdict = fs.readFileSync(path.resolve(cwd, '.loop', 'verdict.md'), 'utf8'); } catch { process.exit(0); }
if (!/Overall verdict:\s*PASS\b/i.test(verdict)) process.exit(0);

try { git('git rev-parse --is-inside-work-tree'); } catch { process.exit(0); } // not a git repo

let iter = 0;
try { iter = JSON.parse(fs.readFileSync(path.resolve(cwd, '.loop', 'budget.json'), 'utf8'))?.current?.iter || 0; } catch {}
if (!iter) {
  try { iter = git('git tag -l "loop-iter-*"').split('\n').filter(Boolean).length + 1; } catch { iter = 1; }
}
const tag = `loop-iter-${iter}`;

try { git(`git rev-parse -q --verify refs/tags/${tag}`); process.exit(0); } catch {} // tag exists -> done

try {
  git('git add -A');
  // never bake loop scratch/worktrees into the checkpoint (embedded-repo gitlinks,
  // base64 screenshots, churning state). Belt-and-suspenders with the .gitignore the
  // orchestrator writes at setup.
  try { git('git reset -q -- .loop/work .loop/screens'); } catch {}
  try { git(`git commit -m "crucible: checkpoint ${tag} (all-PASS verdict)"`); }
  catch { git(`git commit --allow-empty -m "crucible: checkpoint ${tag} (all-PASS verdict, no changes)"`); }
  git(`git tag ${tag}`);
  console.error(`crucible: created checkpoint ${tag}`);
} catch (e) {
  console.error(`crucible: checkpoint skipped (${String(e).split('\n')[0]})`);
}
process.exit(0);
