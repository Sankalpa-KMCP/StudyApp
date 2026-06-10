import type { Meta, StoryObj } from '@storybook/react-vite'
import { FocusSanctuary } from './FocusSanctuary'

const meta: Meta<typeof FocusSanctuary> = {
  title: 'Focus/FocusSanctuary',
  component: FocusSanctuary,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof FocusSanctuary>

export const Idle: Story = {
  args: {
    timerMode: 'study',
    isTimerActive: false,
    setIsTimerActive: () => {},
    remainingSeconds: 25 * 60,
    secondsElapsed: 0,
    progress: 0.35,
    isLongBreak: false,
    completedSessionsInCycle: 1,
    targetSessionsPerCycle: 4,
    handleModeSwitch: () => {},
    completeSession: async () => {},
    extendSession: () => {},
    skipBreak: () => {},
    setIsZenMode: () => {},
    onUserGesture: () => {},
    studyBlockDurationMinutes: 25,
    shortBreakDurationMinutes: 5,
    longBreakDurationMinutes: 15,
    updateSetting: () => {},
  },
}
