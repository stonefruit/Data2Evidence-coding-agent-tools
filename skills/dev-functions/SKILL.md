---
name: dev-functions
description: Use for D2E backend function development and debugging under repos/Data2Evidence/plugins/functions, including Trex-hosted Deno/Express services, function route tracing through plugins/functions/package.json, temporary diagnostic logging, restarting trex to load function changes, and reading filtered Docker logs.
---

# D2E Functions

Use this workflow for D2E function-side changes. Functions are Trex-hosted Deno services, so local verification usually needs a trex restart after code edits and focused Docker log inspection.

## Context

- App repo: `${D2E_APP_REPO:-repos/Data2Evidence}`
- Functions root: `${D2E_APP_REPO:-repos/Data2Evidence}/plugins/functions`
- Route map: `${D2E_APP_REPO:-repos/Data2Evidence}/plugins/functions/package.json` under `trex.functions.api` and `trex.functions.init`
- Durable architecture context: route through `knowledge/INDEX.md`; load `knowledge/functions.md` when function routing, service boundaries, or common function-side pitfalls matter.

## Workflow

1. Start by identifying the function boundary.
   - Map the incoming URL to `source`, `function`, `imports`, and `env` in `plugins/functions/package.json`.
   - Read the target function folder's `index.ts`, `deno.json`, and nearby `src/`, `api/`, controller, or service files.
   - Avoid broad searches through generated data folders; exclude `mcp-server/data`, `node_modules`, `.git`, and lock/build artifacts unless the task specifically needs them.

2. Reproduce or pin down the current behavior before editing when a local runtime path is available.
   - Record the request path, dataset/study identifiers, role context, and expected vs actual behavior.
   - Prefer a minimal request or browser action that can be repeated after restart.

3. Add temporary diagnostics at the places of interest.
   - Use a unique prefix such as `[codex-debug analytics-cohort]` so logs can be filtered cheaply.
   - Log function entry, normalized inputs, key branch decisions, outgoing Trex channel or database calls, result counts, timings, caught errors, and return summaries.
   - Prefer IDs, booleans, counts, lengths, enum values, status codes, elapsed milliseconds, and sanitized shapes over whole objects.
   - Never log PHI, tokens, cookies, secrets, raw credentials, `.env` values, full SQL with sensitive parameters, or full request/response bodies.
   - Keep temporary logs grouped and easy to remove, or put longer-lived diagnostics behind an existing debug flag.

4. Restart trex after function code changes.
   - Use the `d2e-trex` container for local D2E function debugging unless the user explicitly names another stack.
   - Prefer the local stack's documented restart command when known; otherwise restart the trex container directly.
   - After restart, confirm the new code loaded by checking boot/plugin/function logs before retesting.

5. Read logs with filters only.
   - Do not read unbounded Docker logs. Use `--since` or `--tail`, then filter for the debug prefix plus relevant errors.
   - Good pattern: `docker logs d2e-trex 2>&1 | rg "codex-debug|ERROR|WARN|<route-or-function>"`
   - If the output is still large, tighten the prefix, time window, route, correlation id, or error term and rerun.

6. For authenticated local API validation, get a fresh token through the browser and then switch to direct API calls.
   - Use Playwright only for login/token capture unless the UI behavior itself is under test. Prefer API calls for repeatable function validation.
   - Use Playwright's managed Chromium installation instead of the system Chrome app in Codex runs. If it is missing, install it with `npx playwright install chromium`, then find the executable under `$HOME/Library/Caches/ms-playwright` and pass it with `PLAYWRIGHT_CHROME_PATH`.
   - Watch for the browser token exchange response at `POST https://localhost:41100/d2e/oauth/token`; keep the `access_token` in memory or an ephemeral shell variable only. Never write bearer tokens, cookies, refresh tokens, or full token responses into docs, logs, scripts, or final answers.
   - Prefer `https://localhost:41100` for local Caddy-routed API calls. If `curl -k` fails with local TLS issues, use Node fetch with certificate verification disabled only for the local probe.
   - If a saved Playwright storage state skips token exchange, use a fresh storage-state file so `/d2e/oauth/token` is emitted again.
   - Check where the target route expects dataset context. Analytics routes commonly read `datasetId` from `mriquery`, query string, or JSON body; some dataset-scoped routes, especially under `d2e-webapi`, require a request header named `datasetid`. Header names are normalized to lowercase server-side, so send `datasetid: <dataset-uuid>` or verify that `datasetId` is being normalized by the client.
   - When a probe returns `401`, refresh the browser token before debugging function code. When it returns `403`, check dataset/study identifiers, `Content-Type`, and whether the API expects a public dataset id instead of an internal cache id.
   - When a probe returns `400 datasetid missing in request header`, replay with the `datasetid` header; do not keep changing body/query payloads until the route's dataset-source convention is confirmed.

7. For runtime log validation, prove both code loading and request behavior.
   - A temporary non-PHI marker at the specific method boundary can prove the loaded trex runtime reached the edited code. Keep markers small: method name, route/channel, counts, booleans, and correlation hints only.
   - Marker logs are not the same as real feature logs. For example, an audit marker can prove `AuditLogger.log()` was reached even when the configured audit transport is disabled.
   - Correlate at least three signals before calling a runtime validation successful: authorization/study access, successful API status, and the expected filtered log line after the request.
   - For Cohort Builder patient-list validation, the plugin route `/d2e/analytics-svc/api/services/patient?mriquery=<compressed>&datasetId=<dataset-uuid>` is often a better probe than hand-building legacy `analytics.xsjs?action=patientdetail`. Build `mriquery` the same way the UI does: JSON stringify, zlib deflate, base64, then URL encode.

8. Iterate in small loops.
   - Make one focused change, restart trex, reproduce, inspect filtered logs, and decide the next edit.
   - If startup registration, module caching, import maps, or generated bundles may be involved, verify the container is using the file or build artifact just edited.
   - For async or race-sensitive issues, add paired start/end logs with elapsed time around awaited calls.

9. Clean up before finishing.
   - Remove temporary logs unless the user asked to keep them or they are appropriate behind a debug flag.
   - Keep high-signal permanent logs only when they help future operations and are privacy-safe.
   - Restart trex after removing temporary function diagnostics so the local runtime is clean.
   - Confirm temporary marker strings no longer exist in source and that any notes do not contain token-looking strings.
   - Report the reproduce command/path, restart method, filtered log query, and verification result.

## Function Patterns

- `analytics-svc`: Express app for cohort, patient, concept, population, data characterization, dataset filter, parquet, and related analytics controllers.
- `cdw-svc`: metadata and query-engine service with facade classes.
- `dataset`: dataset lifecycle and API clients for analytics, credentials, portal registration, job plugins, and FHIR gateway.
- Inter-service calls should generally use `Trex.tokioChannel("d2e-functions/<function-name>")` instead of ad hoc HTTP.
- Watch dialect handling. HANA and Postgres schema casing differs, and SQL/logging changes must preserve that behavior.
- Keep `/check-liveness` and startup/init paths lightweight; avoid expensive debug work there unless the bug is specifically in startup.

## Verification

- Run the narrowest available unit, lint, build, or Deno check for the touched function when practical.
- For runtime behavior, restart trex and repeat the original request or UI action.
- Use Docker logs to confirm both success and failure paths are understood; capture only filtered snippets in the final summary.
- If tests cannot run because dependencies or services are missing, state that clearly and include the containerized command or runtime step that would verify it.

## Safety

- Treat logs as potentially sensitive. Redact or omit identifiers that are not needed for debugging.
- Do not post investigation notes to GitHub issues or PRs unless explicitly asked.
- Do not edit `human-notes.md`; write brief companion notes to `human-notes-responses.md` if needed.
