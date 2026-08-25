# Public Beta v1.5.0 Release Contract

This document defines the authoritative product contract, browser support targets, feature-freeze rules, and release scope for **Study Dashboard v1.5.0**.

---

## Release Classification & Status

- **Classification:** PUBLIC BETA
- **Current Version:** `1.4.0` (Targeting `1.5.0`)
- **Status:** Feature Freeze Active

---

## Feature Freeze Rules

Feature development is **frozen** until the v1.5.0 release candidate (RC) is complete.

1. **Permitted Work:**
   - Critical release blockers and bug fixes
   - Automated and manual validation execution
   - Deployment controls and CI/CD workflow security fixes
   - Cross-browser compatibility remediations
   - Documentation updates and release guidance
   - Tasks explicitly linked to the parent release tracking issue

2. **Prohibited Work:**
   - New user-facing features or scope expansion
   - Visual redesigns or unrequested UI refactorings
   - Architectural rewrites unrelated to release blockers

3. **Database Schema Freeze:**
   - No IndexedDB schema change (`version(N)` in `src/db/studyDb.ts`) may be introduced after the release-candidate freeze unless it directly fixes a documented release blocker.

---

## Core Product Contract & Guarantees

- **Architecture:** Local-first browser application.
- **Account System:** None. No user registration, authentication, or user accounts.
- **Cloud Synchronization:** None. No cloud database, remote sync services, or backend APIs.
- **Server-Side Storage:** None. All study data remains strictly in the user's browser IndexedDB.
- **Data Backups:** Manual export and import via unencrypted JSON files (Version 3 format).
- **Localization:** English-only interface for the v1.5.0 release.

---

## Supported Browser Target Matrix

The following browser targets define the support scope for the v1.5.0 release:

- **Desktop:**
  - Chrome (Latest 2 versions)
  - Edge (Latest 2 versions)
  - Firefox (Latest 2 versions)
  - Safari on macOS (Current version)
- **Mobile:**
  - Chrome on Android (Current version)
  - Safari on iOS (Current version)

> [!IMPORTANT]
> **Validation Notice:** Inclusion in this supported target matrix represents a **release target and commitment**, not a claim that automated or manual validation has already passed for all listed platforms. Automated CI coverage currently runs Playwright Chromium and mobile Chrome specs, while full Safari, Edge, and mobile device validation remains an active release task.

---

## Governance & Release Tracking

- **Parent Tracking Issue:** The master release issue will be named exactly `Public Release v1.5.0`.
- **Task Linkage:** Every remaining release task, PR, and validation check must be linked under or referenced by the `Public Release v1.5.0` parent tracking issue.
- **Phase 0 Exit Requirements:** Production and staging deployment pipeline correction remains a required prerequisite before the Phase 0 exit gate passes. See the [Staging Architecture & Recovery Guide](staging-architecture.md).
