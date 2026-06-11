import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConfirmProvider } from '../../context/ConfirmProvider'
import { BackupVaultPanel } from './BackupVaultPanel'

const meta: Meta<typeof BackupVaultPanel> = {
  title: 'Settings/BackupVaultPanel',
  component: BackupVaultPanel,
  decorators: [
    Story => (
      <ConfirmProvider>
        <div className="max-w-2xl p-6 bg-[#0d0a1b]">
          <p className="text-white/60 text-sm mb-4">Requires SettingsPanelProvider — see Settings tab in app.</p>
          <Story />
        </div>
      </ConfirmProvider>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof BackupVaultPanel>

export const Default: Story = {
  render: () => <BackupVaultPanel />,
}
