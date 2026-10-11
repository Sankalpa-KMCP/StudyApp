# Dual-Hermes Autonomous Coding Orchestrator (V8.1)

An autonomous multi-agent engineering harness built on top of the **AI Coding Orchestrator V8.1** blueprint where **Hermes operates as both the Project Controller and the Repository Executor**.

---

## 1. Architectural Overview

```
                      ┌──────────────────────────────────────────┐
                      │          PERSISTENT STATE DISK           │
                      │  (ORCHESTRATOR_HANDOFF.md + Git Commits) │
                      └─────────────────────┬────────────────────┘
                                            │ Reads & Updates
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           HERMES #1: THE CONTROLLER                             │
│                         (Architect / Technical Lead)                            │
│  • Reads Master Outcome, Definition of Done, and handoff document               │
│  • Never edits repository files directly                                        │
│  • Formulates one meaningful bounded objective: `PROMPT #00X`                   │
│  • Enforces constraints and decisive verification requirements                  │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │ Dispatches correlated prompt
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           HERMES #2: THE EXECUTOR                               │
│                         (Repository Implementer)                                │
│  • Fresh, isolated process with toolsets (`terminal,file`)                      │
│  • Edits code, runs test suites, checks linter / bundle sizes                   │
│  • Concludes with `END OF RESULT — PROMPT #00X`                                 │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │ Returns execution logs & git diff
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CONTROLLER RECONCILIATION                             │
│  • Verifies prompt-result correlation                                           │
│  • Evaluates observable evidence against `CONTROLLER_RESULT_SCHEMA.json` rules:  │
│      - PASS: Git commit `[verified] PROMPT #00X: ...`, increment sequence       │
│      - PARTIAL / FAIL: Formulate targeted repair prompt with failure context    │
│      - BLOCKED: Halt if circuit breaker fires (3 consecutive failures)          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Why This Can Run for Days Autonomously

1. **Context Window Immune:**
   - Single-chat agent sessions degrade and run out of context after a few hours of reading files and test output.
   - In this harness, both Controller and Executor run in isolated turns. Between turns, state is serialized to `ORCHESTRATOR_HANDOFF.md`, `.orchestrator_state.json`, and Git commits.

2. **No Human Copy-Pasting:**
   - The original V8.1 package required humans to copy prompts between ChatGPT and an IDE executor.
   - This Python harness handles programmatic dispatch, correlation checking, and reconciliation automatically.

3. **Circuit Breakers & Runaway Protection:**
   - If an executor encounters 3 consecutive failures on the same objective, the circuit breaker halts the loop with a `BLOCKED` disposition. This prevents infinite token burn.
   - Output logs for every turn are saved under `.orchestrator_logs/`.

---

## 3. CLI Usage & Commands

Run commands from the repository root:

### Step 1: Initialize a Project Goal
```bash
python run_orchestrator.py init \
  --master-outcome "Implement and verify end-to-end SQLite query cache" \
  --definition-of-done "All unit tests pass, linter clean, bundle size within budget"
```

### Step 2: Check Current Status & Progress
```bash
python run_orchestrator.py status
```
Prints the active prompt ID, last controller disposition, consecutive failure count, and recently completed objectives.

### Step 3: Run a Single Step (Human-in-the-Loop Inspection)
```bash
python run_orchestrator.py step
```
Executes exactly one prompt formulation, executor dispatch, and controller reconciliation cycle.

### Step 4: Run Continuously (Multi-Day Autonomous Execution)
```bash
# Run for up to 50 iterations (default)
python run_orchestrator.py run

# Run indefinitely (0 = infinite iterations)
python run_orchestrator.py run --max-iterations 0

# Run with custom model assignments
python run_orchestrator.py run \
  --controller-model "gemini-3.8-flash-high" \
  --executor-model "gemini-3.8-flash-high"
```

### Step 5: Reset Circuit Breaker (After Manual Fixes)
If the orchestrator halts with `BLOCKED` after 3 consecutive failures, resolve the blocker and run:
```bash
python run_orchestrator.py reset-breaker
```

---

## 4. Package Structure

- `run_orchestrator.py`: Root CLI entry point.
- `orchestrator/`:
  - `config.py`: Orchestrator configuration and file paths.
  - `schema.py`: Data models, correlation ID utilities, and V8.1 schema envelopes.
  - `hermes_client.py`: Subprocess runner for headless Hermes instances.
  - `controller.py`: Controller prompt builder, prompt formulator, and evidence reconciler.
  - `executor.py`: Executor prompt wrapper with terminal/file tool execution.
  - `git_manager.py`: Git status inspector and `[verified]` auto-committer.
  - `handoff.py`: Persistent `ORCHESTRATOR_HANDOFF.md` and state manager.
  - `circuit_breaker.py`: Failure counter and correlation validator.
  - `engine.py`: Master coordination loop.
  - `cli.py`: Argparse command-line interface.
  - `tests/`: Automated unit tests for all orchestrator modules.
