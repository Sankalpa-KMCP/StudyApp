# Changelog

## [Unreleased]

### Added

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

- IndexedDB schema: Dexie version 1.
- JSON backup format: version 1.
- First launch remains empty; no bundled sample data is imported.
- Customized data from the legacy `study-dashboard-v2` localStorage key is migrated once when safe.

## [1.2.0] - 2026-06-13

### Changed

- Rebuilt the application as a root-level, web-only React/Vite PWA using Dexie/IndexedDB as its source of truth.
- Removed the Tauri shell, folder sync, encrypted backups, cloud/server integrations, and the former repository layer.
- Preserved local tasks, subjects, notes, calendar events, flashcards, focus sessions, goals, themes, JSON backups, and offline support.

[1.3.0]: https://github.com/IT25100142/StudyApp/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/IT25100142/StudyApp/releases/tag/v1.2.0
