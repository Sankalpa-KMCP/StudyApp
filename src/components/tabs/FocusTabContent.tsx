import { memo, useEffect, useState } from 'react'
import { FocusSanctuary } from '../FocusSanctuary'
import { TaskRegistry } from '../TaskRegistry'
import { TabPageShell } from '../shared/TabPageShell'
import { useStudyData, useStudyUI } from '../../context/useStudyApp'
import { useStudyTimerContext } from '../../context/studyTimerContext'
import { useConfirm } from '../../context/useConfirm'
import { useTranslation } from '../../i18n/useTranslation'
import {
  clearFirstSessionPending,
  FIRST_SESSION_CHANGED_EVENT,
  isFirstSessionPending,
} from '../../lib/study/firstSession'
import { FirstSessionBanner } from '../focus/FirstSessionBanner'
import { ReviewDueBanner } from '../focus/ReviewDueBanner'
import { useReviewDueCount } from '../../hooks/useReviewDueCount'

const MemoizedTaskRegistry = memo(TaskRegistry)

export function FocusTabContent() {
  const { tasks, categories } = useStudyData()
  const { setIsZenMode, activeTaskId, setActiveTaskId, taskCycleCount, setTaskCycleCount } = useStudyUI()
  const {
    timerControls,
    ensureAudio,
    handleAddTask,
    handleToggleTask,
    activateTask,
  } = useStudyTimerContext()
  const { requestConfirm } = useConfirm()
  const { t } = useTranslation()
  const reviewDueCount = useReviewDueCount(tasks.tasks)
  const [firstSessionActive, setFirstSessionActive] = useState(isFirstSessionPending)

  useEffect(() => {
    const sync = () => setFirstSessionActive(isFirstSessionPending())
    window.addEventListener(FIRST_SESSION_CHANGED_EVENT, sync)
    return () => window.removeEventListener(FIRST_SESSION_CHANGED_EVENT, sync)
  }, [])

  const activeTask = activeTaskId != null
    ? tasks.tasks.find(t => t.id === activeTaskId) ?? null
    : null

  const showFirstSessionBanner =
    firstSessionActive &&
    tasks.tasks.length === 0 &&
    !timerControls.isTimerActive

  useEffect(() => {
    if (!showFirstSessionBanner) return
    requestAnimationFrame(() => {
      const input = document.getElementById('task-input') ?? document.getElementById('task-input-mobile')
      input?.focus()
    })
  }, [showFirstSessionBanner])

  const handleSkipBreak = async () => {
    const ok = await requestConfirm({
      title: t('endBreakEarlyConfirm'),
      message: t('endBreakEarlyBody'),
      confirmLabel: t('endBreakEarly'),
    })
    if (ok) timerControls.skipBreak()
  }

  const handleDismissFirstSession = () => {
    clearFirstSessionPending()
    setFirstSessionActive(false)
  }

  const handleAddTaskWithFirstSessionClear = (...args: Parameters<typeof handleAddTask>) => {
    clearFirstSessionPending()
    setFirstSessionActive(false)
    return handleAddTask(...args)
  }

  const handleViewReviewQueue = () => {
    document.getElementById('review-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <TabPageShell className="h-full min-h-0 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] xl:pb-0 xl:content-center xl:items-center">
      <div className="order-1 w-full min-h-0 max-w-md mx-auto xl:col-span-5 xl:max-w-none xl:mx-0 xl:self-center">
        {showFirstSessionBanner && (
          <FirstSessionBanner onDismiss={handleDismissFirstSession} />
        )}
        {reviewDueCount > 0 && (
          <ReviewDueBanner count={reviewDueCount} onViewQueue={handleViewReviewQueue} />
        )}
        <FocusSanctuary
          activeTask={activeTask}
          setIsZenMode={setIsZenMode}
          onUserGesture={ensureAudio}
          onSkipBreak={handleSkipBreak}
          onTimerStart={() => {
            clearFirstSessionPending()
            setFirstSessionActive(false)
          }}
        />
      </div>
      <div className="order-2 w-full min-h-0 flex flex-col h-fit xl:col-span-7 xl:self-center">
        <MemoizedTaskRegistry
          tasks={tasks.tasks}
          categories={categories.categories}
          addCategory={categories.addCategory}
          deleteCategory={categories.deleteCategory}
          activeTaskId={activeTaskId}
          setActiveTaskId={setActiveTaskId}
          activateTask={activateTask}
          toggleTask={handleToggleTask}
          updateSubtasks={tasks.updateSubtasks}
          handleAddTask={handleAddTaskWithFirstSessionClear}
          submitRecallGrade={timerControls.submitRecallGrade}
          timerCategoryId={timerControls.timerCategoryId}
          setTimerCategoryId={timerControls.setTimerCategoryId}
          timerMode={timerControls.timerMode}
          taskCycleCount={taskCycleCount}
          setTaskCycleCount={setTaskCycleCount}
        />
      </div>
    </TabPageShell>
  )
}
