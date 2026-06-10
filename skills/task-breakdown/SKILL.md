---
name: task-breakdown
description: Use to break an approved PRD into implementation phases, subphases, dependencies, risks, and acceptance criteria.
---

# Breakdown Workflow

Use after a PRD is approved or stable enough to implement.

## Workflow

1. Read the PRD and related issue tracker.
2. Read `knowledge/INDEX.md` and load only matching knowledge docs, especially architecture, workflows, patterns, and troubleshooting.
3. Create `plan-implementation.md` in the same project folder.
4. Break work into independently testable phases and subphases.
5. Include acceptance criteria, testing approach, risk level, dependencies, and cross-service impacts.
6. Keep implementation instructions decision-complete but avoid excessive file inventories unless needed for safety.

## Review Loop

For plans with cross-service impact, risky sequencing, or unclear verification, run a bounded review loop before treating the breakdown as ready.

- The coordinator owns the canonical `plan-implementation.md` file.
- Reviewers produce notes, objections, and proposed edits; they do not directly co-edit the canonical file.
- Prefer subagents for reviewer passes when subagent tooling is available; this preserves coordinator context and gives an independent review surface.
- Codex requires the user request to explicitly mention subagents, delegation, or parallel agent work before spawning subagents. Tell users to invoke this workflow as `/task-breakdown <issue-or-project> use subagents` when they want reviewer subagents. If the request does not explicitly mention subagents, use the sequential fallback.
- Run at most two review rounds. If disagreement remains, capture it as a `Decision Needed` item with the competing options and tradeoffs.

Reviewer roles:

- Software Architect: reviews phase sequencing, dependencies, architecture fit, data and service boundaries, cross-service impacts, migration needs, and rollback concerns.
- QA/Release Reviewer: reviews acceptance criteria, testability, verification commands, fixture/data needs, rollout safety, regression risk, and release readiness.
- Product Manager: use only when the implementation plan changes product scope, user-visible behavior, or PRD intent.

After reviewer feedback, reconcile the breakdown into a decision-complete implementation plan. Preserve unresolved decisions explicitly instead of hiding uncertainty in vague tasks.
