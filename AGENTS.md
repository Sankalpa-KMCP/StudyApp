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
- **Web app:** React 19 + Vite 8 + Dexie/IndexedDB PWA at the repo root.
- **`App.tsx` is the composition root** — live Dexie data, sole `useCurrentDate()`, derived Home metrics, navigation/layout, shared preference notices, and view wiring. Pure helpers stay in `src/appUtils.ts`.
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
- **IndexedDB:** Dexie **version 2** (upgrade from v1 assigns metrics to legacy rows once via title rules in `src/db/goalMetricInference.ts` — migration/import only, not runtime).
- **Backups:** new exports use JSON **version 2** with required goal metrics; valid **version 1** backups remain importable and are normalized before any table replacement.

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
| Settings import / clear-all | `useStudyBackup` + `runWithFocusImportLock` / `reloadFocusFromIndexedDb` / `clearFocusLocalState`; keep `focusImportPending` gating on focus actions. Clear-all is not serialized with an in-flight import (pre-existing; harden only as a separate product-approved change) |
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
