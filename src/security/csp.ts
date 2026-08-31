import { createHash } from 'node:crypto'

export const CSP_UNSUPPORTED_IN_META_DIRECTIVES = [
  'frame-ancestors',
  'report-uri',
  'report-to',
  'sandbox',
] as const

export const PRODUCTION_CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrcBase: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:'],
  fontSrc: ["'self'"],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
} as const

/**
 * Computes deterministic base64-encoded SHA-256 CSP hashes for an inline script string.
 * Generates both LF and CRLF variants so that Git checkout line-ending differences
 * across platforms (Windows vs Linux CI) never cause CSP validation mismatches.
 */
export function computeScriptHashes(scriptContent: string): string[] {
  const hashes = new Set<string>()

  const lfText = scriptContent.replace(/\r\n/g, '\n')
  const crlfText = lfText.replace(/\n/g, '\r\n')

  const lfDigest = createHash('sha256').update(lfText, 'utf8').digest('base64')
  hashes.add(`'sha256-${lfDigest}'`)

  const crlfDigest = createHash('sha256').update(crlfText, 'utf8').digest('base64')
  hashes.add(`'sha256-${crlfDigest}'`)

  return Array.from(hashes)
}

/**
 * Extracts inline script text bodies from an HTML string (skipping external scripts with src=).
 */
export function extractInlineScriptContents(html: string): string[] {
  const inlineScripts: string[] = []
  const scriptRegex = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = scriptRegex.exec(html)) !== null) {
    const body = match[1]
    if (body.trim().length > 0) {
      inlineScripts.push(body)
    }
  }

  return inlineScripts
}

/**
 * Builds the canonical Content-Security-Policy header/meta string for Study Dashboard.
 */
export function buildContentSecurityPolicy(options: { inlineScriptHashes?: string[] } = {}): string {
  const scriptSources = [
    ...PRODUCTION_CSP_DIRECTIVES.scriptSrcBase,
    ...(options.inlineScriptHashes ?? []),
  ]

  return [
    `default-src ${PRODUCTION_CSP_DIRECTIVES.defaultSrc.join(' ')}`,
    `script-src ${scriptSources.join(' ')}`,
    `style-src ${PRODUCTION_CSP_DIRECTIVES.styleSrc.join(' ')}`,
    `img-src ${PRODUCTION_CSP_DIRECTIVES.imgSrc.join(' ')}`,
    `font-src ${PRODUCTION_CSP_DIRECTIVES.fontSrc.join(' ')}`,
    `connect-src ${PRODUCTION_CSP_DIRECTIVES.connectSrc.join(' ')}`,
    `object-src ${PRODUCTION_CSP_DIRECTIVES.objectSrc.join(' ')}`,
    `base-uri ${PRODUCTION_CSP_DIRECTIVES.baseUri.join(' ')}`,
    `form-action ${PRODUCTION_CSP_DIRECTIVES.formAction.join(' ')}`,
  ].join('; ')
}

/**
 * Injects a production Content-Security-Policy meta tag into the <head> of an HTML string,
 * automatically computing sha256 hashes for all inline scripts present in the document.
 */
export function injectProductionCsp(html: string): string {
  const inlineBodies = extractInlineScriptContents(html)
  const inlineScriptHashes = inlineBodies.flatMap((body) => computeScriptHashes(body))
  const cspString = buildContentSecurityPolicy({ inlineScriptHashes })
  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${cspString}" />`

  // Insert right after <meta charset=... /> if present, else after <head>
  if (/<meta\s+charset=[^>]+>/i.test(html)) {
    return html.replace(/(<meta\s+charset=[^>]+>)/i, `$1\n    ${metaTag}`)
  }

  return html.replace(/<head>/i, `<head>\n    ${metaTag}`)
}
