---
name: prd
description: Use to create a product requirements document for larger D2E work needing product, technical, and architecture alignment.
---

# PRD Workflow

Use for multi-file features, ambiguous requirements, or work needing product/architecture alignment.

## Workflow

1. Create or choose a project folder under `${D2E_DOCS_REPO:-repos/docs}/projects`.
2. Create an issue tracker from `${D2E_DOCS_REPO:-repos/docs}/templates/issue-tracker.md` when available.
3. Gather product context, existing patterns, architecture notes, and known pitfalls from `${D2E_DOCS_REPO:-repos/docs}/knowledge`.
4. Draft `<issue-number>-prd.md` using the PRD template when available.
5. Include overview, user stories, requirements, success criteria, out of scope, open questions, and technical notes.
6. Keep absolute paths out of the PRD; use workspace-relative paths such as `repos/Data2Evidence` and `repos/docs`.
