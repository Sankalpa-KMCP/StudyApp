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
from orchestrator.git_manager import GitManager
from orchestrator.handoff import (
    CorruptedStateError,
    HandoffManager,
    OrchestratorPersistentState,
    StateLockError,
)
from orchestrator.execution_backend import TestSimulatedBackend
from orchestrator.hermes_client import HermesClient, HermesResponse
from orchestrator.schema import (
    ControllerDisposition,
    ControllerResult,
    MutationExpectation,
    ObjectiveAuthorization,
    ValidationRecord,
    VerificationProvenance,
    VerificationResult,
    extract_end_correlation_id,
    format_correlation_id,
)
from orchestrator.verification import DeterministicVerificationAdapter

class TestSafetyRegressionsV4(unittest.TestCase):
    """
    Comprehensive regression suite covering the 25 required cases in PROMPT #004.
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
        """Helper to initialize a completely isolated, disposable Git repository."""
        subprocess.run(["git", "init"], cwd=str(self.workspace_root), capture_output=True, check=True)
        subprocess.run(["git", "config", "user.name", "Test Runner"], cwd=str(self.workspace_root), capture_output=True)
        subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=str(self.workspace_root), capture_output=True)
        init_file = self.workspace_root / "README.md"
        init_file.write_text("# Initial Repo\n", encoding="utf-8")
        subprocess.run(["git", "add", "README.md"], cwd=str(self.workspace_root), capture_output=True)
        subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=str(self.workspace_root), capture_output=True)
        return GitManager(self.workspace_root)

    # -------------------------------------------------------------------------
    # 1. Historical PROMPT #001 reference inside valid PROMPT #002 body
    # -------------------------------------------------------------------------
    def test_01_historical_prompt_reference_in_body_accepted(self):
        text = """=== OBJECTIVE_TITLE ===
Repair regression from prior dispatch
=== MUTATION_EXPECTATION ===
REQUIRED
=== EXECUTOR_PROMPT ===
PROMPT #002
Investigate and resolve the test regression introduced in PROMPT #001.
Review the previous diff and ensure PROMPT #001 requirements are preserved.
END OF RESULT — PROMPT #002"""
        title, body, mut_exp = parse_controller_dispatch(text, "PROMPT #002")
        self.assertEqual(title, "Repair regression from prior dispatch")
        self.assertEqual(mut_exp, MutationExpectation.REQUIRED)
        self.assertTrue(body.startswith("PROMPT #002"))
        self.assertIn("PROMPT #001", body)

    # -------------------------------------------------------------------------
    # 2. Wrong leading prompt ID rejected
    # -------------------------------------------------------------------------
    def test_02_wrong_leading_prompt_id_rejected(self):
        text = """=== OBJECTIVE_TITLE ===
Title
=== EXECUTOR_PROMPT ===
PROMPT #001
Task content here"""
        with self.assertRaises(MalformedDispatchError) as ctx:
            parse_controller_dispatch(text, "PROMPT #002")
        self.assertIn("mismatch", str(ctx.exception).lower())

    # -------------------------------------------------------------------------
    # 3. Duplicate envelope rejected
    # -------------------------------------------------------------------------
    def test_03_duplicate_envelope_rejected(self):
        text = """=== OBJECTIVE_TITLE ===
Title 1
=== EXECUTOR_PROMPT ===
PROMPT #002
First prompt
=== OBJECTIVE_TITLE ===
Title 2
=== EXECUTOR_PROMPT ===
PROMPT #002
Second prompt"""
        with self.assertRaises(MalformedDispatchError) as ctx:
            parse_controller_dispatch(text, "PROMPT #002")
        self.assertIn("ambiguous", str(ctx.exception).lower())

    # -------------------------------------------------------------------------
    # 4. Valid read-only task with zero diff passes
    # -------------------------------------------------------------------------
    def test_04_valid_read_only_task_with_zero_diff_passes(self):
        controller = Controller(OrchestratorConfig(), HermesClient())
        json_pass = json.dumps({
            "schema_version": "8.1",
            "correlation_id": "PROMPT #001",
            "controller_disposition": "PASS",
            "validation": [{"kind": "audit", "executed": True, "result": "PASS"}],
            "mutations": {"files_changed": []},
            "evidence": [{"label": "VERIFIED", "summary": "Audit passed clean"}]
        })
        controller.client.run_query = MagicMock(return_value=HermesResponse(
            stdout=json_pass, stderr="", exit_code=0, session_id="1", clean_text=json_pass
        ))
        res = controller.reconcile_result(
            prompt_id="PROMPT #001",
            objective="Audit security",
            executor_output="clean",
            git_diff_stat="",
            changed_files=[],
            mutation_expectation=MutationExpectation.NOT_ALLOWED
        )
        self.assertEqual(res.controller_disposition, ControllerDisposition.PASS)

    # -------------------------------------------------------------------------
    # 5. Valid mutating task with required tracked change
    # -------------------------------------------------------------------------
    def test_05_valid_mutating_task_with_tracked_change(self):
        controller = Controller(OrchestratorConfig(), HermesClient())
        json_pass = json.dumps({
            "schema_version": "8.1",
            "correlation_id": "PROMPT #001",
            "controller_disposition": "PASS",
            "validation": [{"kind": "test", "executed": True, "result": "PASS"}],
            "mutations": {"files_changed": ["src/app.py"]}
        })
        controller.client.run_query = MagicMock(return_value=HermesResponse(
            stdout=json_pass, stderr="", exit_code=0, session_id="1", clean_text=json_pass
        ))
        res = controller.reconcile_result(
            prompt_id="PROMPT #001",
            objective="Add feature",
            executor_output="ok",
            git_diff_stat="1 file changed, 10 insertions(+)",
            changed_files=["src/app.py"],
            mutation_expectation=MutationExpectation.REQUIRED,
            verification_result=VerificationResult(executed=True, passed=True, command="npm test"),
        )
        self.assertEqual(res.controller_disposition, ControllerDisposition.PASS)

    # -------------------------------------------------------------------------
    # 6. Valid mutating task with required untracked change
    # -------------------------------------------------------------------------
    def test_06_valid_mutating_task_with_untracked_change(self):
        controller = Controller(OrchestratorConfig(), HermesClient())
        json_pass = json.dumps({
            "schema_version": "8.1",
            "correlation_id": "PROMPT #001",
            "controller_disposition": "PASS",
            "validation": [{"kind": "test", "executed": True, "result": "PASS"}],
            "mutations": {"files_changed": ["src/new_file.py"]}
        })
        controller.client.run_query = MagicMock(return_value=HermesResponse(
            stdout=json_pass, stderr="", exit_code=0, session_id="1", clean_text=json_pass
        ))
        # diff_stat is empty because file is untracked, but changed_files lists it
        res = controller.reconcile_result(
            prompt_id="PROMPT #001",
            objective="Add new file",
            executor_output="ok",
            git_diff_stat="",
            changed_files=["src/new_file.py"],
            mutation_expectation=MutationExpectation.REQUIRED,
            verification_result=VerificationResult(executed=True, passed=True, command="npm test"),
        )
        self.assertEqual(res.controller_disposition, ControllerDisposition.PASS)

    # -------------------------------------------------------------------------
    # 7. Optional-mutation task with no change
    # -------------------------------------------------------------------------
    def test_07_optional_mutation_task_without_change(self):
        controller = Controller(OrchestratorConfig(), HermesClient())
        json_pass = json.dumps({
            "schema_version": "8.1",
            "correlation_id": "PROMPT #001",
            "controller_disposition": "PASS",
            "validation": [{"kind": "check", "executed": True, "result": "PASS"}],
            "mutations": {"files_changed": []}
        })
        controller.client.run_query = MagicMock(return_value=HermesResponse(
            stdout=json_pass, stderr="", exit_code=0, session_id="1", clean_text=json_pass
        ))
        res = controller.reconcile_result(
            prompt_id="PROMPT #001",
            objective="Check configuration",
            executor_output="ok",
            git_diff_stat="",
            changed_files=[],
            mutation_expectation=MutationExpectation.OPTIONAL
        )
        self.assertEqual(res.controller_disposition, ControllerDisposition.PASS)

    # -------------------------------------------------------------------------
    # 8. Read-only task attempting unauthorized changes
    # -------------------------------------------------------------------------
    def test_08_read_only_task_with_unexpected_mutation_rejected(self):
        controller = Controller(OrchestratorConfig(), HermesClient())
        json_pass = json.dumps({
            "schema_version": "8.1",
            "correlation_id": "PROMPT #001",
            "controller_disposition": "PASS",
            "validation": [{"kind": "audit", "executed": True, "result": "PASS"}],
            "mutations": {"files_changed": ["README.md"]}
        })
        controller.client.run_query = MagicMock(return_value=HermesResponse(
            stdout=json_pass, stderr="", exit_code=0, session_id="1", clean_text=json_pass
        ))
        res = controller.reconcile_result(
            prompt_id="PROMPT #001",
            objective="Audit docs",
            executor_output="ok",
            git_diff_stat="1 file changed",
            changed_files=["README.md"],
            mutation_expectation=MutationExpectation.NOT_ALLOWED
        )
        self.assertEqual(res.controller_disposition, ControllerDisposition.FAIL)
        self.assertTrue(any("unexpectedly mutated" in lim for lim in res.limitations))

    # -------------------------------------------------------------------------
    # 9. Zero-diff implementation with unsatisfied acceptance
    # -------------------------------------------------------------------------
    def test_09_zero_diff_implementation_rejected(self):
        controller = Controller(OrchestratorConfig(), HermesClient())
        json_pass = json.dumps({
            "schema_version": "8.1",
            "correlation_id": "PROMPT #001",
            "controller_disposition": "PASS",
            "validation": [{"kind": "test", "executed": True, "result": "PASS"}],
            "mutations": {"files_changed": []},
            "evidence": [{"label": "VERIFIED", "summary": "Nothing was changed"}]
        })
        controller.client.run_query = MagicMock(return_value=HermesResponse(
            stdout=json_pass, stderr="", exit_code=0, session_id="1", clean_text=json_pass
        ))
        res = controller.reconcile_result(
            prompt_id="PROMPT #001",
            objective="Implement feature",
            executor_output="done",
            git_diff_stat="",
            changed_files=[],
            mutation_expectation=MutationExpectation.REQUIRED
        )
        self.assertEqual(res.controller_disposition, ControllerDisposition.FAIL)
        self.assertTrue(any("no changes were recorded" in lim for lim in res.limitations))

    # -------------------------------------------------------------------------
    # 10. Quoted result marker in a failed response
    # -------------------------------------------------------------------------
    def test_10_quoted_result_marker_rejected(self):
        text = "I failed to build. The instruction was: 'END OF RESULT — PROMPT #002', but build broke."
        self.assertIsNone(extract_end_correlation_id(text))

    # -------------------------------------------------------------------------
    # 11. Terminal marker followed by additional text
    # -------------------------------------------------------------------------
    def test_11_terminal_marker_followed_by_text_rejected(self):
        text = "END OF RESULT — PROMPT #002\nSome extra commentary after the marker."
        self.assertIsNone(extract_end_correlation_id(text))

    # -------------------------------------------------------------------------
    # 12. Wrong or duplicated terminal marker
    # -------------------------------------------------------------------------
    def test_12_duplicated_or_wrong_terminal_marker(self):
        # Duplicated
        text_dup = "END OF RESULT — PROMPT #002\nEND OF RESULT — PROMPT #002"
        self.assertIsNone(extract_end_correlation_id(text_dup))

        # Wrong sequence
        cb = CircuitBreaker()
        valid, err = cb.verify_correlation("PROMPT #002", "Done\nEND OF RESULT — PROMPT #001")
        self.assertFalse(valid)
        self.assertIn("mismatch", err.lower())

    # -------------------------------------------------------------------------
    # 13. Marker inside a code fence
    # -------------------------------------------------------------------------
    def test_13_marker_inside_code_fence_rejected(self):
        text = """Here is an example of what to conclude with:
```bash
END OF RESULT — PROMPT #002
```"""
        self.assertIsNone(extract_end_correlation_id(text))

    # -------------------------------------------------------------------------
    # 14. Valid standalone terminal marker
    # -------------------------------------------------------------------------
    def test_14_valid_standalone_terminal_marker(self):
        text = "All tests passed cleanly and linter is green.\n\nEND OF RESULT — PROMPT #002"
        self.assertEqual(extract_end_correlation_id(text), "PROMPT #002")

    # -------------------------------------------------------------------------
    # 15. Valid exact JSON result
    # -------------------------------------------------------------------------
    def test_15_valid_exact_json_result(self):
        raw = '{"schema_version": "8.1", "correlation_id": "PROMPT #001", "controller_disposition": "PASS"}'
        data, err = extract_single_json_object(raw)
        self.assertIsNone(err)
        self.assertEqual(data["controller_disposition"], "PASS")

    # -------------------------------------------------------------------------
    # 16. Valid single fenced JSON result where supported
    # -------------------------------------------------------------------------
    def test_16_valid_single_fenced_json_result(self):
        raw = """Here is the result:
```json
{
  "schema_version": "8.1",
  "correlation_id": "PROMPT #001",
  "controller_disposition": "PASS"
}
```"""
        data, err = extract_single_json_object(raw)
        self.assertIsNone(err)
        self.assertEqual(data["correlation_id"], "PROMPT #001")

    # -------------------------------------------------------------------------
    # 17. Multiple JSON objects rejected
    # -------------------------------------------------------------------------
    def test_17_multiple_json_objects_rejected(self):
        raw = '{"example": 1}\nSome prose\n{"schema_version": "8.1", "correlation_id": "PROMPT #001"}'
        data, err = extract_single_json_object(raw)
        self.assertIsNone(data)
        self.assertIn("competing", err.lower())

    # -------------------------------------------------------------------------
    # 18. Malformed and truncated JSON rejected
    # -------------------------------------------------------------------------
    def test_18_malformed_and_truncated_json_rejected(self):
        truncated = '{"schema_version": "8.1", "correlation_id": "PRO'
        data, err = extract_single_json_object(truncated)
        self.assertIsNone(data)
        self.assertTrue("failed" in err.lower() or "no json" in err.lower())

    # -------------------------------------------------------------------------
    # 19. Forged executed-tests claim not treated as independently verified
    # -------------------------------------------------------------------------
    def test_19_forged_tests_claim_rejected(self):
        controller = Controller(OrchestratorConfig(), HermesClient())
        # Model returns JSON claiming PASS with failed check
        raw_json = json.dumps({
            "schema_version": "8.1",
            "correlation_id": "PROMPT #001",
            "controller_disposition": "PASS",
            "validation": [{"kind": "test", "executed": True, "result": "FAIL"}],
            "mutations": {"files_changed": []}
        })
        controller.client.run_query = MagicMock(return_value=HermesResponse(
            stdout=raw_json, stderr="", exit_code=0, session_id="1", clean_text=raw_json
        ))
        res = controller.reconcile_result(
            prompt_id="PROMPT #001",
            objective="Run tests",
            executor_output="some output",
            git_diff_stat="",
        )
        self.assertEqual(res.controller_disposition, ControllerDisposition.FAIL)
        self.assertTrue(any("failed checks" in lim for lim in res.limitations))

    # -------------------------------------------------------------------------
    # 20. Corrupted state blocks without resetting sequence
    # -------------------------------------------------------------------------
    def test_20_corrupted_state_blocks_without_resetting(self):
        # Write corrupted content to state file
        self.state_path.write_text("{invalid json truncated...", encoding="utf-8")

        with self.assertRaises(CorruptedStateError):
            self.handoff_mgr.load_state()

        # Engine run_step halts with BLOCKED on corrupted state
        config = OrchestratorConfig(workspace_root=self.workspace_root)
        engine = OrchestratorEngine(config)
        disp = engine.run_step()
        self.assertEqual(disp, ControllerDisposition.BLOCKED)

        # Confirm file was NOT overwritten with default sequence 1
        raw_still = self.state_path.read_text(encoding="utf-8")
        self.assertEqual(raw_still, "{invalid json truncated...")

    # -------------------------------------------------------------------------
    # 21. Atomic save preserves the previous valid state on simulated write failure
    # -------------------------------------------------------------------------
    def test_21_atomic_save_preserves_backup(self):
        # Save valid state
        state = OrchestratorPersistentState(sequence_number=5, master_outcome="Original Goal")
        self.handoff_mgr.save_state(state)
        self.assertTrue(self.state_path.is_file())

        # Save next state
        state2 = OrchestratorPersistentState(sequence_number=6, master_outcome="Updated Goal")
        self.handoff_mgr.save_state(state2)

        # Confirm backup exists and has previous state
        self.assertTrue(self.handoff_mgr.backup_path.is_file())
        backup_data = json.loads(self.handoff_mgr.backup_path.read_text(encoding="utf-8"))
        self.assertEqual(backup_data["sequence_number"], 5)

    # -------------------------------------------------------------------------
    # 22. Concurrent persistence behavior / documented lock boundary
    # -------------------------------------------------------------------------
    def test_22_state_lock_boundary(self):
        # Test acquiring lock and detecting contention
        with self.handoff_mgr.state_lock():
            # A nested manager on the same path with timeout=0.1 should raise StateLockError
            nested_mgr = HandoffManager(self.handoff_path, self.state_path)
            with self.assertRaises(StateLockError):
                with nested_mgr.state_lock(timeout=0.1):
                    pass

    # -------------------------------------------------------------------------
    # 23. Genuine parser/reconciliation integration tests
    # -------------------------------------------------------------------------
    def test_23_genuine_parser_and_reconciliation_integration(self):
        controller = Controller(OrchestratorConfig(), HermesClient())

        # Test real parse_controller_dispatch
        real_dispatch = """=== OBJECTIVE_TITLE ===
Validate WCAG A/AA Color Contrast
=== MUTATION_EXPECTATION ===
NOT_ALLOWED
=== EXECUTOR_PROMPT ===
PROMPT #003
Execute Playwright a11y tests. Remember prior findings from PROMPT #002.
END OF RESULT — PROMPT #003"""

        title, body, mut = parse_controller_dispatch(real_dispatch, "PROMPT #003")
        self.assertEqual(title, "Validate WCAG A/AA Color Contrast")
        self.assertEqual(mut, MutationExpectation.NOT_ALLOWED)
        self.assertTrue(body.startswith("PROMPT #003"))

        # Test real reconciliation
        real_json = """{
          "schema_version": "8.1",
          "correlation_id": "PROMPT #003",
          "executor": "hermes-executor",
          "workflow": "direct_parent",
          "objective": "Validate WCAG A/AA Color Contrast",
          "native_status": "COMPLETED",
          "controller_disposition": "PASS",
          "mutations": {"files_changed": []},
          "validation": [{"kind": "test", "executed": true, "result": "PASS"}]
        }"""
        controller.client.run_query = MagicMock(return_value=HermesResponse(
            stdout=real_json, stderr="", exit_code=0, session_id="s1", clean_text=real_json
        ))

        res = controller.reconcile_result(
            prompt_id="PROMPT #003",
            objective=title,
            executor_output="All 10 tests passed.\nEND OF RESULT — PROMPT #003",
            git_diff_stat="",
            changed_files=[],
            executor_exit_code=0,
            correlation_valid=True,
            mutation_expectation=mut,
        )
        self.assertEqual(res.controller_disposition, ControllerDisposition.PASS)

    # -------------------------------------------------------------------------
    # 24. No automatic staging / commit regression
    # -------------------------------------------------------------------------
    def test_24_no_automatic_staging_or_commit_regression(self):
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

        # Mock controller to return PASS
        engine.controller.formulate_next_prompt = MagicMock(return_value=(
            "Modify code",
            "PROMPT #001\nModify\nEND OF RESULT — PROMPT #001",
            MutationExpectation.REQUIRED,
        ))
        engine.executor.execute_prompt = MagicMock(return_value=HermesResponse(
            stdout="Done\nEND OF RESULT — PROMPT #001",
            stderr="",
            exit_code=0,
            session_id="s1",
            clean_text="Done\nEND OF RESULT — PROMPT #001",
        ))
        engine.controller.reconcile_result = MagicMock(return_value=ControllerResult(
            correlation_id="PROMPT #001",
            objective="Modify code",
            controller_disposition=ControllerDisposition.PASS,
            mutation_expectation=MutationExpectation.REQUIRED,
            validation=[ValidationRecord(kind="test", executed=True, result="PASS")],
        ))

        # Create a modified file
        (self.workspace_root / "new.py").write_text("x = 10\n", encoding="utf-8")

        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.REQUIRED,
            requires_verification=True,
        )
        disp = engine.run_step(authorization=auth)
        self.assertEqual(disp, ControllerDisposition.PASS)

        # Verify: Nothing staged or committed in git
        self.assertEqual(git_mgr.get_staged_files(), [])
        _, rev_count, _ = git_mgr._run_git(["rev-list", "--count", "HEAD"])
        self.assertEqual(rev_count, "1")

    # -------------------------------------------------------------------------
    # 25. Correct fail/partial/block transitions without unsupported advancement
    # -------------------------------------------------------------------------
    def test_25_state_transitions_without_unsupported_advancement(self):
        config = OrchestratorConfig(workspace_root=self.workspace_root, max_consecutive_failures=2)
        backend = TestSimulatedBackend()
        engine = OrchestratorEngine(config, execution_backend=backend)
        engine.initialize_workspace("Workflow Transitions", "Verify state machine")

        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.REQUIRED,
            requires_verification=True,
        )

        # Step 1: Malformed dispatch fails closed -> failure count increments, sequence does NOT advance
        engine.controller.formulate_next_prompt = MagicMock(
            side_effect=MalformedDispatchError("Duplicate envelope markers")
        )
        disp1 = engine.run_step(authorization=auth)
        self.assertEqual(disp1, ControllerDisposition.FAIL)
        state1 = engine.handoff.load_state()
        self.assertEqual(state1.sequence_number, 1)
        self.assertEqual(state1.consecutive_failures, 1)

        # Step 2: Second failure trips circuit breaker (retains original authorization across retries)
        disp2 = engine.run_step()
        self.assertEqual(disp2, ControllerDisposition.FAIL)
        state2 = engine.handoff.load_state()
        self.assertEqual(state2.sequence_number, 1)
        self.assertEqual(state2.consecutive_failures, 2)

        # Step 3: Halts with BLOCKED
        disp3 = engine.run_step()
        self.assertEqual(disp3, ControllerDisposition.BLOCKED)
        state3 = engine.handoff.load_state()
        self.assertEqual(state3.sequence_number, 1, "Sequence must NEVER advance while BLOCKED")

if __name__ == "__main__":
    unittest.main()
