---
description: Judge only — run the crucible jury (correctness, UX, security) plus the foreman once against the CURRENT repo state and print the verdict. Builds nothing. Use it as a manual regression re-check.
argument-hint: ""
disable-model-invocation: true
allowed-tools: Read, Bash, Glob, Grep, Agent
---

Run ONE jury pass against the current state — no building.

1. Require `.loop/spec.md` (criteria + Stack & Commands). If missing, tell the user
   to run `/crucible:loop-plan` first and stop.
2. Pick an iteration label `i` (read `.loop/budget.json` `current.iter`, else use
   `manual`). Run `mkdir -p .loop/screens/iter-i`.
3. Spawn the three specialists **in parallel** (one message, three Agent calls) —
   **`crucible:judge-correctness`**, **`crucible:judge-ux`**,
   **`crucible:judge-security`** — each given the acceptance criteria, the
   iteration label, and the screenshot dir. Collect their returned verdicts.
4. Invoke **`crucible:judge-foreman`** with the three verdicts inline; it writes
   `.loop/verdicts/iter-i/*.md` and `.loop/verdict.md`.
5. Print the per-criterion results and the overall verdict. Do **not** modify code.
