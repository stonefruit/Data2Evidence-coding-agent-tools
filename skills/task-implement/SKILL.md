---
name: task-implement
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
6. If implementation reveals the subphase is incorrectly scoped, stop and update the plan or blocked note instead of silently expanding the change.
7. Run focused tests/builds and summarize results.
8. If blocked, create a concise blocked note in the project folder using the phase-blocked template when available.

## Delegation and Review

The coordinator owns the target subphase, final working tree, and final summary.

Prefer subagents when available and useful for bounded work, especially to preserve coordinator context during exploration and review. Codex requires the user request to explicitly mention subagents, delegation, or parallel agent work before spawning subagents. Tell users to invoke this workflow as `/task-implement <subphase> use subagents` when they want explorer, worker, or reviewer subagents. If the request does not explicitly mention subagents, use the sequential fallback:

- Explorer: answer a specific codebase question before implementation, such as where behavior lives or which existing pattern to follow.
- Worker: implement a clearly isolated slice only when file or module ownership is disjoint from the coordinator and other workers.
- Reviewer/Verifier: after implementation, review the diff against the target subphase, acceptance criteria, test expectations, scope discipline, and rollback risk.

Workers and reviewers must not broaden the subphase or fix adjacent issues unless explicitly asked. If subagent findings conflict, the coordinator decides or records a concise blocked note with the unresolved decision.

Before finalizing, run focused tests/builds where practical and summarize changed files, verification performed, acceptance criteria covered, and risks or follow-up decisions.
