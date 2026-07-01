---
name: dev-openapi-spec
description: Use when updating, regenerating, reviewing, or troubleshooting Data2Evidence OpenAPI specs under docs/openapi/specs and tools/d2e-openapi-spec, including source-diff review from the previous baseline, clean generation from latest origin/develop, request/response/example updates, and OpenAPI style checks.
---

# Data2Evidence OpenAPI Spec Update

## Overview

Use this workflow for deliberate OpenAPI spec updates. The specs are source-derived discovery aids, not the authority by themselves; always trace changed Data2Evidence source before accepting generated output.

Tool reference: `tools/d2e-openapi-spec/README.md`  
Style guide: `docs/openapi/OPENAPI_STYLE.md`

## Workflow

1. Read `tools/d2e-openapi-spec/README.md` and `docs/openapi/OPENAPI_STYLE.md`.
2. Fetch the current Data2Evidence `origin/develop` before selecting the source commit. If fetch is blocked by sandbox/network policy, request escalation.
3. Record the fetched `origin/develop` SHA. This is the candidate `correct as of` baseline.
4. Check for dirty local changes under `repos/Data2Evidence`. Keep them separate from the baseline unless the user explicitly wants specs for those local changes.
5. Diff from the README's previous `correct as of` SHA to fetched `origin/develop`. Review changed source files before relying on generator output.
6. Treat API-related changes broadly:
   - route declarations, controller decorators, Express/Fastify/Hono/router behavior
   - UI Axios/fetch/request/client calls
   - request DTOs, validators, body fields, query/path/header parameters
   - response shapes, status codes, fallback/error behavior, examples/descriptions
   - auth/proxy exposure, service route wiring, function package metadata
7. Trace backend code for affected services. Use generated specs as a checklist, not proof.
8. Generate from a clean archive or checkout of fetched `origin/develop`, not from a dirty app checkout.
9. Run tests, generate specs, review generated JSON, and update the README baseline only after tracing and review.

## Commands

Prefer Docker when practical, per repo policy. For a local quick path:

```bash
cd tools/d2e-openapi-spec
npm test
D2E_APP_REPO=/path/to/clean/Data2Evidence npm run generate
```

Clean archive pattern:

```bash
tmpdir=$(mktemp -d /private/tmp/d2e-openapi.XXXXXX)
git -C repos/Data2Evidence archive --format=tar --output="$tmpdir/Data2Evidence.tar" origin/develop
mkdir -p "$tmpdir/Data2Evidence"
tar -xf "$tmpdir/Data2Evidence.tar" -C "$tmpdir/Data2Evidence"
cd tools/d2e-openapi-spec
npm test
D2E_APP_REPO="$tmpdir/Data2Evidence" npm run generate
```

Container path:

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  -w /workspace/tools/d2e-openapi-spec \
  node:20-alpine \
  sh -lc "npm test && D2E_APP_REPO=/workspace/repos/Data2Evidence npm run generate"
```

## Review Checks

Run or manually confirm:

```bash
rg -n "x-d2e|SNOMED|licensed vocabulary|licensed code|licensed display|\"example\": null" docs/openapi/specs
git diff --check
```

Expected style checks:

- no `x-d2e-*` extensions in emitted specs
- no real licensed terminology examples
- no meaningless top-level `example: null`
- no external absolute URL false positives, such as build scripts fetching PyPI/CDNs, documented as D2E services
- generated specs are reviewed as one batch with the same source baseline

## Output Rules

- Keep `tools/d2e-openapi-spec/README.md` concise as tool usage/reference.
- Put durable agent workflow refinements in this skill.
- Commit reviewed spec JSON, generator/test/style-guide changes, and the README baseline together.
- Do not post investigation notes to GitHub issues or PRs unless the user explicitly asks.
