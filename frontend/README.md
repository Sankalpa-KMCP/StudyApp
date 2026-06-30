# Study Dashboard Frontend

React + Vite PWA frontend for the local-first Study Dashboard. Study data is stored in Dexie + IndexedDB, so tasks, subjects, notes, calendar events, flashcards, focus sessions, goals, quick notes, and settings persist offline in the browser or Tauri WebView.

## Product Surface

- Home dashboard with cross-entity search results.
- Tasks, notes, subjects, calendar, flashcards, progress, goals, and settings workspaces.
- Focus timer with subject selection, Pomodoro-style duration, open-ended mode, live elapsed/remaining time, and local session logging.
- Flashcards use a small local review schedule with `dueAt`, `intervalDays`, and `reviewCount`.
- Progress and subject cards derive useful completion from logged study sessions where possible.
- Settings include JSON import/export, Tauri-native import/export when available, clear-all confirmation, and local dark mode.

## Commands

```bash
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run check:bundle
npm run test:e2e
```

The workspace root delegates the same core commands into this folder.

## Structure

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Dashboard shell, workspace views, timer, settings, and CRUD flows |
| `src/appUtils.ts` | Shared date, progress, search, timer, and flashcard scheduling helpers |
| `src/db/` | Dexie schema, import/export, clear-all, and legacy migration helpers |
| `src/index.css` | Visual system, responsive layout, dark mode, cards, charts, and motion |
| `src/App.test.tsx` | Vitest coverage for key UI workflows |
| `src/appUtils.test.ts` | Unit coverage for derived progress and scheduling helpers |
| `e2e/dashboard.spec.ts` | Playwright desktop/mobile persistence smoke tests |

The Tauri desktop backend lives in `../backend`. It provides the desktop shell, tray timer toggle event, and native file access. Study records still live locally in IndexedDB.

## AI documentation

Start with [`../AGENTS.md`](../AGENTS.md) (committed). Full architecture docs live in local gitignored [`../ai/`](../ai/) when present on your machine (`PROJECT_CONTEXT.md`, `AI_RULES.md`, `ARCHITECTURE_DECISIONS.md`).
