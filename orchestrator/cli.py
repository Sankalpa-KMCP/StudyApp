import argparse
import json
import os
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import List, Optional

from orchestrator.config import OrchestratorConfig
from orchestrator.docker_backend import (
    DEFAULT_SANDBOX_IMAGE,
    DockerExecutionBackend,
    DockerSandboxContainer,
    LocalModelAPIClient,
    resolve_hermes_model_endpoint,
)
from orchestrator.engine import OrchestratorEngine
from orchestrator.hermes_client import HermesClient, HermesResponse
from orchestrator.schema import (
    ControllerDisposition,
    MutationExpectation,
    ObjectiveAuthorization,
    format_correlation_id,
)
from orchestrator.verification import DockerSandboxVerificationAdapter
from orchestrator.workspace_sync import (
    is_protected_from_mutation,
    is_secret_or_orchestrator_internal_path,
    is_symlink_or_reparse_point,
    validate_safe_relative_posix_path,
)

def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="hermes-orchestrator",
        description="Dual-Hermes Autonomous Coding Orchestrator (V8.1 Protocol)",
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Command: init
    init_parser = subparsers.add_parser("init", help="Initialize workspace with Master Outcome")
    init_parser.add_argument(
        "--master-outcome", "-m",
        required=True,
        help="High-level goal (e.g. 'Implement End-to-End Search indexing with tests')",
    )
    init_parser.add_argument(
        "--definition-of-done", "-d",
        default="All unit/e2e tests pass, bundle limits satisfied, git clean",
        help="Definition of done criteria",
    )

    # Command: run
    run_parser = subparsers.add_parser("run", help="Start continuous autonomous loop")
    run_parser.add_argument(
        "--max-iterations", "-n",
        type=int,
        default=50,
        help="Maximum prompt-execution iterations before pausing (0 for infinite)",
    )
    run_parser.add_argument(
        "--controller-model",
        type=str,
        default=None,
        help="Model override for the Controller (Tech Lead)",
    )
    run_parser.add_argument(
        "--executor-model",
        type=str,
        default=None,
        help="Model override for the Executor (Implementer)",
    )
    run_parser.add_argument(
        "--no-autocommit",
        action="store_true",
        help="Disable automatic Git commits on verified PASS",
    )

    # Command: step
    step_parser = subparsers.add_parser("step", help="Run a single prompt-and-reconcile step")
    step_parser.add_argument("--controller-model", type=str, default=None)
    step_parser.add_argument("--executor-model", type=str, default=None)
    step_parser.add_argument(
        "--mutation-permission",
        choices=["REQUIRED", "OPTIONAL", "NOT_ALLOWED"],
        default=None,
        help="Operator-authorized mutation permission for this step",
    )

    # Command: status
    subparsers.add_parser("status", help="Print current orchestrator status & handoff state")

    # Command: inspect (read-only diagnostic)
    subparsers.add_parser("inspect", help="Read-only diagnostic inspection of state and recovery options")

    # Command: reset-breaker
    subparsers.add_parser("reset-breaker", help="Reset circuit breaker failure counter")

    # Command: supervised (PROMPT #032)
    sup_parser = subparsers.add_parser(
        "supervised",
        help="Run a single bounded, supervised coding task via certified Architecture B",
    )
    sup_parser.add_argument(
        "--objective", "-o",
        type=str,
        required=True,
        help="Single bounded coding objective",
    )
    sup_parser.add_argument(
        "--allowed-paths", "-a",
        type=str,
        required=True,
        help="Comma-separated relative paths authorized for file mutation",
    )
    sup_parser.add_argument(
        "--readonly-deps", "-r",
        type=str,
        default="",
        help="Comma-separated relative paths included as read-only snapshot dependencies",
    )
    sup_parser.add_argument(
        "--verification-cmd", "-v",
        type=str,
        default=None,
        help="Explicit verification command to execute inside the container sandbox",
    )
    sup_parser.add_argument(
        "--mutation-permission", "-m",
        choices=["REQUIRED", "OPTIONAL", "NOT_ALLOWED"],
        default="REQUIRED",
        help="Mutation expectation for this objective (default: REQUIRED)",
    )
    sup_parser.add_argument(
        "--workspace-root", "-w",
        type=str,
        default=None,
        help="Explicit workspace root (default: current working directory)",
    )
    sup_parser.add_argument(
        "--max-tool-iterations",
        type=int,
        default=25,
        help="Maximum tool iterations inside the container (default: 25)",
    )
    sup_parser.add_argument(
        "--task-id",
        type=str,
        default=None,
        help="Optional unique task namespace identifier (default: auto-generated timestamp)",
    )
    sup_parser.add_argument(
        "--controller-model",
        type=str,
        default=None,
        help="Model override for the Controller",
    )
    sup_parser.add_argument(
        "--executor-model",
        type=str,
        default=None,
        help="Model override for the Executor",
    )

    return parser

def main() -> None:
    parser = create_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    config = OrchestratorConfig()

    if hasattr(args, "controller_model") and args.controller_model:
        config.controller_model = args.controller_model
    if hasattr(args, "executor_model") and args.executor_model:
        config.executor_model = args.executor_model
    if hasattr(args, "no_autocommit") and args.no_autocommit:
        config.git_autocommit = False

    engine = OrchestratorEngine(config)

    if args.command == "init":
        engine.initialize_workspace(
            master_outcome=args.master_outcome,
            definition_of_done=args.definition_of_done,
        )
        print(f"Workspace initialized successfully. View {config.handoff_filename} for state.")

    elif args.command == "inspect":
        diag = engine.inspect_state()
        print("==================================================")
        print("  ORCHESTRATOR PERSISTED STATE DIAGNOSIS (READ-ONLY) ")
        print("==================================================")
        print(f"State File:          {diag['state_path']}")
        print(f"Primary Exists:      {diag['state_exists']}")
        print(f"Primary Valid:       {diag['state_valid']}")
        print(f"Backup File:         {diag['backup_path']}")
        print(f"Backup Exists:       {diag['backup_exists']}")
        print(f"Backup Valid:        {diag['backup_valid']}")
        print(f"In-Flight Active:    {diag['active_prompt_id'] or 'None'}")
        print(f"Recovery Status:     {diag['recovery_disposition']}")
        if diag.get("error"):
            print(f"Diagnostic Error:    {diag['error']}")
        print("==================================================")

    elif args.command == "status":
        state = engine.handoff.load_state()
        print("==================================================")
        print("    DUAL-HERMES ORCHESTRATOR STATUS (V8.1)       ")
        print("==================================================")
        print(f"Master Outcome:      {state.master_outcome}")
        print(f"SDLC Stage:          {state.current_sdlc_stage}")
        print(f"Next Prompt ID:      {format_correlation_id(state.sequence_number)}")
        print(f"Last Disposition:    {state.last_disposition}")
        print(f"Consecutive Fails:   {state.consecutive_failures}/{config.max_consecutive_failures}")
        print(f"Completed Tasks:     {len(state.completed_tasks)}")
        print(f"Active In-Flight:    {state.active_prompt_id or 'None'}")
        print(f"Handoff File:        {config.handoff_path}")
        print(f"State File:          {config.state_path}")
        print("==================================================")
        if state.completed_tasks:
            print("\nRecent Completed Objectives:")
            for t in state.completed_tasks[-5:]:
                print(f"  • {t.get('prompt_id')}: {t.get('objective')} [{t.get('disposition')}]")

    elif args.command == "reset-breaker":
        state = engine.handoff.load_state()
        state.consecutive_failures = 0
        state.last_disposition = ControllerDisposition.PENDING.value
        engine.handoff.save_state(state)
        print("Circuit breaker reset to 0 consecutive failures. Loop can now resume.")

    elif args.command == "step":
        auth = None
        if hasattr(args, "mutation_permission") and args.mutation_permission:
            auth = ObjectiveAuthorization(
                objective_id=format_correlation_id(1),  # will bind to active sequence
                mutation_permission=MutationExpectation(args.mutation_permission),
                source_of_authorization="cli_operator",
            )
        disp = engine.run_step(authorization=auth)
        print(f"\nStep finished with disposition: {disp.value}")

    elif args.command == "run":
        disp = engine.run_loop(max_iterations=args.max_iterations)
        print(f"\nAutonomous run ended with final disposition: {disp.value}")

    elif args.command == "supervised":
        exit_code = handle_supervised(args)
        sys.exit(exit_code)

class APIBackedControllerClient(HermesClient):
    """Host-side client routing Controller inference directly to the configured custom API."""

    def __init__(self, workspace_root: Path, timeout: int = 120):
        super().__init__(workspace_root=workspace_root)
        self.endpoint = resolve_hermes_model_endpoint()
        self.api = LocalModelAPIClient(endpoint=self.endpoint, timeout=timeout)

    def run_query(self, prompt: str, toolsets: Optional[str] = None, model: Optional[str] = None, timeout: int = 120, yolo: bool = False) -> HermesResponse:
        if yolo:
            raise ValueError("Security violation: yolo=True is permanently prohibited for Controller.")
        raw = self.api.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            tools=None,
            model=model or self.endpoint.model,
            stream=False,
            timeout=timeout,
        )
        choice = (raw.get("choices") or [{}])[0]
        text = str((choice.get("message") or {}).get("content") or "")
        return HermesResponse(
            stdout=text,
            stderr="",
            exit_code=0,
            session_id=str(raw.get("id") or "supervised-cli-controller"),
            clean_text=text.strip(),
            is_truncated=(choice.get("finish_reason") == "length"),
        )

def handle_supervised(
    args,
    model_client: Optional[object] = None,
    controller_client: Optional[HermesClient] = None,
) -> int:
    # 1. Validate objective
    raw_objective = getattr(args, "objective", None)
    if not raw_objective or not str(raw_objective).strip():
        print("[CLI ERROR] --objective cannot be empty.", file=sys.stderr)
        return 2
    objective = str(raw_objective).strip()

    # 2. Validate workspace root
    raw_ws = getattr(args, "workspace_root", None)
    ws_root = Path(raw_ws or os.getcwd()).resolve()
    if not ws_root.is_dir():
        print(f"[CLI ERROR] Workspace root '{ws_root}' does not exist or is not a directory.", file=sys.stderr)
        return 2
    if is_symlink_or_reparse_point(ws_root):
        print(f"[CLI ERROR] Workspace root '{ws_root}' is a symlink or junction.", file=sys.stderr)
        return 2

    # 3. Validate allowed paths
    raw_allowed = getattr(args, "allowed_paths", None)
    if not raw_allowed or not str(raw_allowed).strip():
        print("[CLI ERROR] --allowed-paths must specify at least one relative path.", file=sys.stderr)
        return 2
    allowed_paths: List[str] = []
    for p in str(raw_allowed).replace(";", ",").split(","):
        p_clean = p.strip()
        if not p_clean:
            continue
        try:
            valid_p = validate_safe_relative_posix_path(p_clean)
        except Exception as exc:
            print(f"[CLI ERROR] Invalid allowed path '{p_clean}': {exc}", file=sys.stderr)
            return 2
        if is_secret_or_orchestrator_internal_path(valid_p):
            print(f"[CLI ERROR] Prohibited secret or live-state path in --allowed-paths: '{valid_p}'.", file=sys.stderr)
            return 2
        allowed_paths.append(valid_p)
    if not allowed_paths:
        print("[CLI ERROR] --allowed-paths must specify at least one valid relative path.", file=sys.stderr)
        return 2

    # 4. Validate read-only deps
    raw_ro = getattr(args, "readonly_deps", "") or ""
    readonly_deps: List[str] = []
    for p in str(raw_ro).replace(";", ",").split(","):
        p_clean = p.strip()
        if not p_clean:
            continue
        try:
            valid_p = validate_safe_relative_posix_path(p_clean)
        except Exception as exc:
            print(f"[CLI ERROR] Invalid read-only dependency path '{p_clean}': {exc}", file=sys.stderr)
            return 2
        if is_secret_or_orchestrator_internal_path(valid_p):
            print(f"[CLI ERROR] Prohibited secret or live-state path in --readonly-deps: '{valid_p}'.", file=sys.stderr)
            return 2
        readonly_deps.append(valid_p)

    # 5. Validate mutation permission & verification requirements
    mut_perm_str = getattr(args, "mutation_permission", "REQUIRED") or "REQUIRED"
    try:
        mut_perm = MutationExpectation(mut_perm_str)
    except ValueError:
        print(f"[CLI ERROR] Invalid --mutation-permission '{mut_perm_str}'.", file=sys.stderr)
        return 2

    verif_cmd_raw = getattr(args, "verification_cmd", None)
    verif_cmd = str(verif_cmd_raw).strip() if verif_cmd_raw else ""
    if mut_perm in (MutationExpectation.REQUIRED, MutationExpectation.OPTIONAL) and not verif_cmd:
        print("[CLI ERROR] --verification-cmd is mandatory for mutating tasks.", file=sys.stderr)
        return 2

    verif_reqs = [verif_cmd] if verif_cmd else []

    # 6. Check Docker availability & cached image
    docker_ok, docker_reason = DockerSandboxContainer.check_runtime_prerequisites(DEFAULT_SANDBOX_IMAGE)
    if not docker_ok:
        print(f"[CLI ERROR] Docker sandbox runtime unavailable: {docker_reason}", file=sys.stderr)
        return 3

    # 7. Isolated task directory outside the workspace
    task_id = getattr(args, "task_id", None) or f"task_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    task_dir = Path(tempfile.gettempdir()).resolve() / f"archb_task_{task_id}"
    task_dir.mkdir(parents=True, exist_ok=True)

    config = OrchestratorConfig(
        workspace_root=ws_root,
        handoff_filename=str(task_dir / "TASK_HANDOFF.md"),
        state_filename=str(task_dir / ".task_state.json"),
        log_dirname=str(task_dir / "logs"),
        git_autocommit=False,
        allowed_mutation_paths=allowed_paths,
    )
    if hasattr(args, "controller_model") and args.controller_model:
        config.controller_model = args.controller_model
    if hasattr(args, "executor_model") and args.executor_model:
        config.executor_model = args.executor_model

    # 8. Build trusted authorization
    auth = ObjectiveAuthorization(
        objective_id="PROMPT #001",
        mutation_permission=mut_perm,
        allowed_paths=allowed_paths,
        readonly_snapshot_paths=readonly_deps,
        verification_requirements=verif_reqs,
        requires_verification=bool(verif_reqs),
        source_of_authorization="supervised_operator_cli",
    )

    # 9. Instantiate certified Architecture B components
    backend = DockerExecutionBackend(
        workspace_root=ws_root,
        model_client=model_client,
        max_tool_iterations=getattr(args, "max_tool_iterations", 25),
    )
    verifier = DockerSandboxVerificationAdapter(backend, reuse_last_turn_result=True)
    engine = OrchestratorEngine(
        config=config,
        verification_adapter=verifier,
        execution_backend=backend,
    )
    if controller_client is not None:
        engine.client = controller_client
        engine.controller.client = controller_client
    elif model_client is None:
        # Production CLI invocation: route Controller queries to the configured custom API
        ctrl_client = APIBackedControllerClient(workspace_root=ws_root, timeout=config.controller_timeout)
        engine.client = ctrl_client
        engine.controller.client = ctrl_client

    # 10. Run bounded supervised step
    print(f"[SUPERVISED CLI] Dispatching task '{task_id}' via Architecture B...")
    print(f"  Workspace:    {ws_root}")
    print(f"  Objective:    {objective}")
    print(f"  Allowed:      {allowed_paths}")
    print(f"  Read-only:    {readonly_deps}")
    print(f"  Verification: {verif_reqs}")
    print(f"  Task State:   {task_dir}")

    engine.initialize_workspace(
        master_outcome=objective,
        definition_of_done=f"Objective verified via {verif_reqs}",
    )
    disp = engine.run_step(authorization=auth)

    sync_res = getattr(backend, "last_sync_result", None)
    if disp == ControllerDisposition.PASS:
        print(f"\n[SUPERVISED CLI] PASS: Task '{task_id}' completed successfully.")
        if sync_res and sync_res.applied:
            print(f"  Transaction ID: {sync_res.transaction_id}")
            print(f"  Created files:  {sync_res.created_files}")
            print(f"  Modified files: {sync_res.modified_files}")
            print(f"  Deleted files:  {sync_res.deleted_files}")
            print(f"  Git status:     Changes applied to working tree without Git staging or commit.")
        return 0
    elif disp == ControllerDisposition.FAIL:
        print(f"\n[SUPERVISED CLI] FAIL: Task '{task_id}' did not pass verification or reconciliation.", file=sys.stderr)
        return 1
    elif disp == ControllerDisposition.BLOCKED:
        print(f"\n[SUPERVISED CLI] BLOCKED: Task '{task_id}' was blocked by safety gates.", file=sys.stderr)
        return 4
    else:
        print(f"\n[SUPERVISED CLI] {disp.value}: Task ended with disposition {disp.value}.", file=sys.stderr)
        return 1

if __name__ == "__main__":
    main()
