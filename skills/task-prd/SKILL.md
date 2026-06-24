---
name: task-prd
description: Use to create a product requirements document for larger D2E work needing product, technical, and architecture alignment.
---

# PRD Workflow

Use for multi-file features, ambiguous requirements, or work needing product/architecture alignment.

## Workflow

1. Create or choose a project folder under `${D2E_DOCS_REPO:-repos/docs}/projects`.
2. Create an issue tracker from `${D2E_DOCS_REPO:-repos/docs}/templates/issue-tracker.md` when available.
3. Gather product context, existing patterns, architecture notes, and known pitfalls by routing through `knowledge/INDEX.md`.
4. Draft `<issue-number>-prd.md` using the PRD template when available.
5. Include overview, user stories, requirements, success criteria, out of scope, open questions, and technical notes.
6. Keep absolute paths out of the PRD; use workspace-relative paths such as `repos/Data2Evidence` and `repos/docs`.

## Scope Guardrails

- This skill is documentation-only.
- Do not implement or modify application code, tests, configs, or runtime behavior when running this skill.
- The output should be PRD artifacts only (for example: project folder, issue tracker, and `<issue-number>-prd.md`).

## Review Loop

For PRDs with meaningful product or architecture uncertainty, run a bounded review loop before treating the PRD as ready.

- The coordinator owns the canonical PRD markdown file.
- Reviewers produce notes, objections, and proposed edits; they do not directly co-edit the canonical file.
- Prefer subagents for reviewer passes when subagent tooling is available; this preserves coordinator context and gives an independent review surface.
- Codex requires the user request to explicitly mention subagents, delegation, or parallel agent work before spawning subagents. Tell users to invoke this workflow as `/task-prd <issue-or-project> use subagents` when they want reviewer subagents. If the request does not explicitly mention subagents, use the sequential fallback.
- Run at most two review rounds. If disagreement remains, capture it as a `Decision Needed` item with the competing options and tradeoffs.

Reviewer roles:

- Product Manager: reviews user value, target users, scope, requirements, success criteria, non-goals, and ambiguous product decisions.
- Software Architect: reviews feasibility, architecture fit, integration points, data and service boundaries, operational risks, migration needs, and rollback concerns.

After reviewer feedback, reconcile the PRD into a compromise draft. Preserve unresolved questions explicitly instead of smoothing over uncertainty.
