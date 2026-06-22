---
description: Resume an in-progress crucible — read existing .loop/ state and continue the build→judge loop where it left off, without re-planning.
argument-hint: "[max=N] [time=30m] [bestof=N]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion
---

Continue an existing loop — do **not** re-plan.

1. Require `.loop/spec.md` and `.loop/progress.md`. If absent, tell the user to start
   with `/crucible:loop` and stop.
2. Read `.loop/budget.json` for the prior `max`, `bestof`, `time_cap`, and
   `current.iter`. `$ARGUMENTS` may override `max=` / `time=` / `bestof=` — apply
   those overrides in your loop logic (do **not** re-run `loopctl init`, which would
   reset history). Re-detect git mode as in `/crucible:loop` Step 0/1.
3. Re-enter the iteration loop exactly as **`/crucible:loop` Step 2 onward**
   (builder → jury → foreman → checkpoint → all-PASS re-check → stall guard/escalation),
   starting from the next iteration after `current.iter`, using the existing
   spec/plan/progress and the latest `.loop/verdict.md` as the builder's input.
4. Stop and report per **`/crucible:loop` Steps 3–4** (including the HTML report
   via `node "${CLAUDE_PLUGIN_ROOT}/scripts/report.mjs"`).
