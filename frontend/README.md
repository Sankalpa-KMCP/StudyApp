# Study Dashboard Frontend

React + Vite PWA frontend for the local-first Study Dashboard. The app now stores study data in Dexie + IndexedDB, so tasks, subjects, notes, calendar events, flashcards, sessions, goals, quick notes, and settings persist offline in the browser or Tauri WebView.

## Commands

```bash
npm ci
npm run dev
npm run build
npm test
npm run lint
npm run test:e2e
```

The workspace root delegates the same commands into this folder.

## Structure

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Dashboard shell, workspaces, CRUD flows, flashcards, sessions, and visual summaries |
| `src/db/` | Dexie schema, import/export, clear-all, and legacy migration helpers |
| `src/index.css` | Visual system, responsive dashboard layout, empty states, charts, and motion |
| `src/App.test.tsx` | Vitest coverage for empty first run and key UI workflows |
| `e2e/dashboard.spec.ts` | Playwright desktop/mobile persistence smoke tests |

The Tauri desktop backend lives in `../backend`. It remains the desktop shell; app records are stored locally through IndexedDB.
