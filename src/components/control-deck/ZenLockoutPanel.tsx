import { useTranslation } from '../../i18n/useTranslation'

import { useSettingsPanel } from '../../context/settingsPanelContext'

import { SettingsCard } from '../shared/settings/SettingsCard'

import { RangeSetting } from '../shared/settings/RangeSetting'

import { ToggleSetting } from '../shared/settings/ToggleSetting'

import type { ActiveTab } from '../../types/app'



const TAB_OPTIONS: { id: ActiveTab; labelKey: 'navJournal' | 'navAnalytics' | 'navSettings' }[] = [

  { id: 'journal', labelKey: 'navJournal' },

  { id: 'analytics', labelKey: 'navAnalytics' },

  { id: 'settings', labelKey: 'navSettings' },

]



export function ZenLockoutPanel() {

  const { t } = useTranslation()

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

    const next = allowed.includes(tab) ? allowed.filter(tid => tid !== tab) : [...allowed, tab]

    updateSetting('lockoutAllowedTabs', JSON.stringify(next))

  }



  return (

    <>

      <SettingsCard id="settings-zen-lockout" title={t('focusLockout')} defaultCollapsed>

        <p className="settings-muted leading-relaxed mb-4">

          {t('zenLockoutHelper')}

        </p>

        <ToggleSetting

          label={t('focusLockout')}

          description={enforceLockout ? t('zenLockoutToggleEnabledDesc') : t('zenLockoutToggleDisabledDesc')}

          checked={enforceLockout}

          onChange={v => updateSetting('enforce_lockout', v)}

        />

        {enforceLockout && (

          <div className="mt-4 space-y-4">

            <div>

              <span className="settings-label block mb-2">{t('zenLockoutMode')}</span>

              <div className="flex gap-2">

                {(['strict', 'soft'] as const).map(mode => (

                  <button

                    key={mode}

                    type="button"

                    onClick={() => updateSetting('lockoutMode', mode)}

                    className={`rounded-full px-3 py-1.5 text-micro font-semibold border transition-all ${

                      lockoutMode === mode

                        ? 'border-accent-blue/40 text-accent-blue bg-accent-blue/10'

                        : 'border-card settings-muted hover:border-card'

                    }`}

                  >

                    {mode === 'strict' ? t('zenLockoutModeStrict') : t('zenLockoutModeSoft')}

                  </button>

                ))}

              </div>

            </div>

            <ToggleSetting

              label={t('zenLockoutStudyBlocksOnly')}

              description={t('zenLockoutStudyBlocksOnlyDesc')}

              checked={lockoutStudyOnly}

              onChange={v => updateSetting('lockoutStudyOnly', v)}

            />

            <div>

              <span className="settings-label block mb-2">{t('zenLockoutAllowedTabs')}</span>

              <div className="flex flex-wrap gap-1.5">

                {TAB_OPTIONS.map(tab => (

                  <button

                    key={tab.id}

                    type="button"

                    onClick={() => toggleAllowedTab(tab.id)}

                    className={`rounded-full px-3 py-1.5 text-micro font-semibold border transition-all ${

                      allowed.includes(tab.id)

                        ? 'border-accent-green/40 text-accent-green bg-accent-green/10'

                        : 'border-card settings-muted'

                    }`}

                  >

                    {t(tab.labelKey)}

                  </button>

                ))}

              </div>

            </div>

          </div>

        )}

      </SettingsCard>

      <SettingsCard title={t('zenAutomatedArchivingTitle')} defaultCollapsed>

        <p className="settings-muted leading-relaxed mb-4">

          {t('zenAutomatedArchivingHelper')}

        </p>

        <ToggleSetting

          label={autoArchiveAncientTasks ? t('zenAutomatedArchivingActive') : t('zenAutomatedArchivingDisabled')}

          checked={autoArchiveAncientTasks}

          onChange={v => updateSetting('autoArchiveAncientTasks', v)}

        />

        {autoArchiveAncientTasks && (

          <div className="mt-4">

            <RangeSetting

              label={t('zenArchiveAfterDays')}

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

