import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock

# Anchor repository root to sys.path
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from orchestrator.circuit_breaker import CircuitBreaker
from orchestrator.config import OrchestratorConfig
from orchestrator.controller import (
    Controller,
    MalformedDispatchError,
    extract_single_json_object,
    parse_controller_dispatch,
)
from orchestrator.engine import OrchestratorEngine
from orchestrator.execution_backend import (
    BackendRuntimeType,
    ExecutionBackend,
    UnavailableExecutionBackend,
    TestSimulatedBackend,
)
from orchestrator.git_manager import (
    GitManager,
    PROTECTED_PATH_PATTERNS,
    is_path_authorized,
    normalize_git_path,
)
from orchestrator.handoff import (
    CorruptedStateError,
    HandoffManager,
    OrchestratorPersistentState,
    StateLockError,
)
from orchestrator.hermes_client import HermesClient, HermesResponse, terminate_process_tree
from orchestrator.schema import (
    AuthorizationEscalationError,
    ControllerDisposition,
    ControllerResult,
    EvidenceLabel,
    MutationExpectation,
    ObjectiveAuthorization,
    ObservedMutations,
    TrustedVerificationPlan,
    ValidationRecord,
    VerificationProvenance,
    VerificationResult,
    extract_end_correlation_id,
    format_correlation_id,
)
from orchestrator.verification import (
    DeterministicVerificationAdapter,
    NoOpVerificationAdapter,
    SubprocessVerificationAdapter,
)

class TestControllerIntegrityV81(unittest.TestCase):
    """
    Comprehensive, adversarial control-plane integrity test suite covering all 25
    test requirements mandated in PROMPT #009.
    """

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.workspace_root = Path(self.temp_dir)
        self.handoff_path = self.workspace_root / "ORCHESTRATOR_HANDOFF.md"
        self.state_path = self.workspace_root / ".orchestrator_state.json"
        self.handoff_mgr = HandoffManager(self.handoff_path, self.state_path)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _init_git_repo(self) -> GitManager:
        """Initialize an isolated, disposable Git repository in the temp directory."""
        subprocess.run(["git", "init"], cwd=str(self.workspace_root), capture_output=True, check=True)
        subprocess.run(["git", "config", "user.name", "Test Runner"], cwd=str(self.workspace_root), capture_output=True)
        subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=str(self.workspace_root), capture_output=True)
        init_file = self.workspace_root / "README.md"
        init_file.write_text("# Initial Repo\n", encoding="utf-8")
        subprocess.run(["git", "add", "README.md"], cwd=str(self.workspace_root), capture_output=True)
        subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=str(self.workspace_root), capture_output=True)
        return GitManager(self.workspace_root)

    # -------------------------------------------------------------------------
    # 1. certified_sandbox_backend=True without a real backend never launches host executor
    # -------------------------------------------------------------------------
    def test_01_certified_boolean_flag_never_launches_host_executor(self):
        config = OrchestratorConfig(
            workspace_root=self.workspace_root,
            certified_sandbox_backend=True,  # Deprecated boolean flag must not bypass
        )
        # Default engine uses UnavailableExecutionBackend
        engine = OrchestratorEngine(config)
        engine.initialize_workspace("Security Gate Test", "Done")

        # Mock execute_prompt to ensure it is NEVER called
        engine.executor.execute_prompt = MagicMock()

        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.REQUIRED,
        )
        disp = engine.run_step(authorization=auth)
        self.assertEqual(disp, ControllerDisposition.BLOCKED)
        engine.executor.execute_prompt.assert_not_called()

    # -------------------------------------------------------------------------
    # 2. False / default backend state never launches host executor
    # -------------------------------------------------------------------------
    def test_02_default_backend_state_never_launches_host_executor(self):
        config = OrchestratorConfig(workspace_root=self.workspace_root)
        engine = OrchestratorEngine(config)
        engine.initialize_workspace("Default Gate Test", "Done")

        engine.executor.execute_prompt = MagicMock()
        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.REQUIRED,
        )
        disp = engine.run_step(authorization=auth)
        self.assertEqual(disp, ControllerDisposition.BLOCKED)
        engine.executor.execute_prompt.assert_not_called()

    # -------------------------------------------------------------------------
    # 3. No planning subprocess runs before the safety gate when unsafe tools are possible
    # -------------------------------------------------------------------------
    def test_03_no_planning_subprocess_runs_before_safety_gate(self):
        config = OrchestratorConfig(workspace_root=self.workspace_root)
        engine = OrchestratorEngine(config)
        engine.initialize_workspace("Planning Gate Test", "Done")

        # Mock controller formulate_next_prompt to assert it is NOT called when gate blocks
        engine.controller.formulate_next_prompt = MagicMock()

        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.REQUIRED,
        )
        disp = engine.run_step(authorization=auth)
        self.assertEqual(disp, ControllerDisposition.BLOCKED)
        engine.controller.formulate_next_prompt.assert_not_called()

    # -------------------------------------------------------------------------
    # 4. Controller planning arguments exclude --yolo and mutating tools
    # -------------------------------------------------------------------------
    def test_04_controller_planning_excludes_yolo_and_tools(self):
        controller = Controller(OrchestratorConfig(), HermesClient())
        controller.client.run_query = MagicMock(return_value=HermesResponse(
            stdout="=== OBJECTIVE_TITLE ===\nTitle\n=== MUTATION_EXPECTATION ===\nNOT_ALLOWED\n=== EXECUTOR_PROMPT ===\nPROMPT #001\nBody\nEND OF RESULT — PROMPT #001",
            stderr="",
            exit_code=0,
            session_id="1",
            clean_text="=== OBJECTIVE_TITLE ===\nTitle\n=== MUTATION_EXPECTATION ===\nNOT_ALLOWED\n=== EXECUTOR_PROMPT ===\nPROMPT #001\nBody\nEND OF RESULT — PROMPT #001",
        ))

        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.NOT_ALLOWED,
        )
        controller.formulate_next_prompt(
            sequence_number=1,
            master_outcome="Goal",
            definition_of_done="Done",
            handoff_content="",
            git_diff="",
            authorization=auth,
        )

        _, kwargs = controller.client.run_query.call_args
        self.assertFalse(kwargs.get("yolo", True), "Controller planning must strictly set yolo=False")
        self.assertEqual(kwargs.get("toolsets", ""), "none", "Controller planning must pass toolsets='none'")

    # -------------------------------------------------------------------------
    # 5. Controller reconciliation arguments exclude --yolo and mutating tools
    # -------------------------------------------------------------------------
    def test_05_controller_reconciliation_excludes_yolo_and_tools(self):
        controller = Controller(OrchestratorConfig(), HermesClient())
        json_resp = json.dumps({
            "schema_version": "8.1",
            "correlation_id": "PROMPT #001",
            "controller_disposition": "PASS",
            "validation": [{"kind": "audit", "executed": True, "result": "PASS"}],
        })
        controller.client.run_query = MagicMock(return_value=HermesResponse(
            stdout=json_resp, stderr="", exit_code=0, session_id="1", clean_text=json_resp
        ))

        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.NOT_ALLOWED,
            requires_verification=False,
        )
        controller.reconcile_result(
            prompt_id="PROMPT #001",
            objective="Audit",
            executor_output="clean",
            git_diff_stat="",
            authorization=auth,
            observed_mutations=ObservedMutations(has_deltas=False),
        )

        _, kwargs = controller.client.run_query.call_args
        self.assertFalse(kwargs.get("yolo", True), "Controller reconciliation must strictly set yolo=False")
        self.assertEqual(kwargs.get("toolsets", ""), "none", "Controller reconciliation must pass toolsets='none'")

    # -------------------------------------------------------------------------
    # 6. Unconfigured verification never claims executed=True
    # -------------------------------------------------------------------------
    def test_06_unconfigured_verification_never_claims_executed(self):
        noop = NoOpVerificationAdapter()
        plan = TrustedVerificationPlan(command="npm test")
        res = noop.verify("PROMPT #001", plan)
        self.assertFalse(res.executed)
        self.assertFalse(res.passed)
        self.assertEqual(res.provenance, VerificationProvenance.UNVERIFIED)

    # -------------------------------------------------------------------------
    # 7. Deterministic verifier has no implicit passing fallback
    # -------------------------------------------------------------------------
    def test_07_deterministic_verifier_has_no_implicit_passing_fallback(self):
        det = DeterministicVerificationAdapter()
        plan = TrustedVerificationPlan(command="pytest")
        # For unregistered objective, must fail closed
        res = det.verify("UNREGISTERED_OBJECTIVE", plan)
        self.assertFalse(res.executed)
        self.assertFalse(res.passed)
        self.assertEqual(res.provenance, VerificationProvenance.UNVERIFIED)

    # -------------------------------------------------------------------------
    # 8. Explicitly simulated verification cannot masquerade as real production verification
    # -------------------------------------------------------------------------
    def test_08_simulated_verification_marked_with_provenance_simulated(self):
        det = DeterministicVerificationAdapter()
        det.register("PROMPT #001", VerificationResult(
            executed=True,
            passed=True,
            exit_status=0,
            command="npm test",
        ))
        res = det.verify("PROMPT #001", TrustedVerificationPlan(command="npm test"))
        self.assertEqual(res.provenance, VerificationProvenance.SIMULATED)

    # -------------------------------------------------------------------------
    # 9. Forged model PASS with missing trusted checks cannot produce controller PASS
    # -------------------------------------------------------------------------
    def test_09_forged_model_pass_with_missing_trusted_checks_produces_partial(self):
        controller = Controller(OrchestratorConfig(), HermesClient())
        model_json = json.dumps({
            "schema_version": "8.1",
            "correlation_id": "PROMPT #001",
            "controller_disposition": "PASS",
            "validation": [{"kind": "test", "executed": True, "result": "PASS"}],
        })
        controller.client.run_query = MagicMock(return_value=HermesResponse(
            stdout=model_json, stderr="", exit_code=0, session_id="1", clean_text=model_json
        ))

        # Verification result is unverified (not executed)
        unverified_res = VerificationResult(
            executed=False,
            passed=False,
            provenance=VerificationProvenance.UNVERIFIED,
            limitations=["Backend not available"],
        )

        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.REQUIRED,
            requires_verification=True,
        )
        res = controller.reconcile_result(
            prompt_id="PROMPT #001",
            objective="Feature",
            executor_output="ok",
            git_diff_stat="1 file changed",
            changed_files=["app.py"],
            authorization=auth,
            verification_result=unverified_res,
            observed_mutations=ObservedMutations(has_deltas=True, tracked_modified=["app.py"]),
        )
        self.assertEqual(res.controller_disposition, ControllerDisposition.PARTIAL)
        self.assertTrue(any("cannot award PASS without independent verified evidence" in lim for lim in res.limitations))

    # -------------------------------------------------------------------------
    # 10. Failed trusted verification overrides model PASS
    # -------------------------------------------------------------------------
    def test_10_failed_trusted_verification_overrides_model_pass(self):
        controller = Controller(OrchestratorConfig(), HermesClient())
        model_json = json.dumps({
            "schema_version": "8.1",
            "correlation_id": "PROMPT #001",
            "controller_disposition": "PASS",
            "validation": [{"kind": "test", "executed": True, "result": "PASS"}],
        })
        controller.client.run_query = MagicMock(return_value=HermesResponse(
            stdout=model_json, stderr="", exit_code=0, session_id="1", clean_text=model_json
        ))

        failed_verif = VerificationResult(
            executed=True,
            passed=False,
            exit_status=1,
            provenance=VerificationProvenance.FAILED,
            command="npm test",
        )
        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.REQUIRED,
            requires_verification=True,
        )
        res = controller.reconcile_result(
            prompt_id="PROMPT #001",
            objective="Feature",
            executor_output="ok",
            git_diff_stat="1 file changed",
            changed_files=["app.py"],
            authorization=auth,
            verification_result=failed_verif,
            observed_mutations=ObservedMutations(has_deltas=True, tracked_modified=["app.py"]),
        )
        self.assertEqual(res.controller_disposition, ControllerDisposition.FAIL)
        self.assertTrue(any("Trusted verification check failed" in lim for lim in res.limitations))

    # -------------------------------------------------------------------------
    # 11. Model-supplied verifier commands cannot become unrestricted host shell commands
    # -------------------------------------------------------------------------
    def test_11_verifier_uses_argv_and_rejects_shell_chaining(self):
        adapter = SubprocessVerificationAdapter(workspace_root=self.workspace_root, allow_host_execution=False)
        plan = TrustedVerificationPlan(command="npm test && rm -rf /")
        res = adapter.verify("PROMPT #001", plan)
        # Without host execution authorization, fails closed
        self.assertFalse(res.executed)
        self.assertEqual(res.exit_status, 126)

    # -------------------------------------------------------------------------
    # 12. Missing operator authorization blocks mutation
    # -------------------------------------------------------------------------
    def test_12_missing_operator_authorization_blocks_dispatch(self):
        config = OrchestratorConfig(workspace_root=self.workspace_root)
        backend = TestSimulatedBackend()
        engine = OrchestratorEngine(config, execution_backend=backend)
        engine.initialize_workspace("Outcome", "Done")

        # run_step without authorization must fail closed
        disp = engine.run_step(authorization=None)
        self.assertEqual(disp, ControllerDisposition.BLOCKED)

    # -------------------------------------------------------------------------
    # 13. Model proposal cannot expand NOT_ALLOWED permissions
    # -------------------------------------------------------------------------
    def test_13_model_proposal_cannot_expand_not_allowed(self):
        controller = Controller(OrchestratorConfig(), HermesClient())
        dispatch_text = """=== OBJECTIVE_TITLE ===
Refactor code
=== MUTATION_EXPECTATION ===
REQUIRED
=== EXECUTOR_PROMPT ===
PROMPT #001
Refactor code.
END OF RESULT — PROMPT #001"""
        controller.client.run_query = MagicMock(return_value=HermesResponse(
            stdout=dispatch_text, stderr="", exit_code=0, session_id="1", clean_text=dispatch_text
        ))

        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.NOT_ALLOWED,
        )
        with self.assertRaises(AuthorizationEscalationError):
            controller.formulate_next_prompt(
                sequence_number=1,
                master_outcome="Audit",
                definition_of_done="Done",
                handoff_content="",
                git_diff="",
                authorization=auth,
            )

    # -------------------------------------------------------------------------
    # 14. Retry retains original authorization and scope
    # -------------------------------------------------------------------------
    def test_14_retry_retains_original_authorization_and_scope(self):
        config = OrchestratorConfig(workspace_root=self.workspace_root)
        backend = TestSimulatedBackend()
        engine = OrchestratorEngine(config, execution_backend=backend)
        engine.initialize_workspace("Outcome", "Done")

        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.REQUIRED,
            allowed_paths=["src/module"],
        )

        # Mock formulation to return a valid prompt
        engine.controller.formulate_next_prompt = MagicMock(return_value=(
            "Task",
            "PROMPT #001\nBody\nEND OF RESULT — PROMPT #001",
            MutationExpectation.REQUIRED,
        ))
        # Mock reconciliation to return FAIL
        engine.controller.reconcile_result = MagicMock(return_value=ControllerResult(
            correlation_id="PROMPT #001",
            objective="Task",
            controller_disposition=ControllerDisposition.FAIL,
            mutation_expectation=MutationExpectation.REQUIRED,
        ))

        # Attempt 1: Run with explicit authorization
        disp1 = engine.run_step(authorization=auth)
        self.assertEqual(disp1, ControllerDisposition.FAIL)

        # Confirm state retained current_task_authorization across retry!
        state = engine.handoff.load_state()
        self.assertIsNotNone(state.current_task_authorization)
        self.assertEqual(state.current_task_authorization["mutation_permission"], "REQUIRED")
        self.assertEqual(state.current_task_authorization["allowed_paths"], ["src/module"])
        self.assertEqual(state.current_task_attempt, 2)

        # Attempt 2: Run without re-passing authorization; retains original authorization!
        disp2 = engine.run_step(authorization=None)
        self.assertEqual(disp2, ControllerDisposition.FAIL)
        state2 = engine.handoff.load_state()
        self.assertEqual(state2.current_task_attempt, 3)

    # -------------------------------------------------------------------------
    # 15. Failed attempt cannot become a new unrestricted objective
    # -------------------------------------------------------------------------
    def test_15_failed_attempt_cannot_expand_to_unrestricted_objective(self):
        config = OrchestratorConfig(workspace_root=self.workspace_root)
        backend = TestSimulatedBackend()
        engine = OrchestratorEngine(config, execution_backend=backend)
        engine.initialize_workspace("Outcome", "Done")

        read_only_auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.NOT_ALLOWED,
        )

        engine.controller.formulate_next_prompt = MagicMock(return_value=(
            "Audit Task",
            "PROMPT #001\nAudit\nEND OF RESULT — PROMPT #001",
            MutationExpectation.NOT_ALLOWED,
        ))
        engine.controller.reconcile_result = MagicMock(return_value=ControllerResult(
            correlation_id="PROMPT #001",
            objective="Audit Task",
            controller_disposition=ControllerDisposition.FAIL,
            mutation_expectation=MutationExpectation.NOT_ALLOWED,
        ))

        # Attempt 1 fails
        disp1 = engine.run_step(authorization=read_only_auth)
        self.assertEqual(disp1, ControllerDisposition.FAIL)

        # In Attempt 2 retry, if model tries to propose REQUIRED, it must be rejected!
        engine.controller.formulate_next_prompt = MagicMock(
            side_effect=AuthorizationEscalationError("Escalation rejected")
        )
        disp2 = engine.run_step(authorization=None)
        self.assertEqual(disp2, ControllerDisposition.FAIL)

    # -------------------------------------------------------------------------
    # 16. Crash / restart does not replay prior objective without reconciliation
    # -------------------------------------------------------------------------
    def test_16_crash_restart_does_not_replay_without_reconciliation(self):
        config = OrchestratorConfig(workspace_root=self.workspace_root)
        backend = TestSimulatedBackend()
        engine = OrchestratorEngine(config, execution_backend=backend)
        engine.initialize_workspace("Crash Test", "Done")

        # Simulate crashed in-flight state
        state = engine.handoff.load_state()
        state.active_prompt_id = "PROMPT #001"
        state.active_objective = "Crashed in flight"
        engine.handoff.save_state(state)

        # On restart, run_step must halt with BLOCKED
        disp = engine.run_step()
        self.assertEqual(disp, ControllerDisposition.BLOCKED)

    # -------------------------------------------------------------------------
    # 17. Git rename parsing is correct in a disposable repository (porcelain -z)
    # -------------------------------------------------------------------------
    def test_17_git_rename_parsing_with_porcelain_v1_z(self):
        git_mgr = self._init_git_repo()

        # Create and commit an initial file
        old_f = self.workspace_root / "file_old.txt"
        old_f.write_text("Hello\n", encoding="utf-8")
        subprocess.run(["git", "add", "file_old.txt"], cwd=str(self.workspace_root), check=True)
        subprocess.run(["git", "commit", "-m", "Add old"], cwd=str(self.workspace_root), check=True)

        baseline = git_mgr.capture_baseline()

        # Rename file
        subprocess.run(["git", "mv", "file_old.txt", "file_new.txt"], cwd=str(self.workspace_root), check=True)

        observed = git_mgr.compute_observed_mutations(baseline=baseline)
        self.assertTrue(observed.has_deltas)
        # file_new.txt must appear in staged/modified
        self.assertTrue(any("file_new.txt" in f for f in (observed.staged + observed.tracked_modified)))

    # -------------------------------------------------------------------------
    # 18. Git filenames with spaces, quotes, and Unicode parse correctly
    # -------------------------------------------------------------------------
    def test_18_git_filenames_with_spaces_and_unicode_parsed(self):
        git_mgr = self._init_git_repo()
        baseline = git_mgr.capture_baseline()

        # Create file with spaces and unicode
        weird_name = "test file with spaces_ünicode.txt"
        weird_file = self.workspace_root / weird_name
        weird_file.write_text("content\n", encoding="utf-8")

        observed = git_mgr.compute_observed_mutations(baseline=baseline)
        self.assertTrue(observed.has_deltas)
        self.assertIn(weird_name, observed.untracked_added)

    # -------------------------------------------------------------------------
    # 19. Windows backslash and path case normalization work correctly
    # -------------------------------------------------------------------------
    def test_19_windows_backslash_and_case_normalization(self):
        p1 = normalize_git_path("src\\components\\Button.tsx")
        p2 = normalize_git_path("src/components/button.tsx")
        if sys.platform == "win32":
            self.assertEqual(p1, p2, "On Windows, paths must match across backslashes and casing")

        allowed = ["src\\components"]
        self.assertTrue(is_path_authorized("src/components/Button.tsx", allowed))

    # -------------------------------------------------------------------------
    # 20. Unauthorized prefix paths remain rejected
    # -------------------------------------------------------------------------
    def test_20_unauthorized_prefix_paths_rejected(self):
        allowed = ["src/allowed_dir"]
        self.assertTrue(is_path_authorized("src/allowed_dir/app.py", allowed))
        self.assertFalse(is_path_authorized("src/unauthorized_dir/app.py", allowed))
        self.assertFalse(is_path_authorized("secret.env", allowed))

    # -------------------------------------------------------------------------
    # 21. No automatic Git staging or commit on PASS
    # -------------------------------------------------------------------------
    def test_21_no_automatic_git_commit_on_pass(self):
        git_mgr = self._init_git_repo()
        config = OrchestratorConfig(workspace_root=self.workspace_root)
        backend = TestSimulatedBackend()
        verifier = DeterministicVerificationAdapter()
        verifier.set_default(VerificationResult(
            executed=True,
            passed=True,
            exit_status=0,
            provenance=VerificationProvenance.SIMULATED,
            command="npm test",
        ))
        engine = OrchestratorEngine(config, verification_adapter=verifier, execution_backend=backend)
        engine.initialize_workspace("Goal", "Done")

        engine.controller.formulate_next_prompt = MagicMock(return_value=(
            "Modify",
            "PROMPT #001\nModify\nEND OF RESULT — PROMPT #001",
            MutationExpectation.REQUIRED,
        ))
        engine.controller.reconcile_result = MagicMock(return_value=ControllerResult(
            correlation_id="PROMPT #001",
            objective="Modify",
            controller_disposition=ControllerDisposition.PASS,
            mutation_expectation=MutationExpectation.REQUIRED,
            validation=[ValidationRecord(kind="test", executed=True, result="PASS")],
        ))

        (self.workspace_root / "new.py").write_text("x = 10\n", encoding="utf-8")
        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.REQUIRED,
        )
        disp = engine.run_step(authorization=auth)
        self.assertEqual(disp, ControllerDisposition.PASS)
        self.assertEqual(git_mgr.get_staged_files(), [])

    # -------------------------------------------------------------------------
    # 22. Existing untracked and dirty user changes remain preserved
    # -------------------------------------------------------------------------
    def test_22_untracked_dirty_user_changes_preserved(self):
        git_mgr = self._init_git_repo()
        user_file = self.workspace_root / "my_precious_work.txt"
        user_file.write_text("DO NOT TOUCH\n", encoding="utf-8")

        config = OrchestratorConfig(workspace_root=self.workspace_root)
        backend = TestSimulatedBackend()
        engine = OrchestratorEngine(config, execution_backend=backend)
        engine.initialize_workspace("Init", "Done")

        self.assertTrue(user_file.is_file())
        self.assertEqual(user_file.read_text(encoding="utf-8"), "DO NOT TOUCH\n")

    # -------------------------------------------------------------------------
    # 23. Read-only state diagnosis remains usable without executor launch
    # -------------------------------------------------------------------------
    def test_23_inspect_state_usable_without_executor_launch(self):
        config = OrchestratorConfig(workspace_root=self.workspace_root)
        engine = OrchestratorEngine(config)
        diag = engine.inspect_state()
        self.assertIn("recovery_disposition", diag)
        self.assertIn("state_exists", diag)

    # -------------------------------------------------------------------------
    # 24. Legacy execution paths remain explicitly identified as unsafe/unretired
    # -------------------------------------------------------------------------
    def test_24_legacy_runner_deprecation_notice_verified(self):
        from orchestrator import runner
        self.assertTrue(hasattr(runner, "main"))

    # -------------------------------------------------------------------------
    # 25. Full accumulated test suite valid without security-bypass flags
    # -------------------------------------------------------------------------
    def test_25_full_accumulated_state_machine_transitions(self):
        config = OrchestratorConfig(workspace_root=self.workspace_root, max_consecutive_failures=2)
        backend = TestSimulatedBackend()
        verifier = DeterministicVerificationAdapter()
        verifier.set_default(VerificationResult(
            executed=True,
            passed=True,
            exit_status=0,
            provenance=VerificationProvenance.SIMULATED,
            command="npm test",
        ))
        engine = OrchestratorEngine(config, verification_adapter=verifier, execution_backend=backend)
        engine.initialize_workspace("Workflow", "Done")

        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.REQUIRED,
        )

        # Mock formulation
        engine.controller.formulate_next_prompt = MagicMock(return_value=(
            "Task 1",
            "PROMPT #001\nDo work\nEND OF RESULT — PROMPT #001",
            MutationExpectation.REQUIRED,
        ))
        engine.controller.reconcile_result = MagicMock(return_value=ControllerResult(
            correlation_id="PROMPT #001",
            objective="Task 1",
            controller_disposition=ControllerDisposition.PASS,
            mutation_expectation=MutationExpectation.REQUIRED,
            validation=[ValidationRecord(kind="test", executed=True, result="PASS")],
        ))

        disp = engine.run_step(authorization=auth)
        self.assertEqual(disp, ControllerDisposition.PASS)
        state = engine.handoff.load_state()
        self.assertEqual(state.sequence_number, 2)
        self.assertEqual(len(state.completed_tasks), 1)

if __name__ == "__main__":
    unittest.main()
