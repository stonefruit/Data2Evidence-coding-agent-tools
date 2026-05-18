---
name: breakdown
description: Use to break an approved PRD into implementation phases, subphases, dependencies, risks, and acceptance criteria.
---

# Breakdown Workflow

Use after a PRD is approved or stable enough to implement.

## Workflow

1. Read the PRD and related issue tracker.
2. Load relevant docs from `${D2E_DOCS_REPO:-repos/docs}/knowledge`, especially architecture, workflows, patterns, and troubleshooting.
3. Create `plan-implementation.md` in the same project folder.
4. Break work into independently testable phases and subphases.
5. Include acceptance criteria, testing approach, risk level, dependencies, and cross-service impacts.
6. Keep implementation instructions decision-complete but avoid excessive file inventories unless needed for safety.
