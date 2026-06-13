import { useState, useEffect } from 'react'
import { Check, Circle, Sparkles } from 'lucide-react'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { scrollToSettingsSection } from '../../lib/settings/settingsSections'
import { getLastBackupExportAt } from '../../lib/backup/backupMetadata'
import { BACKUP_EXPORTED_EVENT, isDailyGoalConfigured } from '../../lib/study/setupChecklist'
import { useTranslation } from '../../i18n/useTranslation'

const CHECKLIST_DISMISS_KEY = 'settings_setup_checklist_dismissed'

interface SettingsOnboardingBannersProps {
  dailyGoalMinutes: number
  onShowOnboarding?: () => void
}

function ChecklistItem({
  done,
  label,
  onClick,
}: {
  done: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 text-left text-xs font-semibold text-accent-blue hover:text-accent-blue/80 transition-colors ios-active-scale"
    >
      {done ? (
        <Check className="h-4 w-4 shrink-0 text-accent-green" aria-hidden />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      )}
      <span className={done ? 'text-[var(--color-text-secondary)] line-through decoration-white/20' : ''}>
        {label}
      </span>
    </button>
  )
}

export function SettingsOnboardingBanners({
  dailyGoalMinutes,
  onShowOnboarding,
}: SettingsOnboardingBannersProps) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem(CHECKLIST_DISMISS_KEY),
  )
  const [backupDone, setBackupDone] = useState(() => getLastBackupExportAt() !== null)

  useEffect(() => {
    const onBackupExported = () => setBackupDone(true)
    window.addEventListener(BACKUP_EXPORTED_EVENT, onBackupExported)
    return () => window.removeEventListener(BACKUP_EXPORTED_EVENT, onBackupExported)
  }, [])

  const goalSet = isDailyGoalConfigured()
  const showHighGoalNudge = dailyGoalMinutes >= 480

  const dismissChecklist = () => {
    localStorage.setItem(CHECKLIST_DISMISS_KEY, 'true')
    setDismissed(true)
  }

  if (dismissed) {
    if (!onShowOnboarding) return null
    return (
      <SettingsCard id="settings-getting-started" title={t('onboardingGettingStartedTitle')}>
        <button
          type="button"
          onClick={onShowOnboarding}
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border-card)] bg-[color-mix(in_srgb,var(--color-surface-card)_40%,transparent)] px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[color-mix(in_srgb,var(--color-surface-card)_60%,transparent)] transition-all ios-active-scale"
        >
          <Sparkles className="h-4 w-4 text-accent-blue shrink-0" />
          <span>{t('onboardingReplayTour')}</span>
        </button>
      </SettingsCard>
    )
  }

  return (
    <SettingsCard title={t('onboardingSetupChecklistTitle')}>
      <p className="settings-muted leading-relaxed mb-3">
        {t('onboardingSetupChecklistHelper')}
        {showHighGoalNudge && (
          <span className="block mt-2 text-accent-amber">
            {t('onboardingHighGoalNudge')}
          </span>
        )}
      </p>
      <div className="flex flex-col gap-2.5">
        <ChecklistItem
          done={goalSet}
          label={t('onboardingSetDailyGoal')}
          onClick={() => scrollToSettingsSection('settings-timer-focus')}
        />
        <ChecklistItem
          done={backupDone}
          label={t('onboardingExportBackupVault')}
          onClick={() => scrollToSettingsSection('settings-backup-vault')}
        />
      </div>
      <div className="flex flex-wrap gap-3 mt-4">
        {onShowOnboarding && (
          <button
            type="button"
            onClick={onShowOnboarding}
            className="text-micro font-semibold text-accent-blue hover:text-accent-blue/80 transition-colors"
          >
            {t('onboardingTakeTour')}
          </button>
        )}
        <button
          type="button"
          onClick={dismissChecklist}
          className="text-micro font-semibold settings-muted hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t('onboardingDismissChecklist')}
        </button>
      </div>
    </SettingsCard>
  )
}
