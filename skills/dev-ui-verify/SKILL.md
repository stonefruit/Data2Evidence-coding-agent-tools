---
name: dev-ui-verify
description: Use to verify D2E UI behavior with browser tooling, screenshots, network checks, and known local runtime paths.
---

# Verify UI Workflow

Use for reproducing bugs, verifying UI fixes, checking local pages, or collecting screenshots/network evidence.

## Local Runtime Defaults

- Portal URL: `https://localhost:41100/d2e/portal`
- App repo: `${D2E_APP_REPO:-repos/Data2Evidence}`
- Login for local demo environments: `admin` / `Updatepassword12345`

## Browser Choice

For Data2Evidence local UI verification, prefer standalone Playwright with local Chrome/Chromium over the sandboxed/in-app browser. The local portal uses HTTPS, service workers, redirects, and sometimes route stubbing; standalone Playwright is the more reliable default for D2E checks.

Use the in-app browser only for lightweight visual inspection when standalone Playwright is unnecessary or unavailable. If local Chrome launch or Docker access is blocked by Codex sandboxing, request escalation instead of switching to a less representative path.

## Playwright Local SSL Defaults

When using Playwright against the local D2E portal, launch Chrome/Chromium with local HTTPS settings:

- Set `ignoreHTTPSErrors: true`.
- Pass `--ignore-certificate-errors`.
- For service-worker-sensitive flows, also pass `--unsafely-treat-insecure-origin-as-secure=https://localhost:41100`.
- Prefer a persistent or isolated user data directory under `/tmp`, for example `/tmp/chrome-d2e-insecure-pw`.
- Do not block service workers when verifying Shiny flows.
- Use storage state such as `/private/tmp/d2e-playwright-login-state.json` to reuse local login sessions.
- Capture screenshots for significant findings and save them in the related project folder with timestamped descriptive names.

## Workflow

1. Confirm the platform is running by checking for a trex container.
2. For updated UI bundles, hot deploy before browser verification with `scripts/d2e-ui-hot-deploy.sh <nx-project> [resource-dir]`. Run this outside the sandbox in Codex because it builds with Nx and may use Docker.
3. Prefer `tools/d2e-playwright/verify-ui.mjs` for standalone Playwright launch, login, storage-state reuse, common navigation, and screenshots.
4. Navigate to `https://localhost:41100/d2e/portal/researcher`, login if needed, and wait for the portal to settle.
5. Use stable Playwright locators and scoped selectors. Avoid broad exact-text selectors when repeated labels/descriptions can match the same text.
6. Use route stubbing for frontend-shell checks when backend metadata is not part of the phase under test. Prefer this over mutating the demo database.
7. Capture console/network information for behavioral bugs and screenshots for significant visible findings.
8. Report observed behavior, evidence captured, and whether the original issue is resolved.

## Reusable Helper

Use the helper for smoke checks:

```bash
node tools/d2e-playwright/verify-ui.mjs --check researcher
node tools/d2e-playwright/verify-ui.mjs --check cohorts --screenshot-dir repos/docs/projects/<project-folder>
```

For custom checks, import helpers from `tools/d2e-playwright/verify-ui.mjs` and add task-specific route stubs/assertions around `gotoResearcher`, `openCohorts`, and `saveScreenshot`. See `tools/d2e-playwright/README.md`.

## Standalone Playwright Harness Reference

Use this only when the helper needs to be adapted. The helper already wraps this pattern. In Codex Desktop, call `load_workspace_dependencies` if you need the current Node or `node_modules` paths.

```js
const fs = require('node:fs');
const path = require('node:path');

function requirePlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    process.env.HOME &&
      path.join(
        process.env.HOME,
        '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
      ),
    'playwright',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }

  throw new Error('Could not find Playwright. Set PLAYWRIGHT_MODULE to the package path.');
}

const { chromium } = requirePlaywright();
const storageState = '/private/tmp/d2e-playwright-login-state.json';
const headed = process.env.HEADLESS === 'false';

const browser = await chromium.launch({
  headless: !headed,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  slowMo: headed ? 150 : 0,
  args: ['--no-sandbox', '--ignore-certificate-errors'],
});
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  ...(fs.existsSync(storageState) ? { storageState } : {}),
});
const page = await context.newPage();
```

Use this direct login helper instead of rediscovering the login page each run:

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

After successful login:

```js
await context.storageState({ path: storageState });
```

For one-off Cohort Builder checks after login:

```js
await gotoResearcher(page);
await page.locator('text="Demo dataset"').first().click();
await page.waitForURL('**/d2e/portal/researcher/information**', { timeout: 30000 }).catch(() => {});
await page.getByText('Cohorts', { exact: true }).first().click();
await page.waitForURL('**/d2e/portal/researcher/cohort', { timeout: 30000 }).catch(() => {});
```

## D2E UI Notes

- Concept Sets path: dataset card, then Concepts, then Concept Sets or Concept Search.
- Cohorts path: dataset card, then Cohorts.
- Prefer wide desktop viewports for cohorts chart work.
- Single-spa redirects can happen in automation; re-navigate and continue if the route changes unexpectedly.
- Exact visible text can match multiple elements, for example a dashboard name and description. Scope to a modal/list container or class when possible.
- Never print broad container environments, `.env*`, credentials, certificates, or other secret-bearing diagnostics during verification. Use narrow DB/API queries when local state inspection is needed.
