import { FOCUS_LOCKOUT } from '../../lib/shared/uxTerms'
import { useSettingsPanel } from './SettingsPanelContext'
import { SettingsCard } from '../shared/settings/SettingsCard'
import { RangeSetting } from '../shared/settings/RangeSetting'
import { ToggleSetting } from '../shared/settings/ToggleSetting'
import type { ActiveTab } from '../../types/app'

const TAB_OPTIONS: { id: ActiveTab; label: string }[] = [
  { id: 'journal', label: 'Journal' },
  { id: 'cards', label: 'Cards' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
]

export function ZenLockoutPanel() {
  const {
    enforce_lockout: enforceLockout,
    lockoutMode,
    lockoutAllowedTabs,
    lockoutStudyOnly,
    autoArchiveAncientTasks,
    autoArchiveAfterDays,
    updateSetting,
  } = useSettingsPanel()

  const allowed = (() => {
    try {
      return JSON.parse(lockoutAllowedTabs) as ActiveTab[]
    } catch {
      return [] as ActiveTab[]
    }
  })()

  const toggleAllowedTab = (tab: ActiveTab) => {
    const next = allowed.includes(tab) ? allowed.filter(t => t !== tab) : [...allowed, tab]
    updateSetting('lockoutAllowedTabs', JSON.stringify(next))
  }

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
        {enforceLockout && (
          <div className="mt-4 space-y-4">
            <div>
              <span className="settings-label block mb-2">Lockout mode</span>
              <div className="flex gap-2">
                {(['strict', 'soft'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateSetting('lockoutMode', mode)}
                    className={`rounded-full px-3 py-1.5 text-micro font-semibold border transition-all ${
                      lockoutMode === mode
                        ? 'border-accent-blue/40 text-accent-blue bg-accent-blue/10'
                        : 'border-white/10 settings-muted hover:border-white/20'
                    }`}
                  >
                    {mode === 'strict' ? 'Strict' : 'Soft (confirm)'}
                  </button>
                ))}
              </div>
            </div>
            <ToggleSetting
              label="Study blocks only"
              description="Allow free navigation during breaks"
              checked={lockoutStudyOnly}
              onChange={v => updateSetting('lockoutStudyOnly', v)}
            />
            <div>
              <span className="settings-label block mb-2">Allowed tabs during lockout</span>
              <div className="flex flex-wrap gap-1.5">
                {TAB_OPTIONS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => toggleAllowedTab(tab.id)}
                    className={`rounded-full px-3 py-1.5 text-micro font-semibold border transition-all ${
                      allowed.includes(tab.id)
                        ? 'border-accent-green/40 text-accent-green bg-accent-green/10'
                        : 'border-white/10 settings-muted'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </SettingsCard>
      <SettingsCard title="Automated Archiving" defaultCollapsed>
        <p className="settings-muted leading-relaxed mb-4">
          Automatically archives completed tasks older than the threshold below to keep the workspace clean.
        </p>
        <ToggleSetting
          label={autoArchiveAncientTasks ? 'Active' : 'Disabled'}
          checked={autoArchiveAncientTasks}
          onChange={v => updateSetting('autoArchiveAncientTasks', v)}
        />
        {autoArchiveAncientTasks && (
          <div className="mt-4">
            <RangeSetting
              label="Archive after (days)"
              value={autoArchiveAfterDays}
              min={30}
              max={365}
              step={30}
              onChange={v => updateSetting('autoArchiveAfterDays', v)}
            />
          </div>
        )}
      </SettingsCard>
    </>
  )
}
