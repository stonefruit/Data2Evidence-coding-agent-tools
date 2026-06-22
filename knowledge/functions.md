# Functions Layer

## Read When

- The task touches `repos/Data2Evidence/plugins/functions`.
- You need to map an incoming backend URL to a function folder, environment key, or import map.
- You are debugging function-side behavior in analytics, CDW config/services, dataset lifecycle, terminology, job plugins, MCP, file manager, or similar backend plugin functions.
- A change depends on database credential shape, dialect casing, inter-function calls, or health/readiness behavior.

## Summary

D2E backend functions are grouped under `plugins/functions` in the app repository. The route map in `plugins/functions/package.json` is the first source to inspect: each API route entry maps a public `source` path to a function folder, `deno.json` imports, and an environment section.

Keep this file as an orientation map. For implementation details, inspect the referenced source files directly because function internals change more often than this knowledge layer should.

## Facts

- Function registrations live in `repos/Data2Evidence/plugins/functions/package.json` under `trex.functions.api` and `trex.functions.init`.
- Most function folders have an `index.ts` bootstrap and a `deno.json`; many larger services put their Express app setup under `src/main.ts`.
- `analytics-svc` handles much of the Patient Analytics and cohort-facing backend. Start with `analytics-svc/index.ts`, `analytics-svc/src/main.ts`, `analytics-svc/api/swagger/swagger.yaml`, and `analytics-svc/src/api/controllers/index.ts`.
- Current `analytics-svc` controller modules include `cohort`, `cohortCompare`, `cohortSurvival`, `concept`, `customDBs`, `dataCharacterization`, `datasetFilter`, `dbsvc`, `parquet`, `patient`, `population`, and `values`.
- `analytics-svc/src/main.ts` registers health checks, credentials/study metadata middleware, database connection handling, legacy Patient Analytics actions, and Swagger-driven controller routes.
- `cdw-svc` serves CDW config and services routes. Useful entry points include `cdw-svc/index.ts`, `cdw-svc/src/main.ts`, `cdw-svc/src/qe/settings/SettingsFacade.ts`, `cdw-svc/src/cfg-utils/ConfigFacade.ts`, `cdw-svc/src/qe/config/ConfigFacade.ts`, and `cdw-svc/src/qe/config/CDWServicesFacade.ts`.
- `dataset/index.ts` owns dataset lifecycle routes such as `/cdm-schema/snapshot/metadata`, `/cohorts`, dataset creation at `/`, dataset CRUD under `/:datasetId`, schema generation, dashboard code, and related dataset operations. Its external API clients live in `dataset/api/`.
- Dataset schema casing is dialect-sensitive: HANA schema names are uppercased, while Postgres and default handling lowercases schema names. Recheck `dataset/index.ts` and `dataset/GenerateDatasetSchema.ts` before changing dataset schema behavior.
- Inter-function calls commonly use `Trex.tokioChannel(...)`; examples include dataset calls to `d2e-functions/analytics-svc`, `d2e-functions/portal`, `d2e-functions/jobplugins`, and `fhir/fhir-gateway`.
- Database credentials are assembled from runtime database manager data and service env conversion code. Important credential paths include `analytics-svc/index.ts`, `cdw-svc/index.ts`, and each service's env converter utilities.
- Pooling-related env vars such as `PG__MAX_POOL`, `PG__MIN_POOL`, and `PG__IDLE_TIMEOUT_IN_MS` are defined in function env config and used by services such as `cdw-svc`.
- Keep health and readiness endpoints lightweight. Common paths include `/check-liveness` and `/check-readiness`, but exact use varies by service.

## Pitfalls

- Do not assume the old `repos/Data2Evidence/functions` path; current app functions live under `repos/Data2Evidence/plugins/functions`.
- Do not start from broad repository searches when routing a request. Start with `plugins/functions/package.json`, then inspect the mapped function folder.
- Do not assume one service owns every route with a similar prefix. For example, several `/analytics-svc/...` route prefixes map to different functions such as `analytics-svc`, `query-gen-svc`, `bookmark-svc`, and `mri-pa-config`.
- Treat dialect handling as high-risk. HANA, Postgres, BigQuery, direct connections, and generated schemas may take different paths.
- Avoid logging raw credentials, tokens, PHI, SQL parameter values, request bodies, or full service responses while debugging function behavior.

## Evidence

- Verified against `repos/Data2Evidence` commit `4d960478ee1c731ae6f72b1b2b1f7c6cc13d8042`.
- The app checkout had unrelated untracked files during verification; checked paths were read from tracked source files.
- Verified by inspecting `plugins/functions/package.json`, `plugins/functions/analytics-svc/index.ts`, `plugins/functions/analytics-svc/src/main.ts`, `plugins/functions/analytics-svc/src/api/controllers/index.ts`, `plugins/functions/cdw-svc/src/main.ts`, `plugins/functions/cdw-svc/src/configs.ts`, `plugins/functions/dataset/index.ts`, and `plugins/functions/dataset/api/`.

## Recheck When

- `plugins/functions/package.json` changes route mappings, function names, env keys, or init entries.
- A task depends on exact middleware order, auth behavior, database credential conversion, or dialect-specific SQL/schema behavior.
- A function moves, splits, or replaces Express/Swagger routing with another pattern.

## Related

- `skills/dev-functions/SKILL.md`
