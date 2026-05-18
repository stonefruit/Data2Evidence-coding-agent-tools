---
name: quickfix
description: Use for targeted D2E fixes with small scope, reproduce-first behavior for bugs, minimal edits, and focused verification.
---

# Quickfix Workflow

Use for one small bug fix or obvious change. If the task spans multiple subsystems, touches more than a few files, or needs product/architecture decisions, switch to `smallfeature` or `prd`.

## Workflow

1. Identify the affected subsystem and load any matching skill first. For Data2Evidence code search, use `data2evidence-code-rag` before plain text search.
2. For bug fixes, reproduce the current behavior before editing when a local runtime or browser path is available.
3. Read the target files and nearby patterns before changing anything.
4. Make the minimal fix only; record adjacent issues instead of expanding scope.
5. Build or test the affected area. For UI hot deploys, prefer `scripts/d2e-ui-hot-deploy.sh <nx-project> [resource-dir]`.
6. Verify the original issue is resolved and report any tests not run.

## Defaults

- App repo: `${D2E_APP_REPO:-repos/Data2Evidence}`
- Docs repo: `${D2E_DOCS_REPO:-repos/docs}`
- Branch from `develop` for Data2Evidence app work unless the user says otherwise.
- Do not edit `human-notes.md`; write brief companion notes to `human-notes-responses.md` if needed.
