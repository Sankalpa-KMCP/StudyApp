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
        updateCategory={async () => {}}
        theme="midnight-slate"
        themePreset="midnight-slate"
        lightThemePreset="paper-day"
        uiFont="Inter"
        uiDensity="comfortable"
        cardOpacity={0.06}
        backdropBlur={24}
        backdropSaturate={180}
        cardBorderOpacity={0.08}
        accentBlueOverride={null}
        accentPurpleOverride={null}
        accentGreenOverride={null}
        accentAmberOverride={null}
        noteTagColors={['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#64748b']}
        initialEasinessFactor={2.5}
        dailyGoalMinutes={480}
        studyBlockDurationMinutes={25}
        shortBreakDurationMinutes={5}
        longBreakDurationMinutes={15}
        targetSessionsPerCycle={4}
        recentHistoryLimit={100}
        focusNotificationsEnabled={false}
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
        clearSnapshots={() => {}}
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
