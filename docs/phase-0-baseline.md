# Phase 0 baseline - Study Dashboard

**Report date:** 2026-07-27
**Baseline branch:** `master`
**Baseline commit:** `75670e02757a43c358510b13d438b29203cb784f`
**Production base path:** `/StudyApp/`

This document records a reproducible Phase 0 baseline for installation, validation, production preview, performance, accessibility, and PWA behaviour. Later phases should compare against these commands and metrics rather than informal chat history.

**Repository baseline vs hosted deployment:** Evidence below is for the local repository at the baseline commit. GitHub Pages may lag until that commit (or a later tip) is pushed and the CI `deploy` job publishes a verified `dist`. Do not treat the live demo URL as proof that this exact commit is hosted.

Related tracked docs: [README.md](../README.md), [CONTRIBUTING.md](../CONTRIBUTING.md), [docs/technical-debt.md](technical-debt.md), [AGENTS.md](../AGENTS.md), [CHANGELOG.md](../CHANGELOG.md).

---

## 1. Purpose

Phase 0 established:

- an explicit supported Node/npm toolchain;
- a clean lockfile install under that toolchain;
- a full local validation gate matching CI intent;
- production `/StudyApp/` preview measurements (Lighthouse, axe smoke, PWA registration).

Use this report to reproduce the same checks on a fresh clone and to detect regressions in later work.

---

## 2. Supported environment

| Item | Value |
|------|--------|
| Node.js | **22** release line (`engines.node`: `^22.0.0`) |
| npm | **10.9.2** (`packageManager`: `npm@10.9.2`) |
| Version files | [`.nvmrc`](../.nvmrc), [`.node-version`](../.node-version) (both `22`) |
| Engine rejection | **Not enabled** - [`.npmrc`](../.npmrc) has `engine-strict=false` |

Declarations are compatibility guidance for local work and CI. Unsupported host toolchains (for example Node 24 or npm 11 on the PATH) are **not** baseline evidence even if some scripts appear to work.

Verify:

```bash
node --version   # expect v22.x
npm --version    # expect 10.9.2
```

CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) installs Node from `.nvmrc` and pins `npm@10.9.2` before `npm ci`.

---

## 3. Reproducible installation

From a clean clone of this repository at the baseline commit (or a later tip that preserves the same toolchain pins):

```bash
# Confirm Node 22 + npm 10.9.2 first (see above)
npm ci
```

To force a clean install when a local `node_modules` already exists, remove **only** that directory in the repository root, then run `npm ci` again. Do not use broad recursive deletion from a parent folder, and do not delete tracked files, Git metadata, or caches outside the project.

### Verified clean install (Windows lab)

| Fact | Result |
|------|--------|
| OS | Windows NT 10.0.26200, X64 |
| Node / npm | v22.22.0 / 10.9.2 |
| Command | `npm ci` |
| Result | Exit 0; added **613** packages; audited **614** |
| Audit summary | **6** findings (**1** low, **5** high) - recorded, not remediated in Phase 0 |
| Deprecations observed | `source-map@0.8.0-beta.0`, `glob@11.1.0`, `glob@10.5.0` |

### Accepted Windows optional `@emnapi` variance

Root [`package.json`](../package.json) `optionalDependencies` pin `@emnapi/core@1.11.0` and `@emnapi/runtime@1.11.0` so npm 10 `npm ci` keeps required lockfile package entries (historical CI sync anchors). StudyApp source does **not** import these packages. On Windows, the Vite/Rolldown path uses `@rolldown/binding-win32-x64-msvc`; the wasm32-wasi optional tree (and related `@emnapi` packages) may remain unmet. That is **accepted platform variance**. Do not casually remove the root pins or "fix" unmet optional `@emnapi` on Windows without re-validating Linux/CI `npm ci`.

---

## 4. Canonical validation commands

Run from the repository root with Node 22 and npm 10.9.2.

| Step | Command | Notes |
|------|---------|--------|
| Lint | `npm run lint` | ESLint |
| Plain unit/component tests | `npm test` | Vitest without coverage; useful locally |
| Coverage (canonical gate) | `npm run test:coverage` | See section 5 for local four-CPU affinity wrapper |
| Production build / typecheck | `npm run build` | `tsc -b && vite build` |
| Bundle budget | `npm run check:bundle` | Requires a prior build |
| Production path checks | After build: confirm `dist/index.html` contains `/StudyApp/assets/` and does **not** contain `main.tsx`; confirm no `dist/src` source tree | Matches CI "Verify dist output" |
| E2E | PowerShell: `$env:CI="true"; npm run test:e2e` / POSIX: `CI=true npm run test:e2e` | Forces a fresh Playwright webServer (`reuseExistingServer` is false when `CI` is set) |

**CI relationship:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs lint -> **`npm run test:coverage`** (not a second plain `npm test`) -> build -> `check:bundle` -> dist path checks -> Playwright E2E. Pull requests never deploy. *(Note: When this baseline was created, `master`/`V2` could deploy after a green `check`. Under the current paused release state, GitHub Pages deployment is strictly master-only preview/testing).*

Optional local preview of the production build:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
# open http://127.0.0.1:4173/StudyApp/
```

Nested `npm` invocations (Playwright `webServer`, preview wrappers) must also resolve to npm **10.9.2** and Node **22** for baseline-comparable evidence. Prefer a temporary PATH wrapper that shadows `npm` without permanently changing the user or system PATH.

---

## 5. Coverage affinity requirement (local canonical gate)

On multi-core Windows hosts, the accepted local coverage gate constrains the process to **four** logical CPUs so Vitest parallelism matches the established baseline:

| Requirement | Value |
|-------------|--------|
| Affinity mask | `15` / `0xF` (lowest four CPUs) |
| Inside the constrained process | `os.availableParallelism()` must report **exactly 4** |
| Host probe (unconstrained) | May report the full machine CPU count (for example 20) |
| Working directory | Repository root |
| Inner command | Exactly `npm run test:coverage` |
| Forbidden additions | Worker/pool/serial/retry/timeout/test-selection flags that change suite selection or weaken the gate |

Implement the outer wrapper with an OS process-affinity API (for example PowerShell `ProcessStartInfo` + `ProcessorAffinity = 15`) that launches Node running the approved npm CLI, then the inner script above. Do not bake machine-specific cache paths into project docs or scripts.

CI Ubuntu runners do not use this Windows affinity wrapper; they run `npm run test:coverage` directly after pinning npm 10.9.2.

Coverage thresholds (do not lower to green a change): **80%** lines/functions/statements, **70%** branches - see [`vitest.config.ts`](../vitest.config.ts) and [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## 6. Baseline results

Measured at baseline commit `75670e02757a43c358510b13d438b29203cb784f` under Node 22.22.0 / npm 10.9.2 unless noted.

| Gate | Result |
|------|--------|
| Clean `npm ci` | Pass (613 added / 614 audited) |
| `npm run lint` | Pass |
| `npm test` | **75** files / **783** tests passed; **0** failed / skipped / timed out |
| `npm run test:coverage` (4-CPU affinity) | **75** files / **783** tests passed; statements **94.62%**; branches **90.66%**; functions **89.04%**; lines **94.62%**; **0** failed / skipped / timed out |
| `npm run build` | Pass (Vite **8.0.16**; PWA `generateSW`) |
| `npm run check:bundle` | Pass - main JS gzip **96,363** (limit **512,000**); total JS gzip **130,666** (limit **1,200,000**) |
| Dist path / no-source-entry | Pass - `/StudyApp/assets/...` in `dist/index.html`; no `main.tsx`; no `dist/src` |
| `CI=true` E2E | **112** passed (includes **1** flaky); **0** failed / skipped / retries / flakes (also reconfirmed under a controlled Node 22 / npm 10.9.2 PATH for outer + nested `npm run dev`) |

Representative production main chunk at baseline: `dist/assets/index-JgzJgmuN.js`.

Expected deliberate stderr during tests: `Error: write boom` from the Goals live-read failure-path suite - not a suite failure.

---

## 7. Performance baseline

Tooling: **Lighthouse 13.4.0** (existing local CLI; not a repository dependency) against a fresh production preview at **`http://127.0.0.1:4173/StudyApp/`**. Single local headless run per form factor. Scores are lab measurements and can vary; use repeated/median runs before treating shifts as product regressions.

Configured LHCI thresholds in [`.lighthouserc.json`](../.lighthouserc.json) (for reference; Phase 0 did not claim a green LHCI job): performance **>= 0.9**, accessibility **>= 0.95**, installable-manifest **>= 0.9**.

### Desktop

| Category / metric | Value |
|-------------------|--------|
| Performance | **69** (score 0.69) |
| Accessibility | **100** |
| Best Practices | **100** |
| SEO | **100** |
| FCP | 2.3 s |
| LCP | 2.6 s |
| TBT | 150 ms |
| CLS | 0.001 |
| Speed Index | 2.3 s |
| TTI | 2.8 s |

**Open follow-up:** Desktop Performance **69** is **below** the configured **90** (0.9) threshold in `.lighthouserc.json`. This is **not** labeled as a passed performance gate and is **not** proven as a product regression from a prior median baseline. Record it as an open baseline observation requiring repeatable follow-up (multiple runs / median policy) before changing product code or weakening thresholds.

### Mobile

| Category / metric | Value |
|-------------------|--------|
| Performance | **95** |
| Accessibility | **100** |
| Best Practices | **100** |
| SEO | **100** |
| FCP | 2.0 s |
| LCP | 2.6 s |
| TBT | 0 ms |
| CLS | 0 |
| Speed Index | 2.0 s |
| TTI | 2.6 s |

Lighthouse 13 default category set did **not** include the historic PWA category; PWA behaviour was verified separately (section 9).

---

## 8. Accessibility baseline

### Automated axe (committed E2E)

- Tooling: `@axe-core/playwright` via [`e2e/a11yHelpers.ts`](../e2e/a11yHelpers.ts)
- Tags (unsuppressed): `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`
- Surfaces include Home (+ Notifications open), Settings (+ clear confirmation UI without deleting), Progress (+ Study Time chart), plus mobile navigation / responsive workspace axe smokes
- Policy: do not disable rules, exclude app selectors, or add known-violation baselines merely to obtain green tests - see [AGENTS.md](../AGENTS.md)

### Focused production Home smoke (baseline lab)

Against `http://127.0.0.1:4173/StudyApp/`: **0** violations, **30** passes, **3** incomplete; no severe browser console errors in that smoke.

### Keyboard / mobile / reflow

Represented by existing unit and E2E suites (navigation, notifications Escape restore, mobile bottom nav, workspace reflow). Not re-enumerated here.

### Limitations (non-claims)

- No assistive-technology (screen reader) session was performed.
- Incomplete axe findings are not treated as automatic failures and were not expanded into WCAG claims.
- **No universal WCAG certification** is claimed for any browser or AT.

---

## 9. PWA and production behaviour

| Check | Baseline evidence |
|-------|-------------------|
| Base path | Production Vite `base` `/StudyApp/` ([`vite.config.ts`](../vite.config.ts)) |
| Asset URLs | `dist/index.html` references `/StudyApp/assets/...`, `/StudyApp/manifest.webmanifest`, `/StudyApp/registerSW.js` |
| Service worker | After `npm run build`, `dist/registerSW.js` registers `/StudyApp/sw.js` with scope `/StudyApp/` |
| Manifest / icons | Manifest loads; relative icon paths resolve under `/StudyApp/` (HTTP 200 in lab preview) |
| No source entry | No `dist/src`; built HTML does not reference `main.tsx` |
| Offline navigation | **Not tested** - registration and scope verified only |

---

## 10. Known warnings and limitations

| Item | Classification |
|------|----------------|
| npm audit: 6 findings (1 low, 5 high) | Recorded at clean install; **not** fixed in Phase 0 |
| Deprecations: `source-map@0.8.0-beta.0`, `glob@11` / `glob@10` | Install-time warnings |
| Expected test stderr `write boom` | Deliberate failure-path assertion |
| Playwright `NO_COLOR` / `FORCE_COLOR` worker warnings | Environment noise; non-blocking |
| Host Node 24 / npm 11 on some developer PATH entries | Outside supported baseline toolchain |
| Windows unmet optional root `@emnapi/*` | Accepted platform variance (section 3) |
| Desktop Lighthouse Performance 69 vs configured 90 | Open follow-up; not a passed LHCI gate (section 7) |
| No full offline navigation test | Limitation (section 9) |
| No assistive-technology session / no WCAG certification | Limitation (section 8) |
| Single-run Lighthouse lab scores | Expect variance; prefer repeated/median comparison |

---

## 11. Regression comparison guidance

Later phases should compare at least:

1. Clean `npm ci` under Node 22 + npm 10.9.2
2. `npm run lint`
3. `npm test` file/test pass counts (when run)
4. Affinity-wrapped `npm run test:coverage` percentages and pass counts
5. `npm run build` success
6. `npm run check:bundle` main/total gzip vs limits **512,000** / **1,200,000**
7. Dist `/StudyApp/` path and no-source-entry checks
8. `CI=true` Playwright E2E pass count (baseline **112**)
9. Optional: Lighthouse desktop/mobile categories and core metrics on `http://127.0.0.1:4173/StudyApp/`
10. Optional: production axe smoke (0 violations at baseline Home)

**Naturally variable:** Lighthouse timing metrics and category scores, wall-clock durations, exact chunk hashes/filenames after unrelated bundler churn. Use repeated runs / medians for performance claims.

**Do not** lower coverage thresholds, bundle budgets, axe policy, or LHCI configured minima solely to make a later phase pass.

---

## 12. Evidence provenance

Durable sources of truth:

- Toolchain and scripts: [`package.json`](../package.json), [`.nvmrc`](../.nvmrc), [`.node-version`](../.node-version), [`.npmrc`](../.npmrc)
- CI: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- Coverage thresholds: [`vitest.config.ts`](../vitest.config.ts)
- Bundle limits: [`scripts/check-bundle-size.mjs`](../scripts/check-bundle-size.mjs)
- E2E / axe: [`playwright.config.ts`](../playwright.config.ts), [`e2e/a11yHelpers.ts`](../e2e/a11yHelpers.ts), [`e2e/a11y.spec.ts`](../e2e/a11y.spec.ts)
- LHCI config reference: [`.lighthouserc.json`](../.lighthouserc.json)
- Production base / PWA plugin: [`vite.config.ts`](../vite.config.ts)

Audit provenance (optional): Phase 0 execution prompts **207-212** produced the measurements in this report. The document is intended to stand alone from those chats.
