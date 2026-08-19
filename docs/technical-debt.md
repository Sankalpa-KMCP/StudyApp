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
| PLANNED | Active debt with a clear intended handling direction, but no committed date. |
| BLOCKED | Cannot be resolved yet because a dependency, missing evidence, or prerequisite decision is still outstanding. |
| RESOLVED | Closed item retained for history; identifiers are never reused. |

## Required fields

Every active entry includes:

- Identifier
- Title
- Severity
- Status
- Category
- User impact
- Evidence
- Dependencies
- Planned phase
- Verification criteria
- Notes / constraints

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
| Severity | Medium |
| Status | OPEN |
| Category | Performance baseline |
| User impact | Desktop production performance quality is not yet demonstrated to meet the repository's configured Lighthouse threshold, so later changes have no trustworthy pass/fail comparison for desktop lab performance. |
| Evidence | [docs/phase-0-baseline.md](phase-0-baseline.md) records a single local desktop Lighthouse 13.4.0 run at Performance **69** versus configured minimum **0.9** in [`.lighthouserc.json`](../.lighthouserc.json). |
| Dependencies | Existing production preview flow (`npm run build`, `npm run preview`) and any available local Lighthouse tooling. |
| Planned phase | Unscheduled |
| Verification criteria | Re-run reproducible desktop Lighthouse measurements with the supported toolchain, document repeated/median results, and either meet the configured threshold or explicitly revise the threshold policy with evidence and rationale. |
| Notes / constraints | This is an **open baseline observation**, not a proven product regression. Do not weaken the configured threshold merely to make the baseline pass. |

### TD-002 - Dependency advisory and deprecation triage is incomplete

| Field | Value |
|-------|-------|
| Severity | High |
| Status | OPEN |
| Category | Dependency hygiene / security review |
| User impact | Contributors cannot currently distinguish harmless advisories from issues that need near-term remediation, and clean installs continue to surface deprecation warnings that obscure future signal. |
| Evidence | [docs/phase-0-baseline.md](phase-0-baseline.md) records `npm ci` with **6** audit findings (**1** low, **5** high) plus deprecation warnings for `source-map@0.8.0-beta.0`, `glob@11.1.0`, and `glob@10.5.0`. No exploitability analysis or remediation plan is yet tracked. |
| Dependencies | Supported Node 22 / npm 10.9.2 environment, lockfile-preserving dependency review, and regression checks after any future package updates. |
| Planned phase | Unscheduled |
| Verification criteria | Classify each baseline audit finding and deprecation warning, identify whether it is reachable in supported workflows, and either remediate or document why it remains accepted. Any remediation must preserve lockfile integrity and green validation gates. |
| Notes / constraints | Severity reflects **untriaged engineering/security risk**, not npm's package labels alone. This entry does not authorize `npm audit fix` without deliberate review. |

### TD-003 - Supported toolchain selection depends on explicit local wrapper discipline

| Field | Value |
|-------|-------|
| Severity | Medium |
| Status | ACCEPTED |
| Category | Tooling / reproducibility |
| User impact | Contributors can accidentally run validation with unsupported host tooling (for example Node 24 / npm 11), producing evidence that does not match the supported baseline. Nested commands such as Playwright `webServer` also need explicit inheritance to stay on the approved toolchain. |
| Evidence | [docs/phase-0-baseline.md](phase-0-baseline.md) documents the supported environment as Node **22** and npm **10.9.2**, notes that unsupported host toolchains are not baseline evidence, and records a controlled proof that both outer E2E and nested `npm run dev` required explicit inheritance. [playwright.config.ts](../playwright.config.ts) configures `webServer.command` as `npm run dev -- --host 127.0.0.1 --port 5174`. |
| Dependencies | The pinned declarations in [`.nvmrc`](../.nvmrc), [`.node-version`](../.node-version), [`package.json`](../package.json), and CI setup in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). |
| Planned phase | Unscheduled |
| Verification criteria | A future improvement would let local and nested commands resolve the supported toolchain without ad hoc cache-path wrappers while preserving current CI and lockfile behavior. Until then, all baseline-sensitive local evidence must explicitly verify Node 22 and npm 10.9.2. |
| Notes / constraints | This is a reproducibility constraint, not a product defect. Preserve the existing pins and do not casually remove nested-toolchain safeguards. |

### TD-004 - Windows coverage baseline depends on an external four-CPU affinity wrapper

| Field | Value |
|-------|-------|
| Severity | Medium |
| Status | ACCEPTED |
| Category | Test infrastructure / reproducibility |
| User impact | On the reported Windows host, unconstrained local coverage can suffer resource contention, so reproducing the baseline requires an external wrapper and a verified `availableParallelism() === 4`. |
| Evidence | [docs/phase-0-baseline.md](phase-0-baseline.md) defines the canonical local coverage gate as affinity mask `15` / `0xF`, host CPU probe unconstrained, inner command exactly `npm run test:coverage`, and `os.availableParallelism()` exactly **4** inside the constrained process. |
| Dependencies | Windows local runs, Node 22 / npm 10.9.2, and the existing Vitest coverage command in [`package.json`](../package.json). |
| Planned phase | Unscheduled |
| Verification criteria | Either preserve and document the current wrapper requirement, or replace it with a repository-supported mechanism that reproduces stable local coverage results without changing the suite semantics. Any replacement must keep baseline-comparable pass counts and thresholds. |
| Notes / constraints | This is a local infrastructure constraint. Do not change worker, pool, timeout, retry, or test-selection behavior just to avoid the wrapper. |

### TD-005 - Offline navigation behavior is still a verification gap

| Field | Value |
|-------|-------|
| Severity | Low |
| Status | OPEN |
| Category | PWA evidence gap |
| User impact | The app's service worker and manifest behavior are verified, but later regressions in offline navigation could go unnoticed because full offline usability was not directly tested in the baseline. |
| Evidence | [docs/phase-0-baseline.md](phase-0-baseline.md) confirms `/StudyApp/` asset paths, manifest/icon fetches, and service-worker registration/scope, while explicitly stating that offline navigation was **not tested**. |
| Dependencies | Production preview, service worker registration, and reliable browser tooling that can simulate offline mode without mutating user data. |
| Planned phase | Unscheduled |
| Verification criteria | Add a reliable production offline-navigation check that confirms expected shell behavior after service-worker installation, and document exactly what is and is not guaranteed offline. |
| Notes / constraints | Do not overstate offline support until a real offline navigation scenario is exercised. |

### TD-006 - Manual assistive-technology verification has not been performed

| Field | Value |
|-------|-------|
| Severity | Medium |
| Status | OPEN |
| Category | Accessibility evidence gap |
| User impact | Automated axe coverage is strong, but real screen-reader or equivalent AT usability issues may still exist without being represented in current evidence. |
| Evidence | [docs/phase-0-baseline.md](phase-0-baseline.md) records unsuppressed axe coverage and a zero-violation production Home smoke, but also states that no NVDA, JAWS, VoiceOver, or equivalent assistive-technology session has been performed and that no universal WCAG certification is claimed. |
| Dependencies | Human-operated assistive technology sessions across representative workflows, ideally using the supported production preview. |
| Planned phase | Unscheduled |
| Verification criteria | Run and document manual AT verification for key workflows (Home, navigation, focus, tasks/goals/forms, Settings import/export/danger flows), then update the register with concrete findings or closure evidence. |
| Notes / constraints | This entry tracks a verification gap, not a claim that the app currently fails AT usage. |

### TD-007 - Settings import and clear-all remain unsafely concurrent

| Field | Value |
|-------|-------|
| Severity | Medium |
| Status | OPEN |
| Category | Data safety / mutation coordination |
| User impact | Concurrent destructive Settings flows could still create confusing or unsafe edge cases because clear-all is not serialized with an in-flight import. |
| Evidence | [CONTRIBUTING.md](../CONTRIBUTING.md) states that Settings clear-all is not currently serialized with an in-flight backup import. [AGENTS.md](../AGENTS.md) repeats that this is pre-existing behavior and should only be hardened deliberately. |
| Dependencies | Settings backup/clear-all behavior in [`src/hooks/useStudyBackup.ts`](../src/hooks/useStudyBackup.ts), focus import lock behavior in [`src/hooks/useFocusSession.ts`](../src/hooks/useFocusSession.ts), and current tests that already cover ordinary import failure handling. |
| Planned phase | Unscheduled |
| Verification criteria | Introduce explicit serialization or mutual exclusion between import and clear-all, then prove with focused tests that conflicting actions cannot interleave into unsafe state transitions or misleading UI. |
| Notes / constraints | This is a bounded hardening item, not permission to redesign Settings flows wholesale. |

### TD-008 - Field-level error association is incomplete outside the covered editors

| Field | Value |
|-------|-------|
| Severity | Medium |
| Status | OPEN |
| Category | Accessibility / forms |
| User impact | Some editors may still rely on generic mutation notices or visual validation without complete field-specific `aria-invalid` / `aria-describedby` wiring, making error recovery less precise for assistive technologies. |
| Evidence | [AGENTS.md](../AGENTS.md) explicitly calls out field-specific validation for Tasks and Goals. [docs/phase-0-baseline.md](phase-0-baseline.md) records those improvements. Current code shows field-level associations in [`src/views/GoalsView.tsx`](../src/views/GoalsView.tsx) and [`src/views/ProgressView.tsx`](../src/views/ProgressView.tsx), while other editors such as [`src/views/NotesView.tsx`](../src/views/NotesView.tsx), [`src/views/CalendarView.tsx`](../src/views/CalendarView.tsx), and [`src/views/FlashcardsView.tsx`](../src/views/FlashcardsView.tsx) still surface `MutationNotice` but have no visible field-level validation wiring in the tracked evidence review. |
| Dependencies | Existing view-level validation logic, shared input components in [`src/components/ui.tsx`](../src/components/ui.tsx), and accessibility-focused tests. |
| Planned phase | Unscheduled |
| Verification criteria | For each remaining editor with local validation, associate validation messages to the responsible control using stable IDs and `aria-describedby`, verify with focused tests, and keep form-level mutation notices for persistence failures only. |
| Notes / constraints | This entry is intentionally scoped to editors with local validation; it should not duplicate successful Task/Goal/Progress coverage. |
