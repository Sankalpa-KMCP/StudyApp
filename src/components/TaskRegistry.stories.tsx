import type { Meta, StoryObj } from '@storybook/react-vite'
import { TaskRegistry } from './TaskRegistry'

const meta: Meta<typeof TaskRegistry> = {
  title: 'Features/TaskRegistry',
  component: TaskRegistry,
}

export default meta
type Story = StoryObj<typeof TaskRegistry>

export const Default: Story = {
  render: () => (
    <div className="max-w-2xl p-6" style={{ background: '#0a0b10' }}>
      <TaskRegistry
        tasks={[
          { id: 1, text: 'Read chapter 4', completed: false, createdAt: Date.now(), estimatedCycles: 2, actualCycles: 0, priority: 'high' },
        ]}
        categories={[{ id: 1, name: 'Math', color: '#3B82F6' }]}
        addCategory={async () => 2}
        deleteCategory={async () => {}}
        activeTaskId={null}
        setActiveTaskId={() => {}}
        activateTask={() => {}}
        toggleTask={async () => {}}
        handleAddTask={() => {}}
        submitRecallGrade={async () => {}}
        timerCategoryId={1}
        setTimerCategoryId={() => {}}
        timerMode="study"
        taskCycleCount={1}
        setTaskCycleCount={() => {}}
      />
    </div>
  ),
}
