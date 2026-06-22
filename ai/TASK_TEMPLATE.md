# Task Template

> Reusable template for session-scoped AI work on Study Dashboard.
> Copy this file to a task-specific doc (e.g. `ai/tasks/YYYY-MM-DD-feature-name.md`) or paste sections into your prompt.
> See [AI_RULES.md](AI_RULES.md) for permanent operational rules.

---

## Operational Instructions

Before starting:

1. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) and [AI_RULES.md](AI_RULES.md)
2. Read every file you plan to modify — **entire file**, not just the target function
3. Do not expand scope beyond this document's acceptance criteria
4. Ask the user before touching **Protected Files** listed in AI_RULES.md if not in scope below
5. Stop when acceptance criteria are met — do not add unrequested improvements
6. Update [CURRENT_STATE.md](CURRENT_STATE.md) if active work or priorities change materially

---

## Current Goal

<!-- One sentence: what should be true when this task is done? -->

**[Describe the outcome]**

---

## Context

<!-- Why is this work needed? Link to issue, user request, or bug report. -->

- **Requested by:** [Human / issue link]
- **Related docs:** [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) §…, [CHANGELOG.md](../CHANGELOG.md), ADR-…
- **Relevant version info:** App v1.2.0 · Dexie v12 · Backup format v4

---

## Scope — Files To Touch

<!-- List exact paths. Be specific. -->

| File | Expected change |
|------|-----------------|
| `src/...` | [describe] |
| `ai/...` | [if docs need update] |

---

## Scope — Do Not Touch

<!-- Explicitly list files/systems that must not change -->

- `src/db/db.ts` — unless this task is explicitly a migration
- `src/lib/backup/backupCrypto.ts` — unless this task is explicitly about encryption
- `src/lib/sync/syncPull.ts` — unless this task is explicitly about sync merge
- [add others]

---

## Acceptance Criteria

<!-- Checklist of observable outcomes. Task is done when ALL are met. -->

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] [Relevant coverage tier if applicable]
- [ ] [E2E spec if user-facing]
- [ ] Affected `ai/` docs updated per [AI_RULES.md](AI_RULES.md) sync triggers

---

## Edge Cases To Handle

<!-- List known edge cases the implementation must address -->

- [ ] Existing IndexedDB data / migration compatibility
- [ ] Offline mode (`navigator.onLine` false)
- [ ] Tauri desktop vs web browser differences
- [ ] Legacy backup import (v2/v3 formats)
- [ ] [task-specific edge cases]

---

## Explicitly Out Of Scope

<!-- Prevent scope creep — list what this task does NOT include -->

- [ ] New npm dependencies
- [ ] Schema version bump
- [ ] New hash routes or tab IDs
- [ ] Cloud sync / backend API
- [ ] [other exclusions]

---

## Dependencies & Blockers

| Item | Status | Notes |
|------|--------|-------|
| [Dependency or blocker] | [Open / Resolved] | [details] |

---

## Required Workflow

1. **Read** — PROJECT_CONTEXT, AI_RULES, and all files in "Files To Touch"
2. **Plan** — Identify layer (UI → context → hooks → lib → repository → Dexie)
3. **Implement** — Minimal diff; match existing patterns
4. **Test** — Run commands from acceptance criteria
5. **Document** — Incremental updates to affected `ai/` files
6. **Report** — Summarize changes, warnings, and items needing human confirmation

---

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] No scope creep — out-of-scope items untouched
- [ ] Protected files unchanged (or explicitly in scope with migration/test)
- [ ] No secrets committed
- [ ] `CURRENT_STATE.md` updated if sprint context changed
- [ ] User informed of any manual verification needed (desktop build, E2E sync, etc.)

---

## Notes / Session Log

<!-- Optional: agent or human notes during execution -->

| Date | Note |
|------|------|
| | |
