import type { ActiveTab } from '../types/app'

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
  onClick: () => void
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void
  onMouseLeave?: () => void
  buttonRef?: (el: HTMLButtonElement | null) => void
}

export function NavTabButton({
  variant,
  tabId,
  label,
  icon: Icon,
  iconColor,
  accent,
  isActive,
  isLocked,
  onClick,
  onMouseEnter,
  onMouseLeave,
  buttonRef,
}: NavTabButtonProps) {
  const lockedClass = isLocked ? 'opacity-40' : 'cursor-pointer'

  if (variant === 'sidebar-rail') {
    return (
      <button
        ref={buttonRef}
        type="button"
        data-tab={tabId}
        data-accent={accent}
        data-active={isActive ? 'true' : 'false'}
        aria-current={isActive ? 'page' : undefined}
        aria-label={label}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`sidebar-rail-btn h-10 w-10 flex items-center justify-center rounded-[14px] font-semibold text-xs transition-all duration-200 ios-active-scale border ${lockedClass}`}
      >
        <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? iconColor : 'text-white/60'}`} />
      </button>
    )
  }

  if (variant === 'mobile') {
    return (
      <button
        ref={buttonRef}
        type="button"
        data-tab={tabId}
        data-accent={accent}
        data-active={isActive ? 'true' : 'false'}
        aria-current={isActive ? 'page' : undefined}
        aria-label={label}
        onClick={onClick}
        className={`mobile-nav-btn relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-label font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue ${lockedClass}`}
      >
        <Icon className={`relative z-10 h-5 w-5 ${isActive ? iconColor : 'text-white/50'}`} />
        <span className="relative z-10">{label}</span>
      </button>
    )
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      data-tab={tabId}
      data-accent={accent}
      data-active={isActive ? 'true' : 'false'}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
      title={isLocked ? 'Focus lockout active' : label}
      onClick={onClick}
      className={`nav-tab w-full ios-active-scale ${lockedClass}`}
    >
      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? iconColor : 'text-white/60'}`} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
}
