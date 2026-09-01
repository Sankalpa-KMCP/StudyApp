# Public Beta v1.5.0 Release Contract

This document defines the authoritative product contract, browser support targets, feature-freeze rules, and release scope for **Study Dashboard v1.5.0**.

---

## Release Classification & Status

- **Classification:** PUBLIC BETA (Paused)
- **Current Version:** `1.4.0` (Targeting `1.5.0`)
- **Status:** Production Release Paused

---

## Feature Freeze Rules

The v1.5.0 production release is explicitly paused. The release-candidate freeze is suspended until public-release activity resumes.

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
- **Data Backups:** Manual export and import via unencrypted JSON files (Version 4 format).
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
> **Validation Notice:** Inclusion in this supported target matrix represents a **release target and commitment**, not a claim that branded OEM or physical device validation has already passed for all listed platforms. Automated CI coverage currently executes full Playwright Chromium specs alongside multi-engine smoke suites on Firefox, WebKit, and mobile WebKit. Full Edge OEM, macOS Safari, and physical iOS device validation remains an active release task.

---

## Governance & Release Tracking

- **Deployment Scope:** GitHub Pages is the sole current deployment target and acts only as a preview/testing environment. Only `master` may deploy to GitHub Pages. `V2` builds and tests but does not deploy. No Netlify site, staging environment, token, or secondary hosting provider is required or planned.
- **Deferred Requirements:** The requirement for separate staging and production paths is deferred, not satisfied. If public-release work resumes, deployment architecture and release gates must be reconsidered before production designation. Phase 0 must not be declared complete based solely on the GitHub Pages preview.
- **Parent Tracking Issue:** Creation of the `Public Release v1.5.0` tracking issue is deferred until the owner resumes the public-release process.
- **Validation Status:** Browser certification and public-release validation remain incomplete. GitHub Pages preview availability does not constitute General Availability or Public Beta release completion.
