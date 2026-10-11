import os
import shutil
import tempfile
import unittest
from pathlib import Path
from orchestrator.schema import (
    ControllerDisposition,
    EvidenceLabel,
    format_correlation_id,
    extract_end_correlation_id,
    ControllerResult,
)
from orchestrator.circuit_breaker import CircuitBreaker
from orchestrator.handoff import HandoffManager, OrchestratorPersistentState
from orchestrator.git_manager import GitManager
from orchestrator.hermes_client import HermesClient

class TestOrchestratorSchema(unittest.TestCase):
    def test_correlation_id_formatting(self):
        self.assertEqual(format_correlation_id(1), "PROMPT #001")
        self.assertEqual(format_correlation_id(42), "PROMPT #042")
        self.assertEqual(format_correlation_id(105), "PROMPT #105")

    def test_correlation_id_extraction(self):
        sample = """I have finished the tests and all 42 passed.
        Everything is clean and ready.
        END OF RESULT — PROMPT #003"""
        extracted = extract_end_correlation_id(sample)
        self.assertEqual(extracted, "PROMPT #003")

        sample_alt = "END OF RESULT - PROMPT #15"
        self.assertEqual(extract_end_correlation_id(sample_alt), "PROMPT #015")

        sample_none = "Task finished without marker"
        self.assertIsNone(extract_end_correlation_id(sample_none))

    def test_controller_result_serialization(self):
        res = ControllerResult(
            correlation_id="PROMPT #001",
            objective="Add search index",
            controller_disposition=ControllerDisposition.PASS,
        )
        d = res.to_dict()
        self.assertEqual(d["controller_disposition"], "PASS")
        self.assertEqual(d["correlation_id"], "PROMPT #001")

        reconstructed = ControllerResult.from_dict(d)
        self.assertEqual(reconstructed.controller_disposition, ControllerDisposition.PASS)
        self.assertEqual(reconstructed.objective, "Add search index")

class TestCircuitBreaker(unittest.TestCase):
    def test_threshold(self):
        cb = CircuitBreaker(max_consecutive_failures=3)
        self.assertFalse(cb.check(0).is_blocked)
        self.assertFalse(cb.check(2).is_blocked)
        self.assertTrue(cb.check(3).is_blocked)
        self.assertTrue(cb.check(5).is_blocked)

    def test_verify_correlation(self):
        cb = CircuitBreaker()
        valid, err = cb.verify_correlation("PROMPT #001", "Results here\nEND OF RESULT — PROMPT #001")
        self.assertTrue(valid)
        self.assertIsNone(err)

        invalid, err = cb.verify_correlation("PROMPT #001", "Wrong marker\nEND OF RESULT — PROMPT #002")
        self.assertFalse(invalid)
        self.assertIn("Correlation mismatch", err)

class TestHandoffManager(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.handoff_path = Path(self.temp_dir) / "HANDOFF.md"
        self.state_path = Path(self.temp_dir) / ".state.json"
        self.manager = HandoffManager(self.handoff_path, self.state_path)

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def test_save_and_load_state(self):
        state = OrchestratorPersistentState(
            sequence_number=5,
            master_outcome="Refactor Core Service",
            consecutive_failures=1,
            last_disposition="PASS",
        )
        self.manager.save_state(state)
        loaded = self.manager.load_state()
        self.assertEqual(loaded.sequence_number, 5)
        self.assertEqual(loaded.master_outcome, "Refactor Core Service")
        self.assertEqual(loaded.last_disposition, "PASS")

    def test_write_handoff_doc(self):
        state = OrchestratorPersistentState(
            sequence_number=2,
            master_outcome="Refactor Core Service",
        )
        self.manager.write_handoff_doc(state)
        self.assertTrue(self.handoff_path.exists())
        content = self.handoff_path.read_text(encoding="utf-8")
        self.assertIn("Refactor Core Service", content)
        self.assertIn("PROMPT #002", content)

class TestHermesClientFormatting(unittest.TestCase):
    def test_strip_decorations(self):
        client = HermesClient()
        dirty = """┌─ Reasoning ────────────────────────────────────────────────────────┐
Thinking through the prompt...
└────────────────────────────────────────────────────────────────────┘
ACTUAL_RESULT_TEXT"""
        clean = client.strip_decorations(dirty)
        self.assertEqual(clean, "ACTUAL_RESULT_TEXT")

if __name__ == "__main__":
    unittest.main()
