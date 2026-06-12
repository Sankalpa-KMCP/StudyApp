# Changelog

## Schema versions

| Version | Changes |
|---------|---------|
| **v7** | Remove orphaned ambient audio settings keys from `settings` table |
| **v6** | `history.createdAt`, `studyBlockDurationMinutes` setting, `snapshots` table, pre-migration auto-backup |
| **v5** | `quick_notes` table |
| **v4** | `flashcards` table |
| **v3** | Task cycle fields, category defaults migration |
| **v2** | Initial multi-table schema |

## Backup format vs database schema

- **Backup `version: 2`** in `.studybackup` JSON exports is the **export file format** revision.
- **DB schema v6/v7** (Dexie `db.verno`) is the **IndexedDB migration** version — these are intentionally separate.

## [1.0.0] - 2026-06-12

### Added
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
