---
name: knowledge-curator
description: Use to curate, verify, deduplicate, and route durable D2E knowledge before it is added to or changed under knowledge/.
---

# Knowledge Curator

Use when adding or changing durable knowledge under `knowledge/`.

## Curation Criteria

- Accurate and verified against code, docs, tests, or reliable evidence.
- Reusable beyond a single task.
- Placed in the right category: architecture, patterns, troubleshooting, or workflows.
- Not duplicating existing knowledge.
- Clear enough for a future agent or teammate to apply.
- Records the source repository commit or commits the knowledge was verified against.

## Workflow

1. Read `knowledge/README.md` and search `knowledge/INDEX.md` before adding new content.
2. Prefer project notes for task-specific findings and knowledge docs for durable, verified lessons.
3. Keep knowledge files shallow by default; point to source code for deeper implementation logic.
4. Record the relevant source commit in the knowledge file's `Evidence` section.
5. Update `knowledge/INDEX.md` when adding or changing curated knowledge.
6. Keep uncertain or speculative content outside `knowledge/` until it is verified.
