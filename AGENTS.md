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

Committed pointer: [`.cursor/rules/ai-documentation-sync.mdc`](.cursor/rules/ai-documentation-sync.mdc).

## Project summary

- **Study Dashboard v1.3.0** — local-first study workspace (tasks, notes, subjects, calendar, flashcards, focus sessions, goals).
- **Web app:** React 19 + Vite 8 + Dexie/IndexedDB PWA at the repo root. UI is largely in `src/App.tsx` with helpers in `src/appUtils.ts`.
- **No HTTP API**, no auth, no cloud database, no desktop shell.

## Goals and metrics

- Every goal has an explicit **`metric`**: `manual` (**Manual progress**) or `study_time` (**Study time**). Goal **titles never determine runtime calculation** — only the stored metric and period matter.
- **Manual progress** uses stored `goal.progress` in **points**.
- **Study time** derives progress from finalized recorded **`studySessions`** only (unfinished focus sessions do not count until finalized into history).
- **Period units:** daily study-time goals use **minutes**; weekly and monthly study-time goals use **rounded hours** (weekly totals use the existing rolling seven local calendar days ending today; monthly totals use the current local calendar month).
- **IndexedDB:** Dexie **version 2** (upgrade from v1 assigns metrics to legacy rows once via title rules in `src/db/goalMetricInference.ts` — migration/import only, not runtime).
- **Backups:** new exports use JSON **version 2** with required goal metrics; valid **version 1** backups remain importable and are normalized before any table replacement.

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
| Focus start/pause/resume/stop/stale/subject | Domain result contracts + singleton/idempotency protections in `activeFocusSession` / `App.tsx` |
| Settings import | Dedicated `focusImportPending` must stay synchronized with focus action gating and post-import `reloadFocusFromIndexedDb()` |
| Quick-note autosave | Sequential latest-value write queue so a stale write cannot overwrite newer draft text |
| Theme / sidebar preferences | `localStorage`-backed; report friendly failures without migrating to IndexedDB |

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

`fonts` → `tokens` → `base` → `layout` → `components` → `home` → `workspaces` → `settings` → `progress` → `mixed` → `responsive` → `preferences`

| Module | Ownership |
|--------|-----------|
| `fonts.css` | `@font-face` only |
| `tokens.css` | Design tokens and `:root[data-theme]` overrides (Monochrome = bare `:root`) |
| `base.css` | Reset, global form controls, `:focus-visible`, `::selection`, `.sr-only`, `.skip-link` |
| `layout.css` | App shell, sidebar, topbar, dashboard/page grids |
| `components.css` | Reusable primitives (cards, fields, commands, notices, charts, calendar-strip, empty states) |
| `home.css` | Hero, first-study, focus timer, quick notes, Home search/previews |
| `workspaces.css` | Tasks/Notes/Subjects/Flashcards-owned extras (e.g. swatches, flashcard states) |
| `settings.css` | Theme studio, import card, danger/clear-all |
| `progress.css` | Manual session editor and study journal |
| `mixed.css` | Cross-owned grouped selectors kept **intact** (do not split to force ownership) |
| `responsive.css` | Width breakpoints only |
| `preferences.css` | `prefers-reduced-motion`, then `prefers-reduced-transparency` |

Maintenance rules:

- Keep `responsive` and `preferences` last; never duplicate declarations across modules to “claim” ownership.
- Avoid selector renaming, specificity increases, CSS Modules, CSS-in-JS, or visual redesign during maintenance-only work.
- App and Storybook both load `src/index.css` — validate both after broad CSS changes.

```bash
npm test -- --run
npm run lint
npm run build
npm run check:bundle
# PowerShell clean Playwright server:
$env:CI="true"; npm run test:e2e
npm run build-storybook
```

## Hard rules

1. **Local-first only** — Do not add backend servers, cloud DB, auth, or telemetry without explicit user request.
2. **No HTTP API** — IndexedDB via Dexie is the source of truth.
3. **Minimal diffs** — Change only what the task requires.
4. **Read before edit** — Inspect the full target file and nearest similar feature first.
5. **npm only** — Use `npm ci` / `npm install` (`package-lock.json` is canonical).
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
npm run storybook        # http://localhost:6006
npm test
npm run lint
npm run build
npm run check:bundle
npm run test:e2e
```

CI (`.github/workflows/ci.yml`): lint → unit tests → build → bundle check → Playwright E2E.

## Human-oriented docs

- [README.md](README.md) — product surface and quick start
- [CONTRIBUTING.md](CONTRIBUTING.md) — tests and data safety
- [CHANGELOG.md](CHANGELOG.md) — release notes

## Documentation maintenance

When architecture, schema, features, or workflows change, update the local `ai/` files incrementally. Do not commit `ai/` to git.
