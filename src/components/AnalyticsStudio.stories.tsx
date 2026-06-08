import type { Meta, StoryObj } from '@storybook/react-vite'
import { AnalyticsStudio } from './AnalyticsStudio'

const theme = {
  surface: '#111318',
  surfaceCard: 'rgba(255,255,255,0.06)',
  surfaceCardRgb: '17,19,24',
  pageGradient: 'linear-gradient(180deg, #0a0b10 0%, #111318 100%)',
  accentBlue: '#3B82F6',
  accentPurple: '#8B5CF6',
  accentGreen: '#10B981',
  accentAmber: '#F59E0B',
}

const meta: Meta<typeof AnalyticsStudio> = {
  title: 'Features/AnalyticsStudio',
  component: AnalyticsStudio,
}

export default meta
type Story = StoryObj<typeof AnalyticsStudio>

export const Default: Story = {
  render: () => (
    <div className="p-6" style={{ background: '#0a0b10' }}>
      <AnalyticsStudio
        tasks={[]}
        flashcards={[]}
        monthLogs={[]}
        allLogs={[]}
        totalMonthHours={12}
        totalWeeklyBreakHours={2}
        totalDaysInMonth={30}
        currentStreak={3}
        level={2}
        chartData={[
          { day: 'Mon', hours: 2, focus: 80 },
          { day: 'Tue', hours: 1.5, focus: 70 },
        ]}
        categoryBreakdown={[{ name: 'Math', color: '#3B82F6', hours: 5, percentage: 40 }]}
        topSubject="Math"
        avgMin={45}
        completionRate={72}
        peakDay="Wednesday"
        activeThemeVars={theme}
        tooltipStyle={{ background: '#1a1d26', border: '1px solid rgba(255,255,255,0.1)' }}
        hasChartData
      />
    </div>
  ),
}
