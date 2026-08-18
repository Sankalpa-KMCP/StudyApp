import { Topbar } from './Topbar'
import { LiveReadErrorPanel } from './LiveReadErrorPanel'
import { SettingsView } from '../views/SettingsView'
import type { ThemeMode } from '../hooks/useThemePreference'
import type { View } from '../navigation/viewRoutes'
import type { QuickAddItem } from './QuickAddMenu'

export const LIVE_READ_ERROR_MESSAGE = 'Study data could not be loaded. Your local data is still on this device.'

export type AppLiveReadFallbackProps = {
  activeView: View
  noticeOpen: boolean
  noticePopoverId: string
  onToggleNotices: () => void
  onCloseNotices: () => void
  onQuickAdd: (item: QuickAddItem) => void
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
  onQuickAdd,
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
  const errorPanel = <LiveReadErrorPanel message={LIVE_READ_ERROR_MESSAGE} onRetry={onRetry} />

  return (
    <>
      <Topbar
        activeView={activeView}
        search=""
        searchResults={[]}
        searchEnabled={false}
        noticeOpen={noticeOpen}
        noticePopoverId={noticePopoverId}
        onSearch={() => undefined}
        onClearSearch={() => undefined}
        onSelectSearchResult={() => undefined}
        onToggleNotices={onToggleNotices}
        onCloseNotices={onCloseNotices}
        onOpenProfile={onOpenProfile}
        onQuickAdd={onQuickAdd}
      />
      <main id="dashboard-main" className="dashboard" aria-label="Study dashboard">
        {activeView === 'Settings' ? (
          <div className="content-grid is-workspace-view">
            <section className="primary-column" aria-label="Primary study summary">
              {errorPanel}
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
          errorPanel
        )}
      </main>
    </>
  )
}
