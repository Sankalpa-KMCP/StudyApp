import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const STYLES_DIR = dirname(fileURLToPath(import.meta.url))
const COMPONENTS_CSS_PATH = join(STYLES_DIR, 'components.css')

export type CssDeclaration = {
  property: string
  value: string
  ruleContext: string
}

export const UNSAFE_URL_PROPERTIES = [
  'background',
  'background-image',
  'border-image',
  'border-image-source',
  'mask',
  'mask-image',
  '-webkit-mask',
  '-webkit-mask-image',
  'list-style',
  'list-style-image',
  'content',
  'cursor',
  'shape-outside',
  'filter',
  'backdrop-filter',
  'offset-path',
  'clip-path',
] as const

/**
 * Extracts complete CSS declarations (property and value across newlines) from CSS text.
 */
export function extractCssDeclarations(css: string): CssDeclaration[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const declarations: CssDeclaration[] = []
  const ruleRegex = /([^{}]+)\{([^}]+)\}/g
  let match: RegExpExecArray | null

  while ((match = ruleRegex.exec(clean)) !== null) {
    const selector = match[1].replace(/\s+/g, ' ').trim()
    const block = match[2]
    const decls = block.split(';')
    for (const decl of decls) {
      const colonIndex = decl.indexOf(':')
      if (colonIndex === -1) continue
      const property = decl.slice(0, colonIndex).trim().toLowerCase()
      const value = decl.slice(colonIndex + 1).replace(/\s+/g, ' ').trim()
      if (property && value) {
        declarations.push({ property, value, ruleContext: selector })
      }
    }
  }

  return declarations
}

/**
 * Finds declarations consuming --subject-color in unsafe URL/image-capable properties.
 */
export function findUnsafeSubjectColorDeclarations(css: string): CssDeclaration[] {
  const declarations = extractCssDeclarations(css)
  return declarations.filter((decl) => {
    if (!decl.value.includes('--subject-color')) return false
    return UNSAFE_URL_PROPERTIES.includes(decl.property as typeof UNSAFE_URL_PROPERTIES[number])
  })
}

describe('F-13 Subject color CSS sink safety', () => {
  it('.subject-icon in components.css uses background-color instead of shorthand background', () => {
    const css = readFileSync(COMPONENTS_CSS_PATH, 'utf8')
    const declarations = extractCssDeclarations(css)
    const subjectIconDecls = declarations.filter((d) => d.ruleContext === '.subject-icon')

    const bgColorDecl = subjectIconDecls.find((d) => d.property === 'background-color')
    expect(bgColorDecl, 'Missing background-color declaration on .subject-icon').toBeDefined()
    expect(bgColorDecl!.value).toContain('var(--subject-color')

    const bgShorthandDecl = subjectIconDecls.find((d) => d.property === 'background')
    expect(bgShorthandDecl, 'Found forbidden background shorthand declaration on .subject-icon').toBeUndefined()
  })

  it('no CSS file in src/styles/ consumes --subject-color in a URL-capable shorthand or image property', () => {
    const cssFiles = readdirSync(STYLES_DIR).filter((file) => file.endsWith('.css'))

    for (const file of cssFiles) {
      const filePath = join(STYLES_DIR, file)
      const css = readFileSync(filePath, 'utf8')
      const unsafe = findUnsafeSubjectColorDeclarations(css)

      expect(
        unsafe,
        `Found unsafe --subject-color declarations in ${file}: ${JSON.stringify(unsafe)}`
      ).toEqual([])
    }
  })

  it('correctly detects multiline and varied unsafe declarations in test samples', () => {
    const multilineSample = `
      .test-card {
        color: #fff;
        background:
          var(--subject-color, #2563eb);
      }
    `
    expect(findUnsafeSubjectColorDeclarations(multilineSample)).toHaveLength(1)
    expect(findUnsafeSubjectColorDeclarations(multilineSample)[0]?.property).toBe('background')

    const bgImageSample = `
      .test-icon {
        background-image: var(--subject-color);
      }
    `
    expect(findUnsafeSubjectColorDeclarations(bgImageSample)).toHaveLength(1)
    expect(findUnsafeSubjectColorDeclarations(bgImageSample)[0]?.property).toBe('background-image')

    const maskSample = `
      .test-mask {
        mask-image: var(--subject-color);
        -webkit-mask: var(--subject-color);
      }
    `
    expect(findUnsafeSubjectColorDeclarations(maskSample)).toHaveLength(2)

    const borderImageSample = `
      .test-border {
        border-image: var(--subject-color);
      }
    `
    expect(findUnsafeSubjectColorDeclarations(borderImageSample)).toHaveLength(1)

    const contentSample = `
      .test-content::before {
        content: var(--subject-color);
      }
    `
    expect(findUnsafeSubjectColorDeclarations(contentSample)).toHaveLength(1)

    const listStyleSample = `
      .test-list {
        list-style-image: var(--subject-color);
      }
    `
    expect(findUnsafeSubjectColorDeclarations(listStyleSample)).toHaveLength(1)
  })

  it('permits color-only declarations consuming --subject-color', () => {
    const safeSample = `
      .subject-icon {
        background-color: var(--subject-color, var(--accent));
      }
      .subject-card {
        border-top: 3px solid var(--subject-color, var(--accent));
        border-color: var(--subject-color);
        color: var(--subject-color);
      }
    `
    expect(findUnsafeSubjectColorDeclarations(safeSample)).toEqual([])
  })
})
