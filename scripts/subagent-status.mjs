#!/usr/bin/env node
// crucible subagent status line. Wired via settings.json -> subagentStatusLine.
// Receives the visible subagent rows as JSON on stdin; prints one JSON line per
// row override: {"id","content"}. It augments each row with live loop progress
// read from ./.loop/budget.json (e.g. "builder · loop 4/10 · build · 6/9 ✓").
// Fails safe: on any uncertainty it prints nothing, leaving the default rows.
import fs from 'node:fs';
import path from 'node:path';

function readStdin() { try { return fs.readFileSync(0, 'utf8'); } catch { return ''; } }

let input;
try { input = JSON.parse(readStdin()); } catch { process.exit(0); }

let rows = null;
if (Array.isArray(input)) rows = input;
else if (input && Array.isArray(input.subagents)) rows = input.subagents;
else if (input && Array.isArray(input.rows)) rows = input.rows;
else if (input && Array.isArray(input.agents)) rows = input.agents;
if (!rows || rows.length === 0) process.exit(0);

let suffix = '';
try {
  const b = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), '.loop', 'budget.json'), 'utf8'));
  const c = b.current || {};
  suffix = ` · loop ${c.iter || 0}/${b.max_iterations} · ${c.phase || '?'} · ${c.green || 0}/${c.total || 0} ✓`;
} catch { process.exit(0); } // no active loop -> leave defaults

const base = (r) => r.content ?? r.text ?? r.label ?? r.title ?? r.name ?? r.agent_type ?? '';
for (const r of rows) {
  const id = r.id ?? r.task_id ?? r.taskId;
  if (id == null) continue;
  console.log(JSON.stringify({ id: String(id), content: `${base(r)}${suffix}` }));
}
