import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef } from 'react'
import { ConfirmProvider } from '../context/ConfirmProvider'
import { ControlDeck } from './ControlDeck'

const meta: Meta<typeof ControlDeck> = {
  title: 'Features/ControlDeck',
  component: ControlDeck,
  decorators: [
    Story => (
      <ConfirmProvider>
        <Story />
      </ConfirmProvider>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ControlDeck>

function DeckStory() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="max-w-4xl p-6" style={{ background: '#0d0a1b' }}>
      <ControlDeck
        updateSetting={() => {}}
        theme="midnight"
        cardOpacity={0.06}
        backdropBlur={24}
        initialEasinessFactor={2.5}
        dailyGoalMinutes={480}
        studyBlockDurationMinutes={25}
        shortBreakDurationMinutes={5}
        longBreakDurationMinutes={15}
        targetSessionsPerCycle={4}
        soundEnabled
        tactileEnabled
        developerFont="inter"
        enforceLockout={false}
        autoPauseOnHidden={true}
        autoArchiveAncientTasks
        exportStudyBackup={() => {}}
        exportStudyLogsCSV={() => {}}
        exportTaskCompletionLogsCSV={() => {}}
        importStudyBackup={() => {}}
        resetData={() => {}}
        resetDataSelective={() => {}}
        categories={[{ id: 1, name: 'Math', color: '#3B82F6' }]}
        addCategory={() => {}}
        deleteCategory={() => {}}
        isDragging={false}
        setIsDragging={() => {}}
        handleFileDrop={() => {}}
        fileInputRef={fileInputRef}
      />
    </div>
  )
}

export const Default: Story = {
  render: () => <DeckStory />,
}
