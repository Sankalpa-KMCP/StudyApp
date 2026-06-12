import { memo } from 'react'
import { FocusSanctuary } from '../FocusSanctuary'
import { TaskRegistry } from '../TaskRegistry'
import { TabPageShell } from '../shared/TabPageShell'
import { useStudyData, useStudyUI } from '../../context/useStudyApp'
import { useStudyTimerContext, useStudyTimerDisplay } from '../../context/studyTimerContext'
import { useConfirm } from '../../context/useConfirm'
import { END_BREAK_EARLY_BODY, END_BREAK_EARLY_CONFIRM } from '../../lib/uxTerms'
import { scrollToSettingsSectionWhenReady } from '../../lib/settingsSections'
import { FlashcardsDueBanner } from '../flashcard/FlashcardsDueBanner'
import { FlashcardsEnableBanner } from '../flashcard/FlashcardsEnableBanner'

const MemoizedTaskRegistry = memo(TaskRegistry)

function FocusSanctuaryWithTimer({
  settings,
  activeTask,
  setIsZenMode,
  ensureAudio,
  onSkipBreak,
}: {
  settings: ReturnType<typeof useStudyData>['settings']
  activeTask: ReturnType<typeof useStudyData>['tasks']['tasks'][number] | null
  setIsZenMode: (zen: boolean) => void
  ensureAudio: () => void
  onSkipBreak: () => void
}) {
  const { timerControls } = useStudyTimerContext()
  const timerDisplay = useStudyTimerDisplay()

  return (
    <FocusSanctuary
      timerMode={timerControls.timerMode}
      isTimerActive={timerControls.isTimerActive}
      setIsTimerActive={timerControls.setIsTimerActive}
      remainingSeconds={timerDisplay.remainingSeconds}
      secondsElapsed={timerDisplay.secondsElapsed}
      progress={timerDisplay.progress}
      isLongBreak={timerControls.isLongBreak}
      completedSessionsInCycle={timerControls.completedSessionsInCycle}
      targetSessionsPerCycle={settings.targetSessionsPerCycle}
      handleModeSwitch={timerControls.handleModeSwitch}
      completeSession={() => { void timerControls.completeSession() }}
      extendSession={timerControls.extendSession}
      skipBreak={timerControls.skipBreak}
      onSkipBreak={onSkipBreak}
      setIsZenMode={setIsZenMode}
      onUserGesture={ensureAudio}
      showReflectionModal={timerControls.showReflectionModal}
      studyBlockDurationMinutes={settings.studyBlockDurationMinutes}
      shortBreakDurationMinutes={settings.shortBreakDurationMinutes}
      longBreakDurationMinutes={settings.longBreakDurationMinutes}
      updateSetting={settings.updateSetting}
      activeTask={activeTask}
      wakeLockActive={timerControls.wakeLockActive}
    />
  )
}

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

  const activeTask = activeTaskId != null
    ? tasks.tasks.find(t => t.id === activeTaskId) ?? null
    : null

  const handleSkipBreak = async () => {
    const ok = await requestConfirm({
      title: END_BREAK_EARLY_CONFIRM,
      message: END_BREAK_EARLY_BODY,
      confirmLabel: 'End break',
    })
    if (ok) timerControls.skipBreak()
  }

  return (
    <TabPageShell className="pb-20 lg:pb-0">
      <div className="lg:col-span-5 order-1">
        <FocusSanctuaryWithTimer
          settings={settings}
          activeTask={activeTask}
          setIsZenMode={setIsZenMode}
          ensureAudio={ensureAudio}
          onSkipBreak={handleSkipBreak}
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
            onReview={() => void setActiveTab('cards')}
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
          handleAddTask={handleAddTask}
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
