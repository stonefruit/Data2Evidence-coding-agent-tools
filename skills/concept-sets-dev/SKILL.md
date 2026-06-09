---
name: concept-sets-dev
description: Use for D2E Concept Sets UI changes, including build, hot deploy, and verification workflow.
---

# Concept Sets Development

Use for changes under the Concept Sets UI.

## Defaults

- App repo: `${D2E_APP_REPO:-repos/Data2Evidence}`
- Source area: `repos/Data2Evidence/plugins/ui/apps/concept-sets/src`
- NX project: `concept-sets`
- Resource dir: `concept-sets`

## Workflow

1. Reproduce bugs before editing when possible.
2. Use direct source inspection with `rg`, `rg --files`, and targeted file reads when locating Data2Evidence implementation details.
3. Implement narrowly in the Concept Sets app and related shared libraries only when required.
4. Build and hot deploy with `scripts/d2e-ui-hot-deploy.sh concept-sets`.
5. Verify in the browser and check console/network output for regressions.
