# Study Dashboard

React + Vite PWA for a local-first study workspace. Tasks, subjects, notes, calendar events, flashcards, focus sessions, goals, quick notes, and settings persist offline in the browser with Dexie + IndexedDB.

There is **no backend**, authentication, or cloud synchronization. The browser IndexedDB database is the source of truth.

## Product surface

- Home dashboard with cross-entity search results
- Data-derived first-study checklist for creating a subject, planning work, and recording the first session
- Tasks, notes, subjects, calendar, flashcards, progress, goals, and settings workspaces
- Focus timer with subject selection, Pomodoro-style duration, open-ended mode, and local session logging
- Running and paused focus sessions survive reload and browser reopen; stale sessions offer Resume or Discard
- Successful Settings backup import resynchronizes focus UI from IndexedDB without a page reload
- Flashcards with a simple review schedule (`dueAt`, `intervalDays`, `reviewCount`)
- Progress includes a local-date study journal with manual session logging, correction, and deletion
- Progress, Home totals, subject cards, and study-time goals update from finalized logged study sessions
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

```bash
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
| `src/App.tsx` | Dashboard shell, workspace routing state, timer, settings, and global handlers |
| `src/appUtils.ts` | Shared date, progress, search, timer, and flashcard scheduling helpers |
| `src/hooks/useMutationState.ts` | Shared pending/success/error helper for ordinary local mutations |
| `src/db/` | Dexie schema, import/export, clear-all, and legacy migration helpers |
| `src/views/` | Workspace views (tasks, notes, subjects, calendar, flashcards, progress, goals, settings) |
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

### Focus sessions

- Running and paused unfinished sessions are restored after reload or browser reopen.
- Timed focus sessions safely handle Pause and Resume at the completion boundary by re-checking the saved session before completing.
- Sessions at least 12 hours old show Resume / Discard instead of the normal timer.
- A successful backup import replaces local data and immediately resynchronizes the visible focus state from IndexedDB.

### Backups

- New exports use JSON format **version 2** with an explicit `metric` on every goal.
- Valid **version 1** backups remain importable; goals are normalized to explicit metrics **before** any local data is replaced.
- Import validation runs before table replacement; invalid payloads are rejected and existing data stays intact.

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) — migrations, E2E, coverage gates
- [CHANGELOG.md](CHANGELOG.md) — release notes
- [AGENTS.md](AGENTS.md) — AI agent entry point (full docs live in local gitignored `ai/`)

## Live demo

[Study Dashboard on GitHub Pages](https://it25100142.github.io/StudyApp/) — local-first; all data stays in your browser's IndexedDB.
