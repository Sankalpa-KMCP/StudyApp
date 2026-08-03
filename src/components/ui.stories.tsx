import type { Meta, StoryObj } from '@storybook/react'
import { Check } from './icons'
import { ProgressBar, EmptyState, PanelHeader, MetricCard, SubjectCard } from './ui'
import type { StudySubject } from '../db/types'

const meta = {
  title: 'Components/UI',
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta

export default meta

export const DefaultProgressBar: StoryObj<typeof ProgressBar> = {
  render: () => <div style={{ width: '300px' }}><ProgressBar value={60} label="60%" /></div>,
}

export const DefaultEmptyState: StoryObj<typeof EmptyState> = {
  render: () => (
    <EmptyState
      icon={Check}
      title="You're all caught up!"
      body="There are no tasks remaining for today. Enjoy your free time."
      actionLabel="Add Task"
      onAction={() => console.log('Action clicked')}
    />
  ),
}

export const DefaultPanelHeader: StoryObj<typeof PanelHeader> = {
  render: () => (
    <div style={{ width: '400px' }}>
      <PanelHeader title="My Tasks" description="Plan the work that deserves your attention." actionLabel="Add Task" onAction={() => console.log('Clicked')} />
    </div>
  ),
}

export const DefaultMetricCard: StoryObj<typeof MetricCard> = {
  render: () => <MetricCard label="Current Streak" value="7 Days" />,
}

const mockSubject: StudySubject = {
  id: 'sub-1',
  name: 'Mathematics',
  targetHours: 10,
  color: '#4f46e5',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  progress: 45,
}

export const DefaultSubjectCard: StoryObj<typeof SubjectCard> = {
  render: () => <div style={{ width: '300px' }}><SubjectCard subject={mockSubject} /></div>,
}
