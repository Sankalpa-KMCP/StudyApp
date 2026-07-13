# Changelog

## Schema versions

| Version | Changes |
|---------|---------|
| **v12** | Drop `flashcards` table; remove `flashcardsEnabled` setting; filter `cards` from `lockoutAllowedTabs` JSON |
| **v11** | `sync_handles` table; folder sync settings (`syncEnabled`, `lastSyncAt`, `lastSyncChecksum`); migrates `desktopBackupFolderPath` → `syncFolderPath` |
| **v10** | Task/category timer overrides, recurring tasks, flashcard images, FSRS fields |
| **v9** | Optional `taskId` on `history` entries |
| **v8** | Add optional `flashcardsEnabled` setting (default true for migrations, false for new installs) |
| **v7** | Remove orphaned ambient audio settings keys from `settings` table |
| **v6** | `history.createdAt`, `studyBlockDurationMinutes` setting, `snapshots` table, pre-migration auto-backup |
| **v5** | `quick_notes` table |
| **v4** | `flashcards` table |
| **v3** | Task cycle fields, category defaults migration |
| **v2** | Initial multi-table schema |

## Backup format vs database schema

- **Backup `version: 4`** omits `flashcards`; v2/v3 imports still accepted (flashcard rows discarded on restore).
- **Backup `version: 3`** added `checksumSha256`; v2 imports remain supported.
- **DB schema v12** (Dexie `db.verno`) is the **IndexedDB migration** version — separate from backup file format.

## [Unreleased]

## [1.2.0] - 2026-06-13

### Removed
- **Flashcards / Cards tab** — deck UI, `flashcards` IndexedDB table, and `flashcardsEnabled` setting (Dexie v12 migration). Task-based SM-2/FSRS scheduling on focus targets is unchanged. Legacy backups with `flashcards` still import; card data is not restored.

### Added
- **Folder sync** — bidirectional shared-folder sync between GitHub Pages (Chrome/Edge) and the Tauri desktop app via `study-vault.sync.studybackup`
- Configurable auto-archive threshold (`autoArchiveAfterDays`)
- Command palette actions (toggle timer, zen, export backup, hotkeys)
- Task-linked session history (Dexie v9 `taskId` on history entries)
- Per-task analytics, category goal trends, weekly report export (CSV/Markdown)
- Encrypted `.studybackup` v4, merge import, ICS import, sync folder workflow
- Smarter focus lockout modes, study reminders, per-entity timer presets
- Recurring tasks, FSRS scheduling option
- Journal search in command palette; Tauri minimize-on-close and configurable shortcuts
- i18n string catalog (`en.json`), mobile focus parity, PWA offline documentation

## [1.1.0] - 2026-06-12

> **Note:** Flashcard features listed below were removed in v1.2.0 (Dexie v12). Task-based SM-2/FSRS on focus targets remains.

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
