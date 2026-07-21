# Changelog

## [Unreleased]

### Added

- Explicit goal metrics: **Manual progress** (`manual`) and **Study time** (`study_time`) with an accessible metric selector in Goals.
- Automatic study-time progress for daily (minutes), weekly (rounded hours over the rolling seven local days ending today), and monthly (rounded hours in the current local calendar month) goals.
- Playwright coverage proving goal behavior follows persisted metrics, not title text.

### Changed

- Replaced title-based goal detection with explicit metrics; goal titles no longer affect runtime calculation or settings sync.
- Dexie schema upgraded to **version 2** with a backward-compatible migration that assigns metrics to existing goals once.
- JSON backup exports now use **version 2**; version 1 backups remain importable and are normalized before replacement.
- Daily `dailyGoalMinutes` setting sync now follows explicit daily study-time goals only (not goal titles).

### Added (themes)

- Added Monochrome, Blueprint, and Moss Library appearance themes using the existing visual token system.

### Changed

- New and invalid theme preferences now resolve to Monochrome while existing Canvas, Midnight, Aurora, and Ember preferences remain valid.
- Updated browser and install metadata to match the Monochrome default palette.

## [1.3.0] - 2026-07-13

### Added

- Guided first-study checklist on Home, derived from subjects, tasks or events, and recorded sessions.
- Newest-first study-session journal on Progress with local-date grouping and manual create, edit, and delete workflows.

### Changed

- Refined the shared visual system, workspace hierarchy, controls, empty states, responsive layouts, themes, and accessibility behavior.
- Progress, Home totals, subject progress, and derived goals now update live when study sessions change.

### Fixed

- Reject malformed JSON backup records before replacement so an invalid import cannot erase valid local study data.
- Restored keyboard focus coherently after creation, cancellation, editing, and destructive actions.

## Current storage compatibility

- IndexedDB schema: Dexie **version 2** (upgrade from v1 assigns `manual` or `study_time` to legacy goals).
- JSON backup format: **version 2** for new exports; **version 1** imports remain supported with normalization.
- First launch remains empty; no bundled sample data is imported.
- Customized data from the legacy `study-dashboard-v2` localStorage key is migrated once when safe.

## [1.2.0] - 2026-06-13

### Changed

- Rebuilt the application as a root-level, web-only React/Vite PWA using Dexie/IndexedDB as its source of truth.
- Removed the Tauri shell, folder sync, encrypted backups, cloud/server integrations, and the former repository layer.
- Preserved local tasks, subjects, notes, calendar events, flashcards, focus sessions, goals, themes, JSON backups, and offline support.

[1.3.0]: https://github.com/IT25100142/StudyApp/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/IT25100142/StudyApp/releases/tag/v1.2.0
