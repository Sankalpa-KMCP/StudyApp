import { resetDatabase, resetSelective } from '../../db/repositories/database'
import { backupResetFailed, backupResetSwept } from '../../lib/backup/backupTerms'
import type { PushToast } from './types'

export function useBackupReset(pushToast: PushToast) {
  async function resetData() {
    await resetDatabase()
    localStorage.removeItem('completed_study_sessions_count')
    localStorage.removeItem('study_dashboard_snapshots')
    window.location.reload()
  }

  async function resetDataSelective(options: { tasks: boolean; history: boolean; categories: boolean; notes: boolean }) {
    try {
      await resetSelective(options)
      if (options.history) {
        localStorage.removeItem('completed_study_sessions_count')
      }
      pushToast('RESET', backupResetSwept())
    } catch (err) {
      console.error('Selective reset failed:', err)
      pushToast('RESET', backupResetFailed())
    }
  }

  return { resetData, resetDataSelective }
}
