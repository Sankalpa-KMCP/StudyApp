import os
import sys
from pathlib import Path

# Ensure repository root is on sys.path for test discovery across all runners
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import shutil
import tempfile
import unittest
from unittest.mock import MagicMock

from orchestrator.config import OrchestratorConfig
from orchestrator.engine import OrchestratorEngine
from orchestrator.execution_backend import TestSimulatedBackend
from orchestrator.hermes_client import HermesResponse
from orchestrator.schema import (
    ControllerDisposition,
    ControllerResult,
    MutationExpectation,
    ObjectiveAuthorization,
    ValidationRecord,
    VerificationProvenance,
    VerificationResult,
    format_correlation_id,
)
from orchestrator.verification import DeterministicVerificationAdapter

class TestOrchestratorEngineIntegration(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.workspace_root = Path(self.temp_dir)
        self.config = OrchestratorConfig(
            workspace_root=self.workspace_root,
            max_consecutive_failures=3,
            max_iterations=5,
        )
        self.simulated_backend = TestSimulatedBackend()
        self.simulated_verifier = DeterministicVerificationAdapter()
        # Default simulated result for integration fixtures
        self.simulated_verifier.set_default(
            VerificationResult(
                executed=True,
                passed=True,
                exit_status=0,
                provenance=VerificationProvenance.SIMULATED,
                command="npm test",
            )
        )
        self.engine = OrchestratorEngine(
            self.config,
            verification_adapter=self.simulated_verifier,
            execution_backend=self.simulated_backend,
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_full_lifecycle_pass_without_automatic_git_commit(self):
        # Initialize
        self.engine.initialize_workspace(
            master_outcome="Build Feature X",
            definition_of_done="Unit tests pass",
        )

        state = self.engine.handoff.load_state()
        self.assertEqual(state.sequence_number, 1)
        self.assertEqual(state.master_outcome, "Build Feature X")

        # Mock Controller formulation with MutationExpectation
        self.engine.controller.formulate_next_prompt = MagicMock(
            return_value=(
                "Implement module A",
                "PROMPT #001\nImplement module A\nEND OF RESULT — PROMPT #001",
                MutationExpectation.REQUIRED,
            )
        )

        # Mock Executor response
        self.engine.executor.execute_prompt = MagicMock(
            return_value=HermesResponse(
                stdout="Executed with tests passing\nEND OF RESULT — PROMPT #001",
                stderr="",
                exit_code=0,
                session_id="test_sess_001",
                clean_text="Executed with tests passing\nEND OF RESULT — PROMPT #001",
            )
        )

        # Mock Controller reconciliation
        self.engine.controller.reconcile_result = MagicMock(
            return_value=ControllerResult(
                correlation_id="PROMPT #001",
                objective="Implement module A",
                controller_disposition=ControllerDisposition.PASS,
                mutation_expectation=MutationExpectation.REQUIRED,
            )
        )

        # Mock GitManager commit_authorized / commit_verified to verify it is NEVER called
        self.engine.git.commit_authorized = MagicMock()
        self.engine.git.commit_verified = MagicMock()

        # Run one step with explicit operator authorization
        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.REQUIRED,
            requires_verification=True,
        )
        disp = self.engine.run_step(authorization=auth)
        self.assertEqual(disp, ControllerDisposition.PASS)

        # CRITICAL VERIFICATION: Ordinary execution on PASS MUST NOT automatically commit
        self.engine.git.commit_authorized.assert_not_called()
        self.engine.git.commit_verified.assert_not_called()

        # Verify state advanced
        updated_state = self.engine.handoff.load_state()
        self.assertEqual(updated_state.sequence_number, 2)
        self.assertEqual(updated_state.consecutive_failures, 0)
        self.assertEqual(len(updated_state.completed_tasks), 1)
        self.assertEqual(updated_state.completed_tasks[0]["prompt_id"], "PROMPT #001")
        self.assertEqual(updated_state.completed_tasks[0]["mutation_expectation"], "REQUIRED")

        # Verify handoff markdown was updated
        handoff_text = self.config.handoff_path.read_text(encoding="utf-8")
        self.assertIn("Implement module A", handoff_text)
        self.assertIn("PROMPT #001", handoff_text)

    def test_circuit_breaker_trips_on_failures(self):
        self.engine.initialize_workspace("Fail Test", "Do not crash")

        # Mock formulation
        self.engine.controller.formulate_next_prompt = MagicMock(
            return_value=(
                "Faulty task",
                "PROMPT #001\nDo bad things\nEND OF RESULT — PROMPT #001",
                MutationExpectation.REQUIRED,
            )
        )

        # Mock Executor response
        self.engine.executor.execute_prompt = MagicMock(
            return_value=HermesResponse(
                stdout="Tests failed\nEND OF RESULT — PROMPT #001",
                stderr="",
                exit_code=1,
                session_id="test_sess_fail",
                clean_text="Tests failed\nEND OF RESULT — PROMPT #001",
            )
        )

        # Mock Controller reconciliation to FAIL
        self.engine.controller.reconcile_result = MagicMock(
            return_value=ControllerResult(
                correlation_id="PROMPT #001",
                objective="Faulty task",
                controller_disposition=ControllerDisposition.FAIL,
                mutation_expectation=MutationExpectation.REQUIRED,
            )
        )

        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.REQUIRED,
            requires_verification=True,
        )

        # Attempt 1 -> FAIL (stores authorization in state for retries)
        disp1 = self.engine.run_step(authorization=auth)
        self.assertEqual(disp1, ControllerDisposition.FAIL)
        state = self.engine.handoff.load_state()
        self.assertEqual(state.consecutive_failures, 1)

        # Attempt 2 -> FAIL (retains original authorization automatically)
        disp2 = self.engine.run_step()
        self.assertEqual(disp2, ControllerDisposition.FAIL)
        state = self.engine.handoff.load_state()
        self.assertEqual(state.consecutive_failures, 2)

        # Attempt 3 -> FAIL (trips breaker)
        disp3 = self.engine.run_step()
        self.assertEqual(disp3, ControllerDisposition.FAIL)
        state = self.engine.handoff.load_state()
        self.assertEqual(state.consecutive_failures, 3)

        # Next attempt -> BLOCKED by circuit breaker
        disp4 = self.engine.run_step()
        self.assertEqual(disp4, ControllerDisposition.BLOCKED)

    def test_real_pipeline_integration_without_mocking_critical_functions(self):
        """
        Genuine integration test (TEST-01 remediation):
        Uses REAL parse_controller_dispatch and REAL reconcile_result execution.
        Only the external LLM query strings are mocked.
        """
        self.engine.initialize_workspace("Real Integration", "Pass verification")

        # Mock LLM query response for Controller prompt formulation
        llm_dispatch_output = """=== OBJECTIVE_TITLE ===
Audit code security
=== MUTATION_EXPECTATION ===
NOT_ALLOWED
=== EXECUTOR_PROMPT ===
PROMPT #001
Audit code security without mutating any files.
END OF RESULT — PROMPT #001"""

        # Mock LLM query response for Controller reconciliation
        llm_reconcile_output = """```json
{
  "schema_version": "8.1",
  "correlation_id": "PROMPT #001",
  "executor": "hermes-executor",
  "workflow": "direct_parent",
  "objective": "Audit code security",
  "native_status": "COMPLETED",
  "controller_disposition": "PASS",
  "mutations": {
    "files_changed": [],
    "git_mutation": false
  },
  "validation": [
    {
      "kind": "audit",
      "executed": true,
      "result": "PASS",
      "command_or_check": "bandit audit"
    }
  ],
  "evidence": [
    {
      "label": "VERIFIED",
      "summary": "Security audit complete with 0 findings"
    }
  ],
  "findings": [],
  "limitations": [],
  "next_action": {
    "route": "direct_parent",
    "objective": "Next task"
  }
}
```"""

        # Mock only the HermesClient.run_query calls
        mock_queries = [
            HermesResponse(
                stdout=llm_dispatch_output,
                stderr="",
                exit_code=0,
                session_id="s1",
                clean_text=llm_dispatch_output,
            ),
            HermesResponse(
                stdout=llm_reconcile_output,
                stderr="",
                exit_code=0,
                session_id="s2",
                clean_text=llm_reconcile_output,
            ),
        ]
        self.engine.client.run_query = MagicMock(side_effect=mock_queries)

        # Mock Executor response with matching standalone terminal marker
        self.engine.executor.execute_prompt = MagicMock(
            return_value=HermesResponse(
                stdout="Audit completed cleanly.\nEND OF RESULT — PROMPT #001",
                stderr="",
                exit_code=0,
                session_id="exec_1",
                clean_text="Audit completed cleanly.\nEND OF RESULT — PROMPT #001",
            )
        )

        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.NOT_ALLOWED,
            requires_verification=False,
        )

        # Run real step through the entire engine pipeline
        disp = self.engine.run_step(authorization=auth)
        self.assertEqual(disp, ControllerDisposition.PASS, "Real pipeline must award PASS on valid read-only audit")

        # Verify state transitioned cleanly
        state = self.engine.handoff.load_state()
        self.assertEqual(state.sequence_number, 2)
        self.assertEqual(state.completed_tasks[0]["mutation_expectation"], "NOT_ALLOWED")

if __name__ == "__main__":
    unittest.main()
