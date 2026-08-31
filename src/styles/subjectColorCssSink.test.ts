import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const STYLES_DIR = dirname(fileURLToPath(import.meta.url))
const COMPONENTS_CSS_PATH = join(STYLES_DIR, 'components.css')

describe('F-13 Subject color CSS sink safety', () => {
  it('.subject-icon in components.css uses background-color instead of shorthand background', () => {
    const css = readFileSync(COMPONENTS_CSS_PATH, 'utf8')
    const subjectIconBlockMatch = /\.subject-icon\s*\{([^}]+)\}/m.exec(css)

    expect(subjectIconBlockMatch).not.toBeNull()
    const blockContent = subjectIconBlockMatch![1]

    // Must explicitly use background-color: var(--subject-color...)
    expect(blockContent).toMatch(/background-color\s*:\s*var\(--subject-color/)
    // Must NOT use shorthand background: var(--subject-color...)
    expect(blockContent).not.toMatch(/(?<!-)background\s*:\s*var\(--subject-color/)
  })

  it('no CSS file in src/styles/ consumes --subject-color in a URL-capable shorthand or image property', () => {
    const cssFiles = readdirSync(STYLES_DIR).filter((file) => file.endsWith('.css'))

    for (const file of cssFiles) {
      const filePath = join(STYLES_DIR, file)
      const css = readFileSync(filePath, 'utf8')
      const lines = css.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.includes('--subject-color')) {
          // Disallow shorthand background: or background-image:
          expect(line, `Found URL-capable property in ${file}:${i + 1}`).not.toMatch(/(?<!-)background\s*:/)
          expect(line, `Found background-image in ${file}:${i + 1}`).not.toMatch(/background-image\s*:/)
        }
      }
    }
  })
})
