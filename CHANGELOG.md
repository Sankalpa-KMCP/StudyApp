# Changelog

## Schema versions

| Version | Changes |
|---------|---------|
| **v8** | Add optional `flashcardsEnabled` setting (default true for migrations, false for new installs) |
| **v7** | Remove orphaned ambient audio settings keys from `settings` table |
| **v6** | `history.createdAt`, `studyBlockDurationMinutes` setting, `snapshots` table, pre-migration auto-backup |
| **v5** | `quick_notes` table |
| **v4** | `flashcards` table |
| **v3** | Task cycle fields, category defaults migration |
| **v2** | Initial multi-table schema |

## Backup format vs database schema

- **Backup `version: 3`** in `.studybackup` JSON exports is the **export file format** revision (adds `checksumSha256`; v2 imports remain supported).
- **DB schema v8** (Dexie `db.verno`) is the **IndexedDB migration** version — these are intentionally separate.

## [Unreleased]

### Added
- Command palette (Ctrl/Cmd+K) for tasks, notes, flashcards, and tab navigation
- Anki-style tab-separated `.txt` flashcard import
- Additional ambient presets (café, brown noise) with volume control
- Scheduled vault auto-export settings
- Tauri desktop: system tray, native notifications, global shortcuts, autostart, backup folder picker
- Focus tab due-cards CTA when flashcards are enabled
- E2E helpers (`e2e/helpers/studyApp.ts`) and flashcards-optional spec hardening

### Changed
- README and docs aligned with optional flashcards and backup format v3
- Onboarding and Settings discoverability for optional flashcard deck
- `useDashboardData` skips flashcard query when `flashcardsEnabled` is false
- Desktop backup exports write to the chosen folder without also triggering a browser download
- Auto-export re-checks every 6 hours and when the app becomes visible

### Fixed
- Apply saved desktop autostart and global shortcut settings on app startup
- Backup v3 checksum verification ignores parse-only `rawVersion` field
- Tray menu label reads "Toggle timer" (was "Pause timer")
- Scheduled export requires a prior manual export before the first automatic run
- Settings section nav includes Desktop App panel on Tauri builds
- Tauri FS scope allows backup writes under home, documents, and downloads folders

## [1.0.0] - 2026-06-12

### Added
- Optional flashcards feature gated by `flashcardsEnabled` setting (hides nav tab, shortcuts, prefetch, analytics data)
- Smarter backup reminders based on last export time with 7-day dismiss snooze
- Storage usage panel in Backup Vault with per-table row counts
- Configurable history retention (`historyRetentionDays`) with manual archive action
- Analytics productivity window selector (7d / 30d / 90d / all time)
- Web Share API for vault export on supported mobile browsers
- ICS calendar export for study session history
- Flashcard deck CSV import (`front,back,category`)
- Task templates (save and apply from Focus task form)
- Tab-level error boundaries for isolated crash recovery
- `@tanstack/react-virtual` for large task and flashcard lists
- Storybook stories for OnboardingModal, MobileTabBar, QuickNotesDrawer, ZenOverlay
- E2E specs for backup reminder and analytics range
- CI: settings coverage gate, Storybook a11y test-runner job, Dependabot
- Workspace root `package.json` delegate scripts

### Changed
- Quick Notes drawer split into list and editor panels
- Wake lock success logs routed through `devLog` (dev-only)
- Removed unused `pushToast` parameter from `useStudyDataState`

### Previously unreleased (included in 1.0.0 baseline)
- Context providers, tab routes, and Dexie repository architecture
- Expanded Vitest coverage tiers, Playwright E2E, PWA service worker
- ConfirmDialog, accessibility polish, system theme matching
