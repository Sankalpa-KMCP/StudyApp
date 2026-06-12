import type { Meta, StoryObj } from '@storybook/react-vite'
import { OnboardingModal } from './OnboardingModal'

const meta: Meta<typeof OnboardingModal> = {
  title: 'Features/OnboardingModal',
  component: OnboardingModal,
}

export default meta
type Story = StoryObj<typeof OnboardingModal>

export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    updateSetting: () => {},
    onOpenBackup: () => {},
  },
}
