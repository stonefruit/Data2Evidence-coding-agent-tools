---
name: knowledge-expert
description: Use to review, curate, deduplicate, and approve durable D2E knowledge before it is added to repos/docs/knowledge.
---

# Knowledge Expert

Use when adding or changing durable knowledge under `${D2E_DOCS_REPO:-repos/docs}/knowledge`.

## Review Criteria

- Accurate and verified against code, docs, tests, or reliable evidence.
- Reusable beyond a single task.
- Placed in the right category: architecture, patterns, troubleshooting, or workflows.
- Not duplicating existing knowledge.
- Clear enough for a future agent or teammate to apply.

## Workflow

1. Search the existing knowledge index before adding new content.
2. Prefer project notes for task-specific findings and knowledge docs for durable lessons.
3. Update `repos/docs/knowledge/INDEX.md` when adding approved knowledge.
4. Mark uncertain content as proposed rather than validated.
