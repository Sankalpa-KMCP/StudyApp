import type { Meta, StoryObj } from '@storybook/react-vite'
import { ReflectionModal } from './ReflectionModal'

const meta: Meta<typeof ReflectionModal> = {
  title: 'Focus/ReflectionModal',
  component: ReflectionModal,
}

export default meta
type Story = StoryObj<typeof ReflectionModal>

export const Open: Story = {
  args: {
    showReflectionModal: true,
    pendingSessionData: {
      elapsed: 1500,
      mode: 'study',
      timestamp: 'June 10, 14:30',
    },
    studyBlockDurationMinutes: 25,
    attentionRating: 4,
    setAttentionRating: () => {},
    stabilityRating: 4,
    setStabilityRating: () => {},
    localSessionNotes: '',
    setLocalSessionNotes: () => {},
    onSubmitReflection: async () => {},
  },
}
