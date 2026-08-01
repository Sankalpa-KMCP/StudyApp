# Study Dashboard

React + Vite PWA for a local-first study workspace. Tasks, subjects, notes, calendar events, flashcards, focus sessions, goals, quick notes, and settings persist offline in the browser with Dexie + IndexedDB.

## Product surface

- Home dashboard with cross-entity search results
- Data-derived first-study checklist for creating a subject, planning work, and recording the first session
- Tasks, notes, subjects, calendar, flashcards, progress, goals, and settings workspaces
- Focus timer with subject selection, Pomodoro-style duration, open-ended mode, and local session logging
- Flashcards with a simple review schedule (`dueAt`, `intervalDays`, `reviewCount`)
- Progress includes a local-date study journal with manual session logging, correction, and deletion
- Progress, Home totals, subject cards, and study-time goals update from finalized logged study sessions
- Goals support explicit **Manual progress** (stored points) and **Study time** (automatic from recorded sessions); metric and period are separate choices
- Settings include JSON import/export, clear-all confirmation, and seven local theme palettes; Monochrome is the default

## Quick start

```bash
npm ci
npm run dev         # http://localhost:5173
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm test` | Vitest unit and component tests |
| `npm run lint` | ESLint |
| `npm run check:bundle` | Built JS gzip budget check |
| `npm run test:e2e` | Playwright end-to-end tests |

## Structure

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Dashboard shell, workspace views, timer, settings, and CRUD flows |
| `src/appUtils.ts` | Shared date, progress, search, timer, and flashcard scheduling helpers |
| `src/db/` | Dexie schema, import/export, clear-all, and legacy migration helpers |
| `src/index.css` | Visual system, responsive layout, themes, cards, charts, and motion |
| `e2e/dashboard.spec.ts` | Playwright desktop/mobile persistence smoke tests |

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
