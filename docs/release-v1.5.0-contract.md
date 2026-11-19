# Study Dashboard v1.5.0 Release Contract

This document defines the authoritative product contract, browser support status, release scope, and accepted evidence gaps for **Study Dashboard v1.5.0**.

---

## Release Classification & Status

- **Classification:** GENERAL AVAILABILITY
- **Release Version:** `1.5.0`
- **Release Date:** 2026-11-19
- **Status:** Production Release Published (Owner Approved)

---

## Owner-Approved Release Scope & Acceptance

The application has completed comprehensive automated and physical verification on available host environments and is approved by the repository owner for general personal use and publication.

### Verified Capabilities
1. **Core Product Modules:** Full end-to-end functionality for Tasks, Subjects, Notes, Calendar, Goals, Progress metrics, and 21 accessible theme configurations.
2. **Data Safety & Integrity:** Version 4 JSON backup export and import, local-first IndexedDB storage via Dexie, cross-tab mutation serialization, and zero cloud dependencies.
3. **Focus Session Hardening:** Active focus timers survive page reloads, browser restarts, and tab backgrounding; stale sessions present clear Resume or Discard recovery.
4. **Automated Quality Gates:** 1,370 unit/integration tests with high coverage thresholds, zero bundle budget leaks, and 16/16 unsuppressed WCAG 2.1 A/AA axe scans passing with 0 violations across all views.

### Accepted Limitations & Evidence Gaps
1. **Assistive-Technology Verification (TD-006):** While automated axe scans pass 100% across all views, manual screen-reader verification with NVDA or VoiceOver was not conducted prior to this release due to host environment limitations. The owner explicitly accepted this verification gap for initial release.
2. **Apple Device Validation:** macOS Safari and physical iOS Safari were validated via Playwright WebKit automated smoke suites in CI; physical OEM hardware certification remains deferred.
3. **Android Device Validation:** Android Chrome was verified via Playwright mobile-viewport integration suites; physical hardware testing via ADB was not connected and remains deferred.
4. **Hosting Architecture:** GitHub Pages acts as the single deployment pipeline. Separate staging infrastructure was determined unnecessary and is deferred.

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

- **Desktop:**
  - Chrome (Latest 2 versions) — *Physically verified on Windows 11*
  - Edge (Latest 2 versions) — *Physically verified on Windows 11*
  - Firefox (Latest 2 versions) — *Automated smoke verified in CI*
  - Safari on macOS (Current version) — *Automated WebKit smoke verified in CI*
- **Mobile:**
  - Chrome on Android (Current version) — *Automated mobile-viewport verified*
  - Safari on iOS (Current version) — *Automated mobile-WebKit smoke verified*

---

## Governance & Rollback Procedure

- **Deployment Scope:** `master` branch automatically deploys to GitHub Pages upon passing CI.
- **Rollback Procedure:** If an unanticipated critical regression is identified in production:
  1. Revert `master` to commit `9d5c6e8` or previous release tag.
  2. Push `master` to trigger immediate automatic redeployment to GitHub Pages.
  3. Existing client-side IndexedDB databases remain backward-compatible (Version 4 format).

