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

## Unreleased

- A+ architecture: context providers, tab routes, `db/queries.ts` split
- Expanded test coverage (Vitest + fake-indexeddb)
- PWA service worker, Storybook, Playwright E2E
- ConfirmDialog, accessibility polish, ambient settings removal (v7)
