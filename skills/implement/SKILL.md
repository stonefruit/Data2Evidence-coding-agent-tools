---
name: implement
description: Use to implement a specific subphase from a D2E implementation plan with scope discipline, testing, and review.
---

# Implement Workflow

Use when given a specific subphase from a `plan-implementation.md`.

## Workflow

1. Read the target subphase, acceptance criteria, and testing expectations.
2. Load matching skills and route through `knowledge/INDEX.md` for relevant knowledge before code search or edits.
3. Summarize approach, expected files, and risks before implementation when the change is non-trivial.
4. Prefer test-first where feasible; otherwise document why and add verification afterward.
5. Implement only the subphase. Do not fix adjacent issues unless explicitly requested.
6. Run focused tests/builds and summarize results.
7. If blocked, create a concise blocked note in the project folder using the phase-blocked template when available.
