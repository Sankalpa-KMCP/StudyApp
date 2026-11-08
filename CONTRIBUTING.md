# Contributing

## Setup

Use the supported toolchain declared in `package.json`, `.nvmrc`, and `.node-version`:

- **Node.js** 22 (`engines.node`: `^22.0.0`)
- **npm** 10.9.2 (`packageManager`: `npm@10.9.2`)

These declarations are compatibility guidance for local work and CI. Strict engine rejection is not enabled (`.npmrc` has `engine-strict=false`).

```bash
node --version   # expect v22.x
npm --version    # expect 10.9.2
npm ci
npm run dev
```

CI (`.github/workflows/ci.yml`) installs Node from `.nvmrc` and pins `npm@10.9.2` before `npm ci`.

For the recorded Phase 0 clean-install, validation, and preview baseline (including coverage affinity and Lighthouse notes), see [docs/phase-0-baseline.md](docs/phase-0-baseline.md). For v1.5.0 release scope and feature-freeze rules, see [docs/release-v1.5.0-contract.md](docs/release-v1.5.0-contract.md).

## Tests

| Command | Purpose |
|---------|---------|
| `npm test` | Vitest unit and component tests (full suite) |
| `npm run test:coverage` | Main coverage gate (all production `src/**/*.{ts,tsx}`) |
| `npm run test:e2e` | Playwright end-to-end suite (full Chromium desktop/mobile regression; Firefox, WebKit, and mobile-WebKit smoke projects) |
| `npm run lint` | ESLint including jsx-a11y rules |
| `npm run build` | TypeScript and production Vite build |
| `npm run check:bundle` | Gzip budget on built JS chunks |
| `npm run check:tests` | Strict no-emit TypeScript gate for tests, fixtures, E2E, configuration and local `.mjs` tooling |
| `npm run test:production` | Built-artifact smoke across desktop/mobile Chromium, Firefox and WebKit; build first |

### App integration suites

The production smoke uses `scripts/serve-production.mjs` on loopback port 4175,
serving only `dist` below `/StudyApp/`. It deliberately returns the built 404
document with HTTP 404 for deep links, exercising the real Pages redirect and
query/hash restoration. It does not use Vite's development transforms or SPA
fallback. Missing builds, scripts/assets, CSP violations, unexpected HTTP/network
errors and axe violations fail the gate. Expected 404 document diagnostics are
limited to the explicit fallback test. Each test uses disposable browser storage.

Run `npm run build`, `npm run check:bundle`, then `npm run test:production`.
The production gate also includes `startupEntrance.spec.ts`: ready-document
shell/heading/panel choreography, repeated reloads, saved themes, normal/reduced
motion, direct workspace entry, keyboard use, cancellation and controlled
persisted `pageshow` handling. No storage marker suppresses repeat visits.
CI reuses its already-built artifact and runs both browser gates before artifact
upload. Deployment triggers, permissions and master-tip freshness checks remain
unchanged. Local `STUDY_TEST_CHROMIUM_EXECUTABLE` can select an already installed
Chromium executable; record that override as noncanonical validation. Do not use
it to claim the repository's expected Playwright revisions passed.

`tsconfig.tests.json` inherits production strictness without changing the production
build configuration. It additionally checks test files and helpers, E2E, TypeScript
configs, ESLint config and local `.mjs` tools. The installed jsx-a11y plugin's
used configuration API is declared in `test-types/` because it ships no declarations.

App integration tests under `src/` cover user journeys and subsystem interactions without re-mounting full browser sessions. They are organized into:

- **Feature suites:** Focus restore/actions/races (`App.focus`), backup export/import/clear-all (`App.backup`), goals and metrics (`App.goals`), home dashboard and checklist (`App.home`), workspace views (`App.workspaces`), progress journal (`App.progress`), navigation and URL synchronization (`App.navigation`), app shell and theme preferences (`App.test.tsx`), global search (`App.search`), quick add (`App.quickAdd`), and mobile navigation (`App.mobileNav`).
- **Live-query isolation suites:** Dedicated suites verifying that row mutations in one entity table do not trigger spurious live-query reruns in unrelated consumers (`App.subjectsQuery`, `App.tasksQuery`, `App.notesQuery`, `App.eventsQuery`, `App.studySessionsQuery`, `App.goalsQuery`, `App.uiSettingsQuery`).
- **Error and recovery suites:** Error boundary fallbacks and degraded read/recovery paths (`App.readError`, `App.goalsReadError`).

Shared App suite reset lives in `src/test/appTestSetup.ts` (plus small focus/backup/home helpers). Prefer the matching feature, query-isolation, or error suite when adding App-level coverage.

Coverage (`vitest.config.ts`) instruments all production `src/**/*.{ts,tsx}` files and excludes tests, `src/test/**`, and `*.d.ts`. Thresholds stay at 80% lines/functions/statements and 70% branches. Do not lower those thresholds to green a change. CI enforces this gate with `npm run test:coverage` (not a separate plain `npm test` step). GitHub Pages deploys only from that CI workflow after `check` succeeds on `master` (`push` or `workflow_dispatch`). The hosted Pages site is currently a preview/testing deployment. Pull requests never deploy.

## Data Safety

Study data is local-first and stored in IndexedDB through Dexie. Keep destructive flows confirmed by the user and covered by tests.

Backup import validates size, shape/version, uniqueness, subject references, semantic integrity, known settings, and record-count limits **before** any IndexedDB clear/write. Reject invalid payloads entirely; do not silently repair duplicates, orphans, or out-of-range values. Failed imports must leave existing data and visible focus ownership intact. When changing import rules, inspect `useStudyBackup.ts`, `studyExportLimits.ts`, `studyExportValidation.ts`, and `studyDb.ts` together (see `README.md` → Backups).

Settings import and clear-all operations are strictly serialized via `DataOperationCoordinator`. Any changes to this flow must preserve the mutual exclusion invariant and ensure the focused regression tests in `src/db/dataCoordinator.test.ts` and `e2e/dataCoordinator.spec.ts` continue to pass. A dedicated Playwright scenario that rejects an invalid import through Settings remains optional; unit and App suites already cover rejection and focus preservation.

Optional fields on stored records should stay backward-compatible with older IndexedDB rows and JSON exports. Unknown settings keys on import stay accepted for forward compatibility.

## Dependency Hygiene

The app uses plain CSS, Vite, React, and Dexie. Icons are local React components under `src/components/icons/`, derived from a Lucide subset — reuse or extend that set rather than importing `lucide-react` (it is not an installed dependency). When adding icons, keep the required attribution in `src/components/icons/LICENSE.txt`. Do not add a UI/charting/state dependency unless the product code imports it and the bundle budget still passes.

## Adding an E2E spec

1. Create `e2e/<feature>.spec.ts` beside existing specs.
2. Start with `page.goto('/')` (or a workspace path such as `/tasks`) and wait for the matching workspace heading. Home uses the greeting heading (`Good morning`, `Good afternoon`, or `Good evening` — see `HOME_GREETING_HEADING` in `e2e/a11yHelpers.ts`).
3. Run `npm run test:e2e -- e2e/<feature>.spec.ts` locally before pushing.

## Shared UI components

Cover shared primitives with Vitest/Testing Library tests beside the components (for example `src/components/ui.test.tsx`). Do not add Storybook or other optional UI harnesses unless explicitly requested.

## Release Archive Hygiene

Do not create a release package by compressing the working directory. A generic filesystem ZIP could accidentally include ignored logs, local configuration files, and other private local files.

Use a committed-tree archive instead:
```bash
git archive HEAD --format=zip -o StudyApp-release.zip
```
This ensures the archive contains tracked committed files only. Ignored and untracked local files such as local configuration, development logs, generated output, and local tooling configuration are not release inputs. Note that GitHub Pages deployment remains separately generated from `dist`.

## Project Invariants

Architecture and data rules that apply to every change:

- **Local-first only.** No backend servers, cloud databases, auth, or telemetry. IndexedDB via Dexie is the source of truth; there is no HTTP API.
- **Composition root.** `src/App.tsx` owns live Dexie data, the sole `useCurrentDate()` local-midnight signal, derived Home metrics, URL-synced navigation, and view wiring. Feature orchestration stays in `src/hooks/` (`useFocusSession`, `useStudyBackup`, `useAppSearch`, preference hooks); pure helpers stay in `src/appUtils.ts`; domain persistence stays in `src/db/` (`studyDb.ts`, `activeFocusSession.ts`).
- **Goals and subjects carry explicit fields.** Every goal has a stored `metric` (`manual` points or `study_time`) and period (daily minutes; weekly/monthly rounded hours). Every subject has a `progressMode` (`manual` percentage, or `study_time` from all finalized sessions ÷ target hours). Titles never determine calculation.
- **Backups are validate-before-replace.** New exports are JSON version 4 with required `metric`/`progressMode`. Versions 1–3 remain importable with legacy normalization. Every rejection path (size, parse, duplicates, references, semantics, counts) must leave IndexedDB and visible focus ownership unchanged.
- **Local calendar dates.** Day keys use local `YYYY-MM-DD` (`localDateKey`); `App.tsx` owns the single `useCurrentDate()` timer; Playwright Home readiness accepts morning/afternoon/evening greeting variants.
- **Mutations use the shared pattern.** Prefer `useMutationState` (`src/hooks/useMutationState.ts`): validate before running, never reset forms inside the hook, preserve fields on failure, block duplicate submissions, and surface friendly fixed messages. Specialized flows (focus session, backup import/clear-all, quick-note autosave, preferences) keep their dedicated contracts.
- **Focus timed completion.** Never finalize while persistence is pending (synchronous pending ref); defer with the exact expected session ID; re-read the durable singleton and verify eligibility before auto-completing; paused and open-ended sessions never auto-complete; resume honors `accumulatedPausedMs`.
- **Dexie migrations.** Schema changes need `version(N)` in `src/db/studyDb.ts` plus tests in `studyDb.test.ts`.
- **Protected files.** `src/db/studyDb.ts`, `src/App.tsx`, and the `vite.config.ts` base paths change only with care and explicit review.
- **Do not recreate removed architecture** (hash routing, repository layer, folder sync, encrypted backups, desktop shell) unless explicitly requested.
- **CSS is plain global CSS.** `src/index.css` is an import barrel with fixed module order (fonts → tokens → base → layout → components → home → workspaces → settings → progress → mixed → themes → responsive → preferences). Keep `responsive` and `preferences` last; avoid selector renaming, specificity increases, CSS Modules, or CSS-in-JS.
- **Accessibility contracts.** One primary `h1` per page (topbar context stays outside the heading outline); axe scans stay unsuppressed (no disabled rules, selector exclusions, or violation baselines); theme-token contrast thresholds in `src/styles/themeTokenContrast.ts` keep passing across all themes; named charts need `role="img"` with a single accessible name; popovers stay keyboard-dismissible with focus restored to the trigger; rapidly updating timer text is not live-announced every tick.
- **Toolchain and hygiene.** npm only (`npm ci` / `npm install`; Node 22, npm 10.9.2); no secrets in the repository; minimal diffs; destructive flows keep confirmation and user feedback; after broad mutation, CSS, or accessibility changes run `npm test`, `npm run lint`, `npm run build`, `npm run check:bundle`, and the E2E suite.
