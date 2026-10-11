#!/usr/bin/env python3
"""
Hermes AI Coding Orchestrator V8.1 Runner
Continuous Autonomous Controller-Executor Loop for Hermes Agent.
"""

import os
import sys
import json
import re
import subprocess
import argparse
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent
CONFIG_PATH = BASE_DIR / "config.json"
CONTROLLER_PROMPT_PATH = BASE_DIR / "controller_prompt.md"
EXECUTOR_PROMPT_PATH = BASE_DIR / "executor_prompt.md"

def load_config():
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "controller_model": None,
        "executor_model": None,
        "executor_toolsets": "terminal,file",
        "max_retries": 3,
        "auto_git_commit": True,
        "state_dir": ".orchestrator"
    }

def get_state_dir(config):
    state_dir = REPO_ROOT / config.get("state_dir", ".orchestrator")
    state_dir.mkdir(parents=True, exist_ok=True)
    (state_dir / "logs").mkdir(exist_ok=True)
    return state_dir

def load_state(state_dir):
    state_file = state_dir / "state.json"
    if state_file.exists():
        with open(state_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "prompt_number": 1,
        "attempts": 0,
        "last_disposition": "INIT",
        "total_cycles": 0,
        "completed": False,
        "history": []
    }

def save_state(state_dir, state):
    state_file = state_dir / "state.json"
    with open(state_file, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

def run_cmd(cmd, cwd=REPO_ROOT, timeout=600):
    """Run a shell command and return stdout."""
    res = subprocess.run(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        shell=True
    )
    return res.returncode, res.stdout.strip()

def run_hermes(query, model=None, toolsets=None, timeout=600):
    """Invoke Hermes non-interactively via hermes chat -q."""
    cmd_parts = ["hermes", "chat", "-q", query, "-Q", "--yolo"]
    if model:
        cmd_parts.extend(["-m", model])
    if toolsets:
        cmd_parts.extend(["-t", toolsets])
    
    # Run from REPO_ROOT
    cmd_str = " ".join(f'"{p}"' if " " in p or "\n" in p else p for p in cmd_parts)
    returncode, output = run_cmd(cmd_str, cwd=REPO_ROOT, timeout=timeout)
    
    # Strip any session_id header if present
    clean_lines = []
    for line in output.splitlines():
        if line.startswith("session_id:"):
            continue
        clean_lines.append(line)
    return returncode, "\n".join(clean_lines).strip()

def get_git_status():
    rc, out = run_cmd("git status -s")
    return out if rc == 0 else "git status unavailable"

def init_project(goal, config, state_dir):
    handoff_file = state_dir / "HANDOFF.md"
    content = f"""# AI Session Handoff — Orchestrator V8.1

## 1. Master Outcome
**Goal:** {goal}
**Status:** In Progress
**Initialized At:** {datetime.now().isoformat()}

## 2. Invariants & Definition of Done
- All test suites must pass (`npm test`, build checks).
- Clean code architecture with no regressions.
- All changes must be backed by verifiable test evidence.

## 3. Milestones
- [ ] Milestone 1: Discovery and specification
- [ ] Milestone 2: Implementation
- [ ] Milestone 3: Test verification and hardening

## 4. Current State
- Sequence: PROMPT #001
- Last Disposition: INIT
- Focus: Formulate PROMPT #001
"""
    with open(handoff_file, "w", encoding="utf-8") as f:
        f.write(content)
    
    state = {
        "prompt_number": 1,
        "attempts": 0,
        "last_disposition": "INIT",
        "total_cycles": 0,
        "completed": False,
        "history": []
    }
    save_state(state_dir, state)
    print(f"[+] Initialized project in {handoff_file}")

def step_cycle(config, state_dir):
    state = load_state(state_dir)
    if state.get("completed"):
        print("[*] Project already marked COMPLETED!")
        return True

    prompt_num = state["prompt_number"]
    correlation_id = f"PROMPT #{prompt_num:03d}"
    print(f"\n=======================================================")
    print(f"[*] Starting Cycle {state['total_cycles'] + 1} | Correlation: {correlation_id} (Attempt {state['attempts'] + 1})")
    print(f"=======================================================")

    handoff_file = state_dir / "HANDOFF.md"
    if not handoff_file.exists():
        print("[-] HANDOFF.md not found! Run --init first.")
        return False

    with open(handoff_file, "r", encoding="utf-8") as f:
        handoff_content = f.read()

    with open(CONTROLLER_PROMPT_PATH, "r", encoding="utf-8") as f:
        controller_instructions = f.read()

    with open(EXECUTOR_PROMPT_PATH, "r", encoding="utf-8") as f:
        executor_instructions = f.read()

    git_state = get_git_status()

    # Step 1: Controller Formulates Prompt
    print(f"[1/3] Dispatching Controller to formulate {correlation_id}...")
    prompt_query = f"""{controller_instructions}

Current Repository Git Status:
{git_state}

Current HANDOFF.md:
{handoff_content}

Your Task:
Formulate the single bounded objective for {correlation_id}.
If this is a retry attempt (Attempt {state['attempts'] + 1}), incorporate the previous failures or repair instructions.
Remember: Start strictly with '{correlation_id}'.
"""
    _, prompt_out = run_hermes(prompt_query, model=config.get("controller_model"))
    
    # Save prompt to log
    log_dir = state_dir / "logs"
    with open(log_dir / f"prompt_{prompt_num:03d}_att{state['attempts'] + 1}.txt", "w", encoding="utf-8") as f:
        f.write(prompt_out)
    
    print(f"[+] Controller formulated {correlation_id}:")
    print("\n".join(prompt_out.splitlines()[:6]) + "\n...")

    # Step 2: Executor Executes Prompt
    print(f"\n[2/3] Dispatching Executor with tools ({config.get('executor_toolsets')})...")
    executor_query = f"""{executor_instructions}

{prompt_out}
"""
    _, executor_out = run_hermes(
        executor_query,
        model=config.get("executor_model"),
        toolsets=config.get("executor_toolsets")
    )
    
    # Save executor output to log
    with open(log_dir / f"result_{prompt_num:03d}_att{state['attempts'] + 1}.txt", "w", encoding="utf-8") as f:
        f.write(executor_out)

    print(f"[+] Executor completed execution. (Output length: {len(executor_out)} chars)")
    print("\n".join(executor_out.splitlines()[-8:]))

    # Step 3: Controller Reconciles Evidence
    print(f"\n[3/3] Dispatching Controller to reconcile evidence for {correlation_id}...")
    reconcile_query = f"""{controller_instructions}

Issued Prompt:
{prompt_out}

Executor Result Output:
{executor_out}

Updated Git Status:
{get_git_status()}

Current HANDOFF.md:
{handoff_content}

Your Task:
Evaluate the executor result. Scrutinize test exit codes, modified files, and regression risks.
Emit RECONCILIATION RESULT with Disposition (PASS, PARTIAL, FAIL, or BLOCKED).
If PASS, provide UPDATED HANDOFF content for HANDOFF.md and a Git commit message.
If all work is finished, include 'PROJECT_COMPLETED: True'.
"""
    _, reconcile_out = run_hermes(reconcile_query, model=config.get("controller_model"))

    with open(log_dir / f"reconcile_{prompt_num:03d}_att{state['attempts'] + 1}.txt", "w", encoding="utf-8") as f:
        f.write(reconcile_out)

    print(f"\n[+] Controller Reconciliation Output:")
    print(reconcile_out[:1200] + ("\n..." if len(reconcile_out) > 1200 else ""))

    # Parse disposition
    disposition = "FAIL"
    if "Disposition: PASS" in reconcile_out or "**PASS**" in reconcile_out or "Disposition: [PASS]" in reconcile_out:
        disposition = "PASS"
    elif "Disposition: BLOCKED" in reconcile_out or "**BLOCKED**" in reconcile_out:
        disposition = "BLOCKED"
    elif "Disposition: PARTIAL" in reconcile_out or "**PARTIAL**" in reconcile_out:
        disposition = "PARTIAL"

    state["total_cycles"] += 1
    state["last_disposition"] = disposition

    if disposition == "PASS":
        print(f"\n[***] DISPOSITION: PASS for {correlation_id}!")
        state["attempts"] = 0
        state["prompt_number"] += 1

        # Check for updated handoff
        if "### UPDATED HANDOFF" in reconcile_out:
            updated_handoff = reconcile_out.split("### UPDATED HANDOFF", 1)[1].strip()
            # Clean markdown codeblocks if wrapped
            if updated_handoff.startswith("```markdown"):
                updated_handoff = updated_handoff[len("```markdown"):].strip()
            if updated_handoff.startswith("```"):
                updated_handoff = updated_handoff[3:].strip()
            if updated_handoff.endswith("```"):
                updated_handoff = updated_handoff[:-3].strip()
            with open(handoff_file, "w", encoding="utf-8") as f:
                f.write(updated_handoff)
            print("[+] Updated HANDOFF.md with controller revisions.")

        # Git commit if enabled
        if config.get("auto_git_commit", True):
            commit_msg = f"orchestrator({correlation_id}): verified milestone"
            commit_match = re.search(r"Git Commit Message:\s*(.+)", reconcile_out)
            if commit_match:
                commit_msg = commit_match.group(1).strip()
            run_cmd("git add -A")
            rc, commit_res = run_cmd(f'git commit -m "{commit_msg}"')
            if rc == 0:
                print(f"[+] Git committed: {commit_msg}")
            else:
                print(f"[*] Git commit notice: {commit_res}")

        if "PROJECT_COMPLETED: True" in reconcile_out or "PROJECT_COMPLETED: TRUE" in reconcile_out:
            state["completed"] = True
            print("\n🎉 ===================================================")
            print("🎉 PROJECT COMPLETED SUCCESSFULLY!")
            print("🎉 ===================================================")

    elif disposition == "BLOCKED":
        print(f"\n[!!!] DISPOSITION: BLOCKED for {correlation_id}. Controller requested human attention.")
    else:
        state["attempts"] += 1
        print(f"\n[!] DISPOSITION: {disposition} for {correlation_id}. (Attempt {state['attempts']}/{config.get('max_retries', 3)})")
        if state["attempts"] >= config.get("max_retries", 3):
            print(f"[!] Maximum retry attempts exceeded for {correlation_id}. Marking BLOCKED.")
            state["last_disposition"] = "BLOCKED"

    save_state(state_dir, state)
    return state["last_disposition"] != "BLOCKED" and not state.get("completed", False)

def main():
    parser = argparse.ArgumentParser(description="Hermes Dual-Agent Orchestrator V8.1")
    parser.add_argument("--init", type=str, help="Initialize project with master goal")
    parser.add_argument("--step", action="store_true", help="Run a single controller-executor cycle")
    parser.add_argument("--run", action="store_true", help="Run autonomous loop continuously")
    parser.add_argument("--status", action="store_true", help="Print current orchestrator status")
    parser.add_argument("--max-steps", type=int, default=50, help="Max continuous steps to run (default 50)")
    args = parser.parse_args()

    config = load_config()
    state_dir = get_state_dir(config)

    if args.init:
        init_project(args.init, config, state_dir)
        return

    if args.status:
        state = load_state(state_dir)
        print(f"--- Hermes Orchestrator Status ---")
        print(f"State Dir: {state_dir}")
        print(f"Next Prompt: PROMPT #{state['prompt_number']:03d}")
        print(f"Attempts: {state['attempts']}")
        print(f"Last Disposition: {state['last_disposition']}")
        print(f"Total Cycles: {state['total_cycles']}")
        print(f"Completed: {state.get('completed', False)}")
        return

    if args.step:
        step_cycle(config, state_dir)
        return

    if args.run:
        steps = 0
        while steps < args.max_steps:
            steps += 1
            can_continue = step_cycle(config, state_dir)
            if not can_continue:
                break
        print(f"\n[*] Finished autonomous run after {steps} cycles.")
        return

    parser.print_help()

if __name__ == "__main__":
    main()
