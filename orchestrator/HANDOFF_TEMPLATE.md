# AI Session Handoff Template — Hermes Dual-Agent Orchestrator

## 1. Handoff Header

```text
Project: Study Dashboard / Autonomous Workspace
Repository root: D:/Study_App
Date/time: 2026-10-12
Controller package: Hermes Dual-Agent Orchestrator (V8.1 Evidence-Gated)
Controller model: gemini-3.8-flash-high (or configured reasoning model)
Executor model: gemini-3.8-flash-high (fast implementer)
Current SDLC stage: IMPLEMENTATION / VERIFICATION
Current meaningful bounded objective: [e.g. PROMPT #001: Implement portable backup capacity check]
Last prompt correlation ID: PROMPT #000
Last result correlation status: MATCHED
Controller disposition: PASS / PARTIAL / BLOCKED / FAIL / PENDING
Evidence captured at: [timestamp or commit hash]
```

---

## 2. Master Outcome

```text
Master outcome:
[High-level project deliverable or epic to be achieved autonomously]

Definition of done:
- [ ] Feature / requirement implemented according to spec
- [ ] No regression in existing tests (test suite passes clean)
- [ ] Linter and build pass with zero errors
- [ ] All code changes reviewed and verified by Controller
- [ ] Git commit created with [verified] prefix

Explicit exclusions:
- Do not modify files outside authorized scope
- Do not commit secrets, tokens, or credential files
- Do not rewrite Git history or perform destructive branch operations
```

---

## 3. Current Authorization

```text
Source edits: BOUNDED TO RELEVANT FEATURE FILES
Git stage: ALLOWED
Commit: ALLOWED (with [verified] prefix on PASS)
Push: NOT ALLOWED (requires human sign-off)
Merge/rebase/history rewrite: NOT ALLOWED
Production/destructive actions: NOT ALLOWED
Protected resources: .env, credentials, production configs
```

---

## 4. Repository State

```text
Branch: master
HEAD: [current commit hash]
Working tree: CLEAN / MODIFIED
Active failures: 0
Last test run exit code: 0
```

---

## 5. Bounded Objectives Queue (Milestones)

```text
- [x] #000: Initialize workspace and establish clean test baseline
- [ ] #001: [Next bounded objective to be dispatched to Executor]
- [ ] #002: [Subsequent objective]
- [ ] #003: [Final verification and packaging]
```
