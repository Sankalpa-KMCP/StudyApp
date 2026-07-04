# Agent instructions — Study Dashboard

Entry point for **any** AI coding agent (Cursor, Codex, Claude Code, Copilot, etc.) working in this repository.

## Read first (local, if present)

The full documentation set lives in **`ai/` at the repo root**. That folder is **gitignored** and is not on GitHub. On this machine, read these files before substantive edits:

| File | Purpose |
|------|---------|
| `ai/PROJECT_CONTEXT.md` | Architecture, features, data model, workflows |
| `ai/AI_RULES.md` | Operational rules, protected files, testing matrix |
| `ai/ARCHITECTURE_DECISIONS.md` | ADR log |

If `ai/` is missing (fresh clone), regenerate it with your setup-ai-documentation workflow or copy `ai/` from another machine. Until then, follow the condensed rules below.

Committed pointers also exist at `frontend/ai/README.md` and `frontend/.cursor/rules/ai-documentation-sync.mdc`.

## Project summary

- **Study Dashboard v1.2.0** — local-first study workspace (tasks, notes, subjects, calendar, flashcards, focus sessions, goals).
- **Frontend:** `frontend/` — React 19 + Vite 8 + Dexie/IndexedDB. UI is largely in `frontend/src/App.tsx` with helpers in `frontend/src/appUtils.ts`.
- **Desktop:** `backend/` — Tauri 2 shell only (tray, native file dialogs). Study data stays in the WebView IndexedDB.
- **No HTTP API**, no auth, no cloud database.

## Hard rules

1. **Local-first only** — Do not add backend servers, cloud DB, auth, or telemetry without explicit user request.
2. **No HTTP API** — IndexedDB via Dexie is the source of truth.
3. **Minimal diffs** — Change only what the task requires.
4. **Read before edit** — Inspect the full target file and nearest similar feature first.
5. **npm only** — Use `npm ci` / `npm install` (`package-lock.json` is canonical).
6. **No secrets** — Never commit `.env`, keys, or tokens.
7. **Dexie migrations** — Schema changes need `version(N)` in `frontend/src/db/studyDb.ts` plus tests in `studyDb.test.ts`.
8. **Destructive flows** — Keep confirmation and user feedback (see Settings in `App.tsx`).
9. **Protected files** — `studyDb.ts`, `App.tsx`, `backend/capabilities/default.json`, `vite.config.ts` base paths.
10. **Do not recreate removed architecture** — No hash routing, repository layer, folder sync, or encrypted backup unless explicitly requested.

## Commands (from repo root)

```bash
cd frontend && npm ci    # first time
npm run dev              # http://localhost:5173
npm test
npm run lint
npm run build
npm run check:bundle
npm run test:e2e
npm run tauri:dev
npm run tauri:build
```

CI (`frontend/.github/workflows/ci.yml`): lint → unit tests → build → bundle check → Playwright E2E.

## Human-oriented docs

- [README.md](README.md) — workspace overview
- [frontend/README.md](frontend/README.md) — product surface and structure
- [frontend/CONTRIBUTING.md](frontend/CONTRIBUTING.md) — tests and data safety
- [frontend/CHANGELOG.md](frontend/CHANGELOG.md) — release notes

## Documentation maintenance

When architecture, schema, features, or workflows change, update the local `ai/` files incrementally. Do not commit `ai/` to git.
