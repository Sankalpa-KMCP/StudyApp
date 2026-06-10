import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef } from 'react'
import { ConfirmProvider } from '../../context/ConfirmProvider'
import { BackupVaultPanel } from './BackupVaultPanel'

const meta: Meta<typeof BackupVaultPanel> = {
  title: 'Settings/BackupVaultPanel',
  component: BackupVaultPanel,
  decorators: [
    Story => (
      <ConfirmProvider>
        <div className="max-w-2xl p-6 bg-[#0d0a1b]">
          <Story />
        </div>
      </ConfirmProvider>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof BackupVaultPanel>

function PanelStory() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  return (
    <BackupVaultPanel
      exportStudyBackup={() => {}}
      exportStudyLogsCSV={() => {}}
      exportTaskCompletionLogsCSV={() => {}}
      importStudyBackup={() => {}}
      resetData={() => {}}
      resetDataSelective={() => {}}
      clearSnapshots={() => {}}
      isDragging={false}
      setIsDragging={() => {}}
      handleFileDrop={() => {}}
      fileInputRef={fileInputRef}
    />
  )
}

export const Default: Story = {
  render: () => <PanelStory />,
}
