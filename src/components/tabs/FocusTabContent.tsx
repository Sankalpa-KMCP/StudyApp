import { FocusSanctuary } from '../FocusSanctuary'
import { TaskRegistry } from '../TaskRegistry'
import { useStudyData, useStudyUI, useStudyTimer } from '../../context/useStudyApp'

export function FocusTabContent() {
  const { settings, tasks, categories } = useStudyData()
  const { breathTime, setIsZenMode, activeTaskId, setActiveTaskId, taskCycleCount, setTaskCycleCount, progress } = useStudyUI()
  const { timer, ensureAudio, handleAddTask, handleToggleTask } = useStudyTimer()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 items-start">
      <div className="lg:col-span-5">
        <FocusSanctuary
          timerMode={timer.timerMode}
          isTimerActive={timer.isTimerActive}
          setIsTimerActive={timer.setIsTimerActive}
          remainingSeconds={timer.remainingSeconds}
          secondsElapsed={timer.secondsElapsed}
          progress={progress}
          isLongBreak={timer.isLongBreak}
          completedSessionsInCycle={timer.completedSessionsInCycle}
          targetSessionsPerCycle={settings.targetSessionsPerCycle}
          handleModeSwitch={timer.handleModeSwitch}
          completeSession={timer.completeSession}
          extendSession={timer.extendSession}
          skipBreak={timer.skipBreak}
          breathTime={breathTime}
          setIsZenMode={setIsZenMode}
          onUserGesture={ensureAudio}
          showReflectionModal={timer.showReflectionModal}
        />
      </div>
      <div className="lg:col-span-7">
        <TaskRegistry
          tasks={tasks.tasks}
          categories={categories.categories}
          activeTaskId={activeTaskId}
          setActiveTaskId={setActiveTaskId}
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
    </div>
  )
}
