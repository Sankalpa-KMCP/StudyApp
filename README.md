# Study Dashboard

React + Vite PWA for a local-first study workspace. Tasks, subjects, notes, calendar events, flashcards, focus sessions, goals, quick notes, and settings persist offline in the browser with Dexie + IndexedDB.

There is **no backend**, authentication, or cloud synchronization. The browser IndexedDB database is the source of truth.

## Product surface

- Home dashboard with cross-entity search results
- Data-derived first-study checklist for creating a subject, planning work, and recording the first session
- Tasks, notes, subjects, calendar, flashcards, progress, goals, and settings workspaces (bookmarkable paths such as `/tasks`; production URLs sit under `/StudyApp/`)
- Focus timer with subject selection, Pomodoro-style duration, open-ended mode, and local session logging
- Running and paused focus sessions survive reload and browser reopen; stale sessions offer Resume or Discard
- Successful Settings backup import resynchronizes focus UI from IndexedDB without a page reload
- Flashcards with a simple review schedule (`dueAt`, `intervalDays`, `reviewCount`)
- Progress includes a local-date study journal with manual session logging, correction, and deletion
- Progress, Home totals, and study-time goals update from finalized logged study sessions
- Subjects support explicit **Manual progress** (stored percentage) and **Study time** (automatic from matching recorded sessions toward target hours); cards and search use the same calculated value
- Calendar strip days and Home date summaries use the local calendar day and refresh after local midnight without a reload
- Goals support explicit **Manual progress** (stored points) and **Study time** (automatic from recorded sessions); metric and period are separate choices
- Settings include JSON import/export, clear-all confirmation, and seven local theme palettes; Monochrome is the default

## Data reliability

Workspace create, edit, delete, and status/review actions use a shared local mutation pattern:

- Pending controls block repeated submissions while a write is in flight
- Forms stay populated and open after a failed save so you can retry
- Forms reset or close only after a successful write
- Failed deletes leave the record visible
- Status and review failures preserve the original visible state
- Success and error feedback use accessible status and alert announcements (no raw database errors)

## Accessibility

Study Dashboard includes keyboard-accessible navigation and core study workflows, a skip link, and visible focus indicators. The notification popover is non-modal: Escape closes it and returns focus to the Notifications control. Tasks and Goals associate field-level validation errors with the responsible inputs. All seven themes include improved text and control-boundary contrast. The app respects `prefers-reduced-motion` and `prefers-reduced-transparency`, and keeps focused controls clear of the fixed mobile bottom navigation at common zoom/reflow widths. Focus timer values remain readable on screen without second-by-second live announcements. Automated accessibility smoke checks (axe) cover representative Home, Settings, and Progress states in Playwright.

These are accessibility improvements and checks—not a claim of universal WCAG certification across every browser or assistive technology.

## Quick start

Supported toolchain (compatibility guidance — `.npmrc` keeps `engine-strict=false`, so other versions are not rejected automatically):

- **Node.js** 22 (`^22.0.0`; see `.nvmrc` / `.node-version`)
- **npm** 10.9.2 (`packageManager` in `package.json`; matches CI)

```bash
node --version   # expect v22.x
npm --version    # expect 10.9.2
npm ci
npm run dev         # http://localhost:5173
```

Normal local development does not require a `.env` file.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (`http://localhost:5173`) |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build (`http://localhost:4173/StudyApp/`) |
| `npm test` | Vitest unit and component tests |
| `npm run lint` | ESLint |
| `npm run check:bundle` | Built JS gzip budget check |
| `npm run test:e2e` | Playwright end-to-end tests |

## Structure

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Composition root: live data, navigation, derived metrics, sole `useCurrentDate`, view wiring |
| `src/appUtils.ts` | Shared date, progress, search builders, and flashcard scheduling helpers |
| `src/hooks/useCurrentDate.ts` | App-owned local-midnight Date signal for date-derived Home metrics |
| `src/hooks/useMutationState.ts` | Shared pending/success/error helper for ordinary local mutations |
| `src/hooks/useThemePreference.ts` | Theme `localStorage` + DOM `data-theme` / theme-color |
| `src/hooks/useSidebarPreference.ts` | Sidebar collapse preference in `localStorage` |
| `src/hooks/useAppSearch.ts` | Search state, deferred filters, Home cross-entity results |
| `src/hooks/useFocusSession.ts` | Focus restore/actions/timed completion + import lock APIs |
| `src/hooks/useStudyBackup.ts` | Export download, import under focus lock, clear-all coordination |
| `src/db/` | Dexie schema, import/export validation, clear-all, and legacy migration helpers |
| `src/views/` | Workspace views (tasks, notes, subjects, calendar, flashcards, progress, goals, settings) |
| `src/App.test.tsx` | App-shell integration tests (theme/sidebar/notices/search keyboard) |
| `src/App.*.test.tsx` | Feature App suites (focus, backup, goals, home, navigation, workspaces, progress) |
| `src/index.css` | Ordered global CSS entry (imports only) |
| `src/styles/` | Modular plain CSS (tokens, layout, components, Home, workspaces, responsive, preferences) |
| `e2e/` | Playwright desktop/mobile persistence and focus/import smoke tests |

## CSS architecture

Styling uses **plain global CSS** (no CSS Modules, CSS-in-JS, or per-component stylesheet imports).

- `src/index.css` is the **single ordered entry** imported by the app (`src/main.tsx`).
- Modules live under `src/styles/` and load in a fixed cascade: fonts → tokens/themes → base → layout → components → home → workspaces → settings → progress → mixed → responsive → preferences.
- Seven themes share CSS variables in `tokens.css` (Monochrome uses base `:root` defaults).
- Width breakpoints and reduced-motion / reduced-transparency rules load **last** so they continue to override earlier declarations.

```
src/styles/
  fonts.css          # @font-face
  tokens.css         # :root tokens + theme overrides
  base.css           # reset, focus-visible, sr-only, skip-link
  layout.css         # app shell, sidebar, topbar, page grids
  components.css     # shared cards, fields, buttons, notices, charts
  home.css           # hero, first-study, focus, quick notes, Home search
  workspaces.css     # Tasks/Notes/Subjects/Flashcards-owned extras
  settings.css       # theme studio, import, danger zone
  progress.css       # session editor and journal
  mixed.css          # intentionally cross-owned selector groups
  responsive.css     # width breakpoints (1220 → 420)
  preferences.css    # reduced-motion, reduced-transparency
```

## Data storage

Study data is local-first. Everything is saved in the browser with Dexie + IndexedDB. There is no HTTP API server and no cloud database.

First launch starts empty with create-first actions. Existing customized data from the older `study-dashboard-v2` browser storage key is migrated once when it is safe to do so.

### Goals

- **Manual progress** — you set and edit progress yourself; values are stored in **points**.
- **Study time** — progress is calculated automatically from **finalized recorded study sessions** (unfinished focus sessions do not count until they are saved to history).
- **Period** is separate from metric: daily, weekly, or monthly.
- **Units:** daily study-time goals use **minutes**; weekly and monthly study-time goals use **rounded hours**.
- **Weekly study-time** totals use the existing **rolling seven local calendar days ending today** (not an ISO or fixed calendar week).
- **Monthly study-time** totals use the **current local calendar month**.
- **Renaming a goal does not change** how it is calculated; only the stored metric and period matter.

### Subjects

- **Manual progress** — you set a percentage (0–100); the value stays stored even if you switch modes.
- **Study time** — progress is **matching finalized study-session minutes ÷ (target hours × 60)**, clamped to 0–100. It uses all matching recorded sessions (not limited to a day/week/month). Unfinished focus sessions do not count until they are saved to history.
- New subjects default to **Manual progress**. The Subjects editor lets you choose the mode; Progress % appears only in manual mode.
- Subject cards and Home search use one shared calculator for the displayed percentage.
- **Subject Distribution** on Progress is separate: it shows each subject’s share of total logged study time, not progress toward a subject’s target hours.

### Focus sessions

- Running and paused unfinished sessions are restored after reload or browser reopen.
- Timed focus sessions safely handle Pause and Resume at the completion boundary by re-checking the saved session before completing.
- Sessions at least 12 hours old show Resume / Discard instead of the normal timer.
- A successful backup import replaces local data and immediately resynchronizes the visible focus state from IndexedDB.

### Backups

- New exports use plain, unencrypted JSON format **version 3** (`version: 3`) with an explicit `metric` on every goal and an explicit `progressMode` on every subject (`manual` or `study_time`).
- **Snapshot boundaries:** Snapshot acquisition occurs inside one readonly Dexie transaction covering all eight database tables (`subjects`, `tasks`, `notes`, `events`, `flashcards`, `studySessions`, `goals`, `settings`). Version and timestamp metadata, JSON stringification, Blob creation, object URL generation, and browser download initiation occur after transaction settlement.
- **Data included:** Export captures one point-in-time snapshot of all subjects, tasks, notes, calendar events, flashcards, study sessions, goals, and supported settings (including `activeFocusSession` when present).
- **Data excluded:** Device-local appearance (`localStorage` theme selection) and sidebar collapse state are excluded from backups.
- **Snapshot timing:** Writes committed after snapshot acquisition begins may not appear in that export.
- **Security guidance:** Backup files are unencrypted JSON and should be stored and shared according to the sensitivity of the user's study data.
- **Import validation:** Valid **version 1** and **version 2** backups remain importable. Goals without metrics (v1) and subjects without modes (v1/v2) are normalized from the **complete imported study-session set** **before** any local data is replaced. Current exports are always version 3.
- Version 3 backups that omit or use an invalid subject `progressMode` (or goal `metric`) fail validation **before** table replacement; existing data stays intact.
- **Imports validate fully before replacing local data.** Size, shape/version, uniqueness, subject references, semantic integrity, known settings values, and record-count limits are checked first. Only then does IndexedDB clear and rewrite. Invalid imports leave existing data and the visible focus session unchanged.
- Integrity checks reject duplicate entity IDs and duplicate settings keys; orphan non-empty `subjectId` values (empty string remains General / unassigned); out-of-range subject progress or non-positive target hours; negative task minutes; non-positive session minutes; event or session end before start; non-positive goal targets or negative goal progress; and negative flashcard scheduling counters when present.
- Known settings are checked (`dailyGoalMinutes` 30–720; `quickNotes` string array up to 8; migration flag exactly `true`; `activeFocusSession` must match its domain contract). Unknown settings keys stay accepted and preserved for forward compatibility.
- Resource limits: **5 MiB** file bytes and text length; **25,000** total records; subjects **500**; tasks/notes/events **5,000** each; flashcards/study sessions **10,000** each; goals **500**; settings **64**.
- Import integrity is structural (ranges, uniqueness, references, order). Stricter UI editor limits (for example task minutes 5–720, or Progress’s “session end not in the future” rule) are **not** re-enforced on import.

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) — migrations, E2E, coverage gates
- [docs/phase-0-baseline.md](docs/phase-0-baseline.md) — Phase 0 install/validation/performance baseline
- [docs/technical-debt.md](docs/technical-debt.md) — active technical debt, accepted constraints, evidence gaps
- [CHANGELOG.md](CHANGELOG.md) — release notes
- [AGENTS.md](AGENTS.md) — AI agent entry point (full docs live in local gitignored `ai/`)

## Live demo

[Study Dashboard on GitHub Pages](https://sankalpa-kmcp.github.io/StudyApp/) — local-first; all data stays in your browser's IndexedDB.
