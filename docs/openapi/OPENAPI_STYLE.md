# Data2Evidence OpenAPI Style Guide

This guide describes how generated or manually curated Data2Evidence OpenAPI files should look before they are committed to a public repository.

## File Shape

- Emit one standalone OpenAPI 3.1 JSON file per service/function under `docs/openapi/specs/<service>.openapi.json`.
- Keep files small enough to load in Swagger Editor without rendering problems.
- Use standard OpenAPI fields only. Do not emit Data2Evidence vendor extensions such as `x-d2e-*`.
- Keep `components.schemas.UnknownJson` for endpoints where the concrete contract is not yet traced.
- Keep `UnknownJson` object-shaped by default. Avoid broad primitive unions that make renderers show misleading samples such as `true`.
- Prefer conservative request/response shapes over invented schemas.

## Tags

Use standard OpenAPI `tags` to categorize operations.

Required classification tags:

- `ui-used`: operation is called by at least one Data2Evidence UI.
- `backend-implemented`: backend route declaration was found.
- `backend-only`: backend route exists but no current UI call was found.
- `backend-missing`: UI call was found but backend tracing did not find a matching route.
- `handler-found`: backend route was traced to a concrete controller/router handler.
- `handler-unresolved`: route exists in UI or metadata, but no concrete backend handler was found.

Context tags:

- `service:<name>` identifies the service/function surface.
- `ui:<app>` identifies each UI app that calls the operation.
- `backend:<function>` identifies the backend function where the route was found.

Every top-level tag should include a short description so Swagger Editor users can understand the grouping without separate docs.

## Parameters

- Include path, query, and header parameters needed to call the endpoint.
- Do not emit generated parameter descriptions. They make Swagger Editor noisy and are easy to overstate.
- Use `example` values where a parameter shape is clearer with a concrete value.
- Replace generic wrapper artifacts such as `params` with actual query parameter names when known.

Good:

```json
{
  "name": "datasetId",
  "in": "query",
  "required": false,
  "schema": { "type": "string" },
  "example": "4f05abcf-36d6-4e88-a44d-ad1ee3a0b06e"
}
```

Avoid:

```json
{
  "name": "params",
  "in": "query",
  "description": "Runtime URLSearchParams object",
  "schema": { "type": "string" }
}
```

## Examples

Examples should show representative API shapes without pretending to be exhaustive schemas.

Use examples for:

- query values that are hard to infer from the URL alone
- request bodies for POST/PUT/PATCH
- successful response body shapes
- compatibility behavior that is useful to Swagger Editor users

Do not use examples for:

- secrets, tokens, connection strings, real tenant IDs, or credentials
- real patient, study, cohort, or user data
- licensed terminology content, including real SNOMED CT codes, identifiers, and display terms
- placeholder `null` response bodies when the backend actually returns no content

For no-content responses, document the traced status code such as `204` and omit JSON content instead of emitting `example: null`.

Null values may appear inside an example only when source tracing proves the backend field is nullable and the null is meaningful API behavior.

## Licensed Terminology Content

Public OpenAPI examples must avoid distributing licensed vocabulary content. This especially applies to SNOMED CT.

Do not include real SNOMED CT values. This includes actual vocabulary ids, concept codes, concept identifiers, or display terms copied from SNOMED CT.

```json
{
  "vocabularyId": "<real licensed vocabulary>",
  "code": "<real licensed code>",
  "display": "<real licensed display term>"
}
```

Use clearly synthetic values instead:

```json
{
  "conceptId": 100001,
  "display": "Example condition",
  "domainId": "Condition",
  "vocabularyId": "EXAMPLE",
  "conceptClassId": "Example Class",
  "standardConcept": "S",
  "code": "EXAMPLE-001"
}
```

Synthetic values should be obviously fake:

- `vocabularyId`: `EXAMPLE`
- `code`: `EXAMPLE-001`, `SRC-001`, or another clearly fake value
- `display`: neutral labels such as `Example condition`
- `conceptId`: simple non-authoritative ids such as `100001`

## Descriptions

- Operation descriptions may summarize traced backend behavior.
- Keep descriptions factual and short.
- Call out placeholder or missing backend behavior when tracing proves it.
- Avoid long provenance details in the OpenAPI output itself.

Good:

```text
UI-called PA-Atlas inclusion-report endpoint. No matching d2e-webapi backend route was found in the traced source, so this is documented as UI-used and handler-unresolved.
```

## Validation Checklist

Before committing generated specs:

```bash
cd tools/d2e-openapi-spec
npm test
npm run generate
rg "x-d2e" ../../docs/openapi/specs
rg "SNOMED|licensed vocabulary|licensed code|licensed display" ../../docs/openapi/specs
rg '"example": null' ../../docs/openapi/specs
```

Expected:

- tests pass
- specs regenerate cleanly
- no `x-d2e-*` fields appear in generated specs
- no real SNOMED CT example content appears in generated specs
- no top-level OpenAPI examples are `null`; meaningful nullable fields inside example objects are allowed only when traced
