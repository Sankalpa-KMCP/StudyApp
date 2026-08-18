import { Topbar } from './Topbar'
import { SettingsView } from '../views/SettingsView'
import type { ThemeMode } from '../hooks/useThemePreference'
import type { View } from '../navigation/viewRoutes'

export const LIVE_READ_ERROR_MESSAGE = 'Study data could not be loaded. Your local data is still on this device.'

export type AppLiveReadFallbackProps = {
  activeView: View
  noticeOpen: boolean
  noticePopoverId: string
  onToggleNotices: () => void
  onCloseNotices: () => void
  onOpenProfile: () => void
  onRetry: () => void
  profileNotice: string
  preferenceNotice: string | null
  onDismissPreferenceNotice: () => void
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
  onExport: () => Promise<void>
  onImport: (file: File) => Promise<void>
  onClear: () => Promise<void>
  importPending: boolean
}

/**
 * Shell-preserving fallback while App live reads are unavailable.
 * Keeps Topbar chrome and allows Settings backup recovery without the failed queries.
 */
export function AppLiveReadFallback({
  activeView,
  noticeOpen,
  noticePopoverId,
  onToggleNotices,
  onCloseNotices,
  onOpenProfile,
  onRetry,
  profileNotice,
  preferenceNotice,
  onDismissPreferenceNotice,
  theme,
  onThemeChange,
  onExport,
  onImport,
  onClear,
  importPending,
}: AppLiveReadFallbackProps) {
  return (
    <>
      <Topbar
        activeView={activeView}
        search=""
        noticeOpen={noticeOpen}
        noticePopoverId={noticePopoverId}
        onSearch={() => undefined}
        onClearSearch={() => undefined}
        onToggleNotices={onToggleNotices}
        onCloseNotices={onCloseNotices}
        onOpenProfile={onOpenProfile}
      />
      <main id="dashboard-main" className="dashboard" aria-label="Study dashboard">
        {activeView === 'Settings' ? (
          <div className="content-grid is-workspace-view">
            <section className="primary-column" aria-label="Primary study summary">
              <section className="loading-panel live-read-error-panel" role="alert">
                <div className="live-read-error-copy">
                  <p>{LIVE_READ_ERROR_MESSAGE}</p>
                  <button className="primary-command" type="button" onClick={onRetry}>
                    Retry
                  </button>
                </div>
              </section>
              <SettingsView
                onExport={onExport}
                onImport={onImport}
                onClear={onClear}
                importPending={importPending}
                profileNotice={profileNotice}
                preferenceNotice={preferenceNotice}
                onDismissPreferenceNotice={onDismissPreferenceNotice}
                theme={theme}
                onThemeChange={onThemeChange}
              />
            </section>
          </div>
        ) : (
          <section className="loading-panel live-read-error-panel" role="alert">
            <div className="live-read-error-copy">
              <p>{LIVE_READ_ERROR_MESSAGE}</p>
              <button className="primary-command" type="button" onClick={onRetry}>
                Retry
              </button>
            </div>
          </section>
        )}
      </main>
    </>
  )
}
