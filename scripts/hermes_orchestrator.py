#!/usr/bin/env python3
"""
Autonomous Dual-Hermes Orchestrator (V8.1 Protocol)
===================================================
A self-driving, multi-day development loop using Hermes as both
the Controller (Architect / Reviewer) and Executor (Implementer).

Architecture:
  [State & HANDOFF.md]
          │
          ▼
   HERMES CONTROLLER (Plans next PROMPT #00X)
          │
          ▼
   HERMES EXECUTOR   (Implements, tests, runs tools)
          │
          ▼
   HERMES CONTROLLER (Reconciles evidence: PASS/FAIL/BLOCKED)
          │
  PASS    ├── Commit to Git, update HANDOFF.md, advance to next task
  FAIL    ├── Issue targeted fix prompt (max N attempts)
  BLOCKED └── Halt and notify human
"""

import os
import sys
import json
import time
import shutil
import argparse
import subprocess
from pathlib import Path
from datetime import datetime

# ---------------------------------------------------------------------------
# Configuration & Defaults
# ---------------------------------------------------------------------------
DEFAULT_CONTROLLER_MODEL = "gemini-3.8-flash-high"
DEFAULT_EXECUTOR_MODEL = "gemini-3.8-flash-high"
MAX_ATTEMPTS_PER_TASK = 3
DEFAULT_EXECUTOR_TIMEOUT = 600  # 10 minutes per turn
HANDOFF_FILE = "HANDOFF.md"
TASKS_FILE = "ORCHESTRATOR_TASKS.json"
LOG_DIR = ".orchestrator_logs"


# Reversible safety interlock (PROMPT #032)
# Set to True only with explicit operator authorization to re-enable legacy execution.
LEGACY_EXECUTION_ENABLED: bool = False


def find_hermes_executable() -> str:
    """Locate the Hermes executable."""
    hermes = shutil.which("hermes")
    if hermes:
        return hermes

    # Common Windows virtualenv path
    appdata = os.environ.get("LOCALAPPDATA", "")
    candidate = os.path.join(appdata, "hermes", "hermes-agent", "venv", "Scripts", "hermes.exe")
    if os.path.exists(candidate):
        return candidate

    return "hermes"


def run_cmd(cmd, timeout=300, cwd=None) -> tuple[int, str]:
    """Run a local shell command and return (exit_code, output)."""
    try:
        proc = subprocess.run(
            cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout,
            cwd=cwd or os.getcwd(),
            encoding="utf-8",
            errors="replace"
        )
        return proc.returncode, proc.stdout
    except subprocess.TimeoutExpired:
        return 124, f"[Command timed out after {timeout}s]"
    except Exception as e:
        return 1, f"[Execution error: {e}]"


def run_hermes_turn(prompt: str, model: str, toolsets: str = None, timeout: int = 600) -> tuple[int, str]:
    """Run a single Hermes turn in non-interactive CLI mode with its own isolated session."""
    if not LEGACY_EXECUTION_ENABLED:
        raise RuntimeError(
            "Legacy execution via 'scripts/hermes_orchestrator.py' is disabled for safety. "
            "Use certified supervised execution: 'python run_orchestrator.py supervised'."
        )
    hermes_bin = find_hermes_executable()
    cmd = [hermes_bin, "chat", "-q", prompt, "--yolo", "-Q"]
    if model:
        cmd.extend(["-m", model])
    if toolsets:
        cmd.extend(["-t", toolsets])

    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace"
        )
        return proc.returncode, proc.stdout
    except subprocess.TimeoutExpired:
        return 124, f"[Hermes process timed out after {timeout}s]"
    except Exception as e:
        return 1, f"[Hermes launch error: {e}]"


def init_workspace(master_goal: str):
    """Initialize orchestrator tracking files if not already present."""
    os.makedirs(LOG_DIR, exist_ok=True)

    if not os.path.exists(HANDOFF_FILE):
        content = f"""# AI Session Handoff (V8.1 Protocol)

## 1. Handoff Header
- Date/Time: {datetime.now().isoformat()}
- Controller: Hermes
- Executor: Hermes
- Current SDLC Stage: Planning & Implementation
- Master Outcome: {master_goal}
- Last Prompt ID: None
- Controller Disposition: PENDING

## 2. Completed Milestones
(None yet)

## 3. Current Working Task
- Initializing project execution plan.
"""
        with open(HANDOFF_FILE, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[+] Created {HANDOFF_FILE}")

    if not os.path.exists(TASKS_FILE):
        initial_tasks = {
            "master_goal": master_goal,
            "created_at": datetime.now().isoformat(),
            "prompt_counter": 1,
            "current_task_attempts": 0,
            "completed": False,
            "tasks": []
        }
        with open(TASKS_FILE, "w", encoding="utf-8") as f:
            json.dump(initial_tasks, f, indent=2)
        print(f"[+] Created {TASKS_FILE}")


def get_git_state() -> str:
    """Get concise git status and diff statistics."""
    _, status = run_cmd("git status --short")
    _, branch = run_cmd("git rev-parse --abbrev-ref HEAD")
    _, diffstat = run_cmd("git diff --stat")
    return f"Branch: {branch.strip()}\nStatus:\n{status.strip() or '(clean)'}\nDiffstat:\n{diffstat.strip() or '(none)'}"


def controller_plan_next(state: dict, controller_model: str) -> dict:
    """Hermes Controller decides the next bounded prompt."""
    prompt_id = f"PROMPT #{state['prompt_counter']:03d}"
    print(f"\n=======================================================")
    print(f"[CONTROLLER] Planning {prompt_id}...")
    print(f"=======================================================")

    with open(HANDOFF_FILE, "r", encoding="utf-8") as f:
        handoff_content = f.read()

    git_state = get_git_state()

    controller_query = f"""You are the Project Controller (Lead Architect).
You are managing an autonomous software development loop following the V8.1 Orchestration Protocol.

Master Goal: {state['master_goal']}
Current Prompt ID: {prompt_id}
Current Task Attempts: {state['current_task_attempts']}

Current HANDOFF.md:
---
{handoff_content}
---

Current Git State:
---
{git_state}
---

YOUR RESPONSIBILITY:
1. Determine if the Master Goal is ALREADY FULLY COMPLETED.
   If completed, output JSON with "is_completed": true.
2. Otherwise, define the NEXT bounded, verifiable objective for the Executor.
   - Focus on ONE meaningful outcome per dispatch (e.g. implement feature X, fix test Y).
   - Specify required tests or verification commands to run.
   - Do NOT ask the executor to do microscopic single edits or vague open-ended refactors.

Return ONLY a valid JSON object matching this schema:
{{
  "is_completed": false,
  "objective_title": "Short title of the task",
  "instructions": "Detailed prompt for the executor explaining the requirements and constraints",
  "verification_command": "e.g. npm test or pytest"
}}
"""
    code, output = run_hermes_turn(controller_query, model=controller_model, timeout=300)

    # Extract JSON from output
    try:
        # Find first { and last }
        start = output.find("{")
        end = output.rfind("}") + 1
        if start != -1 and end != 0:
            plan = json.loads(output[start:end])
            plan["prompt_id"] = prompt_id
            return plan
    except Exception as e:
        print(f"[!] Failed to parse Controller plan JSON: {e}")
        print(f"Raw output:\n{output[:1000]}")

    # Fallback plan if json parsing failed
    return {
        "is_completed": False,
        "prompt_id": prompt_id,
        "objective_title": "Progress Master Outcome",
        "instructions": f"Review HANDOFF.md and Git status, run the tests, and proceed with implementing {state['master_goal']}.",
        "verification_command": "npm test"
    }


def executor_run(plan: dict, executor_model: str, timeout: int) -> tuple[int, str]:
    """Hermes Executor carries out the plan using terminal and file editing tools."""
    prompt_id = plan["prompt_id"]
    print(f"\n-------------------------------------------------------")
    print(f"[EXECUTOR] Executing {prompt_id}: {plan['objective_title']}")
    print(f"-------------------------------------------------------")

    executor_query = f"""{prompt_id}
OBJECTIVE: {plan['objective_title']}

INSTRUCTIONS:
{plan['instructions']}

VERIFICATION REQUIRED:
You must run the project test suite using your terminal tool (e.g., `{plan.get('verification_command', 'npm test')}`)
and confirm that all relevant tests pass before concluding.

REQUIREMENTS:
- Inspect existing files before editing.
- Make targeted edits with `patch` or `write_file`.
- Run tests and linting to verify your work.
- In your final response, provide a summary of files modified, verification command output, and finish with:
END OF RESULT — {prompt_id}
"""
    code, output = run_hermes_turn(
        executor_query,
        model=executor_model,
        toolsets="terminal,file",
        timeout=timeout
    )
    return code, output


def controller_reconcile(plan: dict, executor_output: str, controller_model: str) -> dict:
    """Hermes Controller reconciles the executor output, verifies evidence, and assigns PASS/FAIL/BLOCKED."""
    prompt_id = plan["prompt_id"]
    print(f"\n=======================================================")
    print(f"[CONTROLLER] Reconciling evidence for {prompt_id}...")
    print(f"=======================================================")

    git_state = get_git_state()

    reconciliation_query = f"""You are the Project Controller (V8.1 Protocol).
Evaluate the Executor's work for {prompt_id}.

Objective: {plan['objective_title']}
Expected Verification: {plan.get('verification_command')}

Current Git Status after execution:
---
{git_state}
---

Executor Output (truncated):
---
{executor_output[-3000:]}
---

CRITERIA:
- PASS: The objective was achieved, code changed, and tests or verification were executed and passed.
- FAIL: The executor failed to implement the feature, tests failed, or unexpected regressions were introduced.
- BLOCKED: A blocking condition occurred requiring human authorization or manual intervention.

Return ONLY a valid JSON object:
{{
  "disposition": "PASS" | "FAIL" | "BLOCKED",
  "summary": "1-2 sentence reconciliation summary",
  "evidence_verified": true | false,
  "next_recommendation": "What to do next"
}}
"""
    code, output = run_hermes_turn(reconciliation_query, model=controller_model, timeout=300)

    try:
        start = output.find("{")
        end = output.rfind("}") + 1
        if start != -1 and end != 0:
            result = json.loads(output[start:end])
            return result
    except Exception as e:
        print(f"[!] Failed to parse reconciliation JSON: {e}")

    # Fallback simple check
    if f"END OF RESULT — {prompt_id}" in executor_output and "FAIL" not in executor_output[-500:]:
        return {
            "disposition": "PASS",
            "summary": "Executor finished prompt cleanly with verification.",
            "evidence_verified": True,
            "next_recommendation": "Advance to next objective."
        }
    else:
        return {
            "disposition": "FAIL",
            "summary": "Could not conclusively verify executor test pass.",
            "evidence_verified": False,
            "next_recommendation": "Retry with targeted repairs."
        }


def update_handoff(prompt_id: str, plan: dict, reconciliation: dict):
    """Append completed milestone or failure details to HANDOFF.md."""
    disposition = reconciliation.get("disposition", "UNKNOWN")
    entry = f"""
### [{datetime.now().strftime('%Y-%m-%d %H:%M')}] {prompt_id} — {disposition}
- **Objective:** {plan['objective_title']}
- **Disposition:** {disposition}
- **Reconciliation:** {reconciliation.get('summary', '')}
- **Next:** {reconciliation.get('next_recommendation', '')}
"""
    with open(HANDOFF_FILE, "a", encoding="utf-8") as f:
        f.write(entry)


def main():
    if not LEGACY_EXECUTION_ENABLED:
        print(
            "[SECURITY ERROR] Direct execution via 'scripts/hermes_orchestrator.py' is disabled for safety.\n"
            "This legacy entrypoint bypasses Architecture B container isolation and can perform unmediated\n"
            "host-local execution and unintended Git mutations.\n\n"
            "Please use the certified supervised CLI instead:\n"
            "    python run_orchestrator.py supervised --objective ... --allowed-paths ...\n",
            file=sys.stderr,
        )
        sys.exit(1)

    parser = argparse.ArgumentParser(description="Autonomous Dual-Hermes Orchestrator (V8.1 Protocol)")
    parser.add_argument("--goal", type=str, help="Master outcome or project goal")
    parser.add_argument("--controller-model", type=str, default=DEFAULT_CONTROLLER_MODEL, help="Model for Controller")
    parser.add_argument("--executor-model", type=str, default=DEFAULT_EXECUTOR_MODEL, help="Model for Executor")
    parser.add_argument("--max-turns", type=int, default=50, help="Maximum prompt dispatches before auto-stopping")
    parser.add_argument("--timeout", type=int, default=DEFAULT_EXECUTOR_TIMEOUT, help="Timeout in seconds per executor turn")
    args = parser.parse_args()

    # Load existing state or initialize
    if os.path.exists(TASKS_FILE):
        with open(TASKS_FILE, "r", encoding="utf-8") as f:
            state = json.load(f)
        if args.goal:
            state["master_goal"] = args.goal
    else:
        goal = args.goal or "Complete ongoing repository tasks and ensure all tests pass."
        init_workspace(goal)
        with open(TASKS_FILE, "r", encoding="utf-8") as f:
            state = json.load(f)

    print(f"\n=======================================================")
    print(f"  DUAL-HERMES AUTONOMOUS ORCHESTRATOR STARTED")
    print(f"  Master Goal : {state['master_goal']}")
    print(f"  Controller  : {args.controller_model}")
    print(f"  Executor    : {args.executor_model}")
    print(f"=======================================================\n")

    iteration = 0
    while iteration < args.max_turns:
        iteration += 1

        # 1. Controller Plans
        plan = controller_plan_next(state, args.controller_model)
        if plan.get("is_completed"):
            print(f"\n🎉 MASTER GOAL COMPLETED! Finishing loop.")
            state["completed"] = True
            with open(TASKS_FILE, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=2)
            break

        prompt_id = plan["prompt_id"]

        # Log prompt
        log_file = os.path.join(LOG_DIR, f"{prompt_id.replace(' ', '_').replace('#', '')}.json")

        # 2. Executor Executes
        code, executor_output = executor_run(plan, args.executor_model, args.timeout)

        # 3. Controller Reconciles
        reconciliation = controller_reconcile(plan, executor_output, args.controller_model)
        disposition = reconciliation.get("disposition", "FAIL")

        print(f"\n[DECISION] {prompt_id} => {disposition}")
        print(f"Summary: {reconciliation.get('summary')}")

        # Record log
        with open(log_file, "w", encoding="utf-8") as f:
            json.dump({
                "plan": plan,
                "reconciliation": reconciliation,
                "executor_exit_code": code,
                "executor_output_tail": executor_output[-4000:]
            }, f, indent=2)

        # Update persistent handoff
        update_handoff(prompt_id, plan, reconciliation)

        if disposition == "PASS":
            # Auto-commit verified work
            commit_msg = f"[verified] {prompt_id}: {plan['objective_title']}"
            run_cmd("git add -A")
            rc, commit_out = run_cmd(f'git commit -m "{commit_msg}"')
            print(f"[GIT] Committed: {commit_msg}")

            # Advance to next prompt
            state["prompt_counter"] += 1
            state["current_task_attempts"] = 0
        elif disposition == "BLOCKED":
            print(f"\n[!] ORCHESTRATOR BLOCKED. Human intervention required.")
            print(f"Reason: {reconciliation.get('summary')}")
            break
        else:
            # FAIL - increment attempt counter
            state["current_task_attempts"] += 1
            print(f"[!] Task failed (Attempt {state['current_task_attempts']}/{MAX_ATTEMPTS_PER_TASK}).")
            if state["current_task_attempts"] >= MAX_ATTEMPTS_PER_TASK:
                print(f"[!] Circuit breaker triggered: Max attempts exceeded for this objective.")
                print(f"[!] Advancing to next prompt with failure logged in HANDOFF.md.")
                state["prompt_counter"] += 1
                state["current_task_attempts"] = 0

        # Save persistent state
        with open(TASKS_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)

        time.sleep(2)


if __name__ == "__main__":
    main()
