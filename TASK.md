# TASK: Execute Cleanup Step 6.3 (Audit Facade Hooks & Update Documentation)

> **Status:** Complete
> **Created:** 2026-06-22

---

## Current Goal

Execute Step 6.3: update `ai/PROJECT_CONTEXT.md` to reflect the hardened architecture and document `useStudyData()` facade vs granular slice hooks.

---

## Context

After five phases of cleanup, the app enforces a strict data pipeline, relocated hooks/context out of UI folders, extracted pure domain logic, and standardized on `useStudyData()`. Documentation must capture these boundaries for future developers and AI agents.

---

## Scope — Files Touched

- `ai/PROJECT_CONTEXT.md` — Sections 6, 9, and 16

---

## Acceptance Criteria

- [x] Section 6 documents strict `UI → Context → Hooks → Lib → Repositories → Dexie` pipeline.
- [x] Components must never import `db/repositories` directly.
- [x] Facade hook pattern (`useStudyData()` vs `useStudyCore()`) documented.
- [x] Modularized components (`TaskList`, `AppShell`, `useStudyUIState`, `FocusSanctuary`) reflected in section 9.
- [x] ADR-014 referenced in layer import rules.

---

## Completion Checklist

- [x] Layer import rules updated.
- [x] Facade hook pattern documented.
- [x] Outdated monolith references removed or updated.
- [x] ADR-014 referenced.
- [x] No source code modified.

---

## Session Log

| Date | Note |
|------|------|
| 2026-06-22 | Step 6.3 started — documentation audit. |
| 2026-06-22 | Step 6.3 complete — PROJECT_CONTEXT sections 6, 9, 16 updated. |

---

## Architecture Cleanup Plan (Reference)

| Step | Summary |
|------|---------|
| **6.1** | Settings panel uses `useStudyData()` facade |
| **6.2** | Dates utility barrel (`lib/study/dates.ts`) |
| **6.3** | Facade hooks & architecture docs |

**Status:** Architecture cleanup plan complete.
