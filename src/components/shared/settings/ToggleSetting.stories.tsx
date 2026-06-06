import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { ToggleSetting } from './ToggleSetting'

const meta: Meta<typeof ToggleSetting> = {
  title: 'Settings/ToggleSetting',
  component: ToggleSetting,
}

export default meta
type Story = StoryObj<typeof ToggleSetting>

function ToggleSettingDemo() {
  const [checked, setChecked] = useState(false)
  return (
    <div className="max-w-md p-6 bg-[#11131e] rounded-2xl">
      <ToggleSetting
        label="Sound enabled"
        description="Play chimes when study blocks complete."
        checked={checked}
        onChange={setChecked}
      />
    </div>
  )
}

export const Off: Story = {
  render: () => <ToggleSettingDemo />,
}
