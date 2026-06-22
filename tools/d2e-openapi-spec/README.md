# Data2Evidence OpenAPI Spec

Source-derived OpenAPI spec for Data2Evidence APIs used by the UIs and APIs exposed by the backend.

OpenAPI operations are grouped with the standard `tags` field. The generator writes one OpenAPI JSON document per service/function so each file is small enough to load comfortably in Swagger Editor.

See [OPENAPI_STYLE.md](../../docs/openapi/OPENAPI_STYLE.md) for the expected output style, including tag usage, examples, and rules for avoiding licensed terminology content in public specs.

The reviewed OpenAPI specs in this repository are correct as of Data2Evidence source commit `4d960478ee1c731ae6f72b1b2b1f7c6cc13d8042`.

## Role of This Tool

This tool is a source-derived discovery aid, not the only authority for Data2Evidence API consolidation. It helps find UI calls, backend routes, tags, and candidate examples, but spec updates still require tracing the relevant backend code and confirming the endpoint behavior from source.

Do not update OpenAPI specs opportunistically while doing unrelated work. Update specs only when explicitly asked to do a spec update.

When specs are updated, regenerate and review the OpenAPI files as one batch so the committed docs share the same source baseline. Update the commit SHA above to the Data2Evidence commit that was traced for that batch.

## Generate

```bash
cd tools/d2e-openapi-spec
npm run generate
```

By default the generator scans `../../repos/Data2Evidence`. Override that with:

```bash
D2E_APP_REPO=/path/to/Data2Evidence npm run generate
```

## Output

The generator writes `../../docs/openapi/specs/<service>.openapi.json`, standalone OpenAPI 3.1 documents split by service/function. No Data2Evidence vendor extensions are emitted; the output uses standard OpenAPI fields.

Parameter descriptions are intentionally omitted to keep the Swagger Editor view compact. Terminology and d2e-webapi operations include example query values, request bodies, and response bodies as a first pass at concrete API shapes.

Tags categorize operations:

- `service:<name>` identifies the service area.
- `ui-used` means at least one UI call uses the operation.
- `backend-implemented` means a backend route declaration was found.
- `backend-only` means a backend route exists but no current UI call was found.
- `backend-missing` means a UI call was found but backend tracing did not find a matching route.
- `handler-found` means the backend route was traced to a concrete controller/router handler.
- `handler-unresolved` means the route is known from UI or route metadata, but a concrete backend handler was not found.
- `ui:<app>` identifies UI apps that call the operation.
- `backend:<function>` identifies the Trex function where the backend route was found.

The generator is intentionally conservative. When a URL has runtime-only pieces, it keeps the endpoint and marks dynamic pieces as path or query parameters where possible.

## Extraction Sources

The backend does not expose routes in only one style, so the generator combines several source-derived methods:

- UI Axios/fetch calls and local `request({ ... })` / `client({ ... })` wrappers from `plugins/ui/apps`.
- Trex function route mappings from `plugins/functions/package.json`.
- Swagger 2.0 YAML files such as `api/swagger/swagger.yaml`, used by services that register routes dynamically at startup.
- Fastify `app.register(..., { prefix })` chains, used by `d2e-webapi`.
- Express router declarations as a fallback for direct route definitions.

Swagger-derived routes are merged with generic runtime registration when both describe the same method and path. The Swagger source usually contributes descriptions and parameters, while direct route declarations prove runtime handler wiring for services such as query-gen and bookmark.

Some endpoint descriptions are enriched from traced backend behavior and durable D2E knowledge. For example, d2e-webapi dataset-scoped routes get a required `datasetid` header because the backend hook uses that header as the authoritative dataset selector, even when Atlas-compatible URLs also include `sourceKey`.

## Update Process

1. Start from a clean understanding of the Data2Evidence source commit to document.
2. Trace the backend code for the services being documented. Use the generator output as a checklist, not as proof by itself.
3. Run `npm test` and `npm run generate`.
4. Review all generated specs as a batch, including tags, examples, missing-backend markers, and licensed terminology safety.
5. Update the "correct as of" commit SHA in this README to the traced Data2Evidence commit.
6. Commit the reviewed spec batch and tool/style-guide changes together.

## Test

```bash
npm test
```

## Docker

Durable, dependency-isolated path:

```bash
docker run --rm \
  -v "$PWD/../..:/workspace" \
  -w /workspace/tools/d2e-openapi-spec \
  node:20-alpine \
  sh -lc "npm test && npm run generate"
```
