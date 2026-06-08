# CDM Config

## Read When

- A task mentions CDM config, Clinical Data Model config, CDW config, or `HC/HPH/CDW`.
- Work touches Patient Analytics filters, cohorts, domain values, or query generation that depends on the selected data model.
- Work changes the CDM configuration UI, validation, activation, assignment, placeholder mapping, or backend config retrieval.

## Summary

The CDM config is the shared Clinical Data Model definition for D2E analytics. Admin users update it through the portal CDM configuration frontend, and backend services consume the assigned active config to decide which patient/interactions/attributes exist and how placeholders map those model concepts to physical database tables.

## Facts

- The portal CDM configuration frontend lives under `repos/Data2Evidence/plugins/ui/apps/portal/src/plugins/mri/CDM/ui5/`. It supports creating, editing, validating, saving, activating, duplicating, importing, and exporting CDM config versions.
- The CDM config service is `repos/Data2Evidence/plugins/functions/cdw-svc`. Its public CDM config route is `/hc/hph/cdw/config/services/config.xsjs`, wired in `src/main.ts`, and its facade dispatches actions such as `getAdminConfig`, `validate`, `save`, `autosave`, `activate`, `getAll`, and `getBackendConfig`.
- CDM configs are stored as config type `HC/HPH/CDW` in `repos/Data2Evidence/plugins/functions/cdw-svc/src/qe/config/config.ts`.
- A CDM config has a `patient` model and `advancedSettings`. The patient model defines basic attributes and interaction attributes; `advancedSettings.tableMapping` maps logical placeholders to physical schema/table expressions.
- `getAdminConfig` returns an unmodified/admin-oriented config for editing. `getBackendConfig` returns a reduced backend config, checks assignment unless bypassed, and defaults to the active version when no version is supplied.
- Validation combines structural CDM validation with advanced table mapping validation. Activation can validate both before saving the new active version, depending on `EnvVarUtils.isCDWValidationEnabled()`.
- Analytics uses the backend CDM config before executing Patient Analytics requests. For example, `analytics-svc/src/main.ts` calls `MriConfigConnection.getStudyConfig` with action `getBackendConfig`, then initializes `Settings` from `mriConfig.config.advancedSettings` to build the placeholder map used by analytics query processing.
- Cohort-related analytics code also consumes the CDM config. `analytics-svc/src/ifr-to-extcohort/cdmConfigUtils.ts` reads CDM config paths such as `cohortDefinitionKey`, `conceptIdentifierType`, and attribute `type` to translate Patient Analytics IFR filters into OHDSI-style cohort criteria.
- Query generation also resolves study MRI/CDM config through `MriConfigConnection`; see `repos/Data2Evidence/plugins/functions/query-gen-svc/src/proxy/ConfigSvcProxy.ts`.

## Evidence

- Source commit: `repos/Data2Evidence` at `6b0dd2f6e40319c7caa3de38527b21e7beebec2a`. The app repo also had local changes to `docker-compose-local.yml` and `package-lock.json`; those files were not part of this CDM config evidence.
- Frontend CDM app: `repos/Data2Evidence/plugins/ui/apps/portal/src/plugins/mri/CDM/ui5/Component.js` and related `views/` and `lib/` files.
- CDM service route and facade wiring: `repos/Data2Evidence/plugins/functions/cdw-svc/src/main.ts`, `repos/Data2Evidence/plugins/functions/cdw-svc/src/qe/config/ConfigFacade.ts`.
- CDM config storage, formatting, save, activation, and backend retrieval: `repos/Data2Evidence/plugins/functions/cdw-svc/src/qe/config/config.ts`.
- CDM config structure used by analytics conversion: `repos/Data2Evidence/plugins/functions/analytics-svc/src/ifr-to-extcohort/types/cdmConfigTypes.ts`.
- Analytics consumers: `repos/Data2Evidence/plugins/functions/analytics-svc/src/main.ts`, `repos/Data2Evidence/plugins/functions/analytics-svc/src/api/controllers/cohort.ts`, `repos/Data2Evidence/plugins/functions/analytics-svc/src/api/controllers/values.ts`, `repos/Data2Evidence/plugins/functions/analytics-svc/src/ifr-to-extcohort/cdmConfigUtils.ts`.
- E2E coverage showing the admin CDM configuration workflow: `repos/Data2Evidence/tests/e2e/tests/17-configurations/CDM-creation.spec.ts`.

## Recheck When

- `@alp/alp-config-utils` or `MriConfigConnection` behavior changes.
- The CDM config routes, `HC/HPH/CDW` config type, or config assignment/default rules change.
- Patient Analytics, cohort generation, or query generation changes how it resolves `getBackendConfig`.
