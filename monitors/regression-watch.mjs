#!/usr/bin/env node
// crucible regression monitor (wired via monitors/monitors.json).
// Background process: once a loop has recorded .loop/baseline.json, it polls for
// new commits and re-runs the recorded acceptance test command. If a build that
// was green at baseline now fails, it prints ONE line (which the monitor delivers
// to Claude as a notification). It stays silent otherwise.
//
// Monitors are shell-only and cannot run a subagent, so this covers
// command-checkable regressions; the full LLM jury re-check is /crucible:loop-judge.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const BASELINE = path.resolve(cwd, '.loop', 'baseline.json');
const POLL_MS = 60000;
let lastChecked = '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (c) => execSync(c, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const readBaseline = () => { try { return JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch { return null; } };

while (true) {
  try {
    const bl = readBaseline();
    if (bl && bl.test_command) {
      let head = '';
      try { head = git('git rev-parse HEAD'); } catch { head = ''; }
      if (head && head !== lastChecked && head !== bl.commit) {
        lastChecked = head;
        let failed = false;
        try { execSync(bl.test_command, { cwd, stdio: ['ignore', 'ignore', 'ignore'], timeout: 120000 }); }
        catch { failed = true; } // nonzero exit OR timeout (a hung test counts as a regression)
        if (failed) {
          console.log(`⚠ crucible regression: \`${bl.test_command}\` now FAILS at ${head.slice(0, 8)} (was green at ${String(bl.commit).slice(0, 8)}). Run /crucible:loop-judge for a full jury re-check.`);
        }
      }
    }
  } catch {}
  await sleep(POLL_MS);
}
