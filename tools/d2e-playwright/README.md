# D2E Playwright Helper

Reusable standalone Playwright helper for local Data2Evidence UI verification.

Prefer this over the sandboxed/in-app browser for D2E local portal checks. The local portal uses HTTPS, service workers, redirects, hot-deployed UI bundles, and sometimes Playwright route stubbing.

## Quick Path

From the D2E workspace:

```bash
node tools/d2e-playwright/verify-ui.mjs --check researcher
```

In Codex Desktop, request command escalation before running this helper so Playwright can launch and control local Chrome. This applies to both headless and headed runs.

Open the demo Cohorts page and save a screenshot:

```bash
node tools/d2e-playwright/verify-ui.mjs \
  --check cohorts \
  --screenshot-dir repos/docs/projects/<project-folder>
```

Show Chrome while running:

```bash
HEADLESS=false node tools/d2e-playwright/verify-ui.mjs --check cohorts
```

## Runtime Paths

The helper resolves Playwright in this order:

1. `PLAYWRIGHT_MODULE`
2. `$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`
3. normal Node resolution for `playwright`

It uses local Chrome by default:

```text
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

Override with:

```bash
PLAYWRIGHT_CHROME_PATH=/path/to/chrome node tools/d2e-playwright/verify-ui.mjs
```

## Login State

The helper reuses and saves login state at:

```text
/private/tmp/d2e-playwright-login-state.json
```

Override with:

```bash
D2E_PLAYWRIGHT_STORAGE_STATE=/private/tmp/my-state.json node tools/d2e-playwright/verify-ui.mjs
```

## Importable Helpers

Use the module for custom verification scripts that need route stubs or app-specific assertions:

```js
import {
  launchD2EBrowser,
  gotoResearcher,
  openCohorts,
  saveScreenshot,
  saveStorageState,
} from './tools/d2e-playwright/verify-ui.mjs'

const { browser, context, page } = await launchD2EBrowser({ headed: false })

try {
  await page.route('**/some/api', route => route.fulfill({ json: { ok: true } }))
  await gotoResearcher(page)
  await saveStorageState(context, '/private/tmp/d2e-playwright-login-state.json')
  await openCohorts(page, 'Demo dataset')
  await saveScreenshot(page, 'repos/docs/projects/example', 'cohorts-page')
} finally {
  await browser.close()
}
```

## Codex Notes

Launching local Chrome or using Docker hot deploy may require running outside the sandbox. In Codex Desktop, request escalation before running this helper whenever Chrome launch is needed; do not try a sandboxed Chrome launch first. Without escalation, Chrome can launch and then abort during Playwright startup with `kill EPERM`, `SIGABRT`, or `Target page, context or browser has been closed`. Treat that as a command-sandbox permission issue, not a D2E app failure, and rerun the same helper command with escalation instead of switching to a less representative browser path.

Avoid broad environment dumps while debugging local containers. Use narrow DB/API queries and avoid printing secrets.
