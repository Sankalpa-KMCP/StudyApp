# Agent instructions — Study Dashboard

Entry point for **any** AI coding agent (Cursor, Codex, Claude Code, Copilot, etc.) working in this repository.

## Read first (local, if present)

The full documentation set lives in **`ai/` at the repo root**. That folder is **gitignored** and is not on GitHub. On this machine, read these files before substantive edits:

| File | Purpose |
|------|---------|
| `ai/PROJECT_CONTEXT.md` | Architecture, features, data model, workflows |
| `ai/ARCHITECTURE_DECISIONS.md` | ADR log |

Operational rules, protected files, testing matrix, and repository invariants are defined directly below in `AGENTS.md`. If `ai/` is missing (fresh clone), regenerate it with your setup-ai-documentation workflow or copy `ai/` from another machine. Until then, follow the rules below.

## Project summary

- **Study Dashboard v1.4.0** — local-first study workspace (tasks, notes, subjects, calendar, focus sessions, goals).
- **Production release paused:** The v1.5.0 release-candidate freeze is suspended. Ordinary project development may proceed under normal repository controls. Work explicitly designated as resumed v1.5.0 release work must follow the [v1.5.0 Public Beta release contract](docs/release-v1.5.0-contract.md). No current work may claim RC, Public Beta launch, production readiness, browser certification, or Phase 0 completion without new evidence.
- **Web app:** React 19 + Vite 8 + Dexie/IndexedDB web app at the repo root.
- **`App.tsx` is the composition root** — live Dexie data, sole `useCurrentDate()`, derived Home metrics, URL-synced navigation/layout (`src/navigation/viewRoutes.ts` + History API), shared preference notices, and view wiring. Pure helpers stay in `src/appUtils.ts`.
- **Extracted React orchestration (do not re-inline into App):**
  - `useThemePreference` / `useSidebarPreference` — `localStorage` preferences + theme DOM side effects
  - `useAppSearch` — search state, `useDeferredValue` filters, Home results via `buildSearchResults`
  - `useFocusSession` — focus restore/actions/timed completion; exposes `reloadFocusFromIndexedDb`, `runWithFocusImportLock`, `clearFocusLocalState`
  - `useStudyBackup` — export download, import under focus lock, clear-all then local focus reset
- **Domain persistence** remains in `src/db/activeFocusSession.ts` and `src/db/studyDb.ts` (validation/transactions), not in the hooks.
- **No HTTP API**, no auth, no cloud database, no desktop shell.

## Goals and metrics

- Every goal has an explicit **`metric`**: `manual` (**Manual progress**) or `study_time` (**Study time**). Goal **titles never determine runtime calculation** — only the stored metric and period matter.
- **Manual progress** uses stored `goal.progress` in **points**.
- **Study time** derives progress from finalized recorded **`studySessions`** only (unfinished focus sessions do not count until finalized into history).
- **Period units:** daily study-time goals use **minutes**; weekly and monthly study-time goals use **rounded hours** (weekly totals use the existing rolling seven local calendar days ending today; monthly totals use the current local calendar month).
- Dexie **version 2** assigned metrics to legacy goal rows once via title rules in `src/db/goalMetricInference.ts` (migration / v1 import only — not runtime).

## Subject progress

- Every subject has an explicit **`progressMode`**: `manual` (**Manual progress**) or `study_time` (**Study time**). Subject **names never determine** mode or displayed progress.
- **Manual progress** uses stored `subject.progress` (0–100 percentage). That stored value is **retained** while study-time mode is active and after mode switches.
- **Study time** uses all matching finalized **`studySessions`** minutes ÷ (`targetHours × 60`), clamped 0–100. It is **not** period-limited (unlike study-time goals).
- New subjects default to **`manual`**. The Subjects editor exposes the mode selector; Progress % is editable only in manual mode.
- **`calculateSubjectProgress`** in `src/appUtils.ts` is the authoritative display helper for Subject cards, Home subject cards, and Home/search metadata and progress-number filtering (`SubjectsView`, `HomeView`, `buildSearchResults`, `useAppSearch`).
- **Subject Distribution** (`SubjectDistribution` in `src/components/RightColumn.tsx`) remains a separate share-of-total logged study-time chart — not subject target progress.
- **IndexedDB:** current Dexie schema is **version 5** (v4 dropped the `flashcards` table; v5 normalized legacy event start timestamps). Upgrade from v2 assigns missing/invalid `progressMode` once via `inferSubjectProgressMode` (positive matching session minutes → `study_time`, else `manual` — session presence only, no title heuristics).
- **Inspect together when changing subject progress:** `src/db/types.ts`, `src/db/studyDb.ts`, `src/appUtils.ts` (`calculateSubjectProgress` / `inferSubjectProgressMode`), `src/views/SubjectsView.tsx`, `src/home/HomeView.tsx`, `src/hooks/useAppSearch.ts`, `src/components/ui.tsx` (`SubjectCard`).

## Backups

- New exports use JSON **version 4** with required goal **`metric`** and subject **`progressMode`**.
- Valid **version 1**, **version 2**, and **version 3** backups remain importable: goals (v1) and subjects (v1/v2) are normalized from the **complete imported study-session set** before any table replacement. Legacy flashcards in v1–v3 backups are cleanly discarded on import.
- Invalid or missing modes/metrics on **version 3** and **version 4** backups fail validation **before** existing data is replaced.
- **Import validation order** (all rejection paths leave IndexedDB and visible focus ownership unchanged):
  1. File byte size (`File.size`, 64 MiB) — `useStudyBackup` + `studyExportLimits`
  2. Text length after `file.text()` (64 MiB characters)
  3. JSON parsing and shape/version checks (`parseAndNormalizeStudyExport` in `studyDb.ts`)
  4. Legacy normalization (v1 goals; v1/v2 subject `progressMode` from imported sessions; discard legacy flashcards)
  5. Duplicate entity IDs and duplicate settings keys
  6. Subject references (non-empty `subjectId` must exist; `''` = General)
  7. Semantic integrity (subject progress 0–100 and `targetHours > 0`; task minutes ≥ 0; session minutes > 0; event/session end not before start; goal `target > 0` and `progress ≥ 0`)
  8. Known settings values (`dailyGoalMinutes > 0`; `quickNotes` string[] max 8; `legacy-localstorage-migrated-v1` exactly `true`; `activeFocusSession` via `isActiveFocusSession`). **Unknown settings keys are accepted and preserved.**
  9. Record counts (total **25,000**; subjects **500**; tasks/notes/events **5,000**; study sessions **10,000**; goals **500**; settings **64**)
  10. Dexie clear + `bulkPut` (only after steps 1–9 succeed); then reload focus from IndexedDB on success
- Import integrity does **not** enforce stricter UI-only editor maximums (e.g. Tasks minutes 5–720 clamp, Progress “end not in the future”). Do not silently repair duplicate, orphaned, or semantically invalid records — reject the whole import.
- **Inspect together when changing import validation:** `src/hooks/useStudyBackup.ts`, `src/db/studyExportLimits.ts`, `src/db/studyExportValidation.ts`, `src/db/studyDb.ts` (`parseAndNormalizeStudyExport` / `finalizeStudyExport` / `importStudyData`), `src/db/activeFocusSession.ts` (focus settings contract), plus `studyExportValidation.test.ts`, `studyExportLimits.test.ts`, `studyDb.test.ts`, `useStudyBackup.test.ts`, and App backup/focus suites as needed.

## Local calendar dates

- Calendar strip day keys and event matching use **`localDateKey`** (local `YYYY-MM-DD`), not ISO UTC date prefixes (`src/appUtils.ts`, `src/components/calendarStripDays.ts`).
- **`App.tsx` owns one** `useCurrentDate()` (`src/hooks/useCurrentDate.ts`) local-midnight signal. Do not add a second calendar-day timer.
- After local midnight, today focus, weekly study days, upcoming events, streak, hero date, and greeting refresh without reload or data mutation. Helpers accept optional `now` with `new Date()` defaults for compatibility.
- Playwright Home readiness must accept morning, afternoon, or evening greetings (`HOME_GREETING_HEADING` in `e2e/a11yHelpers.ts`), not a hardcoded `Good morning`.

## Local mutation convention

Use the shared helper for ordinary async IndexedDB mutations:

- Prefer `useMutationState` (`src/hooks/useMutationState.ts`) for create/edit/delete and similar row actions.
- Run **validation before** calling `run(...)`; invalid input must not enter pending state or touch Dexie.
- Never reset form fields inside the hook; close or reset editors only in `onSuccess` after persistence succeeds.
- On failure, preserve every field and the editing identity so the user can retry immediately.
- Block duplicate invocation with the hook’s synchronous pending guard; use row-level or accurately represented serialized pending UI so enabled controls match executable actions.
- Treat expected Dexie `update(...) === 0` (missing row) as failure.
- Surface friendly fixed messages via `MutationNotice` — errors use alert semantics, successes use status semantics; never show raw Dexie/exception text.
- Communicate pending work with visible loading labels, disabled controls, and `aria-busy` where appropriate.

**Keep these specialized flows — do not force them through the generic hook:**

| Flow | Why |
|------|-----|
| Focus start/pause/resume/stop/stale/subject | Owned by `useFocusSession`; domain result contracts + singleton/idempotency in `activeFocusSession` |
| Settings import / clear-all | `useStudyBackup` + `runWithFocusImportLock` / `reloadFocusFromIndexedDb` / `clearFocusLocalState`; keep `focusImportPending` gating on focus actions. Import and clear-all are mutually exclusive through the coordinator; conflicting operations are gated at the applicable UI and coordinator layers; agents must preserve that invariant. |
| Quick-note autosave | Sequential latest-value write queue so a stale write cannot overwrite newer draft text |
| Theme / sidebar preferences | Owned by preference hooks; report friendly failures via App’s shared preference notice; do not migrate to IndexedDB |

### Focus timed completion

- Never finalize timed auto-completion while Pause or Resume IndexedDB persistence is pending (use a **synchronous pending ref** for the timeout path, not only React state).
- When deferring, store the **exact expected session ID** (not a boolean-only flag).
- After settlement, re-read the durable singleton from IndexedDB; auto-complete only when the durable ID matches, `status === 'running'`, `plannedMinutes > 0`, and eligibility passes via `shouldAutoCompleteFocusSession` / `getActiveFocusElapsedMs`.
- Paused and open-ended (`plannedMinutes === 0`) sessions must not auto-complete. Successful Pause at the completion boundary takes precedence over a previously scheduled UI timeout.
- Resume must honor updated `accumulatedPausedMs` (paused wall time excluded).
- `finalizingSessionIdRef` is a UI-level duplicate guard; identity-checked, idempotent `finalizeActiveFocusSession` (history id = focus session id) remains the domain guard.
- Clear deferred completion markers at session identity/ownership boundaries (restore, import success, clear-all, start, discard, conflict/missing, finalize, unmount). Preserve established conflict, missing, stale, import, and clear-all contracts.
- Cover precise pending-write races with deterministic Promise-gated `App.focus.test.tsx` cases — do not add flaky real-time E2E for the Dexie-pending window.

After broad mutation changes, run:

```bash
npm test
npm run lint
npm run build
npm run check:bundle
# PowerShell clean Playwright server:
$env:CI="true"; npm run test:e2e
```

## CSS architecture

Plain global CSS only. `src/index.css` is an **import barrel**; do not add ordinary rules there. Preserve this order:

`fonts` → `tokens` → `base` → `layout` → `components` → `home` → `workspaces` → `settings` → `progress` → `mixed` → `themes` → `responsive` → `preferences`

| Module | Ownership |
|--------|-----------|
| `fonts.css` | `@font-face` only |
| `tokens.css` | Design tokens and `:root[data-theme]` overrides (Monochrome = bare `:root`) |
| `base.css` | Reset, global form controls, `:focus-visible`, `::selection`, `.sr-only`, `.skip-link` |
| `layout.css` | App shell, sidebar, topbar, dashboard/page grids |
| `components.css` | Reusable primitives (cards, fields, commands, notices, charts, calendar-strip, empty states) |
| `home.css` | Hero, first-study, focus timer, quick notes, Home search/previews |
| `workspaces.css` | Tasks/Notes/Subjects-owned extras (e.g. swatches) |
| `settings.css` | Theme studio, import card, danger/clear-all |
| `progress.css` | Manual session editor and study journal |
| `mixed.css` | Cross-owned grouped selectors kept **intact** (do not split to force ownership) |
| `themes.css` | Premium live wallpapers, Crystal Glass rendering/fallback, static theme previews, and theme-specific Zen ambience |
| `responsive.css` | Width breakpoints only |
| `preferences.css` | `prefers-reduced-motion`, then `prefers-reduced-transparency` |

Maintenance rules:

- Keep `responsive` and `preferences` last; never duplicate declarations across modules to “claim” ownership.
- Avoid selector renaming, specificity increases, CSS Modules, CSS-in-JS, or visual redesign during maintenance-only work.
- App loads `src/index.css` — validate the app after broad CSS changes.

```bash
npm test -- --run
npm run lint
npm run build
npm run check:bundle
# PowerShell clean Playwright server:
$env:CI="true"; npm run test:e2e
```

## Accessibility maintenance

### Semantics

- Preserve **one primary `h1` per page**; Topbar context (e.g. “Dashboard”) must stay visible but **outside the heading outline**.
- Decorative icons inside already named controls must use `aria-hidden`.
- Named chart wrappers (weekly bar chart, Study Time line chart) need a valid role such as `role="img"` plus a concise accessible name; decorative SVG/path/day-label descendants must not duplicate that name in the accessibility tree.

### Keyboard and focus

- Non-modal popovers (Notifications) must stay keyboard-dismissible; Escape must restore focus to the trigger where implemented.
- Do not add focus traps to inline editors or confirmations.
- Fixed mobile bottom navigation must not obscure focused content (`scroll-padding-bottom` at the bottom-nav breakpoint).
- Preserve visible `:focus-visible` indicators.

### Forms and announcements

- Field-specific validation (Tasks, Goals) should use stable error IDs, `aria-invalid`, and `aria-describedby`.
- Persistence failures remain form-level alerts via `MutationNotice`; do not duplicate the same validation message into competing live regions.
- Routine success uses polite `status`; blocking errors use `alert`.
- Rapidly changing focus timer values must **not** be live-announced every tick (keep `.session-elapsed` as ordinary text).

### Contrast and themes

- Preserve automated theme-token contrast contracts in `src/styles/themeTokenContrast.ts` / `.test.ts`.
- Normal text and meaningful control-boundary pairs must continue passing committed thresholds.
- Monochrome remains the base bare `:root`; token changes require all-theme contrast verification.

### Axe policy

- Playwright axe scans (`e2e/a11y.spec.ts`, `e2e/a11yHelpers.ts`) must remain **unsuppressed**.
- Do not disable rules, exclude application selectors, or add known-violation baselines merely to obtain green tests.
- Genuine violations require focused remediation.
- Keep accessibility specs in normal E2E discovery (`testDir: ./e2e`).

After broad accessibility work, run:

```bash
npm test -- --run
npm run lint
npm run build
npm run check:bundle
# PowerShell clean Playwright server:
$env:CI="true"; npm run test:e2e
```

## Hard rules

1. **Local-first only** — Do not add backend servers, cloud DB, auth, or telemetry without explicit user request.
2. **No HTTP API** — IndexedDB via Dexie is the source of truth.
3. **Minimal diffs** — Change only what the task requires.
4. **Read before edit** — Inspect the full target file and nearest similar feature first.
5. **npm only** — Use `npm ci` / `npm install` (`package-lock.json` is canonical). Supported toolchain: Node.js 22 (`engines.node` `^22.0.0`, `.nvmrc` / `.node-version`) and npm 10.9.2 (`packageManager`). Declarations are guidance only — `engine-strict` stays false.
6. **No secrets** — Never commit `.env`, keys, or tokens.
7. **Dexie migrations** — Schema changes need `version(N)` in `src/db/studyDb.ts` plus tests in `studyDb.test.ts`.
8. **Destructive flows** — Keep confirmation and user feedback (see Settings in `App.tsx`).
9. **Protected files** — `studyDb.ts`, `App.tsx`, `vite.config.ts` base paths.
10. **Do not recreate removed architecture** — No hash routing, repository layer, folder sync, encrypted backup, or Tauri desktop shell unless explicitly requested.

## Commands (from repo root)

```bash
npm ci                   # first time
npm run dev              # http://localhost:5173
npm run preview          # http://localhost:4173/StudyApp/ after build
npm test
npm run lint
npm run build
npm run check:bundle
npm run test:e2e
```

CI (`.github/workflows/ci.yml`): lint → unit tests with coverage (`npm run test:coverage`) → build → bundle check → dist path verification → Playwright E2E. Pushes to `master` and `V2` run the `check` job. Only a successful push or `workflow_dispatch` on `master` may upload `github-pages-dist` and deploy GitHub Pages. `V2` is validation-only and non-deploying. Pull requests run checks and never deploy. There is no separate deploy-only workflow.

## Human-oriented docs

- [README.md](README.md) — product surface and quick start
- [CONTRIBUTING.md](CONTRIBUTING.md) — tests and data safety
- [docs/release-v1.5.0-contract.md](docs/release-v1.5.0-contract.md) — v1.5.0 release contract
- [CHANGELOG.md](CHANGELOG.md) — release notes

## Documentation maintenance

When architecture, schema, features, or workflows change, update the local `ai/` files incrementally. Do not commit `ai/` to git.
