---
name: verify-ui
description: Use to verify D2E UI behavior with browser tooling, screenshots, network checks, and known local runtime paths.
---

# Verify UI Workflow

Use for reproducing bugs, verifying UI fixes, checking local pages, or collecting screenshots/network evidence.

## Local Runtime Defaults

- Portal URL: `https://localhost:41100/portal`
- App repo: `${D2E_APP_REPO:-repos/Data2Evidence}`
- Login for local demo environments: `admin` / `Updatepassword12345`

## Playwright Local SSL Defaults

When using Playwright against the local D2E portal, launch headed Chrome/Chromium with insecure-localhost settings so service workers can run against `https://localhost:41100`:

- Set `ignoreHTTPSErrors: true`.
- Pass `--ignore-certificate-errors`.
- Pass `--unsafely-treat-insecure-origin-as-secure=https://localhost:41100`.
- Prefer a persistent or isolated user data directory under `/tmp`, for example `/tmp/chrome-d2e-insecure-pw`.
- Do not block service workers when verifying Shiny flows.
- Capture screenshots, console logs, and video where useful for user-visible verification.

## Workflow

1. Confirm the platform is running by checking for a trex container.
2. Navigate to the portal, login if needed, and wait for the dataset page before interacting.
3. Use page snapshots/accessibility state before screenshots when locating controls.
4. Capture console and network information for behavioral bugs.
5. For updated UI bundles, hot deploy first with `scripts/d2e-ui-hot-deploy.sh <nx-project> [resource-dir]`.
6. Report observed behavior, evidence captured, and whether the original issue is resolved.

## D2E UI Notes

- Concept Sets path: dataset card, then Concepts, then Concept Sets or Concept Search.
- Cohorts path: dataset card, then Cohorts.
- Prefer wide desktop viewports for cohorts chart work.
- Single-spa redirects can happen in automation; re-navigate and continue if the route changes unexpectedly.
