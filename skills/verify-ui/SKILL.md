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
