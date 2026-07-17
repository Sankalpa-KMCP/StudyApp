# Architecture Decisions

> ADR-style log of significant architectural choices for Study Dashboard.
> Decisions below are **inferred from the codebase** unless marked otherwise.
> For full system context, see [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) §6.

---

## ADR-001: Local-first IndexedDB with no backend API

**Decision:** All persistent data lives in the browser via Dexie (IndexedDB). There is no server-side API, database, or authentication.

**Reason:**
- Privacy and offline use are core product goals (see [README.md](../README.md#why-local-first))
- No hosting cost or sync server to maintain
- PWA + Tauri desktop cover deployment without a backend

**Tradeoffs:**
- (+) Zero cloud dependency, works fully offline after first load
- (+) No user accounts or server security surface
- (−) Cross-device sync requires manual vault export or folder sync (user-managed)
- (−) No multi-user or collaborative features

**Affected files:**
- `src/db/db.ts`
- `src/db/repositories/`
- `ai/PROJECT_CONTEXT.md` §6 (architecture explanation)

**Status:** Accepted

---

## ADR-002: Hash routing instead of React Router

**Decision:** Client-side navigation uses `window.location.hash` (`#focus`, `#analytics`, etc.) rather than React Router or path-based routing.

**Reason:**
- GitHub Pages serves static files at `/StudyApp/` without server-side rewrite rules for SPA paths
- Hash changes do not trigger server requests; deep links work on static hosting
- Tab state syncs via `history.replaceState` without page reload

**Tradeoffs:**
- (+) Simple static hosting on GitHub Pages
- (+) No router dependency
- (−) URLs are less conventional (`#/focus` vs `/focus`)
- (−) Settings deep links use `#settings/<section>` pattern

**Affected files:**
- `src/lib/routing/appHashRouting.ts`
- `src/context/useStudyUIState.ts`
- `src/navigation/appNav.ts`
- `vite.config.ts` (`base: '/StudyApp/'`)

**Status:** Accepted

---

## ADR-003: Repository layer with ESLint import guard on `db/db`

**Decision:** All Dexie access goes through `src/db/repositories/` and `src/db/hooks/`. Direct imports of `db/db` from `components`, `hooks`, and `lib` are forbidden by ESLint.

**Reason:**
- Encapsulates IndexedDB schema and migration details
- Enables testing with `fake-indexeddb` at repository boundaries
- Prevents scattered CRUD logic across UI components

**Tradeoffs:**
- (+) Clear data access boundary; easier to audit DB usage
- (+) Bulk operations centralized in `database.ts`
- (−) Extra indirection for simple one-off queries
- (−) Agents sometimes attempt direct `db` imports (caught by lint)

**Affected files:**
- `eslint.config.js` (`no-restricted-imports`)
- `src/db/repositories/`
- `src/db/hooks/`

**Status:** Accepted

---

## ADR-004: Inline Dexie migrations in `db.ts`

**Decision:** Schema versions v2–v12 are defined as chained `.version(N).stores().upgrade()` calls inside `src/db/db.ts`, not separate migration files.

**Reason:**
- Dexie convention for client-side schema evolution
- Migrations run automatically on app open
- Single file shows full schema history

**Tradeoffs:**
- (+) Automatic migration on user upgrade; no manual migration command
- (+) Pre-migration snapshots (v6+) provide emergency rollback data
- (−) `db.ts` grows large as versions accumulate
- (−) Requires discipline: every schema change needs version bump + test

**Affected files:**
- `src/db/db.ts`
- `src/db/__tests__/db.migration.test.ts`
- `CHANGELOG.md`

**Status:** Accepted

---

## ADR-005: Context provider nesting: Confirm → Data → Timer → UI

**Decision:** Application state is split across four nested React context providers in a fixed order.

**Reason:**
- Separates concerns: data (IndexedDB), timer (session engine), UI (tabs/zen/toasts)
- `ConfirmProvider` wraps destructive action dialogs at the outermost level
- Timer provider receives `pushToast` from UI layer wiring

**Tradeoffs:**
- (+) Clear ownership boundaries per domain
- (−) Provider order is fragile — reordering can break initialization
- (−) No external state library; deep trees may re-render

**Affected files:**
- `src/context/StudyAppProvider.tsx`
- `src/context/StudyDataProvider.tsx`
- `src/context/StudyTimerProvider.tsx`
- `src/context/StudyUIProvider.tsx`

**Status:** Accepted

---

## ADR-006: Folder sync via shared `.studybackup` file (not cloud)

**Decision:** Bidirectional sync between web (Chrome/Edge) and Tauri desktop uses a shared `study-vault.sync.studybackup` file in a user-chosen folder, via File System Access API (web) or Tauri FS (desktop).

**Reason:**
- Maintains local-first principle without a sync server
- Reuses existing backup export/import pipeline (checksum, schema validation, merge)
- User controls where data lives (folder on disk)

**Tradeoffs:**
- (+) No cloud account or server required
- (+) Same merge/conflict logic as manual backup import
- (−) Requires Chrome/Edge on web; Firefox/Safari need manual vault export
- (−) Sync file is plaintext JSON unless user separately encrypts vault exports
- (−) 2s push debounce + 8s poll — not real-time

**Affected files:**
- `src/lib/sync/syncOrchestrator.ts`
- `src/lib/sync/syncPush.ts`, `syncPull.ts`
- `src/lib/sync/fileSystemAccess.ts`, `desktopSyncAdapter.ts`
- `src/db/repositories/syncHooks.ts`
- `src/components/control-deck/FolderSyncPanel.tsx`

**Status:** Accepted

---

## ADR-007: Separate backup format version (v4) from DB schema version (v12)

**Decision:** `.studybackup` files carry their own `version` field (currently 4), independent of Dexie `db.verno` (currently 12).

**Reason:**
- Backup files outlive app versions and may be imported across devices
- Backup format can omit deprecated tables (e.g. flashcards) while DB schema migrates separately
- Checksum and optional encryption are properties of the backup envelope

**Tradeoffs:**
- (+) Backward-compatible imports (v2/v3 backups still accepted)
- (+) Clear separation of concerns for portability vs migration
- (−) Two version numbers to track — easy to confuse in documentation
- (−) Import must handle legacy formats indefinitely

**Affected files:**
- `src/lib/backup/backupExport.ts`
- `src/lib/study/studyDashboard/backupSchema.ts`
- `src/lib/backup/backupChecksum.ts`
- `CHANGELOG.md`

**Status:** Accepted

---

## ADR-008: Tiered Vitest coverage gates (not universal UI coverage)

**Decision:** CI enforces three separate coverage thresholds on scoped directories rather than a single global UI coverage target.

**Reason:**
- Full-app line coverage is not the goal — E2E and Storybook cover integration paths
- Critical logic (`lib`, `db`, timer) gets strictest gate (80%/74%)
- UI primitives and settings panels have proportionally lower gates

**Tradeoffs:**
- (+) Protects high-risk logic without forcing 80% on all JSX
- (+) E2E covers tab flows and user journeys
- (−) Some UI files may have low unit coverage by design
- (−) Agents must know which tier to run for their change

**Affected files:**
- `vitest.config.ts`
- `vitest.components.config.ts`
- `vitest.settings.config.ts`
- `.github/workflows/ci.yml`

**Status:** Accepted

---

## ADR-009: Optional Tauri 2 desktop shell sharing Vite build

**Decision:** Native desktop app wraps the same Vite-built SPA via Tauri 2, using plugins for FS, notifications, tray, autostart, and global shortcuts — no custom Rust commands.

**Reason:**
- Single codebase for web PWA and desktop
- Tauri plugins provide native capabilities without duplicating business logic in Rust
- `TAURI_ENV_PLATFORM` switches Vite `base` to `/` for desktop builds

**Tradeoffs:**
- (+) Feature parity between web and desktop with one React codebase
- (+) Desktop gets folder sync via native FS (broader than File System Access)
- (−) Tauri build adds Rust toolchain requirement for desktop dev
- (−) FS writes scoped to `$HOME`, `$DOCUMENT`, `$DOWNLOAD` only

**Affected files:**
- `src-tauri/`
- `src/lib/desktop/tauri.ts`
- `vite.config.ts`
- `src-tauri/capabilities/default.json`

**Status:** Accepted

---

## ADR-010: Flashcards removed; task-based SM-2/FSRS retained

**Decision:** v1.2.0 (Dexie v12) removes the `flashcards` table, Cards tab, and `flashcardsEnabled` setting. Spaced repetition on focus targets (tasks) via SM-2/FSRS remains.

**Reason:**
- Consolidate spaced repetition into the task/focus workflow
- Reduce UI surface and IndexedDB complexity
- Legacy backup card data is discarded on import (acceptable data loss for deprecated feature)

**Tradeoffs:**
- (+) Simpler navigation (4 tabs) and schema
- (+) Review-due banner on Focus tab covers task-based scheduling
- (−) Users with flashcard-only workflows lose that data on upgrade
- (−) Legacy `#cards` URLs must redirect to `#focus`

**Affected files:**
- `src/db/db.ts` (v12 migration)
- `src/lib/routing/appHashRouting.ts`
- `CHANGELOG.md`

**Status:** Accepted (v1.2.0)

---

## ADR-014: Allow `lib/sync/` and `lib/backup/` to import `db/repositories/`

**Decision:** `src/lib/sync/` and `src/lib/backup/` are explicitly permitted to import from `src/db/repositories/` for read/write orchestration. All other `src/lib/` modules should remain pure domain logic (no repository imports) unless a future ADR documents another exception.

**Reason:**
- Folder sync and vault export/import are background I/O pipelines that run outside the React render cycle (debounced push, poll pull, auto-export, merge preview). They are invoked from hooks such as `useAppShellEffects` and `useSessionBackup`, but the orchestration itself is not UI state.
- Moving bulk export, merge, and sync orchestration into React hooks would tie long-running IndexedDB work to component mount/unmount, increase re-render risk, and duplicate logic across providers.
- ESLint already blocks direct `db/db` imports from `lib/` (ADR-003); these modules use the repository boundary, not raw Dexie.
- Other domain code (e.g. `lib/study/recurrence.ts`, `lib/study/dates.ts`) keeps date math pure; task recurrence spawning lives in `hooks/useTaskRecurrence.ts` instead.

**Boundaries:**
- **In scope:** `src/lib/sync/**`, `src/lib/backup/**` — may call `db/repositories/*` (e.g. `database.ts`, `settings.ts`, `syncHandles.ts`, `syncHooks.ts`).
- **Out of scope:** `src/lib/study/`, `src/lib/theme/`, `src/lib/routing/`, etc. — no repository imports; use hooks or repositories from the caller layer.
- **Still forbidden:** `db/db` from any `lib/` file (enforced by ESLint).

**Tradeoffs:**
- (+) Background sync and backup stay decoupled from React lifecycle and provider nesting
- (+) Reuses centralized bulk operations (`exportAllTables`, `mergeBackupData`, `replaceAllTables`) without a second abstraction layer
- (+) Clear, narrow exception to the “pure lib” guideline — easy for agents and reviewers to grep
- (−) `lib/` is not uniformly pure; agents must check path before adding repository calls
- (−) Unit tests for these modules often mock repositories (heavier than testing pure functions)
- (−) Expanding this pattern to more `lib/` folders without a new ADR would erode the boundary

**Affected files:**
- `src/lib/sync/syncOrchestrator.ts`, `syncPush.ts`, `syncPull.ts`, `fileSystemAccess.ts`
- `src/lib/backup/backupExport.ts`, `backupMerge.ts`, `mergePreview.ts` (types only)
- `src/hooks/app-shell/useAppShellEffects.ts` (invokes sync orchestrator)
- `src/hooks/useSessionBackup.ts` (invokes backup import/export)
- `eslint.config.js` (`no-restricted-imports` — blocks `db/db`, not `db/repositories`)

**Status:** Accepted

---

## Pending / Placeholder ADRs

| ID | Topic | Status |
|----|-------|--------|
| ADR-011 | Encrypted sync file (optional) | **Pending** — sync file is plaintext today |
| ADR-012 | Additional i18n locales | **Pending** — only `en.json` exists |
| ADR-013 | CSP headers for GitHub Pages | **Pending** — not configured |

---

*When making a deliberate architectural change, add a new ADR entry before or as part of the implementing PR.*
