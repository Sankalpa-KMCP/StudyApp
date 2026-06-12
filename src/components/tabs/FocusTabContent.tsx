import { memo, useEffect, useState } from 'react'
import { FocusSanctuary } from '../FocusSanctuary'
import { TaskRegistry } from '../TaskRegistry'
import { TabPageShell } from '../shared/TabPageShell'
import { useStudyData, useStudyUI } from '../../context/useStudyApp'
import { useStudyTimerContext } from '../../context/studyTimerContext'
import { useConfirm } from '../../context/useConfirm'
import { useTranslation } from '../../i18n/useTranslation'
import { scrollToSettingsSectionWhenReady } from '../../lib/settings/settingsSections'
import {
  clearFirstSessionPending,
  FIRST_SESSION_CHANGED_EVENT,
  isFirstSessionPending,
} from '../../lib/study/firstSession'
import { FlashcardsDueBanner } from '../flashcard/FlashcardsDueBanner'
import { FlashcardsEnableBanner } from '../flashcard/FlashcardsEnableBanner'
import { FirstSessionBanner } from '../focus/FirstSessionBanner'
import { setFlashcardReviewPending } from '../../lib/study/flashcardReviewPending'

const MemoizedTaskRegistry = memo(TaskRegistry)

export function FocusTabContent() {
  const { settings, tasks, categories, flashcards } = useStudyData()
  const { setIsZenMode, setActiveTab, activeTaskId, setActiveTaskId, taskCycleCount, setTaskCycleCount } = useStudyUI()
  const {
    timerControls,
    ensureAudio,
    handleAddTask,
    handleToggleTask,
    activateTask,
  } = useStudyTimerContext()
  const { requestConfirm } = useConfirm()
  const { t } = useTranslation()
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
      confirmLabel: 'End break',
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

  return (
    <TabPageShell className="pb-20 lg:pb-0">
      <div className="lg:col-span-5 order-1">
        {showFirstSessionBanner && (
          <FirstSessionBanner onDismiss={handleDismissFirstSession} />
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
      <div className="lg:col-span-7 order-2">
        {!settings.flashcardsEnabled && (
          <FlashcardsEnableBanner
            onEnable={() => {
              void setActiveTab('settings')
              scrollToSettingsSectionWhenReady('settings-flashcards')
            }}
          />
        )}
        {settings.flashcardsEnabled && (
          <FlashcardsDueBanner
            flashcards={flashcards.flashcards}
            onReview={() => {
              setFlashcardReviewPending()
              void setActiveTab('cards')
            }}
          />
        )}
        <MemoizedTaskRegistry
          tasks={tasks.tasks}
          categories={categories.categories}
          addCategory={categories.addCategory}
          deleteCategory={categories.deleteCategory}
          activeTaskId={activeTaskId}
          setActiveTaskId={setActiveTaskId}
          activateTask={activateTask}
          toggleTask={handleToggleTask}
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
