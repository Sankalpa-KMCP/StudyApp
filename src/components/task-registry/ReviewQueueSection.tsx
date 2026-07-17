import { VirtualList } from '../shared/VirtualList'
import type { CategoryItem, TaskItem } from '../../db/types'
import { useTranslation } from '../../i18n/useTranslation'
import type { TranslationKey } from '../../i18n'

const SM2_GRADES = [
  { q: 1, labelKey: 'sm2GradeForgot', titleKey: 'sm2GradeForgotTitle' },
  { q: 2, labelKey: 'sm2GradeHard', titleKey: 'sm2GradeHardTitle' },
  { q: 4, labelKey: 'sm2GradeGood', titleKey: 'sm2GradeGoodTitle' },
  { q: 5, labelKey: 'sm2GradeEasy', titleKey: 'sm2GradeEasyTitle' },
] as const satisfies ReadonlyArray<{ q: number; labelKey: TranslationKey; titleKey: TranslationKey }>

const REVIEW_VIRTUALIZE_THRESHOLD = 25
const REVIEW_ROW_ESTIMATE = 72

export interface ReviewQueueSectionProps {
  reviewQueueList: TaskItem[]
  categoriesMap: Map<number, CategoryItem>
  submitRecallGrade: (task: TaskItem, q: number) => Promise<void>
}

export function ReviewQueueSection({
  reviewQueueList,
  categoriesMap,
  submitRecallGrade,
}: ReviewQueueSectionProps) {
  const { t } = useTranslation()

  if (reviewQueueList.length === 0) return null

  return (
    <div id="review-queue" className="mb-6 p-4 rounded-[20px] surface-subtle border border-card flex flex-col gap-3 shadow-md animate-slide-in-up">
      <div className="flex items-center justify-between border-b border-card pb-2">
        <span className="text-[9.5px] font-bold text-muted uppercase tracking-wider">{t('taskSpacedRepetitionReview')}</span>
        <span className="text-[8.5px] font-bold text-accent-amber bg-accent-amber/10 border border-accent-amber/20 px-2.5 py-0.5 rounded-full select-none">
          {t('taskDueCount', { count: reviewQueueList.length })}
        </span>
      </div>

      <p className="text-micro text-muted">{t('sm2Helper')}</p>
      <VirtualList
        items={reviewQueueList}
        className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1"
        estimateSize={REVIEW_ROW_ESTIMATE}
        enabled={reviewQueueList.length > REVIEW_VIRTUALIZE_THRESHOLD}
        getKey={task => task.id ?? task.text}
        renderItem={task => (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-2 border-b border-card last:border-b-0 hover:surface-subtle px-1 rounded-xl transition-colors duration-200">
            <div className="flex items-center gap-2.5 min-w-0">
              {task.categoryId !== undefined && categoriesMap.has(task.categoryId) && (
                <span
                  className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: `${categoriesMap.get(task.categoryId)!.color}10`,
                    borderColor: `${categoriesMap.get(task.categoryId)!.color}20`,
                    color: categoriesMap.get(task.categoryId)!.color,
                  }}
                >
                  {categoriesMap.get(task.categoryId)!.name}
                </span>
              )}
              <span className="text-xs text-primary font-semibold truncate select-none" title={task.text}>{task.text}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[8px] text-muted font-bold uppercase tracking-wider mr-1.5 hidden sm:inline select-none">{t('taskRecallLabel')}</span>
              {SM2_GRADES.map(({ q, labelKey, titleKey }) => {
                const title = t(titleKey)
                return (
                  <button
                    key={q}
                    type="button"
                    title={title}
                    aria-label={t('taskRecallGradeAria', { q, title, task: task.text })}
                    onClick={() => submitRecallGrade(task, q)}
                    className="min-h-11 min-w-11 sm:min-h-6 sm:min-w-6 rounded-full text-micro sm:text-micro font-bold surface-subtle hover:surface-track text-secondary border border-card transition-all ios-active-scale cursor-pointer flex items-center justify-center px-1"
                  >
                    <span className="sm:hidden">{t(labelKey)}</span>
                    <span className="hidden sm:inline font-mono">{q}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      />
    </div>
  )
}
