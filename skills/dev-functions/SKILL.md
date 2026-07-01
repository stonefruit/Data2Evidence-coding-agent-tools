---
name: dev-functions
description: Use for D2E backend function development and debugging under repos/Data2Evidence/plugins/functions, including Trex-hosted Deno/Express services, function route tracing through plugins/functions/package.json, temporary diagnostic logging, WATCH-mode function reloads, trex restart fallback, and filtered Docker logs.
---

# D2E Functions

Use this workflow for D2E function-side changes. Functions are Trex-hosted Deno services; for local iteration, prefer per-function `WATCH` mode so edited functions reload without a full trex restart. Fall back to a trex restart when watch mode is unavailable, not active, or fails to prove the edited code loaded.

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
   - Add intermediate logs at boundaries where data changes shape: after request decoding, after config/query generation, before and after DB calls, before response formatting, and immediately before side effects such as audit writes or outgoing service calls.
   - When debugging mismatched behavior, log both the producer and consumer shapes. For example, if an API response has rows but a later logger sees none, log the returned dataset shape and the exact array passed into the logger.
   - For stream paths, log stream shape before attaching handlers or piping: constructor name, whether it is a Web `ReadableStream` or Node stream, selected attributes, entity name, and expected count source. Do not consume the stream just to inspect it unless the implementation safely tees or transforms it.
   - Prefer IDs, booleans, counts, lengths, enum values, status codes, elapsed milliseconds, and sanitized shapes over whole objects.
   - Never log PHI, tokens, cookies, secrets, raw credentials, `.env` values, full SQL with sensitive parameters, or full request/response bodies.
   - Keep temporary logs grouped and easy to remove, or put longer-lived diagnostics behind an existing debug flag.

4. Prefer `WATCH` mode for local function reloads.
   - Use the `d2e-trex` container for local D2E function debugging unless the user explicitly names another stack.
   - In `docker-compose-local.yml`, set `WATCH` to `true` only for the involved function env keys from the route map, such as `analytics-svc`, `cdw-svc`, `dataset`, or `fhir-gateway`.
   - Recreate/start trex once with the local stack command so the edited `WATCH` environment is active. Prefer `npm run start` from `repos/Data2Evidence`, because it loads `.env.local` and the generated compose options; avoid raw `docker compose ... up` unless you have already confirmed the exact env/profile set.
   - Confirm activation with `docker exec d2e-trex sh -lc 'printf "%s" "$WATCH" | grep -E "<function-env-1>|<function-env-2>"'`.
   - After `WATCH` is active, do not restart trex for ordinary function code edits. Change the source, replay the endpoint, and use filtered logs to confirm a worker `Shutdown`/`Boot` and the updated marker.
   - Expect the first request after an edit to be less responsive because the watched worker may be recreated on demand.
   - WATCH-mode route workers intentionally use a shorter request timeout than normal mode so old edited workers do not linger with stale code or resources. In `services/trex/core/server/plugin/function.ts`, route workers currently use `1 * 60 * 1000` under `WATCH` and `30 * 60 * 1000` otherwise.
   - If an otherwise valid long-running WATCH repro fails with `WorkerRequestCancelled: request has been cancelled by supervisor`, consider temporarily raising the WATCH `workerTimeoutMs` to match non-WATCH mode. This is Trex core server code, not watched function code: no image rebuild is needed when local compose bind-mounts `./services/trex/core`, but restart/recreate Trex with `npm run start` so the running Trex server reloads the changed timeout. Revert the timeout after the repro unless the user explicitly wants a product change.
   - If `WATCH` cannot be enabled, the target code is startup/init-only, the worker keeps serving stale code, or logs do not prove the edited marker loaded after a replay, restart trex as the fallback.
   - When falling back, prefer the local stack's documented restart/start command when known; otherwise restart the trex container directly. After restart, confirm the new code loaded by checking boot/plugin/function logs before retesting.

5. Read logs with filters only.
   - Do not read unbounded Docker logs. Use `--since` or `--tail`, then filter for the debug prefix plus relevant errors.
   - Good pattern: `docker logs d2e-trex 2>&1 | rg "codex-debug|ERROR|WARN|<route-or-function>"`
   - If the output is still large, tighten the prefix, time window, route, correlation id, or error term and rerun.

6. For authenticated local API validation, ask the user for a current bearer token first, then switch to direct API calls.
   - Default to requesting a token from the user because local tokens may have long TTLs and manual capture is faster and cheaper than browser login. Ask for the `Authorization: Bearer ...` value only when an authenticated probe is needed.
   - Keep provided bearer tokens in memory or ephemeral shell variables only. Never write bearer tokens, cookies, refresh tokens, or full token responses into docs, logs, scripts, source files, or final answers.
   - Use Playwright login/token capture only when the user cannot provide a token, the token is expired, or the UI behavior itself is under test. Prefer API calls for repeatable function validation.
   - Use Playwright's managed Chromium installation instead of the system Chrome app in Codex runs. If it is missing, install it with `npx playwright install chromium`, then find the executable under `$HOME/Library/Caches/ms-playwright` and pass it with `PLAYWRIGHT_CHROME_PATH`.
   - When using Playwright fallback, watch for the browser token exchange response at `POST https://localhost:41100/d2e/oauth/token`; keep the `access_token` in memory or an ephemeral shell variable only.
   - Prefer `https://localhost:41100` for local Caddy-routed API calls. If `curl -k` fails with local TLS issues, use Node fetch with certificate verification disabled only for the local probe.
   - If a saved Playwright storage state skips token exchange, use a fresh storage-state file so `/d2e/oauth/token` is emitted again.
   - Check where the target route expects dataset context. Analytics routes commonly read `datasetId` from `mriquery`, query string, or JSON body; some dataset-scoped routes, especially under `d2e-webapi`, require a request header named `datasetid`. Header names are normalized to lowercase server-side, so send `datasetid: <dataset-uuid>` or verify that `datasetId` is being normalized by the client.
   - When a probe returns `401`, refresh the browser token before debugging function code. When it returns `403`, check dataset/study identifiers, `Content-Type`, and whether the API expects a public dataset id instead of an internal cache id.
   - When a probe returns `400 datasetid missing in request header`, replay with the `datasetid` header; do not keep changing body/query payloads until the route's dataset-source convention is confirmed.

7. For runtime log validation, prove both code loading and request behavior.
   - A temporary non-PHI marker at the specific method boundary can prove the loaded trex runtime reached the edited code. Keep markers small: method name, route/channel, counts, booleans, and correlation hints only.
   - Marker logs are not the same as real feature logs. For example, an audit marker can prove `AuditLogger.log()` was reached even when the configured audit transport is disabled.
   - Correlate at least three signals before calling a runtime validation successful: authorization/study access, successful API status, and the expected filtered log line after the request.
   - Compare marker payloads against the response shape. If the API returned rows but the marker logged `rowCount: 0`, continue debugging the intermediate data flow before calling the endpoint validated.
   - Replay the exact captured request when validating a code fix. Do not rebuild or "simplify" payloads unless request construction is the thing being tested; small payload changes can fail in query generation before the target code path.
   - For Cohort Builder patient-list validation, the plugin route `/d2e/analytics-svc/api/services/patient?mriquery=<compressed>&datasetId=<dataset-uuid>` is often a better probe than hand-building legacy `analytics.xsjs?action=patientdetail`. Build `mriquery` the same way the UI does: JSON stringify, zlib deflate, base64, then URL encode.

8. Iterate in small loops.
   - Make one focused change, replay the request under `WATCH`, inspect filtered logs, and decide the next edit. Restart trex only when the watch-first loop is blocked or disproven.
   - Edits to Trex core server files, such as `services/trex/core/server/plugin/function.ts`, are outside per-function WATCH reload. In local compose these files are usually bind-mounted into `/usr/src/core`, so a rebuild is not needed, but the Trex server process must be restarted/recreated before the change takes effect.
   - If startup registration, module caching, import maps, or generated bundles may be involved, verify the container is using the file or build artifact just edited.
   - For async or race-sensitive issues, add paired start/end logs with elapsed time around awaited calls.
   - If keeping temporary diagnostics for follow-up work, stage only verified production hunks and leave debug hunks unstaged. Confirm with both `git diff --cached` and `git diff`.

9. Clean up before finishing.
   - Remove temporary logs unless the user asked to keep them or they are appropriate behind a debug flag.
   - Keep high-signal permanent logs only when they help future operations and are privacy-safe.
   - Under active `WATCH`, replay the touched endpoint after removing temporary diagnostics so the watched worker reloads clean source. If watch mode was not active or cleanup touches startup/init behavior, restart trex so the local runtime is clean.
   - Confirm temporary marker strings no longer exist in source and that any notes do not contain token-looking strings.
   - Report the reproduce command/path, whether `WATCH` was used or restart fallback was needed, the filtered log query, and the verification result.

## Function Patterns

- `analytics-svc`: Express app for cohort, patient, concept, population, data characterization, dataset filter, parquet, and related analytics controllers.
- `cdw-svc`: metadata and query-engine service with facade classes.
- `dataset`: dataset lifecycle and API clients for analytics, credentials, portal registration, job plugins, and FHIR gateway.
- Inter-service calls should generally use `Trex.tokioChannel("d2e-functions/<function-name>")` instead of ad hoc HTTP.
- Watch dialect handling. HANA and Postgres schema casing differs, and SQL/logging changes must preserve that behavior.
- Keep `/check-liveness` and startup/init paths lightweight; avoid expensive debug work there unless the bug is specifically in startup.

## Verification

- Run the narrowest available unit, lint, build, or Deno check for the touched function when practical.
- For runtime behavior, prefer `WATCH` mode and repeat the original request or UI action. Restart trex only as a fallback when watch mode is unavailable or fails to load the edit.
- Use Docker logs to confirm both success and failure paths are understood; capture only filtered snippets in the final summary.
- If tests cannot run because dependencies or services are missing, state that clearly and include the containerized command or runtime step that would verify it.

## Safety

- Treat logs as potentially sensitive. Redact or omit identifiers that are not needed for debugging.
- Do not post investigation notes to GitHub issues or PRs unless explicitly asked.
- Do not edit `human-notes.md`; write brief companion notes to `human-notes-responses.md` if needed.
