import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock

from orchestrator.config import OrchestratorConfig
from orchestrator.engine import OrchestratorEngine
from orchestrator.hermes_client import HermesResponse
from orchestrator.schema import ControllerDisposition, format_correlation_id

class TestOrchestratorEngineIntegration(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.workspace_root = Path(self.temp_dir)
        self.config = OrchestratorConfig(
            workspace_root=self.workspace_root,
            git_autocommit=False,
            max_consecutive_failures=3,
            max_iterations=5,
        )
        self.engine = OrchestratorEngine(self.config)

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def test_full_lifecycle_pass(self):
        # Initialize
        self.engine.initialize_workspace(
            master_outcome="Build Feature X",
            definition_of_done="Unit tests pass",
        )

        state = self.engine.handoff.load_state()
        self.assertEqual(state.sequence_number, 1)
        self.assertEqual(state.master_outcome, "Build Feature X")

        # Mock Controller formulation
        self.engine.controller.formulate_next_prompt = MagicMock(
            return_value=("Implement module A", "PROMPT #001\nImplement module A\nEND OF RESULT — PROMPT #001")
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
        from orchestrator.schema import ControllerResult
        self.engine.controller.reconcile_result = MagicMock(
            return_value=ControllerResult(
                correlation_id="PROMPT #001",
                objective="Implement module A",
                controller_disposition=ControllerDisposition.PASS,
            )
        )

        # Run one step
        disp = self.engine.run_step()
        self.assertEqual(disp, ControllerDisposition.PASS)

        # Verify state advanced
        updated_state = self.engine.handoff.load_state()
        self.assertEqual(updated_state.sequence_number, 2)
        self.assertEqual(updated_state.consecutive_failures, 0)
        self.assertEqual(len(updated_state.completed_tasks), 1)
        self.assertEqual(updated_state.completed_tasks[0]["prompt_id"], "PROMPT #001")

        # Verify handoff markdown was updated
        handoff_text = self.config.handoff_path.read_text(encoding="utf-8")
        self.assertIn("Implement module A", handoff_text)
        self.assertIn("PROMPT #001", handoff_text)

    def test_circuit_breaker_trips_on_failures(self):
        self.engine.initialize_workspace("Fail Test", "Do not crash")

        # Mock formulation
        self.engine.controller.formulate_next_prompt = MagicMock(
            return_value=("Faulty task", "PROMPT #001\nDo bad things\nEND OF RESULT — PROMPT #001")
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
        from orchestrator.schema import ControllerResult
        self.engine.controller.reconcile_result = MagicMock(
            return_value=ControllerResult(
                correlation_id="PROMPT #001",
                objective="Faulty task",
                controller_disposition=ControllerDisposition.FAIL,
            )
        )

        # Attempt 1 -> FAIL
        disp1 = self.engine.run_step()
        self.assertEqual(disp1, ControllerDisposition.FAIL)
        state = self.engine.handoff.load_state()
        self.assertEqual(state.consecutive_failures, 1)

        # Attempt 2 -> FAIL
        disp2 = self.engine.run_step()
        self.assertEqual(disp2, ControllerDisposition.FAIL)
        state = self.engine.handoff.load_state()
        self.assertEqual(state.consecutive_failures, 2)

        # Attempt 3 -> FAIL
        disp3 = self.engine.run_step()
        self.assertEqual(disp3, ControllerDisposition.FAIL)
        state = self.engine.handoff.load_state()
        self.assertEqual(state.consecutive_failures, 3)

        # Attempt 4 -> BLOCKED (circuit breaker trips)
        disp4 = self.engine.run_step()
        self.assertEqual(disp4, ControllerDisposition.BLOCKED)

if __name__ == "__main__":
    unittest.main()
