import { createElement, forwardRef } from 'react'
import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react'

export type IconNode = Array<[tag: string, attrs: Record<string, string | number>]>

export type AppIconProps = SVGProps<SVGSVGElement> & {
  size?: number | string
  color?: string
  strokeWidth?: number | string
  absoluteStrokeWidth?: boolean
}

export type AppIcon = ForwardRefExoticComponent<AppIconProps & RefAttributes<SVGSVGElement>>

const defaultAttributes = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

function toPascalCase(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function hasA11yProp(props: Record<string, unknown>): boolean {
  for (const prop of Object.keys(props)) {
    if (prop.startsWith('aria-') || prop === 'role' || prop === 'title') return true
  }
  return false
}

function mergeClasses(...classes: Array<string | undefined>): string | undefined {
  return classes.filter(Boolean).join(' ') || undefined
}

export function createIcon(iconName: string, iconNode: IconNode): AppIcon {
  const Component = forwardRef<SVGSVGElement, AppIconProps>(
    (
      {
        color = 'currentColor',
        size = 24,
        strokeWidth = 2,
        absoluteStrokeWidth,
        className = '',
        children,
        ...rest
      },
      ref,
    ) => {
      const calculatedStrokeWidth = absoluteStrokeWidth
        ? (Number(strokeWidth) * 24) / Number(size)
        : strokeWidth

      const a11yDefaults =
        !children && !hasA11yProp(rest as Record<string, unknown>)
          ? { 'aria-hidden': 'true' as const }
          : {}

      return createElement(
        'svg',
        {
          ref,
          ...defaultAttributes,
          width: size,
          height: size,
          stroke: color,
          strokeWidth: calculatedStrokeWidth,
          className: mergeClasses(
            'lucide',
            `lucide-${toKebabCase(toPascalCase(iconName))}`,
            `lucide-${iconName}`,
            className,
          ),
          ...a11yDefaults,
          ...rest,
        },
        [
          ...iconNode.map(([tag, attrs]) => createElement(tag, attrs)),
          ...(Array.isArray(children) ? children : [children]),
        ],
      )
    },
  )

  Component.displayName = toPascalCase(iconName)
  return Component
}
