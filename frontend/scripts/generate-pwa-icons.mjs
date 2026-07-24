import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'icons')
const svg = fs.readFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), 'utf8')

fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0a0b10;display:flex;align-items:center;justify-content:center;width:512px;height:512px">${svg}</body></html>`, { waitUntil: 'load' })

for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size })
  await page.screenshot({ path: path.join(outDir, `icon-${size}.png`), clip: { x: 0, y: 0, width: size, height: size } })
}

await browser.close()
console.log('Generated PWA icons in public/icons/')
