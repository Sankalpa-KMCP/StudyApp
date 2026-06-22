# Prompt Patterns

> Reusable prompt patterns for AI workflows on Study Dashboard.
> Each pattern encourages planning before coding, minimal diffs, and architecture preservation.
> Pair with [AI_RULES.md](AI_RULES.md) and [TASK_TEMPLATE.md](TASK_TEMPLATE.md).

---

## How to use these patterns

1. Copy the **Prompt** block into your AI session
2. Fill in `[bracketed]` placeholders with task-specific details
3. Attach or reference files from **Pre-read** list
4. Run **Verification** commands after the agent finishes

**Always pre-read:**
- [ai/PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
- [ai/AI_RULES.md](AI_RULES.md)
- [ai/CURRENT_STATE.md](CURRENT_STATE.md) (if active work may overlap)

---

## 1. Safe Refactor

**When:** Renaming, extracting, or reorganizing code without behavior change.

**Pre-read:** Target file(s), nearest similar module, related tests.

**Prompt:**

```
Mode: Agent

Refactor [describe what] in Study Dashboard.

Constraints:
- Behavior must not change
- Minimal diff — no full-file rewrites
- Preserve repository layer — never import db/db from components/hooks/lib
- Match existing naming and import style
- Run npm test and npm run lint after changes

Files in scope: [list paths]
Do not touch: [list protected files]

Read ai/PROJECT_CONTEXT.md and ai/AI_RULES.md first.
Stop when tests pass and behavior is unchanged.
```

**Verification:** `npm test` · `npm run lint` · relevant coverage tier

---

## 2. Bug Fix

**When:** Fixing a reported defect with a known reproduction.

**Pre-read:** Failing test (if any), component/hook involved, related repository.

**Prompt:**

```
Mode: Agent

Fix: [describe bug and expected behavior]

Reproduction: [steps or failing test path]
Suspected area: [file or layer]

Constraints:
- Minimal fix — do not refactor unrelated code
- Add or update test that would have caught this bug
- Do not change Dexie schema unless bug is migration-related
- Read entire files before editing

Files likely involved: [paths]
Read ai/AI_RULES.md Protected Files — ask before touching sync/backup/crypto.

Acceptance: [specific observable fix]
```

**Verification:** `npm test` · `npm run test:e2e -- e2e/[relevant].spec.ts` (if UI bug)

---

## 3. Feature Implementation

**When:** Adding new user-facing or data behavior.

**Pre-read:** Nearest similar feature in PROJECT_CONTEXT §4, layer rules in §6.

**Prompt:**

```
Mode: Agent

Implement: [feature description]

User-facing behavior: [what the user sees/does]
Data impact: [tables/settings affected — or "none"]

Use TASK_TEMPLATE structure:
- Scope files: [list]
- Do not touch: db/db.ts, backupCrypto.ts, syncPull.ts (unless in scope)
- Acceptance criteria: [list]

Follow existing patterns:
- UI → hook → repository (not db/db directly)
- Settings: SettingsKey + default + validation + panel
- Strings via t() in en.json
- Co-located __tests__

Read ai/PROJECT_CONTEXT.md §4 and §12 before coding.
Update ai/CURRENT_STATE.md if this changes active priorities.
```

**Verification:** `npm test` · `npm run lint` · coverage tier · E2E if user flow · `npm run build`

---

## 4. Debugging

**When:** Investigating unexpected behavior without a clear fix yet.

**Pre-read:** Error message, stack trace, related hook/provider chain.

**Prompt:**

```
Mode: Agent (investigate only — do not fix until root cause confirmed)

Investigate: [symptom]

Observed: [error message, console output, steps]
Started after: [change or "unknown"]

Tasks:
1. Trace data flow from UI → context → hooks → lib → repository → Dexie
2. Identify root cause with file:line evidence
3. Propose minimal fix — do NOT implement until I confirm

Do not guess. If unclear, say what needs human verification.
Read ai/PROJECT_CONTEXT.md §5 (Application Flow) first.
```

**Verification:** Root cause documented with paths before any code change

---

## 5. Architecture Review

**When:** Evaluating a proposed change for architectural fit.

**Pre-read:** [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md), PROJECT_CONTEXT §6.

**Prompt:**

```
Review this proposed change for Study Dashboard architectural fit:

Proposal: [describe]

Evaluate against:
- Local-first / no backend (ADR-001)
- Hash routing (ADR-002)
- Repository layer (ADR-003)
- Provider nesting (ADR-005)
- ai/AI_RULES.md hard rules

Output:
1. Fit assessment (approve / caution / reject)
2. Affected layers and files
3. Risks and mitigations
4. Whether new ADR entry is needed

Do not implement — review only.
```

---

## 6. Code Review

**When:** Reviewing a diff or PR for safety and conventions.

**Prompt:**

```
Review this change against Study Dashboard standards:

[paste diff or list changed files]

Check:
- db/db import guard violated?
- Settings have validation?
- Tests adequate for change scope?
- ai/ docs need update per AI_RULES sync triggers?
- Scope creep or unrelated changes?
- Secrets exposed?

Output: findings by severity (blocker / warning / nit) with file paths.
```

---

## 7. Security Review

**When:** Reviewing backup, sync, export, or desktop FS changes.

**Pre-read:** PROJECT_CONTEXT §15, `backupCrypto.ts`, `syncPull.ts`, Tauri capabilities.

**Prompt:**

```
Security review for Study Dashboard change:

Scope: [files or feature]
Change summary: [what changed]

Review:
- Backup import validation loosened?
- Sync merge could silently overwrite data?
- CSV formula injection path affected?
- Tauri FS scope expanded?
- Sensitive data logged or exposed client-side?
- Secrets in code?

Cite evidence from files. Mark uncertain items as "needs human review".
Do not claim vulnerability without code evidence.
```

---

## 8. Migration Planning

**When:** Planning a Dexie schema version bump.

**Pre-read:** `src/db/db.ts`, `db.migration.test.ts`, CHANGELOG schema table.

**Prompt:**

```
Plan Dexie migration for Study Dashboard (currently v12).

Change needed: [describe schema change]

Produce a plan (do not implement yet):
1. New version number
2. .stores() index changes
3. .upgrade() data transformation steps
4. Backward compatibility impact
5. backup format impact (separate v4)
6. Tests to add in db.migration.test.ts
7. CHANGELOG entry
8. Whether lockoutAllowedTabs or hash routes need updates

Read ai/ARCHITECTURE_DECISIONS.md ADR-004 and ADR-007.
```

---

## 9. Hash Route / Tauri Boundary Changes

**When:** Changing navigation, deep links, or desktop capabilities.

**Pre-read:** `appHashRouting.ts`, `appNav.ts`, `src-tauri/capabilities/default.json`, E2E specs.

**Prompt:**

```
Change client boundary: [hash route / Tauri capability / File System Access]

Desired behavior: [describe]

Constraints:
- Hash tab IDs: focus, analytics, journal, settings (ADR-002)
- Legacy #cards must redirect to #focus
- Update all E2E specs that assert navigation
- Tauri FS scope: $HOME, $DOCUMENT, $DOWNLOAD only

Files to update: [list after inspection]
Read ai/ARCHITECTURE_DECISIONS.md ADR-002 and ADR-009.
```

---

## 10. UI Changes

**When:** Modifying components, tabs, or settings panels.

**Pre-read:** Nearest similar component, shared primitives in `src/components/shared/`.

**Prompt:**

```
UI change: [describe]

Tab/panel: [Focus / Analytics / Journal / Settings / modal name]

Constraints:
- Reuse shared primitives (Button, Card, ModalShell, settings widgets)
- User strings via t() — add en.json keys
- jsx-a11y rules enforced on CI
- Lazy-load if heavy (see AppShell pattern)
- Storybook story if new shared component

Do not change provider order or data layer unless required.
Run npm run test:coverage:components if shared/analytics UI changed.
```

---

## 11. Dependency Evaluation

**When:** Considering adding or upgrading an npm package.

**Prompt:**

```
Evaluate dependency for Study Dashboard:

Package: [name@version]
Purpose: [why needed]

Assess:
1. Can existing stack achieve this without new dep?
2. Bundle size impact (check:bundle budget ~512KB gzip)
3. Tauri/desktop compatibility
4. License compatible with private project?
5. Alternatives considered

Recommend: add / don't add / upgrade with caution
If add: exact install command (npm) and files affected.

Read ai/AI_RULES.md Dependency Policy first.
```

---

## Anti-patterns to avoid in prompts

| Bad prompt | Why | Better |
|------------|-----|--------|
| "Refactor the whole app" | Scope explosion | List specific files and criteria |
| "Add a REST API for sync" | Violates ADR-001 | Request folder sync or vault export extension |
| "Fix lint by disabling rules" | Hides real issues | Fix imports or add proper abstraction |
| "Update all documentation" | Unnecessary rewrites | Name specific `ai/` files per sync triggers |
| No acceptance criteria | Agent doesn't know when to stop | Use TASK_TEMPLATE checklist |

---

## Quick verification commands

```bash
npm test
npm run lint
npm run test:coverage              # lib/db/hooks
npm run test:coverage:components   # shared/analytics UI
npm run test:coverage:settings     # control-deck
npm run test:e2e -- e2e/<spec>.ts
npm run test:e2e:sync              # folder sync only
npm run build
npm run check:bundle
```
