import type { Meta, StoryObj } from '@storybook/react-vite'
import { THEME_PROFILES, getThemePresetMeta } from './theme'

const meta: Meta = {
  title: 'Theme/Profiles',
}

export default meta
type Story = StoryObj

export const AllThemes: Story = {
  render: () => (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-6">
      {getThemePresetMeta().map(({ id, label, description, isLight }) => {
        const theme = THEME_PROFILES[id]
        const textColor = theme.textPrimary ?? (isLight ? '#1a1a2e' : '#ffffff')
        return (
          <div
            key={id}
            className="rounded-xl p-4 border border-card"
            style={{ background: theme.pageGradient, color: textColor }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold">{label}</p>
              <span className="text-micro uppercase tracking-wider opacity-60">{isLight ? 'Light' : 'Dark'}</span>
            </div>
            <p className="text-[11px] opacity-70 mb-3">{description}</p>
            <div className="flex gap-2">
              <span className="h-6 w-6 rounded" style={{ backgroundColor: theme.accentBlue }} title="Blue" />
              <span className="h-6 w-6 rounded" style={{ backgroundColor: theme.accentPurple }} title="Purple" />
              <span className="h-6 w-6 rounded" style={{ backgroundColor: theme.accentGreen }} title="Green" />
              <span className="h-6 w-6 rounded" style={{ backgroundColor: theme.accentAmber }} title="Amber" />
            </div>
          </div>
        )
      })}
    </div>
  ),
}
