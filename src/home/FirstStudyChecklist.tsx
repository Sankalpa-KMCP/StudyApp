import { ArrowRight, Check } from '../components/icons'

type FirstStudyStep = {
  title: string
  body: string
  actionLabel: string
  complete: boolean
  onAction: () => void
}

export function FirstStudyChecklist(props: {
  hasSubject: boolean
  hasPlan: boolean
  hasSession: boolean
  onCreateSubject: () => void
  onCreatePlan: () => void
  onLogSession: () => void
}) {
  const steps: FirstStudyStep[] = [
    {
      title: 'Create a subject',
      body: 'Give your study work a clear home.',
      actionLabel: 'Create subject',
      complete: props.hasSubject,
      onAction: props.onCreateSubject,
    },
    {
      title: 'Plan a study action',
      body: 'Add a task or calendar event.',
      actionLabel: 'Plan task',
      complete: props.hasPlan,
      onAction: props.onCreatePlan,
    },
    {
      title: 'Record study time',
      body: 'Use focus or log a completed session.',
      actionLabel: 'Log session',
      complete: props.hasSession,
      onAction: props.onLogSession,
    },
  ]
  const completedCount = steps.filter((step) => step.complete).length

  if (completedCount === steps.length) return null

  const progressText = `${completedCount} of ${steps.length} steps complete`

  return (
    <section className="first-study-checklist" aria-labelledby="first-study-title">
      <div className="first-study-heading">
        <div>
          <span className="eyebrow">Getting started</span>
          <h2 id="first-study-title">Your first study loop</h2>
          <p>Set up one useful plan, then record the work.</p>
        </div>
        <div className="first-study-progress-copy">
          <strong aria-live="polite">{completedCount}/{steps.length}</strong>
          <span>complete</span>
        </div>
      </div>
      <div
        className="first-study-progress"
        role="progressbar"
        aria-label="First study loop progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={completedCount}
        aria-valuetext={progressText}
      >
        <span style={{ width: `${(completedCount / steps.length) * 100}%` }} />
      </div>
      <ol className="first-study-steps">
        {steps.map((step, index) => (
          <li className={step.complete ? 'first-study-step is-complete' : 'first-study-step'} key={step.title}>
            <span className="first-study-marker" aria-hidden="true">
              {step.complete ? <Check size={16} /> : index + 1}
            </span>
            <div className="first-study-step-copy">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
            {step.complete ? (
              <span className="first-study-status">
                <Check size={14} aria-hidden="true" />
                Complete
              </span>
            ) : (
              <button className="first-study-action" type="button" onClick={step.onAction}>
                {step.actionLabel}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
