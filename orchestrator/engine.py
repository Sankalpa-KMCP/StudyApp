import datetime
import time
from typing import Callable, Optional
from orchestrator.circuit_breaker import CircuitBreaker
from orchestrator.config import OrchestratorConfig
from orchestrator.controller import Controller
from orchestrator.executor import Executor
from orchestrator.git_manager import GitManager
from orchestrator.handoff import HandoffManager, CompletedTask
from orchestrator.hermes_client import HermesClient
from orchestrator.schema import ControllerDisposition, format_correlation_id

class OrchestratorEngine:
    def __init__(
        self,
        config: Optional[OrchestratorConfig] = None,
        on_log: Optional[Callable[[str], None]] = None,
    ):
        self.config = config or OrchestratorConfig()
        self.on_log = on_log or (lambda msg: print(msg, flush=True))

        self.client = HermesClient(
            hermes_bin=self.config.hermes_bin,
            workspace_root=self.config.workspace_root,
        )
        self.git = GitManager(self.config.workspace_root)
        self.handoff = HandoffManager(self.config.handoff_path, self.config.state_path)
        self.breaker = CircuitBreaker(self.config.max_consecutive_failures)
        self.controller = Controller(self.config, self.client)
        self.executor = Executor(self.config, self.client)

    def log(self, message: str) -> None:
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.on_log(f"[{timestamp}] {message}")

    def initialize_workspace(self, master_outcome: str, definition_of_done: str) -> None:
        state = self.handoff.load_state()
        state.master_outcome = master_outcome
        state.definition_of_done = definition_of_done
        state.consecutive_failures = 0
        state.sequence_number = 1
        state.last_disposition = ControllerDisposition.PENDING.value
        state.completed_tasks = []
        self.handoff.save_state(state)
        self.handoff.write_handoff_doc(
            state,
            git_branch=self.git.get_branch(),
            git_head=self.git.get_head(),
            working_tree=self.git.get_status_summary(),
            latest_validation="Workspace initialized",
            next_action_summary="Ready for PROMPT #001",
        )
        self.log(f"Initialized autonomous orchestrator with master outcome: '{master_outcome}'")

    def run_step(self, previous_failure_context: Optional[str] = None) -> ControllerDisposition:
        state = self.handoff.load_state()

        # Check circuit breaker
        breaker_status = self.breaker.check(state.consecutive_failures)
        if breaker_status.is_blocked:
            self.log(f"[CIRCUIT BREAKER] {breaker_status.reason}")
            state.last_disposition = ControllerDisposition.BLOCKED.value
            self.handoff.save_state(state)
            return ControllerDisposition.BLOCKED

        prompt_id = format_correlation_id(state.sequence_number)
        self.log(f"=== Starting Step for {prompt_id} ===")

        # Step 1: Controller formulates bounded prompt
        self.log(f"Controller (Hermes) formulating bounded objective for {prompt_id}...")
        handoff_content = (
            self.config.handoff_path.read_text(encoding="utf-8")
            if self.config.handoff_path.is_file()
            else ""
        )
        git_diff = self.git.get_diff_stat()

        objective_title, prompt_body = self.controller.formulate_next_prompt(
            sequence_number=state.sequence_number,
            master_outcome=state.master_outcome,
            definition_of_done=state.definition_of_done,
            handoff_content=handoff_content,
            git_diff=git_diff,
            previous_failure_context=previous_failure_context,
        )

        state.active_prompt_id = prompt_id
        state.active_objective = objective_title
        self.handoff.save_state(state)

        self.log(f"Objective selected: '{objective_title}'")
        log_prompt_path = self.config.log_dir / f"{prompt_id.replace(' ', '_')}_dispatch.txt"
        log_prompt_path.write_text(prompt_body, encoding="utf-8")

        # Step 2: Executor executes the prompt in isolated environment
        self.log(f"Executor (Hermes) executing {prompt_id} with tools [{self.config.executor_toolsets}]...")
        t0 = time.time()
        exec_resp = self.executor.execute_prompt(prompt_id, prompt_body)
        duration = time.time() - t0
        self.log(f"Executor finished in {duration:.1f}s (Exit code: {exec_resp.exit_code})")

        log_result_path = self.config.log_dir / f"{prompt_id.replace(' ', '_')}_result.txt"
        log_result_path.write_text(exec_resp.stdout or exec_resp.clean_text, encoding="utf-8")

        # Step 3: Correlation verification
        valid_corr, corr_err = self.breaker.verify_correlation(prompt_id, exec_resp.clean_text)
        if not valid_corr:
            self.log(f"[CORRELATION WARNING] {corr_err}")

        # Step 4: Controller reconciles the evidence
        self.log(f"Controller (Hermes) reconciling evidence and audit diffs...")
        diff_stat_now = self.git.get_diff_stat()
        result = self.controller.reconcile_result(
            prompt_id=prompt_id,
            objective=objective_title,
            executor_output=exec_resp.clean_text,
            git_diff_stat=diff_stat_now,
        )

        disposition = result.controller_disposition
        self.log(f"Controller Disposition: {disposition.value}")

        # Step 5: Handle disposition
        if disposition == ControllerDisposition.PASS:
            state.consecutive_failures = 0
            state.last_disposition = ControllerDisposition.PASS.value

            changed_files = self.git.get_changed_files()
            if self.config.git_autocommit:
                success, commit_msg = self.git.commit_verified(prompt_id, objective_title)
                self.log(f"Git: {commit_msg}")

            # Record task completion
            now_iso = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            state.completed_tasks.append({
                "prompt_id": prompt_id,
                "objective": objective_title,
                "files_changed": changed_files,
                "disposition": disposition.value,
                "timestamp": now_iso,
            })

            # Advance monotonic prompt sequence
            state.sequence_number += 1
            state.active_prompt_id = None
            state.active_objective = None
            self.handoff.save_state(state)

            self.handoff.write_handoff_doc(
                state,
                git_branch=self.git.get_branch(),
                git_head=self.git.get_head(),
                working_tree=self.git.get_status_summary(),
                latest_validation=f"Verified: {objective_title} (All tests passed)",
                next_action_summary=f"Proceeding to {format_correlation_id(state.sequence_number)}",
            )
            return ControllerDisposition.PASS

        elif disposition in (ControllerDisposition.FAIL, ControllerDisposition.PARTIAL):
            state.consecutive_failures += 1
            state.last_disposition = disposition.value
            self.handoff.save_state(state)
            self.log(f"Task {prompt_id} {disposition.value}. Failure count: {state.consecutive_failures}/{self.config.max_consecutive_failures}")

            self.handoff.write_handoff_doc(
                state,
                git_branch=self.git.get_branch(),
                git_head=self.git.get_head(),
                working_tree=self.git.get_status_summary(),
                latest_validation=f"{disposition.value}: Needs repair before landing",
                next_action_summary=f"Dispatching repair prompt for {prompt_id}",
            )
            return disposition

        else:  # BLOCKED
            state.last_disposition = ControllerDisposition.BLOCKED.value
            self.handoff.save_state(state)
            self.log(f"Task {prompt_id} is BLOCKED. Halting autonomous loop.")
            return ControllerDisposition.BLOCKED

    def run_loop(self, max_iterations: Optional[int] = None) -> ControllerDisposition:
        limit = max_iterations if max_iterations is not None else self.config.max_iterations
        self.log(f"Starting autonomous loop (Max iterations: {limit if limit > 0 else 'infinite'})...")

        iteration = 0
        failure_context = None

        while True:
            if 0 < limit <= iteration:
                self.log(f"Reached iteration limit ({limit}). Pausing loop.")
                return ControllerDisposition.PENDING

            iteration += 1
            self.log(f"\n--- Iteration #{iteration} ---")

            disp = self.run_step(previous_failure_context=failure_context)

            if disp == ControllerDisposition.PASS:
                failure_context = None
            elif disp in (ControllerDisposition.FAIL, ControllerDisposition.PARTIAL):
                state = self.handoff.load_state()
                prompt_id = format_correlation_id(state.sequence_number)
                log_result_path = self.config.log_dir / f"{prompt_id.replace(' ', '_')}_result.txt"
                if log_result_path.is_file():
                    failure_context = log_result_path.read_text(encoding="utf-8")[-2000:]
            elif disp == ControllerDisposition.BLOCKED:
                self.log("Autonomous loop halted due to BLOCKED status.")
                return ControllerDisposition.BLOCKED

            # Politeness pause between turns
            time.sleep(2)
