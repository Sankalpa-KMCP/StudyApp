# Architecture

React + Vite web application for a local-first study workspace. The browser IndexedDB database
(Dexie) is the source of truth. There is **no backend**, authentication, or cloud
synchronization.

## Project structure

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Composition root: live data, navigation, derived metrics, sole `useCurrentDate`, view wiring |
| `src/appUtils.ts` | Shared date, progress, and search builders |
| `src/hooks/useCurrentDate.ts` | App-owned local-midnight Date signal for date-derived Home metrics |
| `src/hooks/useMutationState.ts` | Shared pending/success/error helper for ordinary local mutations |
| `src/hooks/useThemePreference.ts` | Theme `localStorage` + DOM `data-theme` / theme-color |
| `src/hooks/useSidebarPreference.ts` | Sidebar collapse preference in `localStorage` |
| `src/hooks/useAppSearch.ts` | Search state, deferred filters, Home cross-entity results |
| `src/hooks/useFocusSession.ts` | Focus restore/actions/timed completion + import lock APIs |
| `src/hooks/useStudyBackup.ts` | Export download, import under focus lock, clear-all coordination |
| `src/db/` | Dexie schema, import/export validation, clear-all, and legacy migration helpers |
| `src/views/` | Workspace views (tasks, notes, subjects, calendar, progress, goals, settings) |
| `src/App.test.tsx` | App-shell integration tests (theme/sidebar/notices/search keyboard) |
| `src/App.*.test.tsx` | Feature App suites (focus, backup, goals, home, navigation, workspaces, progress) |
| `src/index.css` | Ordered global CSS entry (imports only) |
| `src/styles/` | Modular plain CSS (tokens, layout, components, Home, workspaces, responsive, preferences) |
| `e2e/` | Playwright desktop/mobile persistence and focus/import smoke tests |

## CSS architecture

Styling uses **plain global CSS** (no CSS Modules, CSS-in-JS, or per-component stylesheet
imports).

- `src/index.css` is the **single ordered entry** imported by the app (`src/main.tsx`).
- Modules live under `src/styles/` and load in a fixed cascade: fonts → tokens → base →
  layout → components → home → workspaces → settings → progress → mixed → premium themes →
  responsive → preferences.
- 21 themes share CSS variables in `tokens.css` (Monochrome uses base `:root` defaults);
  `themes.css` owns the five lightweight ambient wallpapers and Crystal Glass rendering.
- Width breakpoints and reduced-motion / reduced-transparency rules load **last** so they
  continue to override earlier declarations.

```
src/styles/
  fonts.css          # @font-face
  tokens.css         # :root tokens + theme overrides
  base.css           # reset, focus-visible, sr-only, skip-link
  layout.css         # app shell, sidebar, topbar, page grids
  components.css     # shared cards, fields, buttons, notices, charts
  home.css           # hero, first-study, focus, quick notes, Home search
  workspaces.css     # Tasks/Notes/Subjects-owned extras
  settings.css       # theme studio, import, danger zone
  progress.css       # session editor and journal
  mixed.css          # intentionally cross-owned selector groups
  themes.css         # premium ambience, Crystal glass, Zen and preview treatments
  responsive.css     # width breakpoints (1220 → 420)
  preferences.css    # reduced-motion, reduced-transparency
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (`http://localhost:5173`) |
| `npm run build` | Production build |
| `npm run preview` | Serve the production build (`http://localhost:4173/StudyApp/`) |
| `npm test` | Vitest unit and component tests |
| `npm run lint` | ESLint |
| `npm run check:tests` | Strict no-emit check of unit/component tests, E2E, fixtures and testing configuration |
| `npm run check:bundle` | Built JS gzip budget check |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run test:production` | Smoke-test existing `dist` using the production Pages fixture; run `npm run build` first |

## Further engineering notes

- [docs/capacity-performance.md](capacity-performance.md) — storage capacity and performance notes
- [docs/phase-0-baseline.md](phase-0-baseline.md) — Phase 0 install/validation/performance baseline
- [docs/technical-debt.md](technical-debt.md) — active technical debt, accepted constraints, evidence gaps
- [docs/release-v1.5.0-contract.md](release-v1.5.0-contract.md) — v1.5.0 release contract
