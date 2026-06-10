import React, { useState } from 'react'
import { Sparkles, Clock, RefreshCw, BarChart3, ChevronRight, Check } from 'lucide-react'
import { ModalShell } from './shared/ModalShell'

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
}

interface OnboardingBullet {
  text: string
  helper?: string
}

interface OnboardingSlide {
  title: string
  description: string
  icon: typeof Sparkles
  color: string
  bullets: OnboardingBullet[]
}

const SLIDES: OnboardingSlide[] = [
  {
    title: 'Welcome to Sanctuary Study',
    description: 'A premium, offline-first dashboard designed to protect your focus, track study sprints, and supercharge your active recall.',
    icon: Sparkles,
    color: 'text-accent-blue bg-accent-blue/10 border-accent-blue/20',
    bullets: [
      { text: '🔒 100% Local-First', helper: 'Your data never leaves this device.' },
      { text: '✨ Premium Aesthetics', helper: 'Dark mode and glass UI built in.' },
      { text: '🌬️ Breathing pacer during breaks', helper: 'Optional guided breathing when you rest.' },
    ],
  },
  {
    title: 'Focus Targets & Timer',
    description: 'Set your sights on one task at a time to optimize productivity and eliminate distractions.',
    icon: Clock,
    color: 'text-accent-amber bg-accent-amber/10 border-accent-amber/20',
    bullets: [
      { text: '📝 Focus Targets', helper: 'Add tasks with subject, priority, and cycles.' },
      { text: '🎯 Active Target', helper: 'Click a task to link it to the live timer.' },
      { text: '⏳ Live Adjustments', helper: 'Change focus length from the timer panel.' },
    ],
  },
  {
    title: 'Active Recall (SM-2)',
    description: 'Retain information efficiently with integrated spaced repetition scheduling.',
    icon: RefreshCw,
    color: 'text-accent-purple bg-accent-purple/10 border-accent-purple/20',
    bullets: [
      { text: '🔄 Spaced repetition toggle', helper: 'Turn review scheduling on for tasks and cards.' },
      { text: '🧠 SM-2 scheduling', helper: 'Grades set when you will see this again.' },
      { text: '📊 Retention charts', helper: 'Track recall trends in Analytics.' },
    ],
  },
  {
    title: 'Interactive Dashboard',
    description: 'Review your study history, daily logs, level XP, and category breakdown.',
    icon: BarChart3,
    color: 'text-accent-green bg-accent-green/10 border-accent-green/20',
    bullets: [
      { text: '🔥 Streak & Level XP', helper: 'Stay motivated with gamified progress.' },
      { text: '📈 Advanced Insights', helper: 'Peak day, completion rate, and subjects.' },
      { text: '📓 Journal', helper: 'Browse notes and logs for past focus days.' },
      { text: '📝 Quick Notes vs Journal', helper: 'Quick Notes is a scratch pad; Journal is your study log by day.' },
    ],
  },
]

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0)

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(s => s + 1)
    } else {
      onClose()
      requestAnimationFrame(() => {
        const input = document.getElementById('task-input')
        input?.focus()
        if (!localStorage.getItem('sanctuary_first_task_hint')) {
          localStorage.setItem('sanctuary_first_task_hint', 'shown')
          input?.classList.add('ring-2', 'ring-accent-blue/40')
          window.setTimeout(() => input?.classList.remove('ring-2', 'ring-accent-blue/40'), 2500)
        }
      })
    }
  }

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(s => s - 1)
    }
  }

  const slide = SLIDES[currentSlide]
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
          onClick={onClose}
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
          {slide.bullets.map((bullet, idx) => (
            <li key={idx} className="text-[11px] font-semibold text-white/80 flex flex-col gap-0.5 bg-white/[0.02] border border-white/5 px-3 py-2 rounded-xl animate-fade-in">
              <span className="leading-relaxed">{bullet.text}</span>
              {bullet.helper && (
                <span className="text-[10px] font-medium text-white/45 leading-relaxed">{bullet.helper}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/5 select-none">
        <div className="flex gap-1.5">
          {SLIDES.map((_, idx) => (
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
              Back
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-[10px] font-bold bg-accent-blue hover:bg-accent-blue/90 border border-white/10 text-white transition-all cursor-pointer shadow-md shadow-accent-blue/15"
          >
            <span>{currentSlide === SLIDES.length - 1 ? 'Create your first focus target' : 'Next'}</span>
            {currentSlide === SLIDES.length - 1 ? <Check className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
