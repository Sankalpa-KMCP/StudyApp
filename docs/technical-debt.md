# Technical debt register

Tracked register for current Study Dashboard technical debt, accepted platform constraints, and evidence gaps.

This file records **active** debt only. It is not a wishlist, roadmap, or changelog replacement. Use it with [docs/phase-0-baseline.md](phase-0-baseline.md), [README.md](../README.md), and [CONTRIBUTING.md](../CONTRIBUTING.md).

## Severity meanings

| Severity | Meaning |
|----------|---------|
| Critical | Proven risk of data loss, severe security exposure, or a baseline-blocking failure in supported workflows. |
| High | Significant user or engineering risk with credible impact across common workflows, but not currently blocking all baseline use. |
| Medium | Real maintenance, reliability, accessibility, or tooling risk with bounded impact or workaround. |
| Low | Minor or narrow residual with limited current impact, but still worth tracking with evidence. |

## Status meanings

| Status | Meaning |
|--------|---------|
| OPEN | Active debt or evidence gap with no approved remediation started. |
| ACCEPTED | Known and currently tolerated constraint or behavior; preserve and re-evaluate before changing casually. |
| DEFERRED | Active debt with a clear intended handling direction, deferred to a future phase. |
| RESOLVED | Closed item retained for history; identifiers are never reused. |

## Required fields

Every active entry includes:

- Status (OPEN | RESOLVED | ACCEPTED | DEFERRED)
- Severity (Low | Medium | High | Critical)
- Release criticality (Release-critical | Non-release-critical)
- Owner role (accountable functional role)
- Planned phase (concrete phase or deferred trigger)
- Verification evidence (current paths, commands, reports, or evidence gap)
- Resolution / acceptance condition (observable condition for closure or continued acceptance)

## Maintenance policy

- Identifiers are stable, unique, sequential, and never reused.
- Every entry must cite current tracked evidence.
- Resolved items keep their identifier and history rather than being deleted.
- Severity and status changes require a rationale update in the entry.
- Do not add debt for stylistic preference alone; evidence of real impact or a concrete verification gap is required.
- Accepted platform behavior must be separated from product defects.
- Deferred product scope that was never part of the current contract does not belong here.

---

## Active entries

### TD-001 - Desktop Lighthouse performance below configured threshold

| Field | Value |
|-------|-------|
| Status | OPEN |
| Severity | Medium |
| Release criticality | Non-release-critical |
| Owner role | Application Maintainer |
| Planned phase | Future Public-Release Phase 0 Reopening |
| Category | Performance baseline |
| User impact | Desktop production performance quality is not yet demonstrated to meet the repository's configured Lighthouse threshold, so later changes have no trustworthy pass/fail comparison for desktop lab performance. |
| Verification evidence | [docs/phase-0-baseline.md](phase-0-baseline.md) records a single local desktop Lighthouse 13.4.0 run at Performance **69** versus configured minimum **0.9** in [`.lighthouserc.json`](../.lighthouserc.json). Evidence gap for repeated/median runs. |
| Resolution / acceptance condition | Re-run reproducible desktop Lighthouse measurements with the supported toolchain, document repeated/median results, and either meet the configured threshold or explicitly revise the threshold policy with evidence and rationale. |
| Notes / constraints | This is an **open baseline observation**, not a proven product regression. Do not weaken the configured threshold merely to make the baseline pass. |

### TD-002 - Dependency advisory and deprecation triage is incomplete

| Field | Value |
|-------|-------|
| Status | RESOLVED |
| Severity | High |
| Release criticality | Release-critical |
| Owner role | Dependency and Release Owner |
| Planned phase | Phase 1 — Repository Baseline Reconciliation |
| Category | Dependency hygiene / security review |
| User impact | Historical. Contributors previously could not distinguish harmless advisories from issues needing remediation, causing alert fatigue and obscuring future signal. |
| Verification evidence | Resolved. Deliberate review confirmed 6 baseline audit findings (`brace-expansion`, `esbuild`, `fast-uri`, `js-yaml`, `postcss`, `undici`) and 3 deprecations (`source-map@0.8.0-beta.0`, `glob@11.1.0`, `glob@10.5.0`). All belong exclusively to `devDependencies` (`vite`, `eslint`, `vitest`, `vite-plugin-pwa` trees) and are unreachable in production. `npm 10.9.2 audit fix` remediated 5/6 findings cleanly. Validated under Node v22.23.2 and npm 10.9.2; canonical validation gates passed: lint, build, test:coverage, check:bundle, and test:e2e. `npm audit --omit=dev` confirms 0 production vulnerabilities. |
| Resolution / acceptance condition | Classify each baseline audit finding and deprecation warning, identify whether it is reachable in supported workflows, and either remediate or document why it remains accepted. (Condition met). |
| Notes / constraints | The remaining `esbuild` finding (arbitrary file read in Windows dev server) and `glob`/`source-map` deprecations are **ACCEPTED** as they pose zero risk to production users and acceptable risk to local trusted development environments. Future re-review trigger: Next Dependency Maintenance Cycle. |

### TD-003 - Supported toolchain selection depends on explicit local wrapper discipline

| Field | Value |
|-------|-------|
| Status | ACCEPTED |
| Severity | Medium |
| Release criticality | Non-release-critical |
| Owner role | CI/Tooling Owner |
| Planned phase | Ordinary Development — Maintenance |
| Category | Tooling / reproducibility |
| User impact | Contributors can accidentally run validation with unsupported host tooling (for example Node 24 / npm 11), producing evidence that does not match the supported baseline. Nested commands such as Playwright `webServer` also need explicit inheritance to stay on the approved toolchain. |
| Verification evidence | [docs/phase-0-baseline.md](phase-0-baseline.md) documents the supported environment as Node **22** and npm **10.9.2**, notes that unsupported host toolchains are not baseline evidence, and records a controlled proof that both outer E2E and nested `npm run dev` required explicit inheritance. [playwright.config.ts](../playwright.config.ts) configures `webServer.command`. |
| Resolution / acceptance condition | A future improvement would let local and nested commands resolve the supported toolchain without ad hoc cache-path wrappers while preserving current CI and lockfile behavior. Until then, all baseline-sensitive local evidence must explicitly verify Node 22 and npm 10.9.2. |
| Notes / constraints | This is a reproducibility constraint, not a product defect. Preserve the existing pins and do not casually remove nested-toolchain safeguards. |

### TD-004 - Windows coverage baseline depends on an external four-CPU affinity wrapper

| Field | Value |
|-------|-------|
| Status | ACCEPTED |
| Severity | Medium |
| Release criticality | Non-release-critical |
| Owner role | CI/Tooling Owner |
| Planned phase | Ordinary Development — Maintenance |
| Category | Test infrastructure / reproducibility |
| User impact | On the reported Windows host, unconstrained local coverage can suffer resource contention, so reproducing the baseline requires an external wrapper and a verified `availableParallelism() === 4`. |
| Verification evidence | [docs/phase-0-baseline.md](phase-0-baseline.md) defines the canonical local coverage gate as affinity mask `15` / `0xF`, host CPU probe unconstrained, inner command exactly `npm run test:coverage`, and `os.availableParallelism()` exactly **4** inside the constrained process. |
| Resolution / acceptance condition | Either preserve and document the current wrapper requirement, or replace it with a repository-supported mechanism that reproduces stable local coverage results without changing the suite semantics. Any replacement must keep baseline-comparable pass counts and thresholds. |
| Notes / constraints | This is a local infrastructure constraint. Do not change worker, pool, timeout, retry, or test-selection behavior just to avoid the wrapper. |

### TD-005 - Offline navigation behavior is still a verification gap

| Field | Value |
|-------|-------|
| Status | RESOLVED |
| Severity | Low |
| Release criticality | Non-release-critical |
| Owner role | Application Maintainer |
| Planned phase | Historical / Obsolete |
| Category | PWA evidence gap (Obsolete) |
| User impact | Historical. Previously tracked offline navigation verification for the experimental PWA/service-worker delivery model. |
| Verification evidence | Resolved / Obsolete. PWA, service workers, web manifest, and `vite-plugin-pwa` tooling were intentionally removed in favor of a standard browser-only React/Vite web application architecture. Offline service worker verification is no longer applicable. |
| Resolution / acceptance condition | Closed. PWA and service worker functionality removed from application scope; verification debt no longer applies. (Condition met). |
| Notes / constraints | The application is a local-first web-only application backed by Dexie/IndexedDB with no service worker or PWA layer. |

### TD-006 - Manual assistive-technology verification has not been performed

| Field | Value |
|-------|-------|
| Status | OPEN |
| Severity | Medium |
| Release criticality | Release-critical |
| Owner role | Accessibility Owner |
| Planned phase | Future Browser and Accessibility Certification |
| Category | Accessibility evidence gap |
| User impact | Automated axe coverage is strong, but real screen-reader or equivalent AT usability issues may still exist without being represented in current evidence. |
| Verification evidence | [docs/phase-0-baseline.md](phase-0-baseline.md) records unsuppressed axe coverage and a zero-violation production Home smoke, but explicitly states an evidence gap: no NVDA, JAWS, VoiceOver, or equivalent assistive-technology testing has been performed. |
| Resolution / acceptance condition | Run and document manual AT verification for key workflows (Home, navigation, focus, tasks/goals/forms, Settings import/export/danger flows), then update the register with concrete findings or closure evidence. |
| Notes / constraints | This entry tracks a verification gap, not a claim that the app currently fails AT usage. |

### TD-007 - Settings import and clear-all remain unsafely concurrent

| Field | Value |
|-------|-------|
| Status | RESOLVED |
| Severity | Medium |
| Release criticality | Release-critical |
| Owner role | Application Maintainer |
| Planned phase | Phase 1 — Repository Baseline Reconciliation |
| Category | Data safety / mutation coordination |
| User impact | Historical. Concurrent destructive Settings flows previously risked confusing or unsafe edge cases because clear-all was not serialized with an in-flight import. |
| Verification evidence | Resolved via `DataOperationCoordinator`. Verified by seven focused Vitest files, 99 focused tests passed, and two focused E2E cases passed covering Settings backup/clear-all serialization. |
| Resolution / acceptance condition | Explicit serialization or mutual exclusion between import and clear-all is proven with focused tests ensuring conflicting actions cannot interleave into unsafe state transitions or misleading UI. (Condition met). |
| Notes / constraints | This is a bounded hardening item, not permission to redesign Settings flows wholesale. |

### TD-008 - Field-level error association is incomplete outside the covered editors

| Field | Value |
|-------|-------|
| Status | RESOLVED |
| Severity | Medium |
| Release criticality | Non-release-critical |
| Owner role | Accessibility Owner |
| Planned phase | Phase 1 — Repository Baseline Reconciliation |
| Category | Accessibility / forms |
| User impact | Historical. Some editors previously relied on generic mutation notices or visual validation without complete field-specific `aria-invalid` / `aria-describedby` wiring, making error recovery less precise for assistive technologies. |
| Verification evidence | Resolved via updates to `NotesView.tsx`, `CalendarView.tsx`, `FlashcardsView.tsx`, and shared input support in `ui.tsx` providing field-level error associations. Verified by focused workspace test coverage in `App.workspaces.test.tsx` (50 passing tests) asserting `aria-invalid` and `aria-describedby` presence on validation failures. Lint and build gates both pass. |
| Resolution / acceptance condition | For each remaining editor with local validation, associate validation messages to the responsible control using stable IDs and `aria-describedby`, verify with focused tests, and keep form-level mutation notices for persistence failures only. (Condition met). |
| Notes / constraints | This entry is intentionally scoped to editors with local validation; it should not duplicate successful Task/Goal/Progress coverage. Do not claim manual assistive-technology or browser certification based on this. |
