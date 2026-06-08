---
name: smallfeature
description: Use for small D2E features spanning roughly 1-3 files where scope is clear but a quick implementation plan and review are useful.
---

# Small Feature Workflow

Use when the request is clear, limited, and does not need a full PRD. If scope expands beyond roughly 1-3 files or requires architecture/product choices, move to `prd`.

## Workflow

1. Load matching skills and retrieve relevant context through `knowledge/INDEX.md` when useful.
2. State a brief approach before editing: files expected, behavior change, verification plan.
3. Implement narrowly and follow existing patterns.
4. Run focused tests/builds for the affected subsystem.
5. For UI changes, hot deploy with `scripts/d2e-ui-hot-deploy.sh <nx-project> [resource-dir]` when a running trex container should be updated.
6. Review for scope creep, missing tests, and user-visible behavior before final reporting.
