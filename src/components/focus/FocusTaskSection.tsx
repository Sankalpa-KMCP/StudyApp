import { useStudyTimerContext } from '../../context/studyTimerContext'
import { Heart } from 'lucide-react'
import { PanelCard } from '../shared/PanelCard'
import type { TaskItem } from '../../db/types'
import { useTranslation } from '../../i18n/useTranslation'

interface FocusActiveTaskLabelProps {
  activeTask?: TaskItem | null
}

export function FocusActiveTaskLabel({ activeTask = null }: FocusActiveTaskLabelProps) {
  const { t } = useTranslation()

  return (
    <p className="text-center text-caption text-muted mb-3 select-none">
      {activeTask
        ? `${t('workingOn')}: ${activeTask.text}`
        : t('noFocusTarget')}
    </p>
  )
}

export function FocusStudyTipSection() {
  const { timerControls } = useStudyTimerContext()

  if (timerControls.timerMode !== 'study') return null

  return (
    <PanelCard className="hidden md:flex select-none flex-col gap-3 !p-4.5">
      <div className="flex items-center justify-between">
        <span className="text-label font-bold tracking-wider text-muted uppercase surface-subtle border border-card px-2 py-0.5 rounded-full">Study tip</span>
        <div className="flex items-center gap-1.5 text-accent-purple">
          <Heart className="h-3.5 w-3.5" />
          <span className="text-label font-bold uppercase tracking-wider">Stay present</span>
        </div>
      </div>
      <div className="glass-tier-2 px-3.5 py-3">
        <p className="text-xs font-bold text-primary">One task at a time</p>
        <p className="text-caption text-muted leading-relaxed mt-1">Pick a single focus target and protect this block from context switches.</p>
      </div>
    </PanelCard>
  )
}
