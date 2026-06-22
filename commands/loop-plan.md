---
description: Plan only — run the crucible planner to produce .loop/spec.md (requirements, Stack & Commands, verifiable acceptance criteria) and the incremental plan, then stop for review. Builds nothing.
argument-hint: "[goal + done-criteria]"
disable-model-invocation: true
allowed-tools: Read, Bash, Agent
---

Run ONLY the planning phase of crucible.

1. Load lessons: `mkdir -p ~/.crucible && touch ~/.crucible/LESSONS.md && cat ~/.crucible/LESSONS.md`.
2. Invoke the **`crucible:planner`** subagent with the goal (`$ARGUMENTS`) and the
   lessons text. It writes `.loop/spec.md` (incl. **Stack & Commands**),
   `.loop/plan.md`, and initializes `.loop/progress.md`.
3. Print the requirements, the detected Stack & Commands, and the numbered
   acceptance criteria for review. Do **not** build or judge.
4. Tell the user they can run `/crucible:loop` for the full loop or
   `/crucible:loop-resume` to continue from this plan.
