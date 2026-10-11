import argparse
import sys
from pathlib import Path
from orchestrator.config import OrchestratorConfig
from orchestrator.engine import OrchestratorEngine
from orchestrator.schema import ControllerDisposition, format_correlation_id

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

    # Command: status
    subparsers.add_parser("status", help="Print current orchestrator status & handoff state")

    # Command: reset-breaker
    subparsers.add_parser("reset-breaker", help="Reset circuit breaker failure counter")

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
        disp = engine.run_step()
        print(f"\nStep finished with disposition: {disp.value}")

    elif args.command == "run":
        disp = engine.run_loop(max_iterations=args.max_iterations)
        print(f"\nAutonomous run ended with final disposition: {disp.value}")

if __name__ == "__main__":
    main()
