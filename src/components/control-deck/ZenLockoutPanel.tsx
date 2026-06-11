import type { SettingsKey, SettingsValue } from '../../db/types'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { ToggleSetting } from '../shared/settings/ToggleSetting'

interface ZenLockoutPanelProps {
  enforceLockout: boolean
  autoArchiveAncientTasks: boolean
  updateSetting: (key: SettingsKey, val: SettingsValue) => void
}

export function ZenLockoutPanel({ enforceLockout, autoArchiveAncientTasks, updateSetting }: ZenLockoutPanelProps) {
  return (
    <>
      <SettingsCard title="Zen Lockout">
        <p className="settings-muted leading-relaxed mb-4">
          Hides tab and escape navigation menus during study blocks to enforce strict focus.
        </p>
        <ToggleSetting
          label={enforceLockout ? 'Enforced' : 'Bypassed'}
          checked={enforceLockout}
          onChange={v => updateSetting('enforce_lockout', v)}
        />
      </SettingsCard>
      <SettingsCard title="Automated Archiving">
        <p className="settings-muted leading-relaxed mb-4">
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
