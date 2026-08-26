import { expect, test } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const DIST_INDEX_PATH = resolve(process.cwd(), 'dist/index.html')
const PUBLIC_404_PATH = resolve(process.cwd(), 'public/404.html')

test.describe('Content Security Policy (CSP) E2E', () => {
  test('production build index.html contains canonical restrictive CSP meta tag', async () => {
    if (!existsSync(DIST_INDEX_PATH)) {
      test.skip()
      return
    }

    const distHtml = readFileSync(DIST_INDEX_PATH, 'utf8')
    expect(distHtml).toContain('<meta http-equiv="Content-Security-Policy"')

    const match = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i.exec(distHtml)
    expect(match).not.toBeNull()
    const csp = match![1]

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toContain("script-src 'unsafe-inline'")
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
    expect(csp).toContain("img-src 'self' data:")
    expect(csp).toContain("font-src 'self'")
    expect(csp).toContain("connect-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
  })

  test('public/404.html contains valid CSP with authorized script hashes', async () => {
    const html404 = readFileSync(PUBLIC_404_PATH, 'utf8')
    const match = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i.exec(html404)
    expect(match).not.toBeNull()
    const csp = match![1]

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self' 'sha256-")
    expect(csp).toContain("connect-src 'self'")
    expect(csp).toContain("object-src 'none'")
  })

  test('application loads and navigates with zero security or resource errors', async ({ page }) => {
    const consoleErrors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Deep link navigation
    await page.goto('/tasks')
    await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible()

    await page.goto('/subjects')
    await expect(page.getByRole('heading', { level: 1, name: 'Subjects' })).toBeVisible()

    // Verify no unhandled errors or CSP violations occurred during normal usage
    const securityErrors = consoleErrors.filter(
      (err) =>
        err.includes('Content Security Policy') ||
        err.includes('violates the following Content Security Policy') ||
        err.includes('blocked by CSP')
    )
    expect(securityErrors).toEqual([])
  })

  test('browser CSP enforcement blocks unauthorized connect and img probes while permitting safe dynamic styles', async ({ page }) => {
    if (!existsSync(DIST_INDEX_PATH)) {
      test.skip()
      return
    }

    const distHtml = readFileSync(DIST_INDEX_PATH, 'utf8')
    const cspMatch = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i.exec(distHtml)
    expect(cspMatch).not.toBeNull()
    const cspContent = cspMatch![1]

    // Create a sandbox HTML page with the exact production CSP delivered via meta tag
    const sandboxHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="Content-Security-Policy" content="${cspContent}" />
          <title>CSP Enforcement Probe Sandbox</title>
        </head>
        <body>
          <div id="test-container">Sandbox Ready</div>
        </body>
      </html>
    `

    const cspViolationLogs: string[] = []
    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('violates the following Content Security Policy') || text.includes('Refused to')) {
        cspViolationLogs.push(text)
      }
    })

    await page.setContent(sandboxHtml)
    await expect(page.locator('#test-container')).toBeVisible()

    // 1. Probe connect-src: Attempt unauthorized fetch
    const fetchBlocked = await page.evaluate(async () => {
      try {
        await fetch('http://127.0.0.1:9999/unauthorized-endpoint')
        return false
      } catch {
        return true
      }
    })
    expect(fetchBlocked).toBe(true)

    // 2. Probe img-src: Attempt unauthorized external beacon image
    await page.evaluate(() => {
      const img = document.createElement('img')
      img.src = 'http://127.0.0.1:9999/tracking-beacon.png'
      document.body.appendChild(img)
    })
    await page.waitForTimeout(200)

    // 3. Probe script-src: Attempt unauthorized inline script execution
    await page.evaluate(() => {
      try {
        const s = document.createElement('script')
        s.textContent = 'window.__malicious = true;'
        document.head.appendChild(s)
      } catch (err) {
        void err
      }
    })
    await page.waitForTimeout(200)

    const isMaliciousExecuted = await page.evaluate(() => (window as unknown as { __malicious?: boolean }).__malicious === true)
    expect(isMaliciousExecuted).toBe(false)

    // 4. Probe style-src: Verify dynamic CSS variables and inline styles render safely
    const computedVar = await page.evaluate(() => {
      const el = document.createElement('div')
      el.style.setProperty('--subject-color', '#2563eb')
      document.body.appendChild(el)
      return getComputedStyle(el).getPropertyValue('--subject-color').trim()
    })
    expect(computedVar).toBe('#2563eb')

    // Confirm browser security engine registered the CSP violations for the unauthorized probes
    expect(cspViolationLogs.length).toBeGreaterThanOrEqual(1)
  })
})
