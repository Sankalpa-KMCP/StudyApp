import { FOCUS_LOCKOUT } from '../../lib/uxTerms'
import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { ToggleSetting } from '../shared/settings/ToggleSetting'

export function ZenLockoutPanel() {
  const { enforce_lockout: enforceLockout, autoArchiveAncientTasks, updateSetting } = useSettingsPanel()

  return (
    <>
      <SettingsCard id="settings-zen-lockout" title={FOCUS_LOCKOUT} defaultCollapsed>
        <p className="settings-muted leading-relaxed mb-4">
          Hides tab and escape navigation menus during study blocks to enforce strict focus.
        </p>
        <ToggleSetting
          label="Focus lockout"
          description={enforceLockout ? 'Navigation away from Focus is blocked during study blocks.' : 'You can switch tabs freely while the timer runs.'}
          checked={enforceLockout}
          onChange={v => updateSetting('enforce_lockout', v)}
        />
      </SettingsCard>
      <SettingsCard title="Automated Archiving" defaultCollapsed>
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
