# Study App - workspace

Parent folder for the **Study Dashboard** project. The workspace now separates the browser app from the desktop backend while keeping root `npm` scripts as the main entrypoint.

## What's here

| Path | Description |
|------|-------------|
| [`frontend/`](frontend/) | Database-backed React + Vite PWA frontend |
| [`backend/`](backend/) | Tauri 2 Rust desktop backend, capabilities, and bundle assets |
| `package.json` | Workspace script delegate (`npm run dev` forwards to `frontend/`) |

## Quick start

**First-time setup** - install dependencies in `frontend/`:

```bash
cd frontend && npm ci
```

**Daily dev** - from this parent folder, scripts delegate to `frontend/`:

```bash
npm run dev         # http://localhost:5173
```

Or work entirely inside `frontend/`:

```bash
cd frontend
npm ci              # first time only
npm run dev
```

## Common commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm test` | Vitest unit and component tests |
| `npm run lint` | ESLint |
| `npm run storybook` | Storybook on port 6006 |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run tauri:dev` | Tauri desktop dev using `backend/tauri.conf.json` |
| `npm run tauri:build` | Tauri desktop release build using `backend/tauri.conf.json` |

Full test matrices and deployment details are in [frontend/README.md](frontend/README.md).

## Data storage

The study app is local-first. Tasks, subjects, notes, calendar events, flashcards, study sessions, goals, quick notes, and settings are saved in the browser/Tauri WebView with Dexie + IndexedDB. There is no bundled sample workspace and no HTTP API server. The Tauri backend remains the native desktop shell, not the study-data database.

First launch starts empty with create-first actions. Existing customized data from the older `study-dashboard-v2` browser storage key is migrated once when it is safe to do so; the old bundled sample rows are ignored.

## Documentation

- [frontend/README.md](frontend/README.md) - features, data model, deployment, PWA
- [frontend/CONTRIBUTING.md](frontend/CONTRIBUTING.md) - migrations, E2E, coverage gates
- [frontend/CHANGELOG.md](frontend/CHANGELOG.md) - release notes

## Live demo

[Study Dashboard on GitHub Pages](https://it25100142.github.io/StudyApp/) - local-first; all data stays in your browser's IndexedDB.
