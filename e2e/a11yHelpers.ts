import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, type TestInfo } from '@playwright/test'
import type { Result, NodeResult } from 'axe-core'

/** Supported WCAG A/AA tags for axe-core 4.12.x (wcag22aa present; wcag22a not tagged in this build). */
export const WCAG_A_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const

function formatNode(node: NodeResult): string {
  const target = node.target.join(' >> ')
  const summary = node.failureSummary?.replace(/\s+/g, ' ').trim() ?? 'No failure summary'
  const html = node.html.replace(/\s+/g, ' ').trim().slice(0, 160)
  return `    target: ${target}\n    summary: ${summary}\n    html: ${html}`
}

export function formatAxeViolations(violations: Result[]): string {
  if (violations.length === 0) return 'No axe violations.'
  return violations
    .map((violation) => {
      const nodes = violation.nodes.map(formatNode).join('\n')
      return [
        `[${violation.id}] impact=${violation.impact ?? 'unknown'}`,
        `  help: ${violation.help}`,
        `  tags: ${violation.tags.join(', ')}`,
        nodes,
      ].join('\n')
    })
    .join('\n\n')
}

export async function expectNoAxeViolations(page: Page, testInfo: TestInfo, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags([...WCAG_A_AA_TAGS])
    .analyze()

  await testInfo.attach(`axe-${label}`, {
    body: Buffer.from(JSON.stringify({
      label,
      url: page.url(),
      violations: results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        tags: violation.tags,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          failureSummary: node.failureSummary,
          html: node.html,
        })),
      })),
      passes: results.passes.length,
      incomplete: results.incomplete.length,
    }, null, 2), 'utf8'),
    contentType: 'application/json',
  })

  expect(results.violations, formatAxeViolations(results.violations)).toEqual([])
}

export async function waitForSettledHome(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Good morning' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Start focus' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Notifications' })).toHaveAttribute('aria-expanded', 'false')
}
