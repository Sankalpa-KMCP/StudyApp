import type { Meta, StoryObj } from '@storybook/react-vite'
import { THEME_PROFILES } from './theme'

const meta: Meta = {
  title: 'Theme/Profiles',
}

export default meta
type Story = StoryObj

export const AllThemes: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 p-6">
      {Object.entries(THEME_PROFILES).map(([name, theme]) => (
        <div
          key={name}
          className="rounded-xl p-4 border border-white/10"
          style={{ backgroundColor: theme.surface }}
        >
          <p className="text-white font-bold mb-2">{name}</p>
          <div className="flex gap-2">
            <span className="h-6 w-6 rounded" style={{ backgroundColor: theme.accentBlue }} />
            <span className="h-6 w-6 rounded" style={{ backgroundColor: theme.accentPurple }} />
            <span className="h-6 w-6 rounded" style={{ backgroundColor: theme.accentGreen }} />
          </div>
        </div>
      ))}
    </div>
  ),
}
