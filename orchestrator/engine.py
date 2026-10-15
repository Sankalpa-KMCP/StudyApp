import datetime
import time
from typing import Callable, Optional
from orchestrator.circuit_breaker import CircuitBreaker
from orchestrator.config import OrchestratorConfig
from orchestrator.controller import Controller, MalformedDispatchError
from orchestrator.execution_backend import (
    BackendRuntimeType,
    ExecutionBackend,
    ExecutionBackendNotAvailableError,
    UnavailableExecutionBackend,
    TestSimulatedBackend,
)
from orchestrator.executor import Executor
from orchestrator.git_manager import GitManager
from orchestrator.handoff import HandoffManager, CompletedTask, CorruptedStateError, StateLockError
from orchestrator.hermes_client import HermesClient
from orchestrator.schema import (
    AuthorizationEscalationError,
    ControllerDisposition,
    MissingAuthorizationError,
    MutationExpectation,
    ObjectiveAuthorization,
    ObservedMutations,
    TrustedVerificationPlan,
    VerificationResult,
    format_correlation_id,
)
from orchestrator.verification import (
    DeterministicVerificationAdapter,
    NoOpVerificationAdapter,
    VerificationAdapter,
)

class OrchestratorEngine:
    def __init__(
        self,
        config: Optional[OrchestratorConfig] = None,
        on_log: Optional[Callable[[str], None]] = None,
        verification_adapter: Optional[VerificationAdapter] = None,
        execution_backend: Optional[ExecutionBackend] = None,
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

        # Default verifier is strictly fail-closed NoOpVerificationAdapter
        self.verifier = verification_adapter or NoOpVerificationAdapter()

        # Default execution backend is strictly fail-closed UnavailableExecutionBackend
        self.execution_backend = execution_backend or UnavailableExecutionBackend()

        # Bind executor exclusively to the validated execution backend
        self.executor = Executor(self.config, backend=self.execution_backend)

    def log(self, message: str) -> None:
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        self.on_log(f"[{timestamp}] {message}")

    def inspect_state(self) -> dict:
        """Read-only diagnostic inspection of current persisted state."""
        return self.handoff.diagnose_state()

    def initialize_workspace(self, master_outcome: str, definition_of_done: str) -> None:
        try:
            state = self.handoff.load_state()
        except CorruptedStateError as e:
            self.log(f"[CORRUPTED STATE] {e}")
            raise

        state.master_outcome = master_outcome
        state.definition_of_done = definition_of_done
        state.consecutive_failures = 0
        state.sequence_number = 1
        state.last_disposition = ControllerDisposition.PENDING.value
        state.completed_tasks = []
        state.active_prompt_id = None
        state.active_objective = None
        state.active_mutation_expectation = None
        state.active_authorization = None
        state.current_task_objective = None
        state.current_task_authorization = None
        state.current_task_attempt = 1

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

    def run_step(
        self,
        previous_failure_context: Optional[str] = None,
        authorization: Optional[ObjectiveAuthorization] = None,
    ) -> ControllerDisposition:
        """
        Execute a single bounded controller-executor step.
        Enforces:
        - Execution-scoped single-writer locking across full lifecycle:
          LOAD -> CLAIM -> PLAN -> DISPATCH -> RECONCILE -> PERSIST.
        - Execution Gate evaluated BEFORE prompt formulation (no planning when backend is uncertified).
        - Fail-closed crash & in-flight state detection (prevents overwriting unresolved work).
        - Controller-owned authorization contracts (model cannot escalate mutation permissions).
        - Immutable authorization retained across failure retries.
        - Fail-closed verification provenance (unconfigured verifier never fabricates passing tests).
        - Pre-execution baseline capture and NUL-safe observed mutation diffing.
        """
        # Step 0: Acquire execution-scoped single-writer lifecycle lock
        try:
            with self.handoff.execution_lifecycle_lock():
                return self._run_step_locked(
                    previous_failure_context=previous_failure_context,
                    authorization=authorization,
                )
        except StateLockError as e:
            self.log(f"[STATE LOCK CONFLICT] {e}")
            return ControllerDisposition.BLOCKED

    def _run_step_locked(
        self,
        previous_failure_context: Optional[str] = None,
        authorization: Optional[ObjectiveAuthorization] = None,
    ) -> ControllerDisposition:
        # Step 1: Fail-closed state loading
        try:
            state = self.handoff.load_state()
        except CorruptedStateError as e:
            self.log(f"[CORRUPTED STATE] {e}")
            return ControllerDisposition.BLOCKED

        # Step 2: Crash and In-Flight State Detection (Section E)
        if state.active_prompt_id is not None:
            self.log(
                f"[IN-FLIGHT CRASH DETECTED] Detected unresolved in-flight prompt '{state.active_prompt_id}' "
                f"(objective: '{state.active_objective}'). Automatic overwrite or replay is prohibited. "
                "Operator recovery required."
            )
            state.last_disposition = ControllerDisposition.BLOCKED.value
            self.handoff.save_state(state)
            return ControllerDisposition.BLOCKED

        # Step 3: Execution Gate Enforced BEFORE Planning (Section A & B)
        # Prevents running any model planning or execution when no certified backend exists.
        is_isolated = self.execution_backend.is_certified_isolated or (
            self.execution_backend.runtime_type == BackendRuntimeType.TEST_SIMULATED
        )
        if not is_isolated:
            self.log(
                "[SECURITY GATE] Execution refused: No certified isolated backend configured "
                f"(backend runtime: {self.execution_backend.runtime_type.value}). Host-local --yolo "
                "execution is permanently prohibited."
            )
            state.last_disposition = ControllerDisposition.BLOCKED.value
            self.handoff.save_state(state)
            self.handoff.write_handoff_doc(
                state,
                git_branch=self.git.get_branch(),
                git_head=self.git.get_head(),
                working_tree=self.git.get_status_summary(),
                latest_validation="BLOCKED: No certified isolated execution backend is available.",
                next_action_summary="Configure a certified isolated container or VM execution backend.",
            )
            return ControllerDisposition.BLOCKED

        # Step 4: Authorization Origin & Stability Across Retries (Section E & F)
        effective_auth = None
        if authorization is not None:
            # Operator supplied authorization for this task
            effective_auth = authorization
            state.current_task_authorization = authorization.to_dict()
            state.current_task_attempt = 1
        elif state.current_task_authorization is not None:
            # This is an active task retry! Preserve original authorization!
            effective_auth = ObjectiveAuthorization.from_dict(state.current_task_authorization)
        else:
            # Missing operator authorization: model cannot self-authorize mutation authority!
            self.log(
                "[MISSING AUTHORIZATION BLOCKER] Objective authorization is missing. "
                "Model cannot self-authorize mutation authority. Operator authorization required before dispatch."
            )
            state.last_disposition = ControllerDisposition.BLOCKED.value
            self.handoff.save_state(state)
            return ControllerDisposition.BLOCKED

        # Step 5: Check circuit breaker
        breaker_status = self.breaker.check(state.consecutive_failures)
        if breaker_status.is_blocked:
            self.log(f"[CIRCUIT BREAKER] {breaker_status.reason}")
            state.last_disposition = ControllerDisposition.BLOCKED.value
            self.handoff.save_state(state)
            return ControllerDisposition.BLOCKED

        prompt_id = format_correlation_id(state.sequence_number)
        self.log(f"=== Starting Step for {prompt_id} (Attempt #{state.current_task_attempt}) ===")

        # Step 6: Controller formulates bounded prompt under authorization bounds
        self.log(f"Controller (Hermes) formulating bounded objective for {prompt_id}...")
        handoff_content = (
            self.config.handoff_path.read_text(encoding="utf-8")
            if self.config.handoff_path.is_file()
            else ""
        )
        git_diff = self.git.get_diff_stat()

        try:
            objective_title, prompt_body, effective_mutation = self.controller.formulate_next_prompt(
                sequence_number=state.sequence_number,
                master_outcome=state.master_outcome,
                definition_of_done=state.definition_of_done,
                handoff_content=handoff_content,
                git_diff=git_diff,
                authorization=effective_auth,
                previous_failure_context=previous_failure_context,
            )
        except AuthorizationEscalationError as e:
            self.log(f"[AUTHORIZATION ESCALATION REJECTED] {e}")
            state.consecutive_failures += 1
            state.last_disposition = ControllerDisposition.FAIL.value
            self.handoff.save_state(state)
            self.handoff.write_handoff_doc(
                state,
                git_branch=self.git.get_branch(),
                git_head=self.git.get_head(),
                working_tree=self.git.get_status_summary(),
                latest_validation=f"FAIL: Authorization escalation rejected: {str(e)[:200]}",
                next_action_summary=f"Re-formulate within authorized bounds for {prompt_id}",
            )
            return ControllerDisposition.FAIL
        except MalformedDispatchError as e:
            self.log(f"[MALFORMED DISPATCH] {e}")
            state.consecutive_failures += 1
            state.last_disposition = ControllerDisposition.FAIL.value
            self.handoff.save_state(state)
            self.handoff.write_handoff_doc(
                state,
                git_branch=self.git.get_branch(),
                git_head=self.git.get_head(),
                working_tree=self.git.get_status_summary(),
                latest_validation=f"FAIL: Malformed controller dispatch: {str(e)[:200]}",
                next_action_summary=f"Re-formulate valid dispatch for {prompt_id}",
            )
            return ControllerDisposition.FAIL

        # Claim work in persistent state before dispatching
        state.active_prompt_id = prompt_id
        state.active_objective = objective_title
        state.active_mutation_expectation = effective_mutation.value
        state.current_task_objective = objective_title
        self.handoff.save_state(state)

        self.log(f"Objective selected: '{objective_title}' [Mutation: {effective_mutation.value}]")
        formatted_dispatch = self.executor.format_prompt(prompt_id, prompt_body)
        log_prompt_path = self.config.log_dir / f"{prompt_id.replace(' ', '_')}_dispatch.txt"
        log_prompt_path.write_text(formatted_dispatch, encoding="utf-8")

        # Step 7: Capture pre-execution baseline & resolve canonical verification plan BEFORE dispatch
        baseline = self.git.capture_baseline()
        from orchestrator.docker_backend import resolve_canonical_verification_plan
        from orchestrator.git_manager import is_path_authorized
        from orchestrator.workspace_sync import is_protected_from_mutation

        try:
            verif_plan = resolve_canonical_verification_plan(authorization=effective_auth)
        except ValueError as verif_plan_err:
            self.log(f"[INVALID VERIFICATION PLAN] {verif_plan_err}")
            state.consecutive_failures += 1
            state.last_disposition = ControllerDisposition.FAIL.value
            state.active_prompt_id = None
            self.handoff.save_state(state)
            return ControllerDisposition.FAIL

        # Step 8 (PHASE 1 — PREPARE): Execute prompt strictly via injected execution backend
        self.log(f"Executing {prompt_id} via {self.execution_backend.runtime_type.value} backend...")
        t0 = time.time()

        try:
            exec_resp = self.executor.execute_prompt(
                prompt_id,
                formatted_dispatch,
                authorization=effective_auth,
                verification_plan=verif_plan,
            )
        except ExecutionBackendNotAvailableError as e:
            self.log(f"[EXECUTION BACKEND REFUSED] {e}")
            state.last_disposition = ControllerDisposition.BLOCKED.value
            state.active_prompt_id = None
            self.handoff.save_state(state)
            self.handoff.write_handoff_doc(
                state,
                git_branch=self.git.get_branch(),
                git_head=self.git.get_head(),
                working_tree=self.git.get_status_summary(),
                latest_validation=f"BLOCKED: Execution backend refused: {str(e)[:200]}",
                next_action_summary=f"Configure certified execution backend for {prompt_id}",
            )
            return ControllerDisposition.BLOCKED
        except Exception as e:
            self.log(f"[EXECUTION BACKEND ERROR] {e}")
            state.consecutive_failures += 1
            state.last_disposition = ControllerDisposition.FAIL.value
            state.active_prompt_id = None
            self.handoff.save_state(state)
            self.handoff.write_handoff_doc(
                state,
                git_branch=self.git.get_branch(),
                git_head=self.git.get_head(),
                working_tree=self.git.get_status_summary(),
                latest_validation=f"FAIL: Execution backend failed: {str(e)[:200]}",
                next_action_summary=f"Repair execution backend for {prompt_id}",
            )
            return ControllerDisposition.FAIL

        duration = time.time() - t0
        self.log(f"Executor finished in {duration:.1f}s (Exit code: {exec_resp.exit_code})")

        log_result_path = self.config.log_dir / f"{prompt_id.replace(' ', '_')}_result.txt"
        log_result_path.write_text(exec_resp.stdout or exec_resp.clean_text, encoding="utf-8")

        # Step 9: Hardened correlation verification
        valid_corr, corr_err = self.breaker.verify_correlation(prompt_id, exec_resp.clean_text)
        if not valid_corr:
            self.log(f"[CORRELATION WARNING] {corr_err}")

        # Step 10: Compute observed/proposed mutations relative to baseline
        prepared_exec = getattr(self.execution_backend, "last_prepared_execution", None)
        if prepared_exec is not None:
            p_delta = prepared_exec.delta
            unauth: list[str] = []
            for p_path in p_delta.all_affected_paths:
                if is_protected_from_mutation(p_path, effective_auth):
                    unauth.append(p_path)
                elif effective_auth.allowed_paths and not is_path_authorized(p_path, effective_auth.allowed_paths):
                    unauth.append(p_path)
            if getattr(prepared_exec, "unauthorized_deltas", None):
                unauth.extend(prepared_exec.unauthorized_deltas)
            observed_mutations = ObservedMutations(
                tracked_modified=list(p_delta.modified),
                untracked_added=list(p_delta.created),
                deleted=list(p_delta.deleted),
                staged=[],
                pre_existing_modified=[],
                has_deltas=p_delta.has_changes,
                unauthorized_deltas=sorted(set(unauth)),
            )
            changed_files_now = p_delta.all_affected_paths
            diff_stat_now = (
                f"Prepared delta: {len(p_delta.modified)} modified, "
                f"{len(p_delta.created)} created, {len(p_delta.deleted)} deleted"
                if p_delta.has_changes else ""
            )
        else:
            diff_stat_now = self.git.get_diff_stat()
            changed_files_now = self.git.get_changed_files()
            observed_mutations = self.git.compute_observed_mutations(
                baseline=baseline,
                allowed_paths=effective_auth.allowed_paths,
            )

        # Step 11: Run independent trusted verification adapter using the SAME canonical plan
        verification_result = self.verifier.verify(prompt_id, verif_plan)

        # Step 12: Controller reconciles evidence against authorized mutation expectation
        self.log("Controller (Hermes) reconciling evidence and audit diffs...")
        result = self.controller.reconcile_result(
            prompt_id=prompt_id,
            objective=objective_title,
            executor_output=exec_resp.clean_text,
            git_diff_stat=diff_stat_now,
            changed_files=changed_files_now,
            executor_exit_code=exec_resp.exit_code,
            correlation_valid=valid_corr,
            correlation_error=corr_err,
            is_truncated=exec_resp.is_truncated,
            mutation_expectation=effective_mutation,
            authorization=effective_auth,
            verification_result=verification_result,
            observed_mutations=observed_mutations,
        )

        disposition = result.controller_disposition

        # Step 13 (PHASE 2 — ACCEPT AND APPLY): Promote prepared changes ONLY when all gates pass!
        if disposition == ControllerDisposition.PASS and prepared_exec is not None:
            if hasattr(self.execution_backend, "commit_prepared_execution"):
                try:
                    self.execution_backend.commit_prepared_execution(
                        expected_objective_id=prompt_id,
                        correlation_valid=valid_corr,
                        controller_disposition=disposition,
                        verification_result=verification_result,
                        authorization=effective_auth,
                    )
                except Exception as sync_err:
                    self.log(f"[PHASE 2 PROMOTION REJECTED] {sync_err}")
                    disposition = ControllerDisposition.FAIL
                    result.controller_disposition = ControllerDisposition.FAIL
                    result.limitations.append(f"Phase 2 promotion rejected: {sync_err}")
        elif disposition != ControllerDisposition.PASS and hasattr(self.execution_backend, "discard_prepared_execution"):
            self.execution_backend.discard_prepared_execution(
                reason=f"Controller disposition={disposition.value}; correlation_valid={valid_corr}"
            )

        self.log(f"Controller Disposition: {disposition.value}")

        # Step 13: Handle disposition & update persistent state (Section E & F)
        if disposition == ControllerDisposition.PASS:
            state.consecutive_failures = 0
            state.last_disposition = ControllerDisposition.PASS.value

            now_iso = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            state.completed_tasks.append({
                "prompt_id": prompt_id,
                "objective": objective_title,
                "files_changed": changed_files_now,
                "disposition": disposition.value,
                "mutation_expectation": effective_mutation.value,
                "timestamp": now_iso,
            })

            # Task completed cleanly: advance sequence & clear active task state
            state.sequence_number += 1
            state.active_prompt_id = None
            state.active_objective = None
            state.active_mutation_expectation = None
            state.active_authorization = None
            state.current_task_objective = None
            state.current_task_authorization = None
            state.current_task_attempt = 1
            self.handoff.save_state(state)

            self.handoff.write_handoff_doc(
                state,
                git_branch=self.git.get_branch(),
                git_head=self.git.get_head(),
                working_tree=self.git.get_status_summary(),
                latest_validation=f"Verified: {objective_title} (All checks passed; unstaged/uncommitted for review)",
                next_action_summary=f"Proceeding to {format_correlation_id(state.sequence_number)}",
            )
            return ControllerDisposition.PASS

        elif disposition in (ControllerDisposition.FAIL, ControllerDisposition.PARTIAL):
            state.consecutive_failures += 1
            state.last_disposition = disposition.value
            # Normal completion of failed turn: clear in-flight flag, but RETAIN task authorization for retry!
            state.active_prompt_id = None
            state.current_task_attempt += 1
            self.handoff.save_state(state)
            self.log(f"Task {prompt_id} {disposition.value}. Failure count: {state.consecutive_failures}/{self.config.max_consecutive_failures}")

            self.handoff.write_handoff_doc(
                state,
                git_branch=self.git.get_branch(),
                git_head=self.git.get_head(),
                working_tree=self.git.get_status_summary(),
                latest_validation=f"{disposition.value}: Needs repair before landing ({', '.join(result.limitations)})",
                next_action_summary=f"Dispatching repair prompt for {prompt_id} (Attempt #{state.current_task_attempt})",
            )
            return disposition

        else:  # BLOCKED
            state.last_disposition = ControllerDisposition.BLOCKED.value
            state.active_prompt_id = None
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

            time.sleep(2)
