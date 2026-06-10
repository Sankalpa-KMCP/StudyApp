# Changelog

## Schema versions

| Version | Changes |
|---------|---------|
| **v6** | `history.createdAt`, `studyBlockDurationMinutes` setting, `snapshots` table, pre-migration auto-backup |
| **v5** | `quick_notes` table |
| **v4** | `flashcards` table |
| **v3** | Task cycle fields, category defaults migration |
| **v2** | Initial multi-table schema |

## Unreleased

- A+ architecture: context providers, tab routes, `db/queries.ts` split
- Expanded test coverage (Vitest + fake-indexeddb)
- PWA service worker, Storybook, Playwright E2E
- Error boundary and accessibility polish
