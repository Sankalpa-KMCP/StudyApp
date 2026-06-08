import type { SettingsKey, SettingsValue } from '../../db/types'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { ToggleSetting } from '../shared/settings/ToggleSetting'

interface ZenLockoutPanelProps {
  enforceLockout: boolean
  autoArchiveAncientTasks: boolean
  autoPauseOnHidden: boolean
  updateSetting: (key: SettingsKey, val: SettingsValue) => void
}

export function ZenLockoutPanel({ enforceLockout, autoArchiveAncientTasks, autoPauseOnHidden, updateSetting }: ZenLockoutPanelProps) {
  return (
    <>
      <SettingsCard title="Zen Lockout">
        <p className="text-[10px] text-white/40 leading-relaxed mb-4">
          Hides tab and escape navigation menus during study blocks to enforce strict focus.
        </p>
        <ToggleSetting
          label={enforceLockout ? 'Enforced' : 'Bypassed'}
          checked={enforceLockout}
          onChange={v => updateSetting('enforce_lockout', v)}
        />
      </SettingsCard>
      <SettingsCard title="Auto-Pause on Inactive">
        <p className="text-[10px] text-white/40 leading-relaxed mb-4">
          Pauses the active Pomodoro timer automatically when switching browser tabs or backgrounding the window.
        </p>
        <ToggleSetting
          label={autoPauseOnHidden ? 'Active' : 'Disabled'}
          checked={autoPauseOnHidden}
          onChange={v => updateSetting('auto_pause_on_hidden', v)}
        />
      </SettingsCard>
      <SettingsCard title="Automated Archiving">
        <p className="text-[10px] text-white/40 leading-relaxed mb-4">
          Automatically archives completed tasks older than 90 days to keep the workspace clean.
        </p>
        <ToggleSetting
          label={autoArchiveAncientTasks ? 'Active' : 'Disabled'}
          checked={autoArchiveAncientTasks}
          onChange={v => updateSetting('autoArchiveAncientTasks', v)}
        />
      </SettingsCard>
    </>
  )
}
