---
name: cohorts-dev
description: Use for D2E Cohorts, Patient Analytics, vue-mri, or MRI UI5 changes, including build, hot deploy, and verification workflow.
---

# Cohorts And Patient Analytics Development

Use for Cohorts, Patient Analytics, vue-mri, and MRI UI5 plugin work.

## Defaults

- App repo: `${D2E_APP_REPO:-repos/Data2Evidence}`
- Source area: `repos/Data2Evidence/plugins/ui/apps/vue-mri-ui-lib/src`
- NX project: `vue-mri`
- Resource dir: `mri`

## Workflow

1. Reproduce bugs before editing when possible.
2. Use `data2evidence-code-rag` before locating Data2Evidence implementation details.
3. Build vue-mri with `scripts/d2e-ui-hot-deploy.sh vue-mri` when deploying to a running trex container.
4. For portal MRI UI5 plugin changes, also build/deploy the relevant MRI UI5 resources if the changed code is served from `mri-ui5`.
5. Hard-refresh the browser and verify the scenario.

## Known QA Guardrails

- Cohort chart single-click usually shows tooltip; drag-select plus drilldown is the filtering path.
- Age chips inside one attribute use OR logic.
- Atlas iframe behavior differs from the D2E Vue cohort builder.
