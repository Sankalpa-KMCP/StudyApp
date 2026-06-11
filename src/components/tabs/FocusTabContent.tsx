import { FocusSanctuary } from '../FocusSanctuary'
import { TaskRegistry } from '../TaskRegistry'
import { TabPageShell } from '../shared/TabPageShell'
import { useStudyData, useStudyUI, useStudyTimer } from '../../context/useStudyApp'
import { useConfirm } from '../../context/useConfirm'
import { END_BREAK_EARLY_BODY, END_BREAK_EARLY_CONFIRM } from '../../lib/uxTerms'

export function FocusTabContent() {
  const { settings, tasks, categories } = useStudyData()
  const { setIsZenMode, activeTaskId, setActiveTaskId, taskCycleCount, setTaskCycleCount } = useStudyUI()
  const { timer, ensureAudio, handleAddTask, handleToggleTask, activateTask } = useStudyTimer()
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
    if (ok) timer.skipBreak()
  }

  return (
    <TabPageShell className="pb-20 lg:pb-0">
      <div className="lg:col-span-5 order-1">
        <FocusSanctuary
          timerMode={timer.timerMode}
          isTimerActive={timer.isTimerActive}
          setIsTimerActive={timer.setIsTimerActive}
          remainingSeconds={timer.remainingSeconds}
          secondsElapsed={timer.secondsElapsed}
          progress={timer.progress}
          isLongBreak={timer.isLongBreak}
          completedSessionsInCycle={timer.completedSessionsInCycle}
          targetSessionsPerCycle={settings.targetSessionsPerCycle}
          handleModeSwitch={timer.handleModeSwitch}
          completeSession={() => { void timer.completeSession() }}
          extendSession={timer.extendSession}
          skipBreak={timer.skipBreak}
          onSkipBreak={handleSkipBreak}
          setIsZenMode={setIsZenMode}
          onUserGesture={ensureAudio}
          showReflectionModal={timer.showReflectionModal}
          studyBlockDurationMinutes={settings.studyBlockDurationMinutes}
          shortBreakDurationMinutes={settings.shortBreakDurationMinutes}
          longBreakDurationMinutes={settings.longBreakDurationMinutes}
          updateSetting={settings.updateSetting}
          activeTask={activeTask}
        />
      </div>
      <div className="lg:col-span-7 order-2">
        <TaskRegistry
          tasks={tasks.tasks}
          categories={categories.categories}
          addCategory={categories.addCategory}
          deleteCategory={categories.deleteCategory}
          activeTaskId={activeTaskId}
          setActiveTaskId={setActiveTaskId}
          activateTask={activateTask}
          toggleTask={handleToggleTask}
          handleAddTask={handleAddTask}
          submitRecallGrade={timer.submitRecallGrade}
          timerCategoryId={timer.timerCategoryId}
          setTimerCategoryId={timer.setTimerCategoryId}
          timerMode={timer.timerMode}
          taskCycleCount={taskCycleCount}
          setTaskCycleCount={setTaskCycleCount}
        />
      </div>
    </TabPageShell>
  )
}
