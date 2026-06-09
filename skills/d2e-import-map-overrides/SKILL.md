---
name: d2e-import-map-overrides
description: Use to enable and verify D2E single-spa Import Map Overrides, point portal plugin modules to local dev server lifecycle bundles, or handle the Cohort Builder/vue-mri exception that requires build-and-copy hot deploy to trex. Trigger when a task mentions D2E devtools, single-spa import map overrides, the bottom-right ellipsis menu, serving updated UI from another app setup, localhost:41100 UI override checks, module override URLs, or verifying that "Import Map Overrides" appears after setting localStorage devtools.
---

# D2E Import Map Overrides

## Overview

D2E exposes a single-spa Import Map Overrides UI behind a devtools flag. Use this workflow to log into the local portal, enable the devtools flag, refresh, and verify that the bottom-right ellipsis opens the "Import Map Overrides" panel.

## Workflow

1. Confirm the local D2E stack is running.
   - Prefer `docker ps`.
   - Expect `d2e-trex` and the Caddy proxy exposing `0.0.0.0:41100->443`.

2. Open the portal at:

   ```text
   https://localhost:41100/d2e/portal
   ```

   Do not use `/portal` as the first attempt for this workflow; the route that worked locally was `/d2e/portal`.

3. Navigate into the sign-in form.
   - If `/d2e/portal` redirects directly to `/sign-in`, continue.
   - If it lands on `/d2e/portal/public/overview`, click the visible `Login` button first, then wait for `/sign-in`.

4. Log in with the local demo credentials unless the user provides different credentials:

   ```text
   username: admin
   password: Updatepassword12345
   ```

   A successful login redirects through `/sign-in` to a page like:

   ```text
   https://localhost:41100/d2e/portal/researcher
   ```

   In one verified run, login briefly showed `/d2e/portal/no-access`; after setting the devtools flag and refreshing, the portal resolved to `/d2e/portal/researcher`. Treat `/d2e/portal/researcher` after refresh as the useful success state.

5. On the logged-in portal origin, set the devtools flag:

   ```js
   localStorage.setItem('devtools', true);
   ```

   Verify it persisted as `"true"` with:

   ```js
   localStorage.getItem('devtools');
   ```

6. Refresh the page and wait for the portal to finish rendering.

7. Click the bottom-right ellipsis button.
   - In the verified run, it rendered as an unlabeled interactable with text similar to `{···}`.
   - At a 1280x720 viewport, its box was approximately `x=1220`, `y=660`, `w=50`, `h=50`.
   - Because it may not have an accessible label, locate bottom-right interactables by bounding box if role/name selectors do not find it.

8. Verify that this text becomes visible:

   ```text
   Import Map Overrides
   ```

## Point A Module To A Dev Server

Use this for single-spa lifecycle apps shown in the Import Map Overrides table. The table usually shows the module name, current domain `localhost:41100`, and filename such as `lifecycles.js`.

1. Start the app's local dev server from `repos/Data2Evidence/plugins/ui`.

   ```bash
   bun nx dev <nx-project>
   ```

   This usually runs a watch build plus Vite preview. Confirm the lifecycle bundle URL by opening it directly before overriding.

2. In the bottom-right Import Map Overrides panel, override the exact module name shown in the table with the local lifecycle URL.

   Examples verified from app config/docs:

   | Module Name | Local Override URL |
   | --- | --- |
   | `/resources/concept-sets/lifecycles.js` | `https://localhost:8082/lifecycles.js` |
   | `/resources/analysis-ui/lifecycles.js` | `https://localhost:8083/lifecycles.js` |
   | `/resources/notebook-ui/lifecycles.js` | `https://localhost:8084/lifecycles.js` |
   | `/resources/wizards/lifecycles.js` | `https://localhost:8084/lifecycles.js` |

   Do not run two apps that claim the same local port unless you intentionally changed one app's Vite port.

3. Apply the override, then reload the portal tab. For HTTPS self-signed dev servers, first open the local lifecycle URL directly and accept the certificate if Chrome blocks it.

4. If the app still loads from `localhost:41100`, clear the override, re-add it, and hard reload the portal.

## Cohort Builder Exception

The main Cohort Builder / Patient Analytics app is `vue-mri`, served from the `mri` resource bundle. For current local work, do not rely on the portal Import Map Overrides table for this path. Build and copy the updated bundle into the running `trex` container instead.

From the D2E workspace:

```bash
scripts/d2e-ui-hot-deploy.sh vue-mri
```

Run this outside the sandbox when using Codex tools because it performs an Nx production build and `docker cp` into the running `trex` container. In Codex, request escalation for this command rather than retrying sandboxed if Nx daemon/socket or Docker copy permissions fail.

That script:

- uses `${D2E_APP_REPO:-<workspace>/repos/Data2Evidence}` and `${D2E_UI_DIR:-$D2E_APP_REPO/plugins/ui}`
- builds `vue-mri`
- maps `vue-mri` to resource dir `mri`
- finds the running `trex` container
- copies the local `plugins/ui/resources/mri` build output into `trex` with `docker cp`
- recreates `/usr/src/data/plugins/@data2evidence/d2e-ui/resources/mri` from the local build output

After hot deploy, hard-refresh the browser and verify the Cohort Builder scenario. For portal MRI UI5 plugin changes, also follow `skills/cohorts-dev/SKILL.md` because some changes may be served from `mri-ui5` rather than `mri`.

## Fast Playwright Harness

Use standalone Playwright when the in-app Browser blocks localhost or when verifying a deployed UI bundle. Launch local Chrome outside the sandbox. For visible browser runs, set `headless: false`, add a small `slowMo`, and keep the page open briefly at the end.

```js
const fs = require('node:fs');
const { chromium } = require('/Users/jerome/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const storageState = '/private/tmp/d2e-playwright-login-state.json';
const headed = process.env.HEADLESS === 'false';
const browser = await chromium.launch({
  headless: !headed,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  slowMo: headed ? 150 : 0,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  ...(fs.existsSync(storageState) ? { storageState } : {}),
});
const page = await context.newPage();
```

Use this direct login helper instead of rediscovering the login page each run. It handles already-logged-in sessions because it only fills credentials when the direct `/researcher` navigation redirects to `/sign-in`.

```js
async function gotoResearcher(page) {
  await page.goto('https://localhost:41100/d2e/portal/researcher', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

  if (page.url().includes('/sign-in')) {
    await page.locator('input[type="text"], input[name="identifier"], input[name="username"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('Updatepassword12345');
    await page.locator('button[type="submit"], button:has-text("Sign in")').first().click();
    await page.waitForURL('**/d2e/portal/**', { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  }

  if (page.url().includes('/no-access')) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  }
}
```

After a successful login, save storage state so future Playwright contexts can skip the login form while the session remains valid:

```js
await context.storageState({ path: storageState });
```

For one-off Cohort Builder checks after login:

```js
await gotoResearcher(page);
await page.locator('text="Demo dataset"').first().click();
await page.waitForURL('**/d2e/portal/researcher/information**', { timeout: 30000 }).catch(() => {});
await page.locator('a:has-text("Cohorts"), button:has-text("Cohorts"), text="Cohorts"').first().click();
await page.waitForURL('**/d2e/portal/researcher/cohort**', { timeout: 30000 }).catch(() => {});
await page.getByText('Create Cohort test:', { exact: true }).isVisible();
if (headed) await page.waitForTimeout(10000);
```

## Browser Notes

- Prefer the normal D2E UI/browser verification workflow first when available.
- If the in-app Browser reports `net::ERR_BLOCKED_BY_CLIENT` for `https://localhost:41100/d2e/portal`, use standalone Playwright instead of spending time on alternate URL guesses.
- In Codex Desktop, call `load_workspace_dependencies` to find the bundled Node and `node_modules` paths. The bundled Playwright package may exist even when `playwright` is not on the shell `PATH`.
- If Playwright's downloaded browser is missing, launch an installed local Chrome/Chromium executable. On the verified macOS setup, this worked:

  ```js
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 720 },
  });
  ```

- Launching a local GUI/browser binary may require approval outside the sandbox.

## Playwright Checks

Use stable page state checks rather than screenshots unless the user asks for visual evidence.

Useful checks:

```js
await page.goto('https://localhost:41100/d2e/portal', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});

if (!await page.locator('input[type="password"]').count()
    && await page.getByText('Login', { exact: true }).isVisible().catch(() => false)) {
  const login = page.locator('button:has-text("Login"), a:has-text("Login"), [role="button"]:has-text("Login")');
  await login.first().click();
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
}

await page.locator('input[type="password"]').count();
await page.evaluate(() => localStorage.setItem('devtools', true));
await page.evaluate(() => localStorage.getItem('devtools'));
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.getByText('Import Map Overrides', { exact: true }).isVisible();
```

For the ellipsis, inspect bottom-right interactables when selectors fail:

```js
const candidates = page.locator('button, [role="button"], .sapMBtn, [tabindex="0"]');
```

Collect each candidate's `boundingBox()`, visible text, `aria-label`, and `title`; then click the bottom-right candidate and check for `Import Map Overrides`.

Console errors like `400 - datasetId or tokenDatasetCode is required` can appear on the portal during this check and are not by themselves evidence that the override menu failed.
