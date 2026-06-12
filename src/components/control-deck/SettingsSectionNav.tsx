import { useEffect, useState } from 'react'
import { SETTINGS_SECTIONS, scrollToSettingsSection, type SettingsSectionId } from '../../lib/settingsSections'

interface SettingsSectionNavProps {
  className?: string
  variant?: 'sidebar' | 'pills'
}

export function SettingsSectionNav({ className = '', variant = 'sidebar' }: SettingsSectionNavProps) {
  const [activeId, setActiveId] = useState<SettingsSectionId>('appearance')

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('[data-settings-section]')
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible.length > 0) {
          const id = visible[0].target.id.replace('settings-', '') as SettingsSectionId
          setActiveId(id)
        }
      },
      { threshold: [0.2, 0.35, 0.5], rootMargin: '-10% 0px -55% 0px' },
    )

    sections.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const isPills = variant === 'pills'

  return (
    <nav
      aria-label="Settings sections"
      className={`${isPills ? 'flex gap-2 overflow-x-auto pb-1 custom-scrollbar' : 'flex flex-col gap-1'} ${className}`.trim()}
    >
      {SETTINGS_SECTIONS.map(section => {
        const isActive = activeId === section.id
        const Icon = section.icon
        return (
          <button
            key={section.id}
            type="button"
            id={`nav-${section.id}`}
            aria-current={isActive ? 'location' : undefined}
            onClick={() => scrollToSettingsSection(`settings-${section.id}`)}
            className={
              isPills
                ? `shrink-0 flex items-center gap-2 rounded-full px-3 py-2 text-micro font-semibold transition-all ios-active-scale border ${
                    isActive
                      ? 'bg-accent-blue/15 border-accent-blue/40 text-accent-blue'
                      : 'bg-[color-mix(in_srgb,var(--color-surface-card)_60%,transparent)] border-[var(--color-border-card)] settings-muted'
                  }`
                : `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-all ios-active-scale border-l-2 ${
                    isActive
                      ? 'border-l-accent-blue bg-accent-blue/10 text-[var(--color-text-primary)]'
                      : 'border-l-transparent settings-muted hover:bg-[color-mix(in_srgb,var(--color-surface-card)_50%,transparent)] hover:text-[var(--color-text-primary)]'
                  }`
            }
          >
            <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-accent-blue' : ''}`} aria-hidden />
            <span>{section.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
