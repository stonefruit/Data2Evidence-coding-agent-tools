#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    check: 'researcher',
    portalUrl: process.env.D2E_PORTAL_URL || 'https://localhost:41100/d2e/portal',
    dataset: process.env.D2E_DATASET_NAME || 'Demo dataset',
    storageState: process.env.D2E_PLAYWRIGHT_STORAGE_STATE || '/private/tmp/d2e-playwright-login-state.json',
    screenshotDir: process.env.D2E_PLAYWRIGHT_SCREENSHOT_DIR || '',
    screenshotName: '',
    headed: process.env.HEADLESS === 'false',
    slowMo: 0,
    summary: true,
    chromePath:
      process.env.PLAYWRIGHT_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    username: process.env.D2E_USERNAME || 'admin',
    password: process.env.D2E_PASSWORD || 'Updatepassword12345',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      i += 1
      return argv[i]
    }

    if (arg === '--check') options.check = next()
    else if (arg === '--portal-url') options.portalUrl = next()
    else if (arg === '--dataset') options.dataset = next()
    else if (arg === '--storage-state') options.storageState = next()
    else if (arg === '--screenshot-dir') options.screenshotDir = next()
    else if (arg === '--screenshot-name') options.screenshotName = next()
    else if (arg === '--chrome-path') options.chromePath = next()
    else if (arg === '--username') options.username = next()
    else if (arg === '--password') options.password = next()
    else if (arg === '--slow-mo') options.slowMo = Number(next() || 0)
    else if (arg === '--headed') options.headed = true
    else if (arg === '--headless') options.headed = false
    else if (arg === '--no-summary') options.summary = false
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

export function printHelp() {
  console.log(`Usage: node tools/d2e-playwright/verify-ui.mjs [options]

Options:
  --check researcher|cohorts   Verification target. Default: researcher
  --portal-url URL             Portal base URL. Default: https://localhost:41100/d2e/portal
  --dataset NAME               Dataset card/name to open for cohorts checks. Default: Demo dataset
  --screenshot-dir DIR         Save a timestamped screenshot after the check
  --screenshot-name NAME       Screenshot name suffix. Default: <check>
  --storage-state FILE         Reuse/save login state. Default: /private/tmp/d2e-playwright-login-state.json
  --headed                     Show Chrome
  --headless                   Run headless
  --slow-mo MS                 Slow down headed runs
  --chrome-path PATH           Chrome/Chromium executable path
  --username USER              Local login username. Default: admin
  --password PASSWORD          Local login password. Default: Updatepassword12345
  --no-summary                 Do not print JSON summary
  --help                       Show this help

Environment:
  PLAYWRIGHT_MODULE            Explicit Playwright module path
  PLAYWRIGHT_CHROME_PATH       Chrome executable path
  D2E_PORTAL_URL               Portal base URL
  D2E_PLAYWRIGHT_STORAGE_STATE Storage-state file
  D2E_PLAYWRIGHT_SCREENSHOT_DIR Screenshot directory
`)
}

export function requirePlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    process.env.HOME &&
      path.join(
        process.env.HOME,
        '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
      ),
    'playwright',
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      return require(candidate)
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error
    }
  }

  throw new Error('Could not find Playwright. Set PLAYWRIGHT_MODULE to the package path.')
}

function isLikelyCodexSandboxLaunchError(error) {
  const message = `${error?.message || ''}\n${error?.stack || ''}`

  return (
    message.includes('kill EPERM') ||
    message.includes('signal=SIGABRT') ||
    (message.includes('Target page, context or browser has been closed') &&
      message.includes('<launching>') &&
      message.includes('Google Chrome'))
  )
}

function withLaunchHint(error) {
  if (!isLikelyCodexSandboxLaunchError(error)) {
    return error
  }

  const hint =
    'Chrome launched but was stopped during Playwright startup. In Codex Desktop, rerun this helper outside the command sandbox with escalation; this is a browser-launch permission issue, not a D2E app failure.'
  const hinted = new Error(`${hint}\n\nOriginal error:\n${error.message}`)
  return hinted
}

export async function launchD2EBrowser(options = {}) {
  const { chromium } = requirePlaywright()
  const headed = options.headed ?? false
  const storageState = options.storageState || '/private/tmp/d2e-playwright-login-state.json'
  const contextOptions = {
    ignoreHTTPSErrors: true,
    viewport: options.viewport || { width: 1440, height: 900 },
  }

  if (fs.existsSync(storageState)) {
    contextOptions.storageState = storageState
  }

  let browser
  try {
    browser = await chromium.launch({
      headless: !headed,
      executablePath: options.chromePath || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      slowMo: headed ? options.slowMo || 150 : 0,
      args: [
        '--no-sandbox',
        '--ignore-certificate-errors',
        '--unsafely-treat-insecure-origin-as-secure=https://localhost:41100',
      ],
    })
  } catch (error) {
    throw withLaunchHint(error)
  }
  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()

  return { browser, context, page }
}

export async function gotoResearcher(page, options = {}) {
  const portalUrl = normalizePortalUrl(options.portalUrl)
  await page.goto(`${portalUrl}/researcher`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})

  if (page.url().includes('/sign-in')) {
    await page.locator('input[type="text"], input[name="identifier"], input[name="username"]').first().fill(options.username || 'admin')
    await page.locator('input[type="password"]').first().fill(options.password || 'Updatepassword12345')
    await page.locator('button[type="submit"], button:has-text("Sign in")').first().click()
    await page.waitForURL('**/d2e/portal/**', { timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  }

  if (page.url().includes('/no-access')) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  }
}

export async function saveStorageState(context, storageState) {
  if (!storageState) return
  fs.mkdirSync(path.dirname(storageState), { recursive: true })
  await context.storageState({ path: storageState })
}

export async function openDataset(page, datasetName = 'Demo dataset') {
  await page.locator(`text="${datasetName}"`).first().click()
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
}

export async function openCohorts(page, datasetName = 'Demo dataset') {
  await openDataset(page, datasetName)
  await page.getByText('Cohorts', { exact: true }).first().click()
  await page.waitForURL('**/d2e/portal/researcher/cohort', { timeout: 30000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
}

export function timestampedScreenshotPath(dir, name) {
  if (!dir) return ''
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return path.join(dir, `${stamp}-${name}.png`)
}

export async function saveScreenshot(page, dir, name) {
  const file = timestampedScreenshotPath(dir, name)
  if (!file) return ''
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await page.screenshot({ path: file, fullPage: true })
  return file
}

export async function pageSummary(page) {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
      .map((el) => ({
        text: el.textContent?.trim() || '',
        title: el.getAttribute('title') || '',
        disabled: el.hasAttribute('disabled'),
      }))
      .filter((item) => item.text || item.title)
      .slice(0, 40)
    const links = Array.from(document.querySelectorAll('a'))
      .map((el) => ({
        text: el.textContent?.trim() || '',
        href: el.getAttribute('href') || '',
      }))
      .filter((item) => item.text || item.href)
      .slice(0, 40)

    return {
      url: location.href,
      title: document.title,
      buttons,
      links,
    }
  })
}

export function normalizePortalUrl(url = 'https://localhost:41100/d2e/portal') {
  return url.replace(/\/$/, '')
}

export async function runCli(rawOptions = parseArgs()) {
  if (rawOptions.help) {
    printHelp()
    return { help: true }
  }

  const { browser, context, page } = await launchD2EBrowser(rawOptions)
  try {
    await gotoResearcher(page, rawOptions)
    await saveStorageState(context, rawOptions.storageState)

    if (rawOptions.check === 'cohorts') {
      await openCohorts(page, rawOptions.dataset)
    } else if (rawOptions.check !== 'researcher') {
      throw new Error(`Unsupported check: ${rawOptions.check}`)
    }

    const screenshot = await saveScreenshot(page, rawOptions.screenshotDir, rawOptions.screenshotName || rawOptions.check)
    const summary = {
      check: rawOptions.check,
      url: page.url(),
      screenshot,
      ...(rawOptions.summary ? { page: await pageSummary(page) } : {}),
    }

    if (rawOptions.summary) {
      console.log(JSON.stringify(summary, null, 2))
    }
    return summary
  } finally {
    await browser.close()
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
