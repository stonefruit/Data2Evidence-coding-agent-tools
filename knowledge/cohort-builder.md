# Cohort Builders

## Read When

- Working on the main D2E cohort builder, Patient Analytics, PA-Atlas, Atlas cohort definitions, or cohort-builder code in `plugins/ui/apps/vue-mri-ui-lib`.
- Changing cohort definition import/export, concept-set resolution, cohort generation, or inclusion report behavior.
- Debugging why filter-card state, Atlas JSON, local concept sets, or generated cohort counts do not line up.

## Summary

D2E has two closely related cohort-building paths inside `plugins/ui/apps/vue-mri-ui-lib`. The main D2E cohort builder is the Patient Analytics filter-card experience, with legacy `PA` naming still visible across files and translation keys. The `query-filter` package is the Atlas-specific cohort-definition builder used for PA-Atlas/OHDSI Atlas JSON, not the default filter-card builder.

## Facts

- The main D2E cohort builder is the Patient Analytics path. `components/PatientAnalytics.vue` normally renders `components/Filters.vue`, which renders the boolean filter-card tree through `components/BoolContainer.vue`, `components/FilterCard.vue`, and constraint/advanced-time components backed by `store/modules/query.ts`.
- The Atlas-specific builder is called `query-filter` in source and PA-Atlas in product/developer docs. It lives under `plugins/ui/apps/vue-mri-ui-lib/src/query-filter` and imports/exports OHDSI Atlas cohort-definition JSON.
- PA-Atlas keeps some `PA` naming because the Atlas builder is embedded into the Patient Analytics shell and history, not because `query-filter` is the whole Patient Analytics cohort builder.
- `src/main.ts` chooses the root app by `portalAPI.isAtlas`: Atlas standalone mode mounts `RootLayout`, applies the Atlas theme, and initializes single-spa/component registries; normal D2E mode mounts `App` and the Patient Analytics flow.
- In normal Patient Analytics mode, `components/Bookmarks.vue` gates Atlas cohort-definition behavior through `panelOptions.atlasCohortDefinition`. `panelOptions.usePaAtlas` opens the embedded PA-Atlas query filter; without it, the code follows the older Atlas-lite link path.
- `components/PatientAnalytics.vue` switches between the main `Filters` builder and the Atlas `QueryFilter` builder. `toggleCohorts(..., isPaAtlas = true)` opens the right pane and sets `showQueryFilter`; otherwise Patient Analytics uses the normal filter-card builder.
- When PA-Atlas is active, `components/PatientAnalytics.vue` hosts `QueryFilterModern` through the `QueryFilter` export. It passes either an existing Atlas cohort definition or `null` for a new PA-Atlas cohort via `atlasDataForQueryFilter`.
- `query-filter/components/QueryFilterModern.vue` is the main orchestrator. It loads Atlas definitions, opens terminology selection through the `alp-terminology-open` custom event, waits for concept details before save, converts the UI model back to Atlas JSON, and dispatches Vuex actions for create/update/generate.
- `query-filter/models/QueryFilterModel.ts` contains `QueryFilterCriteriaManager`, the canonical mutable model for entry events, inclusion criteria, exit/censoring criteria, and Atlas export.
- Atlas import flows through `query-filter/utils/QueryFilterModern/loadAtlasCohortDefinition.ts` and `query-filter/utils/AtlasConverter.ts`. Import can match concept sets by stored `conceptSetId`, fall back to sanitized names, create missing local concept sets, and remap `CodesetId` references before conversion.
- Atlas export flows through `QueryFilterCriteriaManager.convertToAtlasFormat()`, `models/modules/nested-criteria-processor.ts`, `models/modules/event-transformer.ts`, and `models/modules/atlas-mappers.ts`.
- D2E WebAPI calls for the builder are centralized in `query-filter/services/D2eWebapiService.ts` and wrapped for concept-set details by `query-filter/services/ConceptSetApiService.ts`. Important endpoints include `d2e-webapi/conceptset`, `d2e-webapi/conceptset/{id}/expression`, `d2e-webapi/source/sources`, `d2e-webapi/cohortdefinition`, `d2e-webapi/cohortdefinition/{id}/info`, `d2e-webapi/cohortdefinition/{id}/generate/{datasetId}`, `d2e-webapi/notifications`, and inclusion-report endpoints under `d2e-webapi/cohortdefinition/{id}/report/{sourceKey}`.
- The legacy D2E cohort materialization path still exists nearby in `components/AddCohort.vue`, `store/modules/collections.ts`, and `store/modules/cohortDefinition.ts`. For Atlas definitions, `cohortDefinition.ts` handles create, update, get, delete, and generate calls against `d2e-webapi/cohortdefinition`.
- `query-filter/config/atlas-config.json` defines supported criteria types and attributes. Attribute IDs must stay aligned with OHDSI/circe Atlas field names; `query-filter/utils/AtlasAttributeLookup.ts` and `query-filter/utils/AtlasUtils.ts` perform field-name mapping.
- Round-trip behavior is protected by focused tests under `query-filter/__tests__`, `query-filter/utils/__tests__`, and `query-filter/components/__tests__`. Prefer adding or updating those tests when touching conversion, nested criteria, attribute mapping, or concept-set detail loading.

## Pitfalls

- Do not treat `query-filter` as the main D2E cohort builder. It is the Atlas/PA-Atlas builder; the default Patient Analytics builder is the filter-card flow.
- Preserve `0` cardinality/count values with nullish checks. `0` is valid for exclusions, so `count || 1` changes behavior; use `count ?? 1`.
- Preserve nested criteria through event transformations. Losing `nestedCriteria` silently flattens or drops correlated criteria.
- For group export, collect all nested events for a group before creating the Atlas group. Splitting one UI group into many Atlas groups changes cohort logic.
- Save/export depends on concept-set details, not just concept-set IDs. `QueryFilterModern` disables save while details load and also waits before conversion.
- In Atlas standalone mode, generation uses a selected source from `/source/sources`; in normal portal mode it uses the portal dataset ID.

## Evidence

- Verified against `repos/Data2Evidence` commit `3d65d00e750d144d5e43a40df631a7cd58f94c25`.
- The `repos/Data2Evidence` working tree had unrelated uncommitted changes under `plugins/functions/cdw-svc` and `docker-compose.yml`; cohort-builder paths inspected for this note were not listed as modified.
- Verified by querying the local code RAG index for `vue-mri-ui-lib` cohort-builder entrypoints, MRI config, QueryFilterCriteria, and cohort-definition flow, then inspecting current source files directly.
- Source files inspected include `plugins/ui/PA-ATLAS.md`, `plugins/ui/apps/vue-mri-ui-lib/src/main.ts`, `RootLayout.vue`, `components/PatientAnalytics.vue`, `components/Filters.vue`, `components/FilterCard.vue`, `components/Bookmarks.vue`, `store/modules/bookmark.ts`, `store/modules/cohortDefinition.ts`, `store/modules/query.ts`, and files under `src/query-filter`.
- Nomenclature clarified by user feedback: `query-filter` is used for the Atlas part of cohort building; the main cohort builder was historically called Patient Analytics, which explains legacy `PA` names.

## Recheck When

- `portalAPI.isAtlas`, `panelOptions.atlasCohortDefinition`, or `panelOptions.usePaAtlas` behavior changes.
- The cohort builder moves out of `vue-mri-ui-lib` or changes framework/root mounting.
- The Patient Analytics filter-card model or `store/modules/query.ts` changes shape.
- D2E WebAPI cohort-definition or concept-set endpoints change.
- Atlas JSON conversion, nested criteria, or concept-set import/export behavior changes.

## Related

- `skills/cohorts-dev/SKILL.md`
- `knowledge/cdm-config.md`
- `knowledge/single-spa.md`
