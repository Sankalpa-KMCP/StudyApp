import { memo } from 'react'
import { Lock } from 'lucide-react'
import type { ActiveTab } from '../types/app'
import { useTranslation } from '../i18n/useTranslation'

export type NavTabButtonVariant = 'sidebar-expanded' | 'sidebar-rail' | 'mobile'

interface NavTabButtonProps {
  variant: NavTabButtonVariant
  tabId: ActiveTab
  label: string
  icon: React.FC<{ className?: string }>
  iconColor: string
  accent: ActiveTab
  isActive: boolean
  isLocked: boolean
  badge?: number
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void
  onMouseLeave?: () => void
  onTouchStart?: () => void
  buttonRef?: (el: HTMLButtonElement | null) => void
}

function formatBadge(count: number): string {
  return count > 99 ? '99+' : String(count)
}

function NavTabBadge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={`rounded-full bg-accent-amber/15 border border-accent-amber/25 px-1.5 py-0.5 text-micro font-bold leading-none text-accent-amber ${className}`}
      aria-hidden
    >
      {formatBadge(count)}
    </span>
  )
}

import { t } from '../i18n'

function buildAriaLabel(label: string, badge: number, isLocked: boolean): string {
  let aria = badge > 0 ? `${label}, ${t('navTabDueForReview', { count: badge })}` : label
  if (isLocked) {
    aria = `${aria}, ${t('navTabLockoutSuffix')}`
  }
  return aria
}

export const NavTabButton = memo(function NavTabButton({
  variant,
  tabId,
  label,
  icon: Icon,
  iconColor,
  accent,
  isActive,
  isLocked,
  badge = 0,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  buttonRef,
}: NavTabButtonProps) {
  const { t } = useTranslation()
  const lockedClass = isLocked ? 'opacity-50' : ''
  const ariaLabel = buildAriaLabel(label, badge, isLocked)

  const lockIcon = isLocked ? (
    <Lock className="h-3 w-3 shrink-0 text-muted" aria-hidden />
  ) : null

  const sharedDataAttrs = {
    'data-tab': tabId,
    'data-accent': accent,
    'data-active': isActive ? 'true' : 'false',
    ...(isLocked ? { 'data-locked': 'true' as const } : {}),
  }

  if (variant === 'sidebar-rail') {
    return (
      <button
        ref={buttonRef}
        type="button"
        {...sharedDataAttrs}
        aria-current={isActive ? 'page' : undefined}
        aria-label={ariaLabel}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`sidebar-rail-btn relative h-10 w-10 flex items-center justify-center rounded-[14px] font-semibold text-xs transition-all duration-200 ios-active-scale border cursor-pointer ${lockedClass}`}
      >
        <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? iconColor : 'text-secondary'}`} />
        {isLocked && (
          <span className="absolute -bottom-0.5 -right-0.5">{lockIcon}</span>
        )}
        {badge > 0 && (
          <NavTabBadge count={badge} className="absolute -top-1 -right-1 min-w-[18px] text-center px-1" />
        )}
      </button>
    )
  }

  if (variant === 'mobile') {
    return (
      <button
        ref={buttonRef}
        type="button"
        {...sharedDataAttrs}
        aria-current={isActive ? 'page' : undefined}
        aria-label={ariaLabel}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onTouchStart={onTouchStart}
        className={`mobile-nav-btn relative flex flex-col items-center justify-center gap-0.5 px-2.5 py-2.5 min-h-[44px] rounded-xl text-label font-semibold transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue ${lockedClass}`}
      >
        {badge > 0 && (
          <NavTabBadge count={badge} className="absolute top-0 right-1 z-20" />
        )}
        <span className="relative z-10 flex items-center gap-0.5">
          {isLocked && lockIcon}
          <Icon className={`h-5 w-5 ${isActive ? iconColor : 'text-muted'}`} />
        </span>
        <span className="relative z-10">{label}</span>
      </button>
    )
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      {...sharedDataAttrs}
      aria-current={isActive ? 'page' : undefined}
      aria-label={ariaLabel}
      title={isLocked ? `${t('focusLockout')} active` : label}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`nav-tab w-full ios-active-scale cursor-pointer ${lockedClass}`}
    >
      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? iconColor : 'text-secondary'}`} />
      <span className="whitespace-nowrap">{label}</span>
      {isLocked && lockIcon}
      <NavTabBadge count={badge} className="ml-auto" />
    </button>
  )
})
