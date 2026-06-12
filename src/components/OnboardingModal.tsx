import React, { useState } from 'react'
import { Sparkles, Clock, Target, ChevronRight, Check, Lock, Heart, RefreshCw, Layers } from 'lucide-react'
import { ModalShell } from './shared/ModalShell'
import { SelectionChip } from './shared/SelectionChip'
import { useTranslation } from '../i18n/useTranslation'
import type { TranslationKey } from '../i18n'
import { markDailyGoalConfigured } from '../lib/study/setupChecklist'
import { markFirstSessionPending } from '../lib/study/firstSession'
import type { SettingsKey, SettingsValue } from '../db/types'

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  updateSetting?: (key: SettingsKey, val: SettingsValue) => void
  onOpenBackup?: () => void
  onReplayTour?: () => void
}

interface OnboardingBulletDef {
  textKey: TranslationKey
  helperKey?: TranslationKey
  icon: typeof Sparkles
}

interface OnboardingBullet {
  text: string
  helper?: string
  icon: typeof Sparkles
}

interface OnboardingSlide {
  title: string
  description: string
  icon: typeof Sparkles
  color: string
  bullets: OnboardingBullet[]
  showGoalPicker?: boolean
}

const GOAL_OPTIONS = [60, 120, 240, 480] as const

const SLIDE_BULLET_DEFS: Array<Omit<OnboardingSlide, 'title' | 'description' | 'bullets'> & {
  bullets: OnboardingBulletDef[]
}> = [
  {
    icon: Sparkles,
    color: 'text-accent-blue bg-accent-blue/10 border-accent-blue/20',
    bullets: [
      { textKey: 'onboardingBulletLocalFirst', helperKey: 'onboardingBulletLocalFirstHelper', icon: Lock },
      { textKey: 'onboardingBulletAesthetics', helperKey: 'onboardingBulletAestheticsHelper', icon: Sparkles },
      { textKey: 'onboardingBulletBreathing', helperKey: 'onboardingBulletBreathingHelper', icon: Heart },
    ],
  },
  {
    icon: Clock,
    color: 'text-accent-amber bg-accent-amber/10 border-accent-amber/20',
    bullets: [
      { textKey: 'onboardingBulletFocusTargets', helperKey: 'onboardingBulletFocusTargetsHelper', icon: Target },
      { textKey: 'onboardingBulletStudyBlocks', helperKey: 'onboardingBulletStudyBlocksHelper', icon: Clock },
      { textKey: 'onboardingBulletFocusLockout', helperKey: 'onboardingBulletFocusLockoutHelper', icon: RefreshCw },
      { textKey: 'onboardingBulletFlashcards', helperKey: 'onboardingBulletFlashcardsHelper', icon: Layers },
    ],
    showGoalPicker: true,
  },
]

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  updateSetting,
  onOpenBackup,
  onReplayTour,
}) => {
  const { t } = useTranslation()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number | null>(null)
  const [enableFlashcards, setEnableFlashcards] = useState(false)

  const slides: OnboardingSlide[] = SLIDE_BULLET_DEFS.map((def, index) => ({
    title: index === 0
      ? t('onboardingWelcomeTitle', { productName: t('productName') })
      : t('onboardingFocusLoopTitle'),
    description: index === 0 ? t('onboardingWelcomeDesc') : t('onboardingFocusLoopDesc'),
    icon: def.icon,
    color: def.color,
    showGoalPicker: def.showGoalPicker,
    bullets: def.bullets.map(bullet => ({
      text: t(bullet.textKey),
      helper: bullet.helperKey ? t(bullet.helperKey) : undefined,
      icon: bullet.icon,
    })),
  }))

  const handleFinish = () => {
    markFirstSessionPending()
    if (dailyGoalMinutes != null && updateSetting) {
      updateSetting('dailyGoalMinutes', dailyGoalMinutes)
      markDailyGoalConfigured()
    }
    if (enableFlashcards && updateSetting) {
      updateSetting('flashcardsEnabled', true)
    }
    onClose()
    requestAnimationFrame(() => {
      const input = document.getElementById('task-input') ?? document.getElementById('task-input-mobile')
      input?.focus()
      if (!localStorage.getItem('sanctuary_first_task_hint')) {
        localStorage.setItem('sanctuary_first_task_hint', 'shown')
        input?.classList.add('ring-2', 'ring-accent-blue/40')
        window.setTimeout(() => input?.classList.remove('ring-2', 'ring-accent-blue/40'), 2500)
      }
    })
  }

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(s => s + 1)
    } else {
      handleFinish()
    }
  }

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(s => s - 1)
    }
  }

  const slide = slides[currentSlide]
  const Icon = slide.icon

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      closeOnBackdrop={false}
      ariaLabelledby="onboarding-modal-title"
      ariaDescribedby="onboarding-modal-desc"
      panelClassName="max-w-md bg-white/5 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.08)] overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-white/5 pb-3.5 mb-5 select-none">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-accent-blue" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Getting Started</span>
        </div>
        <button
          type="button"
          onClick={handleFinish}
          aria-label="Skip onboarding tour"
          className="text-xs text-white/40 hover:text-white/80 transition-colors font-semibold cursor-pointer"
        >
          Skip Tour
        </button>
      </div>

      <div className="flex flex-col items-center text-center space-y-4 mb-6">
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border ${slide.color} animate-fade-in`}>
          <Icon className="h-6 w-6" />
        </div>

        <h3 id="onboarding-modal-title" className="text-base font-bold text-white tracking-wide animate-fade-in">
          {slide.title}
        </h3>

        <p id="onboarding-modal-desc" className="text-xs text-white/60 leading-relaxed max-w-sm animate-fade-in">
          {slide.description}
        </p>

        <ul className="w-full text-left space-y-2.5 pt-3 border-t border-white/5">
          {slide.bullets.map((bullet, idx) => {
            const BulletIcon = bullet.icon
            return (
              <li key={idx} className="text-[11px] font-semibold text-white/80 flex gap-2.5 items-start bg-white/[0.02] border border-white/5 px-3 py-2 rounded-xl animate-fade-in">
                <BulletIcon className="h-4 w-4 shrink-0 mt-0.5 text-accent-blue" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="leading-relaxed">{bullet.text}</span>
                  {bullet.helper && (
                    <span className="text-[10px] font-medium text-white/45 leading-relaxed">{bullet.helper}</span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        {slide.showGoalPicker && (
          <div className="w-full pt-3 border-t border-white/5 text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-2">Set your daily goal (optional)</p>
            <div className="flex flex-wrap gap-2">
              {GOAL_OPTIONS.map(mins => (
                <SelectionChip
                  key={mins}
                  selected={dailyGoalMinutes === mins}
                  accent="blue"
                  size="sm"
                  onClick={() => setDailyGoalMinutes(dailyGoalMinutes === mins ? null : mins)}
                >
                  {mins} min
                </SelectionChip>
              ))}
            </div>
            <p className="text-[10px] text-white/40 mt-2 leading-relaxed">
              Fine-tune anytime in Settings → Timer &amp; Focus.
            </p>
            {onReplayTour && (
              <button
                type="button"
                onClick={onReplayTour}
                className="mt-3 text-[10px] font-semibold text-accent-blue hover:underline cursor-pointer"
              >
                Learn more — replay anytime from Settings → Getting started, or the ⋯ menu on mobile
              </button>
            )}
            <label className="mt-4 flex items-center gap-2.5 cursor-pointer rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
              <input
                type="checkbox"
                checked={enableFlashcards}
                onChange={e => setEnableFlashcards(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/20 accent-accent-blue"
              />
              <span className="text-[11px] font-semibold text-white/80">Enable recall deck (optional)</span>
            </label>
          </div>
        )}
      </div>

      {currentSlide === 0 && onOpenBackup && (
        <p className="text-center pb-2">
          <button
            type="button"
            onClick={() => {
              handleFinish()
              onOpenBackup()
            }}
            className="text-[10px] font-semibold text-white/45 hover:text-accent-blue transition-colors cursor-pointer"
          >
            {t('onboardingImportData')}
          </button>
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-white/5 select-none">
        <div className="flex gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentSlide ? 'w-5 bg-accent-blue' : 'w-1.5 bg-white/10 hover:bg-white/25'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {currentSlide > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all cursor-pointer"
            >
              {t('onboardingBack')}
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-[10px] font-bold bg-accent-blue hover:bg-accent-blue/90 border border-white/10 text-white transition-all cursor-pointer shadow-md shadow-accent-blue/15"
          >
            <span>{currentSlide === slides.length - 1 ? t('onboardingFinish') : t('onboardingNext')}</span>
            {currentSlide === slides.length - 1 ? <Check className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
