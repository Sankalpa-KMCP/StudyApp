# AI Rules

> Permanent operational rules for AI coding agents working on Study Dashboard.
> Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) before substantive edits.
> For ADR context, see [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) §6 (a separate `ARCHITECTURE_DECISIONS.md` is intentionally not maintained).

---

## Hard Rules

These rules are non-negotiable unless the user explicitly overrides them in the current task.

1. **Local-first only** — Do not add backend servers, cloud databases, auth providers, or telemetry without explicit user request.
2. **Repository layer only** — Never import `db/db` from `src/components/`, `src/hooks/`, or `src/lib/`. Use `db/repositories` and `db/hooks` (enforced by ESLint).
3. **Minimal diffs** — Change only what the task requires. Do not rewrite unrelated files or reformat entire modules.
4. **Read before edit** — Read the entire target file and its nearest similar feature before modifying code.
5. **npm only** — Use `npm ci` / `npm install`. Do not switch to pnpm, yarn, or bun (`package-lock.json` is canonical).
6. **No secrets in repo** — Never commit `.env`, API keys, tokens, or credentials. Redact if discovered.
7. **Preserve private license** — Do not remove or weaken the private-license notice.
8. **No invented APIs** — This project has no HTTP API. Do not document or implement REST/GraphQL endpoints unless explicitly requested.
9. **Schema migrations are mandatory** — Any Dexie schema change requires a version bump, `.upgrade()` handler, and migration test.
10. **Settings need validation** — New `SettingsKey` values require defaults, `settingsValidation.ts` rules, and UI wiring.

---

## Editing Constraints

- Prefer extending existing functions, hooks, and components over creating parallel abstractions.
- Match surrounding naming, import style, and documentation level.
- Co-locate tests in `__tests__/` next to the code under test.
- Use `t()` from `src/i18n` for user-facing strings; add keys to `src/i18n/locales/en.json`.
- Lazy-load heavy modals and panels following `AppShell.tsx` patterns.
- Use `ConfirmProvider` for destructive actions.
- Do not delete comments, migration notes, or historical context unless factually wrong.
- Do not run destructive git commands (`push --force`, `reset --hard`) unless explicitly requested.

---

## Architecture Preservation

### Provider nesting order (do not reorder)

```
ConfirmProvider
  └── StudyDataProvider
        └── StudyTimerProvider
              └── StudyUIProvider
```

Defined in `src/context/StudyAppProvider.tsx`.

### Layer import rules

| Layer | May import |
|-------|------------|
| `db/repositories`, `db/hooks` | `db/db` |
| `hooks`, `components`, `lib` | `db/repositories`, `db/hooks`, `db/types` — **not** `db/db` |
| Tests | `db/db` for setup/teardown only |

### Hash route IDs (do not rename without E2E updates)

`focus`, `analytics`, `journal`, `settings` — plus settings sections: `appearance`, `focus`, `study`, `data`.

Legacy `#cards` must continue redirecting to `#focus`.

### Deployment base path

Production web build uses `/StudyApp/` (GitHub Pages). Tauri builds use `/`. Do not change without updating CI and deploy workflows.

---

## Dependency Policy

- Do not add npm dependencies without clear justification tied to the task.
- Prefer browser APIs, existing `lib/` services, and current stack libraries.
- Do not introduce Redux, Zustand, React Router, or a backend framework.
- Major version bumps require checking CI, types, and E2E compatibility.
- Tauri plugin additions require `src-tauri/capabilities/default.json` scope review.

---

## Testing Requirements

Run the minimum set appropriate to your change:

| Change scope | Commands |
|--------------|----------|
| Always | `npm test`, `npm run lint` |
| `lib/`, `db/`, timer/backup hooks | `npm run test:coverage` (80%/74% gate) |
| Shared/analytics components | `npm run test:coverage:components` (65%/50%) |
| Control-deck/settings | `npm run test:coverage:settings` (60%/45%) |
| User-facing flows | `npm run test:e2e -- e2e/<relevant>.spec.ts` |
| Build/config changes | `npm run build` |

Dexie migrations: always extend `src/db/__tests__/db.migration.test.ts`.

---

## Naming Conventions

| Item | Convention |
|------|------------|
| Components | PascalCase `.tsx` in `src/components/` |
| Hooks | `use` prefix in `src/hooks/` |
| Repositories | `src/db/repositories/<domain>.ts` |
| Tests | `__tests__/<name>.test.ts(x)` co-located |
| Stories | `<Component>.stories.tsx` co-located |
| Settings keys | camelCase strings in `SettingsKey` union |
| i18n keys | camelCase in `en.json` |

---

## Protected Files and Systems

Handle these with extreme caution. Read fully before editing; prefer asking the user if the change is large.

| File / system | Risk |
|---------------|------|
| `src/db/db.ts` | Schema migrations affect all users; irreversible without upgrade path |
| `src/db/repositories/database.ts` | Bulk export/merge/reset — can wipe or corrupt all data |
| `src/lib/backup/backupCrypto.ts` | Encryption format changes break existing encrypted backups |
| `src/lib/backup/backupChecksum.ts` | Checksum algorithm changes break backup verification |
| `src/lib/sync/syncPull.ts` | Merge logic errors cause silent data loss or conflicts |
| `src/lib/sync/syncPush.ts` | Push errors can overwrite remote sync file |
| `src/lib/routing/appHashRouting.ts` | Hash changes break bookmarks, deep links, and E2E tests |
| `src/context/StudyAppProvider.tsx` | Provider order affects entire app initialization |
| `src/lib/settings/settingsValidation.ts` | Missing validation allows invalid settings into IndexedDB |
| `src/lib/study/studyDashboard/backupSchema.ts` | Import validation — loosening can allow corrupt restores |
| `src-tauri/capabilities/default.json` | FS scope changes affect desktop security posture |

---

## Forbidden Changes

Unless explicitly requested by the user:

- Bumping Dexie schema version without migration handler and test
- Bumping backup format version without backward-compatible import path
- Changing AES-GCM / PBKDF2 parameters in `backupCrypto.ts`
- Renaming hash tab IDs or removing legacy `#cards` redirect
- Reordering context providers
- Force-pushing to `master` or `V2`
- Committing secrets, `.env` files, or credentials
- Removing tiered coverage gates or disabling ESLint rules to pass CI
- Adding cloud sync, user accounts, or analytics telemetry

---

## Safe Refactor Strategy

1. Identify the layer (UI → context → hooks → lib → repository → Dexie).
2. Find the nearest working example of the same pattern.
3. Make the smallest change that satisfies acceptance criteria.
4. Update tests in the same layer before crossing layer boundaries.
5. If a refactor touches protected files, stop and confirm scope with the user.
6. Update affected `ai/` documentation incrementally in the same task.

---

## Known AI Failure Modes

Patterns that commonly cause damage in this codebase:

| Failure mode | Consequence | Prevention |
|--------------|-------------|------------|
| Importing `db/db` in a component | ESLint failure; bypasses repository layer | Use `db/repositories` or `db/hooks` |
| Adding a setting without validation | Invalid data in IndexedDB; subtle UI bugs | Wire through `settingsValidation.ts` |
| Changing hash routes without E2E update | Broken navigation tests and user bookmarks | Update `appHashRouting.ts`, `appNav.ts`, E2E specs |
| Inventing HTTP API endpoints | Documentation lies; wrong architecture | Remember: IndexedDB is source of truth |
| Full-file rewrites of hooks/providers | Regression in timer, sync, or backup flows | Edit targeted functions only |
| Skipping migration `.upgrade()` | Users stuck on broken schema | Always add handler + `db.migration.test.ts` |
| Using pnpm/yarn | Lockfile drift; CI uses npm | Use `npm ci` |
| Adding React Router | Conflicts with hash routing and GitHub Pages | Use `appHashRouting.ts` |
| Loosening backup import validation | Corrupt data restored into IndexedDB | Keep `backupSchema.ts` checks strict |
| Touching sync merge without tests | Data loss between web and desktop | Run `npm run test:e2e:sync` |

---

## Completion Checklist

Before marking a task done:

- [ ] Acceptance criteria met — no scope creep
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] Relevant coverage tier run (if applicable)
- [ ] E2E spec run (if user-facing behavior changed)
- [ ] `npm run build` (if build/config/import graph changed)
- [ ] Affected `ai/` docs updated per sync triggers below
- [ ] No secrets committed

---

## Anti-Scope-Creep Rules

- Stop when acceptance criteria are met — do not "improve" unrelated code.
- Do not add features, tests, or docs not requested unless required for correctness.
- Ask before touching protected files or systems outside the stated scope.
- Ask before adding dependencies, new architectural layers, or new top-level folders.
- Do not refactor documentation structure unless explicitly requested.

---

## AI-Maintained Documentation Registry

These files live in `ai/` and must stay synchronized with the codebase when relevant changes occur:

| File | Purpose | Status |
|------|---------|--------|
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | Comprehensive project reference for developers and AI | Active |
| [`AI_RULES.md`](AI_RULES.md) | AI workflow rules (this file) | Active |
| [`CURRENT_STATE.md`](CURRENT_STATE.md) | Snapshot of active work, recent changes, and open items | **Intentionally omitted** — use `CHANGELOG.md` and git history |
| [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) | Record of significant architectural decisions | **Intentionally omitted** — see `PROJECT_CONTEXT.md` §6 |
| [`TASK_TEMPLATE.md`](TASK_TEMPLATE.md) | Template for scoped AI task documents | Not present |
| [`PROMPT_PATTERNS.md`](PROMPT_PATTERNS.md) | Reusable prompt patterns for AI workflows | Not present |
| [`.cursor/rules/`](../.cursor/rules/) | Persistent Cursor agent rules | Active |

Human-oriented docs (`README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`) should also be updated when changes affect their audience, but AI agents must treat the `ai/` registry above as the primary synchronization set.

---

## AI Documentation Synchronization

AI-maintained documentation must be **reviewed and updated whenever relevant project changes occur**. Documentation is part of implementation work — not a separate optional step.

### When to update documentation

Update affected registry files when changes touch:

- **Architecture** — layers, providers, routing, module boundaries
- **Features** — new, removed, or materially changed user-facing behavior
- **APIs** — hash routes, Tauri capabilities, File System Access boundaries, backup/sync interfaces
- **Database models** — Dexie schema, migrations, table fields, repository contracts
- **Environment variables** — new, renamed, or removed `VITE_*` / build-time flags
- **Workflows** — dev setup, test commands, CI, deployment, migration procedures
- **Setup steps** — prerequisites, install commands, common problems
- **Dependencies** — added, removed, or major version bumps that affect behavior or tooling
- **Risky systems** — backup crypto, sync merge, bulk DB operations, encryption formats
- **Conventions** — lint rules, import guards, coding patterns agents must follow
- **Deployment behavior** — base paths, GitHub Pages, Tauri release triggers
- **Authentication / authorization** — permission models, capability scopes (even if "none")
- **Major refactors** — moved modules, renamed entry points, changed provider order

### Which file to update

| Change type | Primary docs to update |
|-------------|------------------------|
| Broad codebase / onboarding context | `PROJECT_CONTEXT.md` |
| Active sprint / recent delta | `CHANGELOG.md`, git history — not `CURRENT_STATE.md` |
| Deliberate design choice with trade-offs | `PROJECT_CONTEXT.md` §6 — not `ARCHITECTURE_DECISIONS.md` |
| AI workflow or agent behavior | `AI_RULES.md`, `.cursor/rules/` |
| User-facing release notes | `CHANGELOG.md` |
| Contributor procedures | `CONTRIBUTING.md` |

Prefer **incremental updates** to the most specific file. Do not duplicate large sections across multiple docs — cross-link instead.

### Agent instructions

When implementing or reviewing changes, AI agents must:

1. **Update documentation as part of the work** when the change falls into any trigger category above.
2. **Inspect the implementation first** — read affected source files before editing docs; never update documentation blindly from assumptions.
3. **Make incremental edits** — revise only the sections that are now wrong or incomplete; avoid full rewrites.
4. **Preserve useful historical context** — keep migration notes, decision rationale, and "why" explanations unless they are factually incorrect.
5. **Minimize stale documentation** — if you change behavior, update or remove the matching doc claim in the same task when practical.
6. **Keep AI instructions aligned with the real codebase** — verify file paths, versions, and commands against the repo before documenting them.
7. **Avoid unnecessary rewrites** — do not restructure docs, reformat tables, or rewrite unrelated sections without cause.

### What not to do

- Leave architecture or workflow docs stale after a merged behavioral change
- Copy entire doc sections into multiple files instead of linking
- Document features or files that do not exist without marking them as planned
- Refactor the documentation tree unless explicitly requested

### Quick checklist (end of task)

Before finishing implementation work, ask:

- [ ] Did this change affect anything in the trigger list above?
- [ ] If yes, which registry files need a targeted update?
- [ ] Did I verify claims against the actual code?
- [ ] Did I preserve still-accurate historical context?

---

## Related Reading

| Document | When to read |
|----------|--------------|
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | Before any substantive edit |
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) §6 | Layer boundaries, design trade-offs, ADR-003/ADR-014 context |
| [`CHANGELOG.md`](../CHANGELOG.md) | Recent schema, release history, and active-work context |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Migrations, E2E patterns, settings conventions |
