# Current State

> Snapshot of the project's working state for AI agents and maintainers.
> Update this file when starting or finishing significant work.
> Last reviewed: June 2026 (v1.2.0 baseline).

**Related:** [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) · [AI_RULES.md](AI_RULES.md) · [CHANGELOG.md](../CHANGELOG.md)

---

## Active Work

<!-- Human: describe current sprint, branch focus, or in-flight feature -->

**[Human: describe current sprint/branch focus]**

Detected from repository state at last doc update:

- Canonical AI documentation lives under `ai/` (migrated from `.ai/`, June 2026)
- No in-progress runtime feature branch detected from documentation alone

---

## Current Priorities

| Priority | Item | Source |
|----------|------|--------|
| High | Maintain `ai/` doc accuracy alongside code changes | [AI_RULES.md](AI_RULES.md) |
| High | Add `.env.example` for `VITE_E2E_SYNC` and contributor onboarding | [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) §17 |
| Medium | Expand i18n beyond English (`en.json` catalog exists) | README known limits |
| Medium | Add Vitest integration test for sync conflict path | [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) §17 |
| Low | Document workspace root when parent `study app` folder delegates to `web/` | README, parent `package.json` if present |

---

## Known Problems

| Problem | Impact | Notes |
|---------|--------|-------|
| English-only UI | Non-English users see English only | i18n infrastructure ready; only `src/i18n/locales/en.json` exists |
| No cloud sync | Cross-device sync requires manual vault or folder sync | By design (local-first) |
| Folder sync browser limits | Firefox/Safari cannot use File System Access sync | Manual `.studybackup` export/import still works |
| No `.env.example` | Contributors must discover `VITE_E2E_SYNC` from docs | See `src/vite-env.d.ts`, `playwright.config.ts` |
| README architecture link was broken | Pointed to removed root `ARCHITECTURE.md` | Fixed to reference `ai/PROJECT_CONTEXT.md` |

---

## Temporary Hacks

**None detected** as unintentional hacks in `src/`.

Intentional patterns (not hacks — do not remove without understanding):

| Pattern | Location | Purpose |
|---------|----------|---------|
| `sessionStorage` timer heartbeat | `src/hooks/timer/useTimerSessionShadow.ts` | Recover interrupted study sessions (≥60s threshold) |
| Legacy `#cards` hash redirect | `src/lib/routing/appHashRouting.ts` | v12 migration compatibility for old bookmarks |
| `console.error` in error handlers | backup, sync, ErrorBoundary, db.ts | Diagnostic logging on failure paths (not debug spam) |

---

## Recently Changed Systems

From [CHANGELOG.md](../CHANGELOG.md) v1.2.0 (2026-06-13):

| System | Change |
|--------|--------|
| **Flashcards** | Removed — `flashcards` table dropped (Dexie v12); task-based SM-2/FSRS retained |
| **Folder sync** | Added — bidirectional sync via `study-vault.sync.studybackup` between web and Tauri |
| **Backup** | Encrypted `.studybackup` v4, merge import, ICS import |
| **History** | Optional `taskId` on history entries (v9) |
| **Tasks** | Recurring tasks, FSRS scheduling option, per-task timer presets |
| **Desktop** | Minimize-on-close, configurable global shortcuts |
| **i18n** | String catalog introduced (`en.json`) |

**Schema:** Dexie v12 · **Backup format:** v4

---

## Pending Decisions

| Decision | Options / notes | Owner |
|----------|-----------------|-------|
| Target i18n locales | `si.json` or others — infrastructure ready | **[Human]** |
| Chromatic visual testing | CI job conditional on `CHROMATIC_PROJECT_TOKEN` secret | **[Human]** — is it actively used? |
| Encrypted sync file | Sync file is plaintext JSON in shared folder today | **[Human]** — optional encryption layer |
| Open-source licensing | Currently private by Sankalpa KMCP | **[Human]** |
| Parent workspace layout | `study app` folder may delegate npm scripts to `web/` | **[Human]** — confirm active usage |

---

## Current Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Sync merge complexity | Medium | E2E specs in `e2e/folder-sync*.spec.ts`; conflict modal UI |
| IndexedDB quota exceeded | Medium | `QuotaRecoveryBanner`, emergency export in `ErrorFallback` |
| Schema migration errors | High | Inline migrations + `db.migration.test.ts` + pre-migration snapshots |
| Backup format drift | High | Separate backup v4 vs schema v12; checksum + schema validation on import |
| AI doc staleness | Low | `AI_RULES.md` sync policy + `.cursor/rules/ai-documentation-sync.mdc` |

---

## Next Recommended Tasks

1. **Add `.env.example`** — document `VITE_E2E_SYNC=1` for folder-sync E2E (`playwright.config.ts`)
2. **Sync conflict unit test** — reduce reliance on E2E alone for `syncPull.ts` merge logic
3. **Verify parent workspace** — confirm whether root `study app/package.json` delegation is still needed in README
4. **Keep `CURRENT_STATE.md` updated** — after each significant feature or release

---

## Codebase Health Signals

| Signal | Status | Source |
|--------|--------|--------|
| Version | 1.2.0 | `package.json` |
| Dexie schema | v12 | `src/db/db.ts` |
| TODO/FIXME in `src/` | None found | Codebase search |
| CI branches | `V2`, `master` | `.github/workflows/ci.yml` |
| Test tiers | Core 80/74%, Component 65/50%, Settings 60/45% | `vitest*.config.ts` |
| E2E specs | 26 files in `e2e/` | Repository listing |

---

*Update the **Active Work** and **Pending Decisions** sections when human context is available.*
