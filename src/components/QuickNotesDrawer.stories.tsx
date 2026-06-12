import type { Meta, StoryObj } from '@storybook/react-vite'
import { QuickNotesDrawer } from './QuickNotesDrawer'

const meta: Meta<typeof QuickNotesDrawer> = {
  title: 'Features/QuickNotesDrawer',
  component: QuickNotesDrawer,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof QuickNotesDrawer>

export const Open: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    categories: [{ id: 1, name: 'General', color: '#64748B' }],
    addCategory: () => 2,
    deleteCategory: () => {},
    notes: [{ id: 1, title: 'Sample note', content: 'Review chapter 3', updatedAt: Date.now(), color: '#06b6d4' }],
    addNote: async () => 2,
    updateNote: async () => {},
    deleteNote: async () => {},
    noteTagColors: ['#06b6d4', '#3b82f6'],
  },
}
