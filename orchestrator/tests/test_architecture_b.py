import io
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import MagicMock

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from orchestrator.circuit_breaker import CircuitBreaker
from orchestrator.config import NO_TOOLS_SENTINEL, OrchestratorConfig
from orchestrator.docker_backend import (
    DEFAULT_MODEL_NAME,
    DEFAULT_PROVIDER_NAME,
    DEFAULT_PROXY_BASE_URL,
    DEFAULT_SANDBOX_IMAGE,
    DockerExecutionBackend,
    DockerSandboxContainer,
    LocalModelAPIClient,
    MediatedToolBroker,
    PreparedExecution,
    parse_structured_verification_step,
    resolve_canonical_verification_plan,
    resolve_hermes_model_endpoint,
)
from orchestrator.engine import OrchestratorEngine
from orchestrator.execution_backend import (
    BackendRuntimeType,
    ExecutionBackendNotAvailableError,
    UnavailableExecutionBackend,
)
from orchestrator.executor import Executor, FormattedExecutorPrompt
from orchestrator.git_manager import GitManager, is_path_authorized
from orchestrator.hermes_client import HermesResponse, get_resolved_tool_names
from orchestrator.schema import (
    AuthorizationEscalationError,
    ControllerDisposition,
    ControllerResult,
    MissingAuthorizationError,
    MutationExpectation,
    ObjectiveAuthorization,
    TrustedVerificationPlan,
    VerificationProvenance,
    VerificationResult,
    compute_authorization_digest,
    compute_verification_plan_digest,
)
from orchestrator.verification import (
    DeterministicVerificationAdapter,
    DockerSandboxVerificationAdapter,
)
from orchestrator.workspace_sync import (
    CorruptedTransactionError,
    DirectSourceSynchronizer,
    DuplicateNormalizedPathError,
    PathTraversalError,
    SnapshotBaseline,
    SnapshotBuilder,
    StaleBaselineConflictError,
    SymlinkEscapeError,
    SyncTransactionRollbackError,
    UnauthorizedPathError,
    UnverifiedSyncError,
    WorkspaceDelta,
    compute_workspace_delta,
    extract_and_validate_container_tar,
    host_file_exact_case_exists,
    validate_delta_authorization,
)


class ScriptedToolLoopModelClient:
    """
    Deterministic multi-turn model client that drives the real MediatedToolBroker
    and real DockerSandboxContainer through a scripted sequence of tool calls.
    """

    def __init__(self, turns: List[Dict[str, Any]], finish_reasons: List[str] = None):
        self.turns = list(turns)
        self.finish_reasons = finish_reasons or ["stop"] * len(turns)
        self.call_count = 0
        self.received_messages: List[List[Dict[str, Any]]] = []

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Any = None,
        model: Any = None,
        stream: bool = False,
        timeout: int = 120,
    ) -> Dict[str, Any]:
        self.received_messages.append(list(messages))
        if self.call_count < len(self.turns):
            msg = self.turns[self.call_count]
            fr = self.finish_reasons[self.call_count] if self.call_count < len(self.finish_reasons) else "stop"
            self.call_count += 1
        else:
            msg = {"role": "assistant", "content": "END OF RESULT — PROMPT #001"}
            fr = "stop"
        return {
            "model": model or DEFAULT_MODEL_NAME,
            "choices": [{"index": 0, "message": msg, "finish_reason": fr}],
        }


class TestArchitectureBImplementation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.docker_ready, cls.docker_reason = DockerSandboxContainer.check_runtime_prerequisites(
            DEFAULT_SANDBOX_IMAGE
        )
        cls.shared_container = None
        if cls.docker_ready:
            cls.shared_container = DockerSandboxContainer(
                image=DEFAULT_SANDBOX_IMAGE,
                dispatch_id="shared_test_suite",
            )
            cls.shared_attestation = cls.shared_container.start()

    @classmethod
    def tearDownClass(cls):
        if cls.shared_container is not None:
            cls.shared_container.stop_and_remove()

    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp(prefix="archb_test_"))
        self.repo_dir = self.temp_dir / "repo"
        self.repo_dir.mkdir(parents=True, exist_ok=True)
        self._init_disposable_git_repo(self.repo_dir)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _init_disposable_git_repo(self, root: Path) -> None:
        subprocess.run(["git", "init"], cwd=str(root), capture_output=True, check=True)
        subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=str(root), capture_output=True, check=True)
        subprocess.run(["git", "config", "user.name", "Test User"], cwd=str(root), capture_output=True, check=True)

        (root / "src").mkdir(parents=True, exist_ok=True)
        (root / "tests").mkdir(parents=True, exist_ok=True)
        (root / "src" / "__init__.py").write_text("", encoding="utf-8")
        (root / "src" / "calculator.py").write_text(
            "def add(a: int, b: int) -> int:\n"
            "    return a - b  # Intentional bug for repair workflow\n\n"
            "def multiply(a: int, b: int) -> int:\n"
            "    return a * b\n",
            encoding="utf-8",
        )
        (root / "tests" / "test_calculator.py").write_text(
            "import unittest\n"
            "from src.calculator import add, multiply\n\n"
            "class TestCalculator(unittest.TestCase):\n"
            "    def test_add(self):\n"
            "        self.assertEqual(add(2, 3), 5)\n\n"
            "    def test_multiply(self):\n"
            "        self.assertEqual(multiply(3, 4), 12)\n\n"
            "if __name__ == '__main__':\n"
            "    unittest.main()\n",
            encoding="utf-8",
        )
        (root / "README.md").write_text("# Sample Project\n", encoding="utf-8")
        subprocess.run(["git", "add", "."], cwd=str(root), capture_output=True, check=True)
        subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=str(root), capture_output=True, check=True)

    # 1. read_file returns real content without traceback (ARCHB-BROKER-001)
    def test_01_read_file_returns_real_content_without_traceback(self):
        self.assertTrue(self.docker_ready)
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.NOT_ALLOWED, allowed_paths=["src"])
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        self.shared_container.import_snapshot(baseline)
        broker = MediatedToolBroker(self.shared_container, auth, retire_container_on_timeout=False)

        raw_out = broker.dispatch_tool("read_file", {"path": "src/calculator.py", "offset": 1, "limit": 50})
        parsed = json.loads(raw_out)
        self.assertNotIn("error", parsed)
        self.assertNotIn("Traceback", raw_out)
        self.assertEqual(parsed["path"], "src/calculator.py")
        self.assertEqual(parsed["total_lines"], 5)
        self.assertIn("1|def add(a: int, b: int) -> int:", parsed["content"])

    # 2. read_file handles missing file clearly (ARCHB-BROKER-001)
    def test_02_read_file_handles_missing_file_clearly(self):
        self.assertTrue(self.docker_ready)
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.NOT_ALLOWED, allowed_paths=["src"])
        broker = MediatedToolBroker(self.shared_container, auth, retire_container_on_timeout=False)

        raw_out = broker.dispatch_tool("read_file", {"path": "src/nonexistent_module.py"})
        parsed = json.loads(raw_out)
        self.assertIn("error", parsed)
        self.assertIn("File not found", parsed["error"])
        self.assertNotIn("Traceback", raw_out)

    # 3. Malformed tool args do not invoke tools (ARCHB-API-001)
    def test_03_malformed_tool_args_do_not_invoke_tools(self):
        self.assertTrue(self.docker_ready)
        turns = [
            {
                "role": "assistant",
                "content": "Calling tool with malformed JSON",
                "tool_calls": [
                    {
                        "id": "call_bad_json",
                        "type": "function",
                        "function": {"name": "write_file", "arguments": "{bad_json_unquoted"},
                    },
                    {
                        "id": "call_missing_req",
                        "type": "function",
                        "function": {"name": "write_file", "arguments": json.dumps({"path": "src/calculator.py"})},
                    },
                ],
            },
            {"role": "assistant", "content": "END OF RESULT — PROMPT #001"},
        ]
        backend = DockerExecutionBackend(
            workspace_root=self.repo_dir,
            model_client=ScriptedToolLoopModelClient(turns),
        )
        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            allowed_paths=["src"],
            verification_requirements=["python3 -c 'print(1)'"],
        )
        backend.execute("PROMPT #001", authorization=auth)
        self.assertEqual(len(backend.last_tool_history), 2)
        self.assertFalse(backend.last_tool_history[0].allowed)
        self.assertFalse(backend.last_tool_history[0].executed_in_container)
        self.assertIn("MALFORMED_TOOL_ARGUMENTS", backend.last_tool_history[0].result_summary)
        self.assertFalse(backend.last_tool_history[1].allowed)
        self.assertFalse(backend.last_tool_history[1].executed_in_container)
        self.assertIn("MISSING_REQUIRED_ARGUMENT", backend.last_tool_history[1].result_summary)

    # 4. Invalid tool-call IDs or duplicates are handled (ARCHB-API-001)
    def test_04_invalid_or_duplicate_tool_call_ids_handled(self):
        self.assertTrue(self.docker_ready)
        turns = [
            {
                "role": "assistant",
                "content": "Duplicate IDs",
                "tool_calls": [
                    {"id": "dup_1", "type": "function", "function": {"name": "list_files", "arguments": "{}"}},
                    {"id": "dup_1", "type": "function", "function": {"name": "list_files", "arguments": "{}"}},
                    {"id": "", "type": "function", "function": {"name": "list_files", "arguments": "{}"}},
                ],
            },
            {"role": "assistant", "content": "END OF RESULT — PROMPT #001"},
        ]
        backend = DockerExecutionBackend(
            workspace_root=self.repo_dir,
            model_client=ScriptedToolLoopModelClient(turns),
        )
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.NOT_ALLOWED, requires_verification=False)
        backend.execute("PROMPT #001", authorization=auth)
        self.assertEqual(len(backend.last_tool_history), 3)
        self.assertTrue(backend.last_tool_history[0].allowed)
        self.assertFalse(backend.last_tool_history[1].allowed)
        self.assertIn("INVALID_OR_DUPLICATE_TOOL_CALL_ID", backend.last_tool_history[1].result_summary)
        self.assertFalse(backend.last_tool_history[2].allowed)

    # 5. finish_reason="length" produces incomplete status (ARCHB-API-001)
    def test_05_finish_reason_length_produces_incomplete_status(self):
        self.assertTrue(self.docker_ready)
        turns = [{"role": "assistant", "content": "Truncated output..."}]
        client = ScriptedToolLoopModelClient(turns, finish_reasons=["length"])
        backend = DockerExecutionBackend(workspace_root=self.repo_dir, model_client=client)
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.NOT_ALLOWED, requires_verification=False)
        resp = backend.execute("PROMPT #001", authorization=auth)
        self.assertTrue(resp.is_truncated)
        self.assertNotEqual(resp.exit_code, 0)
        self.assertFalse(backend.last_prepared_execution.loop_completed)

    # 6. Iteration exhaustion never returns successful completion (ARCHB-SYNC-001)
    def test_06_iteration_exhaustion_never_returns_successful_completion(self):
        self.assertTrue(self.docker_ready)
        turns = [
            {
                "role": "assistant",
                "content": "Calling tool 1",
                "tool_calls": [{"id": "t1", "type": "function", "function": {"name": "list_files", "arguments": "{}"}}],
            },
            {
                "role": "assistant",
                "content": "Calling tool 2",
                "tool_calls": [{"id": "t2", "type": "function", "function": {"name": "list_files", "arguments": "{}"}}],
            },
        ]
        backend = DockerExecutionBackend(
            workspace_root=self.repo_dir,
            model_client=ScriptedToolLoopModelClient(turns),
            max_tool_iterations=2,
        )
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.NOT_ALLOWED, requires_verification=False)
        resp = backend.execute("PROMPT #001", authorization=auth)
        self.assertNotEqual(resp.exit_code, 0)
        self.assertTrue(resp.is_truncated)
        self.assertFalse(backend.last_prepared_execution.loop_completed)

    # 7. Iteration exhaustion never synchronizes files (ARCHB-SYNC-001)
    def test_07_iteration_exhaustion_never_synchronizes_files(self):
        self.assertTrue(self.docker_ready)
        orig_calc = (self.repo_dir / "src" / "calculator.py").read_text(encoding="utf-8")
        turns = [
            {
                "role": "assistant",
                "content": "Edit file in turn 1",
                "tool_calls": [{
                    "id": "t1",
                    "type": "function",
                    "function": {
                        "name": "write_file",
                        "arguments": json.dumps({"path": "src/calculator.py", "content": "def add(a, b): return a + b\ndef multiply(a, b): return a * b\n"}),
                    },
                }],
            },
            {
                "role": "assistant",
                "content": "Still calling tools in turn 2",
                "tool_calls": [{"id": "t2", "type": "function", "function": {"name": "list_files", "arguments": "{}"}}],
            },
        ]
        backend = DockerExecutionBackend(
            workspace_root=self.repo_dir,
            model_client=ScriptedToolLoopModelClient(turns),
            max_tool_iterations=2,
        )
        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            allowed_paths=["src"],
            verification_requirements=["python3 -m unittest discover -s tests"],
        )
        resp = backend.execute("PROMPT #001", authorization=auth)
        self.assertNotEqual(resp.exit_code, 0)
        self.assertTrue(resp.is_truncated)
        self.assertFalse(backend.last_prepared_execution.loop_completed)
        self.assertTrue(backend.last_prepared_execution.expired)
        self.assertEqual((self.repo_dir / "src" / "calculator.py").read_text(encoding="utf-8"), orig_calc)

        # Incomplete preparation cannot be committed later
        with self.assertRaises(UnverifiedSyncError):
            backend.commit_prepared_execution(
                expected_objective_id="PROMPT #001",
                correlation_valid=True,
                controller_disposition=ControllerDisposition.PASS,
                authorization=auth,
            )
        self.assertEqual((self.repo_dir / "src" / "calculator.py").read_text(encoding="utf-8"), orig_calc)

    # 8. Missing/mismatched terminal marker never synchronizes (ARCHB-SYNC-001)
    def test_08_missing_or_mismatched_terminal_marker_never_synchronizes(self):
        self.assertTrue(self.docker_ready)
        orig_calc = (self.repo_dir / "src" / "calculator.py").read_text(encoding="utf-8")
        turns = [
            {
                "role": "assistant",
                "content": "Fix bug",
                "tool_calls": [{
                    "id": "t1",
                    "type": "function",
                    "function": {
                        "name": "write_file",
                        "arguments": json.dumps({"path": "src/calculator.py", "content": "def add(a, b): return a + b\ndef multiply(a, b): return a * b\n"}),
                    },
                }],
            },
            {"role": "assistant", "content": "Completed work but wrong marker\nEND OF RESULT — PROMPT #999"},
        ]
        backend = DockerExecutionBackend(
            workspace_root=self.repo_dir,
            model_client=ScriptedToolLoopModelClient(turns),
        )
        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            allowed_paths=["src"],
            verification_requirements=["python3 -m unittest discover -s tests"],
        )
        resp = backend.execute("PROMPT #001", authorization=auth)
        self.assertEqual((self.repo_dir / "src" / "calculator.py").read_text(encoding="utf-8"), orig_calc)
        valid_corr, corr_err = CircuitBreaker().verify_correlation("PROMPT #001", resp.clean_text)
        self.assertFalse(valid_corr)

        # Incomplete / mismatched correlation cannot be committed
        with self.assertRaises(UnverifiedSyncError):
            backend.commit_prepared_execution(
                expected_objective_id="PROMPT #001",
                correlation_valid=valid_corr,
                controller_disposition=ControllerDisposition.PASS,
                authorization=auth,
            )
        self.assertEqual((self.repo_dir / "src" / "calculator.py").read_text(encoding="utf-8"), orig_calc)

    # 9. Failed controller reconciliation never synchronizes (ARCHB-SYNC-001)
    def test_09_failed_controller_reconciliation_never_synchronizes(self):
        self.assertTrue(self.docker_ready)
        orig_calc = (self.repo_dir / "src" / "calculator.py").read_text(encoding="utf-8")
        turns = [
            {
                "role": "assistant",
                "content": "Fix bug",
                "tool_calls": [{
                    "id": "t1",
                    "type": "function",
                    "function": {
                        "name": "write_file",
                        "arguments": json.dumps({"path": "src/calculator.py", "content": "def add(a, b): return a + b\ndef multiply(a, b): return a * b\n"}),
                    },
                }],
            },
            {"role": "assistant", "content": "Done.\nEND OF RESULT — PROMPT #001"},
        ]
        backend = DockerExecutionBackend(workspace_root=self.repo_dir, model_client=ScriptedToolLoopModelClient(turns))
        verifier = DockerSandboxVerificationAdapter(backend)
        engine = OrchestratorEngine(OrchestratorConfig(workspace_root=self.repo_dir), verification_adapter=verifier, execution_backend=backend)
        engine.initialize_workspace("Two-Phase Reject Test", "Done")

        engine.controller.formulate_next_prompt = MagicMock(return_value=("Fix bug", "PROMPT #001\nFix bug", MutationExpectation.REQUIRED))
        engine.controller.reconcile_result = MagicMock(return_value=ControllerResult(
            correlation_id="PROMPT #001",
            objective="Fix bug",
            controller_disposition=ControllerDisposition.FAIL,
            mutation_expectation=MutationExpectation.REQUIRED,
            limitations=["Controller rejected architectural approach"],
        ))

        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            allowed_paths=["src"],
            verification_requirements=["python3 -m unittest discover -s tests"],
        )
        disp = engine.run_step(authorization=auth)
        self.assertEqual(disp, ControllerDisposition.FAIL)
        self.assertTrue(backend.last_prepared_execution.expired)
        self.assertFalse(backend.last_prepared_execution.applied)
        self.assertEqual((self.repo_dir / "src" / "calculator.py").read_text(encoding="utf-8"), orig_calc)

    # 10. Verification failure never synchronizes
    def test_10_verification_failure_never_synchronizes(self):
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"], requires_verification=True)
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        exported = dict(baseline.file_bytes)
        exported["src/calculator.py"] = b"# modified\n"
        delta = compute_workspace_delta(baseline, exported)
        failed_v = VerificationResult(executed=True, passed=False, exit_status=1, provenance=VerificationProvenance.FAILED)
        with self.assertRaises(UnverifiedSyncError):
            DirectSourceSynchronizer(self.repo_dir).synchronize(delta, baseline, auth, failed_v)

    # 11. Verification absent never synchronizes
    def test_11_verification_absent_never_synchronizes(self):
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"], requires_verification=True)
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        exported = dict(baseline.file_bytes)
        exported["src/calculator.py"] = b"# modified\n"
        delta = compute_workspace_delta(baseline, exported)
        absent_v = VerificationResult(executed=False, passed=False, exit_status=-1, provenance=VerificationProvenance.UNVERIFIED)
        with self.assertRaises(UnverifiedSyncError):
            DirectSourceSynchronizer(self.repo_dir).synchronize(delta, baseline, auth, absent_v)

    # 12. Unauthorized delta never synchronizes
    def test_12_unauthorized_delta_never_synchronizes(self):
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"], requires_verification=True)
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        verif = VerificationResult(executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED)
        exported_unauth = dict(baseline.file_bytes)
        exported_unauth["README.md"] = b"# hack\n"
        delta_unauth = compute_workspace_delta(baseline, exported_unauth)
        with self.assertRaises(UnauthorizedPathError):
            DirectSourceSynchronizer(self.repo_dir).synchronize(delta_unauth, baseline, auth, verif)

    # 13. Stale baseline never synchronizes
    def test_13_stale_baseline_never_synchronizes(self):
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"], requires_verification=True)
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        verif = VerificationResult(executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED)
        exported_ok = dict(baseline.file_bytes)
        exported_ok["src/calculator.py"] = b"# container edit\n"
        delta_ok = compute_workspace_delta(baseline, exported_ok)
        (self.repo_dir / "src" / "calculator.py").write_text("# concurrent host edit\n", encoding="utf-8")
        with self.assertRaises(StaleBaselineConflictError):
            DirectSourceSynchronizer(self.repo_dir).synchronize(delta_ok, baseline, auth, verif)

    # 14. Engine verifies result correlation before promotion
    def test_14_engine_verifies_result_correlation_before_promotion(self):
        self.assertTrue(self.docker_ready)
        orig_calc = (self.repo_dir / "src" / "calculator.py").read_text(encoding="utf-8")
        turns = [
            {
                "role": "assistant",
                "content": "Fix bug",
                "tool_calls": [{
                    "id": "t1",
                    "type": "function",
                    "function": {
                        "name": "write_file",
                        "arguments": json.dumps({"path": "src/calculator.py", "content": "def add(a, b): return a + b\ndef multiply(a, b): return a * b\n"}),
                    },
                }],
            },
            {"role": "assistant", "content": "Done without valid marker."},
        ]
        backend = DockerExecutionBackend(workspace_root=self.repo_dir, model_client=ScriptedToolLoopModelClient(turns))
        verifier = DockerSandboxVerificationAdapter(backend)
        engine = OrchestratorEngine(OrchestratorConfig(workspace_root=self.repo_dir), verification_adapter=verifier, execution_backend=backend)
        engine.initialize_workspace("Correlation Gate Test", "Done")
        engine.controller.formulate_next_prompt = MagicMock(return_value=("Fix bug", "PROMPT #001\nFix bug", MutationExpectation.REQUIRED))

        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            allowed_paths=["src"],
            verification_requirements=["python3 -m unittest discover -s tests"],
        )
        disp = engine.run_step(authorization=auth)
        self.assertEqual(disp, ControllerDisposition.FAIL)
        self.assertFalse(backend.last_prepared_execution.applied)
        self.assertEqual((self.repo_dir / "src" / "calculator.py").read_text(encoding="utf-8"), orig_calc)

    # 15. Exactly the trusted verification plan is executed (ARCHB-VERIF-001)
    def test_15_exact_trusted_verification_plan_is_executed(self):
        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            verification_requirements=["PYTHONPATH=. python3 -m unittest discover -s tests"],
        )
        plan = resolve_canonical_verification_plan(auth)
        self.assertEqual(len(plan.steps), 1)
        self.assertEqual(plan.steps[0].environment, {"PYTHONPATH": "."})
        self.assertEqual(plan.steps[0].argv, ["python3", "-m", "unittest", "discover", "-s", "tests"])

    # 16. Missing verification requirements fail closed (ARCHB-VERIF-001)
    def test_16_missing_verification_requirements_fail_closed(self):
        auth_empty = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, verification_requirements=[])
        plan_empty = resolve_canonical_verification_plan(auth_empty)
        self.assertEqual(plan_empty.command, "")
        self.assertEqual(plan_empty.steps, [])
        if self.docker_ready:
            backend = DockerExecutionBackend(workspace_root=self.repo_dir)
            verifier = DockerSandboxVerificationAdapter(backend, reuse_last_turn_result=False)
            res = verifier.verify("PROMPT #001", plan_empty)
            self.assertFalse(res.executed)
            self.assertFalse(res.passed)
            self.assertEqual(res.provenance, VerificationProvenance.UNVERIFIED)

    # 17. Multiple structured verification steps execute in order (ARCHB-VERIF-001)
    def test_17_multiple_structured_verification_steps_execute_in_order(self):
        self.assertTrue(self.docker_ready)
        (self.repo_dir / "src" / "calculator.py").write_text(
            "def add(a, b): return a + b\ndef multiply(a, b): return a * b\n", encoding="utf-8"
        )
        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            verification_requirements=[
                "PYTHONPATH=. python3 -c \"import src.calculator as c; assert c.add(2, 2) == 4\"",
                "python3 -m unittest discover -s tests",
            ],
        )
        plan = resolve_canonical_verification_plan(auth)
        self.assertEqual(len(plan.steps), 2)
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        verifier = DockerSandboxVerificationAdapter(backend, reuse_last_turn_result=False)
        res = verifier.verify("PROMPT #001", plan)
        self.assertTrue(res.executed)
        self.assertTrue(res.passed)
        self.assertEqual(res.provenance, VerificationProvenance.EXECUTED_TRUSTED)
        self.assertIn("[Step 1/2]", res.observable_output)
        self.assertIn("[Step 2/2]", res.observable_output)

    # 18. Compound command syntax is explicitly rejected (ARCHB-VERIF-001)
    def test_18_compound_command_syntax_explicitly_rejected(self):
        for bad_cmd in ["pytest && flake8", "python3 -m unittest; echo pwn", "cat a | grep b", "echo $(id)"]:
            with self.assertRaises(ValueError) as ctx:
                parse_structured_verification_step(bad_cmd)
            self.assertIn("Compound shell syntax is rejected", str(ctx.exception))

    # 19. Protected non-secret files remain available for builds (ARCHB-SNAP-001)
    def test_19_protected_non_secret_files_remain_available_for_builds(self):
        (self.repo_dir / "src" / "config.json").write_text('{"feature_flag": true}\n', encoding="utf-8")
        (self.repo_dir / "package.json").write_text('{"name": "demo-app"}\n', encoding="utf-8")
        subprocess.run(["git", "add", "src/config.json", "package.json"], cwd=str(self.repo_dir), capture_output=True, check=True)
        subprocess.run(["git", "commit", "-m", "Add config and package.json"], cwd=str(self.repo_dir), capture_output=True, check=True)

        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            allowed_paths=["src"],
            protected_resources=["package.json", "src/config.json"],
        )
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        self.assertTrue(baseline.has_path("package.json"))
        self.assertTrue(baseline.has_path("src/config.json"))

    # 20. Protected resource modifications are rejected on export (ARCHB-SNAP-001)
    def test_20_protected_resource_modifications_rejected_on_export(self):
        (self.repo_dir / "src" / "config.json").write_text('{"feature_flag": true}\n', encoding="utf-8")
        subprocess.run(["git", "add", "src/config.json"], cwd=str(self.repo_dir), capture_output=True, check=True)
        subprocess.run(["git", "commit", "-m", "Add config"], cwd=str(self.repo_dir), capture_output=True, check=True)

        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            allowed_paths=["src"],
            protected_resources=["src/config.json"],
        )
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        exported = dict(baseline.file_bytes)
        exported["src/config.json"] = b'{"feature_flag": false}\n'
        delta = compute_workspace_delta(baseline, exported)
        with self.assertRaises(UnauthorizedPathError):
            validate_delta_authorization(delta, auth)

    # 21. Secrets are excluded from snapshots (ARCHB-SNAP-001)
    def test_21_secrets_are_excluded_from_snapshots(self):
        (self.repo_dir / ".env").write_text("SECRET=1\n", encoding="utf-8")
        (self.repo_dir / "src" / "api_secrets.json").write_text('{"key": "123"}\n', encoding="utf-8")
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        self.assertFalse(baseline.has_path(".env"))
        self.assertFalse(baseline.has_path("src/api_secrets.json"))

    # 22. Read-only objectives cannot call arbitrary mutating commands (ARCHB-BROKER-002)
    def test_22_readonly_objectives_cannot_call_arbitrary_commands(self):
        self.assertTrue(self.docker_ready)
        auth_ro = ObjectiveAuthorization("PROMPT #001", MutationExpectation.NOT_ALLOWED, allowed_paths=["src"])
        broker_ro = MediatedToolBroker(self.shared_container, auth_ro, retire_container_on_timeout=False)
        res = json.loads(broker_ro.dispatch_tool("run_command", {"command": "python3 -c \"print('hi')\""}))
        self.assertIn("SECURITY_POLICY_REJECTED", res.get("error", ""))

    # 23. Shell redirection cannot bypass NOT_ALLOWED policy (ARCHB-BROKER-002)
    def test_23_shell_redirection_cannot_bypass_not_allowed_policy(self):
        self.assertTrue(self.docker_ready)
        auth_ro = ObjectiveAuthorization("PROMPT #001", MutationExpectation.NOT_ALLOWED, allowed_paths=["src"])
        broker_ro = MediatedToolBroker(self.shared_container, auth_ro, retire_container_on_timeout=False)
        res = json.loads(broker_ro.dispatch_tool("run_command", {"command": "echo hacked > src/calculator.py"}))
        self.assertIn("SECURITY_POLICY_REJECTED", res.get("error", ""))

    # 24 & 25. Container command timeout ends affected execution and leaves zero orphaned processes (ARCHB-BROKER-002)
    def test_24_container_command_timeout_ends_affected_execution(self):
        self.assertTrue(self.docker_ready)
        container = DockerSandboxContainer(image=DEFAULT_SANDBOX_IMAGE, dispatch_id="timeout_test_24")
        container.start()
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        broker = MediatedToolBroker(container, auth, retire_container_on_timeout=True)
        res = json.loads(broker.dispatch_tool("run_command", {"command": "sleep 30", "timeout": 1}))
        self.assertIn("TIMEOUT_CONTAINER_RETIRED", res.get("error", ""))
        self.assertTrue(container.timed_out)
        self.assertTrue(container.retired)
        res_after = json.loads(broker.dispatch_tool("list_files", {"path": "."}))
        self.assertIn("retired", res_after.get("error", ""))

    def test_25_no_orphaned_timeout_processes_remain(self):
        self.assertTrue(self.docker_ready)
        container = DockerSandboxContainer(image=DEFAULT_SANDBOX_IMAGE, dispatch_id="timeout_test_25")
        container.start()
        cid = container.container_id
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        broker = MediatedToolBroker(container, auth, retire_container_on_timeout=True)
        broker.dispatch_tool("run_command", {"command": "sleep 30", "timeout": 1})
        insp = subprocess.run(["docker", "ps", "-a", "-q", "--filter", f"id={cid}"], capture_output=True, text=True)
        self.assertEqual(insp.stdout.strip(), "")

    # 26. Case-only rename is detected (ARCHB-SYNC-002)
    def test_26_case_only_rename_is_detected(self):
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        exported = dict(baseline.file_bytes)
        exported["src/Calculator.py"] = exported.pop("src/calculator.py")
        delta = compute_workspace_delta(baseline, exported)
        self.assertIn(("src/calculator.py", "src/Calculator.py"), delta.renamed)
        self.assertIn("src/calculator.py", delta.deleted)
        self.assertIn("src/Calculator.py", delta.created)

    # 27. Normal Windows case-insensitive allowed-path matching remains correct
    def test_27_windows_case_insensitive_allowed_path_matching(self):
        self.assertTrue(is_path_authorized("src/calculator.py", ["SRC"]))
        self.assertTrue(is_path_authorized("SRC/Calculator.py", ["src"]))

    # 28. Duplicate normalized paths are rejected (ARCHB-SYNC-002)
    def test_28_duplicate_normalized_paths_rejected(self):
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot()
        dup_export = dict(baseline.file_bytes)
        dup_export["src/module_x.py"] = b"x = 1\n"
        dup_export["src/Module_X.py"] = b"x = 2\n"
        with self.assertRaises(DuplicateNormalizedPathError):
            compute_workspace_delta(baseline, dup_export)

    # 29. Multi-file application succeeds on a disposable repository
    def test_29_multi_file_application_succeeds_on_disposable_repo(self):
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src", "tests"])
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        exported = dict(baseline.file_bytes)
        exported["src/calculator.py"] = b"def add(a, b):\n    return a + b\n"
        exported["src/new_util.py"] = b"UTIL = 1\n"
        delta = compute_workspace_delta(baseline, exported)
        verif = VerificationResult(executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED)
        res = DirectSourceSynchronizer(self.repo_dir).synchronize(delta, baseline, auth, verif)
        self.assertTrue(res.applied)
        self.assertTrue((self.repo_dir / "src" / "new_util.py").is_file())

    # 30. Simulated I/O failure restores prior file contents
    def test_30_simulated_io_failure_restores_prior_file_contents(self):
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        orig_bytes = baseline.file_bytes["src/calculator.py"]
        exported = dict(baseline.file_bytes)
        exported["src/calculator.py"] = b"# modified\n"
        exported["src/extra.py"] = b"# fails\n"
        delta = compute_workspace_delta(baseline, exported)
        verif = VerificationResult(executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED)
        io_fail_sync = DirectSourceSynchronizer(
            self.repo_dir,
            fault_injector=lambda p: (_ for _ in ()).throw(IOError("Disk write error")) if p == "src/extra.py" else None,
        )
        with self.assertRaises(SyncTransactionRollbackError):
            io_fail_sync.synchronize(delta, baseline, auth, verif)
        self.assertEqual((self.repo_dir / "src" / "calculator.py").read_bytes(), orig_bytes)
        self.assertFalse((self.repo_dir / "src" / "extra.py").exists())

    # 31. Simulated crash leaves recoverable transaction evidence (ARCHB-SYNC-002)
    def test_31_simulated_crash_leaves_recoverable_transaction_evidence(self):
        class HardCrashError(BaseException):
            _simulate_hard_crash = True

        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        orig_bytes = baseline.file_bytes["src/calculator.py"]
        exported = dict(baseline.file_bytes)
        exported["src/calculator.py"] = b"def add(a, b):\n    return a + b\n"
        exported["src/extra.py"] = b"extra = True\n"
        delta = compute_workspace_delta(baseline, exported)
        verif = VerificationResult(executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED)

        crash_sync = DirectSourceSynchronizer(
            self.repo_dir,
            crash_injector=lambda p: (_ for _ in ()).throw(HardCrashError("SIGKILL")) if p == "src/extra.py" else None,
        )
        with self.assertRaises(HardCrashError):
            crash_sync.synchronize(delta, baseline, auth, verif)

        interrupted = crash_sync.get_interrupted_transactions()
        self.assertEqual(len(interrupted), 1)
        self.assertEqual(interrupted[0]["status"], "APPLYING")
        recovered = crash_sync.recover_interrupted_transactions()
        self.assertEqual(len(recovered), 1)
        self.assertEqual((self.repo_dir / "src" / "calculator.py").read_bytes(), orig_bytes)

    # 32. Recovery never destroys concurrent user changes (ARCHB-SYNC-002)
    def test_32_recovery_never_destroys_concurrent_user_changes(self):
        class HardCrashError(BaseException):
            _simulate_hard_crash = True

        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        exported = dict(baseline.file_bytes)
        exported["src/calculator.py"] = b"def add(a, b):\n    return a + b\n"
        exported["src/extra.py"] = b"extra = True\n"
        delta = compute_workspace_delta(baseline, exported)
        verif = VerificationResult(executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED)

        crash_sync = DirectSourceSynchronizer(
            self.repo_dir,
            crash_injector=lambda p: (_ for _ in ()).throw(HardCrashError("SIGKILL")) if p == "src/extra.py" else None,
        )
        with self.assertRaises(HardCrashError):
            crash_sync.synchronize(delta, baseline, auth, verif)

        # User edits src/calculator.py after the crash
        (self.repo_dir / "src" / "calculator.py").write_bytes(b"# Concurrent post-crash user edit!\n")
        with self.assertRaises(StaleBaselineConflictError):
            crash_sync.recover_interrupted_transactions()
        self.assertEqual((self.repo_dir / "src" / "calculator.py").read_bytes(), b"# Concurrent post-crash user edit!\n")

    # 33 & 34. Existing staged/index state remains unchanged; no Git staging/commit/push
    def test_33_existing_staged_index_state_remains_unchanged(self):
        (self.repo_dir / "README.md").write_text("# Staged User Edit\n", encoding="utf-8")
        subprocess.run(["git", "add", "README.md"], cwd=str(self.repo_dir), capture_output=True, check=True)
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(authorization=auth)
        exported = dict(baseline.file_bytes)
        exported["src/calculator.py"] = b"def add(a, b):\n    return a + b\n"
        delta = compute_workspace_delta(baseline, exported)
        verif = VerificationResult(executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED)
        DirectSourceSynchronizer(self.repo_dir).synchronize(delta, baseline, auth, verif)
        self.assertEqual(GitManager(self.repo_dir).get_staged_files(), ["README.md"])

    def test_34_no_git_staging_commit_or_push_on_two_phase_pass(self):
        self.assertTrue(self.docker_ready)
        turns = [
            {
                "role": "assistant",
                "content": "Read file and fix bug",
                "tool_calls": [
                    {"id": "c1", "type": "function", "function": {"name": "read_file", "arguments": json.dumps({"path": "src/calculator.py"})}},
                    {
                        "id": "c2",
                        "type": "function",
                        "function": {
                            "name": "patch_file",
                            "arguments": json.dumps({
                                "path": "src/calculator.py",
                                "old_string": "return a - b  # Intentional bug for repair workflow",
                                "new_string": "return a + b",
                            }),
                        },
                    },
                ],
            },
            {"role": "assistant", "content": "Fixed add() and verified.\nEND OF RESULT — PROMPT #001"},
        ]
        backend = DockerExecutionBackend(workspace_root=self.repo_dir, model_client=ScriptedToolLoopModelClient(turns))
        verifier = DockerSandboxVerificationAdapter(backend)
        engine = OrchestratorEngine(OrchestratorConfig(workspace_root=self.repo_dir), verification_adapter=verifier, execution_backend=backend)
        engine.initialize_workspace("Two-Phase Engine Pass", "All tests pass")
        engine.controller.formulate_next_prompt = MagicMock(return_value=("Fix calculator add()", "PROMPT #001\nFix add()", MutationExpectation.REQUIRED))
        engine.controller.reconcile_result = MagicMock(return_value=ControllerResult(
            correlation_id="PROMPT #001",
            objective="Fix calculator add()",
            controller_disposition=ControllerDisposition.PASS,
            mutation_expectation=MutationExpectation.REQUIRED,
        ))
        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            allowed_paths=["src"],
            verification_requirements=["python3 -m unittest discover -s tests"],
        )
        head_before = GitManager(self.repo_dir).get_head()
        disp = engine.run_step(authorization=auth)
        self.assertEqual(disp, ControllerDisposition.PASS)
        self.assertTrue(backend.last_prepared_execution.applied)
        self.assertEqual(GitManager(self.repo_dir).get_head(), head_before)
        self.assertEqual(GitManager(self.repo_dir).get_staged_files(), [])

    # 35. Custom model API configuration remains unchanged
    def test_35_custom_model_api_configuration_remains_unchanged(self):
        ep = resolve_hermes_model_endpoint()
        self.assertEqual(ep.base_url, "http://127.0.0.1:8045/v1")
        self.assertEqual(ep.provider, "custom:antigravity-manager")
        self.assertEqual(ep.model, "gemini-3.8-flash-high")

    # 36. Unattended execution remains disabled by default
    def test_36_unattended_execution_remains_disabled_by_default(self):
        default_engine = OrchestratorEngine(OrchestratorConfig(workspace_root=self.repo_dir))
        self.assertIsInstance(default_engine.execution_backend, UnavailableExecutionBackend)
        self.assertFalse(default_engine.execution_backend.is_certified_isolated)

    # 37. Auto-sync option is permanently prohibited and raises ValueError (ARCHB-PROMO-001)
    def test_37_auto_sync_to_working_tree_permanently_prohibited(self):
        with self.assertRaises(ValueError) as ctx:
            DockerExecutionBackend(
                workspace_root=self.repo_dir,
                auto_sync_to_working_tree=True,
            )
        self.assertIn("auto_sync_to_working_tree is permanently prohibited and removed", str(ctx.exception))

    # 38. Objective A verification cannot certify objective B (ARCHB-VERIF-002)
    def test_38_objective_a_verification_cannot_certify_objective_b(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        verifier = DockerSandboxVerificationAdapter(backend, reuse_last_turn_result=True)
        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# new"})
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        plan = resolve_canonical_verification_plan(auth, TrustedVerificationPlan(command="python3 -m unittest"))
        v_res = VerificationResult(
            executed=True,
            passed=True,
            exit_status=0,
            provenance=VerificationProvenance.EXECUTED_TRUSTED,
            objective_id="PROMPT #001",
            plan_digest=compute_verification_plan_digest(plan),
            verified_delta_digest=delta.compute_manifest_digest(),
        )
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=v_res,
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth),
            plan_digest=compute_verification_plan_digest(plan),
        )
        backend.last_verification_result = v_res
        res = verifier.verify("PROMPT #002", plan)
        self.assertFalse(res.passed)
        self.assertEqual(res.provenance, VerificationProvenance.UNVERIFIED)
        self.assertIn("objective mismatch", res.limitations[0])

    # 39. Plan A evidence cannot certify plan B (ARCHB-VERIF-002)
    def test_39_plan_a_evidence_cannot_certify_plan_b(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        verifier = DockerSandboxVerificationAdapter(backend, reuse_last_turn_result=True)
        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# new"})
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        plan_a = resolve_canonical_verification_plan(auth, TrustedVerificationPlan(command="python3 -m unittest discover -s tests"))
        plan_b = resolve_canonical_verification_plan(auth, TrustedVerificationPlan(command="pytest tests"))
        v_res = VerificationResult(
            executed=True,
            passed=True,
            exit_status=0,
            provenance=VerificationProvenance.EXECUTED_TRUSTED,
            objective_id="PROMPT #001",
            plan_digest=compute_verification_plan_digest(plan_a),
            verified_delta_digest=delta.compute_manifest_digest(),
        )
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=v_res,
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth),
            plan_digest=compute_verification_plan_digest(plan_a),
        )
        backend.last_verification_result = v_res
        res = verifier.verify("PROMPT #001", plan_b)
        self.assertFalse(res.passed)
        self.assertEqual(res.provenance, VerificationProvenance.UNVERIFIED)
        self.assertIn("plan digest mismatch", res.limitations[0])

    # 40. Delta A evidence cannot certify delta B (ARCHB-VERIF-002)
    def test_40_delta_a_evidence_cannot_certify_delta_b(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        verifier = DockerSandboxVerificationAdapter(backend, reuse_last_turn_result=True)
        delta_a = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# a"})
        delta_b = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# b"})
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        plan = resolve_canonical_verification_plan(auth, TrustedVerificationPlan(command="python3 -m unittest"))
        v_res = VerificationResult(
            executed=True,
            passed=True,
            exit_status=0,
            provenance=VerificationProvenance.EXECUTED_TRUSTED,
            objective_id="PROMPT #001",
            plan_digest=compute_verification_plan_digest(plan),
            verified_delta_digest=delta_a.compute_manifest_digest(),
        )
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta_b,
            verified_delta_digest=delta_b.compute_manifest_digest(),
            verification_result=v_res,
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth),
            plan_digest=compute_verification_plan_digest(plan),
        )
        backend.last_verification_result = v_res
        res = verifier.verify("PROMPT #001", plan)
        self.assertFalse(res.passed)
        self.assertEqual(res.provenance, VerificationProvenance.UNVERIFIED)
        self.assertIn("verified_delta_digest mismatch", res.limitations[0])

    # 41. Missing binding fields fail closed (ARCHB-VERIF-002)
    def test_41_missing_binding_fields_fail_closed(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        verifier = DockerSandboxVerificationAdapter(backend, reuse_last_turn_result=True)
        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# new"})
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        plan = resolve_canonical_verification_plan(auth, TrustedVerificationPlan(command="python3 -m unittest"))
        v_res = VerificationResult(
            executed=True,
            passed=True,
            exit_status=0,
            provenance=VerificationProvenance.EXECUTED_TRUSTED,
        )
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=v_res,
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth),
            plan_digest=compute_verification_plan_digest(plan),
        )
        backend.last_verification_result = v_res
        res = verifier.verify("PROMPT #001", plan)
        self.assertFalse(res.passed)
        self.assertEqual(res.provenance, VerificationProvenance.UNVERIFIED)

    # 42. Expired preparation cannot reuse verification (ARCHB-VERIF-002)
    def test_42_expired_preparation_cannot_reuse_verification(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        verifier = DockerSandboxVerificationAdapter(backend, reuse_last_turn_result=True)
        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# new"})
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        plan = resolve_canonical_verification_plan(auth, TrustedVerificationPlan(command="python3 -m unittest"))
        v_res = VerificationResult(
            executed=True,
            passed=True,
            exit_status=0,
            provenance=VerificationProvenance.EXECUTED_TRUSTED,
            objective_id="PROMPT #001",
            plan_digest=compute_verification_plan_digest(plan),
            verified_delta_digest=delta.compute_manifest_digest(),
        )
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=v_res,
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            expired=True,
            authorization_digest=compute_authorization_digest(auth),
            plan_digest=compute_verification_plan_digest(plan),
        )
        backend.last_verification_result = v_res
        res = verifier.verify("PROMPT #001", plan)
        self.assertFalse(res.passed)
        self.assertIn("already expired", res.limitations[0])

    # 43. Already-applied preparation cannot be promoted twice (ARCHB-SYNC-001)
    def test_43_already_applied_preparation_cannot_be_promoted_twice(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# app"})
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"], requires_verification=False)
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=VerificationResult(executed=True, passed=True, provenance=VerificationProvenance.EXECUTED_TRUSTED),
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            applied=True,
            authorization_digest=compute_authorization_digest(auth),
        )
        with self.assertRaises(UnverifiedSyncError) as ctx:
            backend.commit_prepared_execution("PROMPT #001", True, ControllerDisposition.PASS, authorization=auth)
        self.assertIn("already been consumed or expired", str(ctx.exception))

    # 44. UNVERIFIED or SIMULATED evidence cannot promote (ARCHB-VERIF-002)
    def test_44_unverified_or_simulated_evidence_cannot_promote(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# sim"})
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"], requires_verification=True)
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=VerificationResult(executed=True, passed=True, provenance=VerificationProvenance.SIMULATED, objective_id="PROMPT #001", verified_delta_digest=delta.compute_manifest_digest()),
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth),
        )
        with self.assertRaises(UnverifiedSyncError):
            backend.commit_prepared_execution("PROMPT #001", True, ControllerDisposition.PASS, authorization=auth)

    # 45. Failed prepared verification cannot be overridden by external result (ARCHB-VERIF-002)
    def test_45_failed_prepared_verification_cannot_be_overridden_by_external_result(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# fail"})
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"], requires_verification=True)
        plan = resolve_canonical_verification_plan(auth, TrustedVerificationPlan(command="python3 -m unittest"))
        failed_prep_v = VerificationResult(
            executed=True,
            passed=False,
            exit_status=1,
            provenance=VerificationProvenance.FAILED,
            objective_id="PROMPT #001",
            plan_digest=compute_verification_plan_digest(plan),
            verified_delta_digest=delta.compute_manifest_digest(),
        )
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=failed_prep_v,
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth),
            plan_digest=compute_verification_plan_digest(plan),
        )
        forged_passed_v = VerificationResult(
            executed=True,
            passed=True,
            exit_status=0,
            provenance=VerificationProvenance.EXECUTED_TRUSTED,
            objective_id="PROMPT #001",
            plan_digest=compute_verification_plan_digest(plan),
            verified_delta_digest=delta.compute_manifest_digest(),
        )
        with self.assertRaises(UnverifiedSyncError) as ctx:
            backend.commit_prepared_execution(
                "PROMPT #001",
                True,
                ControllerDisposition.PASS,
                verification_result=forged_passed_v,
                authorization=auth,
            )
        self.assertIn("prepared verification did not pass with EXECUTED_TRUSTED provenance", str(ctx.exception))

    # 46. Successful result from another turn cannot be reused after consumption (ARCHB-VERIF-002)
    def test_46_successful_result_from_another_turn_cannot_be_reused(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        verifier = DockerSandboxVerificationAdapter(backend, reuse_last_turn_result=True)
        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# new"})
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"])
        plan = resolve_canonical_verification_plan(auth, TrustedVerificationPlan(command="python3 -m unittest"))
        v_res = VerificationResult(
            executed=True,
            passed=True,
            exit_status=0,
            provenance=VerificationProvenance.EXECUTED_TRUSTED,
            objective_id="PROMPT #001",
            plan_digest=compute_verification_plan_digest(plan),
            verified_delta_digest=delta.compute_manifest_digest(),
        )
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=v_res,
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth),
            plan_digest=compute_verification_plan_digest(plan),
        )
        backend.last_verification_result = v_res
        first = verifier.verify("PROMPT #001", TrustedVerificationPlan(command="python3 -m unittest"))
        self.assertTrue(first.passed)
        self.assertIsNone(backend.last_verification_result)

    # 47. Phase 2 authorization revalidation rejects altered policy (ARCHB-PROMO-001)
    def test_47_phase_2_authorization_revalidation_rejects_altered_policy(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# auth"})
        auth_original = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"], verification_requirements=["python3 -m unittest"])
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth_original,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=VerificationResult(executed=True, passed=True, provenance=VerificationProvenance.EXECUTED_TRUSTED, objective_id="PROMPT #001", verified_delta_digest=delta.compute_manifest_digest()),
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth_original),
        )
        # Subcase 1: changed allowed_paths
        auth_changed_paths = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src", "tests"], verification_requirements=["python3 -m unittest"])
        with self.assertRaises(UnverifiedSyncError):
            backend.commit_prepared_execution("PROMPT #001", True, ControllerDisposition.PASS, authorization=auth_changed_paths)
        # Subcase 2: changed mutation_permission
        auth_changed_mut = ObjectiveAuthorization("PROMPT #001", MutationExpectation.OPTIONAL, allowed_paths=["src"], verification_requirements=["python3 -m unittest"])
        with self.assertRaises(UnverifiedSyncError):
            backend.commit_prepared_execution("PROMPT #001", True, ControllerDisposition.PASS, authorization=auth_changed_mut)
        # Subcase 3: changed verification_requirements
        auth_changed_verif = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"], verification_requirements=["pytest"])
        with self.assertRaises(UnverifiedSyncError):
            backend.commit_prepared_execution("PROMPT #001", True, ControllerDisposition.PASS, authorization=auth_changed_verif)

    # 48. In-place mutation of prepared.authorization blocks promotion (ARCHB-PROMO-001)
    def test_48_inplace_mutation_of_prepared_authorization_blocks_promotion(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# inplace"})
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"], requires_verification=False)
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=VerificationResult(executed=True, passed=True, provenance=VerificationProvenance.EXECUTED_TRUSTED),
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth),
        )
        auth_copy = ObjectiveAuthorization.from_dict(auth.to_dict())
        backend.last_prepared_execution.authorization.allowed_paths.append("evil_path")
        with self.assertRaises(UnverifiedSyncError) as ctx:
            backend.commit_prepared_execution("PROMPT #001", True, ControllerDisposition.PASS, authorization=auth_copy)
        self.assertIn("prepared authorization was mutated after Phase 1", str(ctx.exception))

    # 49. Cross-objective prepared result substitution fails closed (ARCHB-PROMO-001)
    def test_49_cross_objective_prepared_result_substitution_fails_closed(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# sub"})
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"], requires_verification=False)
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=VerificationResult(executed=True, passed=True, provenance=VerificationProvenance.EXECUTED_TRUSTED),
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth),
        )
        with self.assertRaises(UnverifiedSyncError) as ctx:
            backend.commit_prepared_execution("PROMPT #002", True, ControllerDisposition.PASS, authorization=auth)
        self.assertIn("correlation mismatch", str(ctx.exception))

    # 50. Stale host baseline blocks promotion (ARCHB-SYNC-001)
    def test_50_stale_host_baseline_blocks_promotion(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        target_f = self.repo_dir / "src" / "calculator.py"
        orig_bytes = target_f.read_bytes()
        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# stale test"})
        auth = ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src"], requires_verification=False)
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(auth)
        target_f.write_text("# concurrent user edit", encoding="utf-8")
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=baseline,
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=VerificationResult(executed=True, passed=True, provenance=VerificationProvenance.EXECUTED_TRUSTED),
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth),
        )
        with self.assertRaises(StaleBaselineConflictError):
            backend.commit_prepared_execution("PROMPT #001", True, ControllerDisposition.PASS, authorization=auth)
        target_f.write_bytes(orig_bytes)

    # 51. Transaction recovery rejects path traversal and escapes (ARCHB-TX-001)
    def test_51_transaction_recovery_rejects_path_traversal_and_escapes(self):
        sync = DirectSourceSynchronizer(self.repo_dir)
        tx_dir = sync.transaction_dir / "tx_traversal_01"
        tx_dir.mkdir(parents=True, exist_ok=True)
        manifest = {
            "tx_id": "tx_traversal_01",
            "status": "APPLYING",
            "affected_paths": ["../escape.txt"],
            "preimage_hashes": {"../escape.txt": None},
            "postimage_hashes": {"../escape.txt": "abc"},
            "preimage_files": {},
        }
        (tx_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaises(PathTraversalError):
            sync.recover_interrupted_transactions()
        shutil.rmtree(tx_dir, ignore_errors=True)

    # 52. Transaction recovery rejects preimage escapes (ARCHB-TX-001)
    def test_52_transaction_recovery_rejects_preimage_escapes(self):
        sync = DirectSourceSynchronizer(self.repo_dir)
        tx_dir = sync.transaction_dir / "tx_preimage_escape_01"
        (tx_dir / "preimages").mkdir(parents=True, exist_ok=True)
        manifest = {
            "tx_id": "tx_preimage_escape_01",
            "status": "APPLYING",
            "affected_paths": ["src/calculator.py"],
            "preimage_hashes": {"src/calculator.py": "abc"},
            "postimage_hashes": {"src/calculator.py": "def"},
            "preimage_files": {"src/calculator.py": "../../secret.bin"},
        }
        (tx_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaises(PathTraversalError):
            sync.recover_interrupted_transactions()
        shutil.rmtree(tx_dir, ignore_errors=True)

    # 53. Corrupted JSON and missing preimages produce typed failures (ARCHB-TX-001)
    def test_53_corrupted_json_and_missing_preimages_produce_typed_failures(self):
        sync = DirectSourceSynchronizer(self.repo_dir)
        tx_dir1 = sync.transaction_dir / "tx_corrupt_json"
        tx_dir1.mkdir(parents=True, exist_ok=True)
        (tx_dir1 / "manifest.json").write_text('{"tx_id": "tx_corrupt_json", "status": "APPLYING", "affected_paths": [', encoding="utf-8")
        with self.assertRaises(CorruptedTransactionError):
            sync.recover_interrupted_transactions()
        shutil.rmtree(tx_dir1, ignore_errors=True)

        tx_dir2 = sync.transaction_dir / "tx_missing_preimage"
        (tx_dir2 / "preimages").mkdir(parents=True, exist_ok=True)
        manifest2 = {
            "tx_id": "tx_missing_preimage",
            "status": "APPLYING",
            "affected_paths": ["src/calculator.py"],
            "preimage_hashes": {"src/calculator.py": "0123456789abcdef"},
            "postimage_hashes": {"src/calculator.py": "fedcba9876543210"},
            "preimage_files": {"src/calculator.py": "file_0001.bin"},
        }
        (tx_dir2 / "manifest.json").write_text(json.dumps(manifest2), encoding="utf-8")
        with self.assertRaises(CorruptedTransactionError) as ctx:
            sync.recover_interrupted_transactions()
        self.assertIn("Missing preimage file", str(ctx.exception))
        shutil.rmtree(tx_dir2, ignore_errors=True)

    # 54. Safely incomplete PREPARED journals handled idempotently (ARCHB-TX-001)
    def test_54_safely_incomplete_prepared_journals_handled_idempotently(self):
        sync = DirectSourceSynchronizer(self.repo_dir)
        tx_dir = sync.transaction_dir / "tx_safe_prepared_01"
        tx_dir.mkdir(parents=True, exist_ok=True)
        manifest = {
            "tx_id": "tx_safe_prepared_01",
            "status": "PREPARED",
            "affected_paths": ["src/calculator.py"],
        }
        manifest_p = tx_dir / "manifest.json"
        manifest_p.write_text(json.dumps(manifest), encoding="utf-8")
        recovered = sync.recover_interrupted_transactions()
        self.assertIn("tx_safe_prepared_01", recovered)
        updated = json.loads(manifest_p.read_text(encoding="utf-8"))
        self.assertEqual(updated["status"], "CANCELLED")
        shutil.rmtree(tx_dir, ignore_errors=True)

    # 55. Windows case-only rename recovery restores original spelling (ARCHB-SYNC-002)
    def test_55_windows_case_only_rename_recovery_restores_original_spelling(self):
        with tempfile.TemporaryDirectory() as tmp_d:
            repo = Path(tmp_d)
            f_orig = repo / "Foo.txt"
            f_orig.write_text("ORIGINAL_CONTENT", encoding="utf-8")
            self.assertTrue(host_file_exact_case_exists(repo, "Foo.txt"))
            self.assertFalse(host_file_exact_case_exists(repo, "foo.txt"))

            sync = DirectSourceSynchronizer(repo)
            tx_dir = sync.transaction_dir / "tx_case_rename"
            (tx_dir / "preimages").mkdir(parents=True, exist_ok=True)
            blob_path = tx_dir / "preimages" / "file_0000.bin"
            blob_path.write_bytes(b"ORIGINAL_CONTENT")
            import hashlib
            orig_sha = hashlib.sha256(b"ORIGINAL_CONTENT").hexdigest()
            new_sha = hashlib.sha256(b"NEW_CONTENT").hexdigest()

            f_orig.unlink()
            (repo / "foo.txt").write_text("NEW_CONTENT", encoding="utf-8")

            manifest = {
                "tx_id": "tx_case_rename",
                "status": "APPLYING",
                "affected_paths": ["foo.txt", "Foo.txt"],
                "preimage_hashes": {"foo.txt": None, "Foo.txt": orig_sha},
                "postimage_hashes": {"foo.txt": new_sha, "Foo.txt": None},
                "preimage_files": {"Foo.txt": "file_0000.bin"},
            }
            (tx_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

            recovered = sync.recover_interrupted_transactions()
            self.assertIn("tx_case_rename", recovered)
            self.assertTrue(host_file_exact_case_exists(repo, "Foo.txt"))
            self.assertFalse(host_file_exact_case_exists(repo, "foo.txt"))
            self.assertEqual((repo / "Foo.txt").read_text(encoding="utf-8"), "ORIGINAL_CONTENT")

    # 56. Unauthorized sandbox deltas produce structured failure (ARCHB-SYNC-003)
    def test_56_unauthorized_sandbox_deltas_produce_structured_failure(self):
        self.assertTrue(self.docker_ready)
        orig_calc = (self.repo_dir / "src" / "calculator.py").read_text(encoding="utf-8")
        turns = [
            {
                "role": "assistant",
                "content": "Modify protected file via run_command inside sandbox",
                "tool_calls": [{
                    "id": "t1",
                    "type": "function",
                    "function": {
                        "name": "run_command",
                        "arguments": json.dumps({
                            "command": "python3 -c \"open('package.json', 'w').write('hacked')\""
                        }),
                    },
                }],
            },
            {"role": "assistant", "content": "Done hacking\nEND OF RESULT — PROMPT #001"},
        ]
        backend = DockerExecutionBackend(
            workspace_root=self.repo_dir,
            model_client=ScriptedToolLoopModelClient(turns),
        )
        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            allowed_paths=["src"],
            verification_requirements=["python3 -m unittest discover -s tests"],
        )
        resp = backend.execute("PROMPT #001", authorization=auth)
        self.assertEqual(resp.exit_code, 1)
        self.assertIn("UNAUTHORIZED_DELTA_REJECTED", resp.stderr)
        prep = backend.last_prepared_execution
        self.assertIsNotNone(prep)
        self.assertTrue(prep.expired)
        self.assertFalse(prep.loop_completed)
        self.assertIn("package.json", prep.unauthorized_deltas)
        self.assertEqual((self.repo_dir / "src" / "calculator.py").read_text(encoding="utf-8"), orig_calc)

        with self.assertRaises(UnverifiedSyncError):
            backend.commit_prepared_execution("PROMPT #001", True, ControllerDisposition.PASS, authorization=auth)

    # 57. In-process _rollback() preserves Windows case-only rename source & reports incomplete rollback (ARCHB-SYNC-004)
    def test_57_in_process_rollback_preserves_windows_case_only_rename_source(self):
        with tempfile.TemporaryDirectory() as tmp_d:
            repo = Path(tmp_d)
            subprocess.run(["git", "init"], cwd=str(repo), capture_output=True, check=True)
            subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=str(repo), capture_output=True, check=True)
            subprocess.run(["git", "config", "user.name", "Test User"], cwd=str(repo), capture_output=True, check=True)
            (repo / "src").mkdir(parents=True, exist_ok=True)
            (repo / "src" / "Foo.ts").write_text("ORIGINAL_CONTENT", encoding="utf-8")
            (repo / "src" / "unrelated.ts").write_text("UNRELATED_CONTENT", encoding="utf-8")
            subprocess.run(["git", "add", "."], cwd=str(repo), capture_output=True, check=True)
            subprocess.run(["git", "commit", "-m", "initial"], cwd=str(repo), capture_output=True, check=True)
            head_before = GitManager(repo).get_head()

            auth = ObjectiveAuthorization(
                "PROMPT #001",
                MutationExpectation.REQUIRED,
                allowed_paths=["src"],
                requires_verification=False,
            )
            baseline = SnapshotBuilder(repo).capture_snapshot(auth)
            delta = compute_workspace_delta(
                baseline,
                {
                    "src/foo.ts": b"NEW_CONTENT",
                    "src/unrelated.ts": b"UNRELATED_CONTENT",
                    "src/z_after.ts": b"AFTER_CONTENT",
                },
            )
            self.assertEqual(delta.renamed, [("src/Foo.ts", "src/foo.ts")])

            # Subcase A: Failure injected during creation of src/foo.ts (after src/Foo.ts was unlinked)
            def fail_on_foo_create(rel_p: str) -> None:
                if rel_p == "src/foo.ts":
                    raise OSError("Simulated write error during case-only rename target creation")

            sync_a = DirectSourceSynchronizer(repo, fault_injector=fail_on_foo_create)
            with self.assertRaises(SyncTransactionRollbackError):
                sync_a.synchronize(delta, baseline, auth, require_trusted_verification=False)

            self.assertTrue(host_file_exact_case_exists(repo, "src/Foo.ts"))
            self.assertFalse(host_file_exact_case_exists(repo, "src/foo.ts"))
            self.assertEqual((repo / "src" / "Foo.ts").read_text(encoding="utf-8"), "ORIGINAL_CONTENT")
            self.assertEqual((repo / "src" / "unrelated.ts").read_text(encoding="utf-8"), "UNRELATED_CONTENT")
            tx_records_a = sync_a.diagnose_transactions()
            self.assertEqual(len(tx_records_a), 1)
            self.assertEqual(tx_records_a[0]["status"], "ROLLED_BACK")

            # Subcase B: Failure injected on src/z_after.ts AFTER src/Foo.ts was unlinked AND src/foo.ts was written
            def fail_on_z_after(rel_p: str) -> None:
                if rel_p == "src/z_after.ts":
                    raise OSError("Simulated write error after case-only rename target was created")

            sync_b = DirectSourceSynchronizer(repo, fault_injector=fail_on_z_after)
            with self.assertRaises(SyncTransactionRollbackError):
                sync_b.synchronize(delta, baseline, auth, require_trusted_verification=False)

            self.assertTrue(host_file_exact_case_exists(repo, "src/Foo.ts"))
            self.assertFalse(host_file_exact_case_exists(repo, "src/foo.ts"))
            self.assertFalse((repo / "src" / "z_after.ts").exists())
            self.assertEqual((repo / "src" / "Foo.ts").read_text(encoding="utf-8"), "ORIGINAL_CONTENT")
            self.assertEqual((repo / "src" / "unrelated.ts").read_text(encoding="utf-8"), "UNRELATED_CONTENT")
            self.assertEqual(GitManager(repo).get_head(), head_before)
            self.assertEqual(GitManager(repo).get_staged_files(), [])

            # Subcase C: If _rollback() itself fails, journal status stays ROLLBACK_NEEDED (never ROLLED_BACK)
            sync_c = DirectSourceSynchronizer(repo, fault_injector=fail_on_foo_create)
            sync_c._atomic_write_host_file = MagicMock(side_effect=OSError("Disk full during rollback"))
            with self.assertRaises(SyncTransactionRollbackError) as ctx_c:
                sync_c.synchronize(delta, baseline, auth, require_trusted_verification=False)
            self.assertIn("status=ROLLBACK_NEEDED", str(ctx_c.exception))
            interrupted_c = sync_c.get_interrupted_transactions()
            self.assertEqual(len(interrupted_c), 1)
            self.assertEqual(interrupted_c[0]["status"], "ROLLBACK_NEEDED")

    # 58. Strict non-empty verification binding checks at Phase 2 (ARCHB-VERIF-003)
    def test_58_strict_verification_binding_checks_at_phase_2(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        target_f = self.repo_dir / "src" / "calculator.py"
        orig_bytes = target_f.read_bytes()
        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            allowed_paths=["src"],
            verification_requirements=["python3 -m unittest discover -s tests"],
            requires_verification=True,
        )
        baseline = SnapshotBuilder(self.repo_dir).capture_snapshot(auth)
        exported_files = dict(baseline.file_bytes)
        exported_files["src/calculator.py"] = (
            b"def add(a: int, b: int) -> int:\n    return a + b\n\ndef multiply(a: int, b: int) -> int:\n    return a * b\n"
        )
        delta = compute_workspace_delta(baseline, exported_files)
        plan = resolve_canonical_verification_plan(authorization=auth)
        plan_digest = compute_verification_plan_digest(plan)
        delta_digest = delta.compute_manifest_digest()
        auth_digest = compute_authorization_digest(auth)

        def make_prep(v_res: VerificationResult) -> PreparedExecution:
            return PreparedExecution(
                objective_id="PROMPT #001",
                authorization=auth,
                baseline=baseline,
                delta=delta,
                verified_delta_digest=delta_digest,
                verification_result=v_res,
                attestation=None,
                response=HermesResponse("ok", "", 0, "s1", "ok"),
                loop_completed=True,
                authorization_digest=auth_digest,
                plan_digest=plan_digest,
            )

        # 1. Missing objective_id (None and "")
        for bad_obj in (None, "", "   "):
            backend.last_prepared_execution = make_prep(VerificationResult(
                executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED,
                objective_id=bad_obj, plan_digest=plan_digest, verified_delta_digest=delta_digest,
            ))
            with self.assertRaises(UnverifiedSyncError):
                backend.commit_prepared_execution("PROMPT #001", True, ControllerDisposition.PASS, authorization=auth)

        # 2. Missing or mismatched plan_digest
        for bad_plan_d in (None, "", "wrong_plan_digest"):
            backend.last_prepared_execution = make_prep(VerificationResult(
                executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED,
                objective_id="PROMPT #001", plan_digest=bad_plan_d, verified_delta_digest=delta_digest,
            ))
            with self.assertRaises(UnverifiedSyncError):
                backend.commit_prepared_execution("PROMPT #001", True, ControllerDisposition.PASS, authorization=auth)

        # 3. Missing or mismatched verified_delta_digest
        for bad_delta_d in (None, "", "wrong_delta_digest"):
            backend.last_prepared_execution = make_prep(VerificationResult(
                executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED,
                objective_id="PROMPT #001", plan_digest=plan_digest, verified_delta_digest=bad_delta_d,
            ))
            with self.assertRaises(UnverifiedSyncError):
                backend.commit_prepared_execution("PROMPT #001", True, ControllerDisposition.PASS, authorization=auth)

        # 4. Valid prepared verification + wrong/incomplete external verification_result rejected
        valid_v = VerificationResult(
            executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED,
            objective_id="PROMPT #001", plan_digest=plan_digest, verified_delta_digest=delta_digest,
        )
        for bad_ext_v in (
            VerificationResult(executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED, objective_id=None, plan_digest=plan_digest, verified_delta_digest=delta_digest),
            VerificationResult(executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED, objective_id="PROMPT #001", plan_digest=None, verified_delta_digest=delta_digest),
            VerificationResult(executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED, objective_id="PROMPT #001", plan_digest=plan_digest, verified_delta_digest=None),
            VerificationResult(executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED, objective_id="PROMPT #001", plan_digest="other_plan", verified_delta_digest=delta_digest),
        ):
            backend.last_prepared_execution = make_prep(valid_v)
            with self.assertRaises(UnverifiedSyncError):
                backend.commit_prepared_execution("PROMPT #001", True, ControllerDisposition.PASS, verification_result=bad_ext_v, authorization=auth)

        # 5. Positive case: genuine, completely bound verification evidence permits promotion
        backend.last_prepared_execution = make_prep(valid_v)
        sync_res = backend.commit_prepared_execution("PROMPT #001", True, ControllerDisposition.PASS, verification_result=valid_v, authorization=auth)
        self.assertTrue(sync_res.applied)
        self.assertIn("return a + b", target_f.read_text(encoding="utf-8"))
        target_f.write_bytes(orig_bytes)

    # 59. Raw steps=[] and resolved TrustedVerificationPlan produce consistent canonical validation (ARCHB-VERIF-003)
    def test_59_raw_and_resolved_verification_plan_canonical_equivalence(self):
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        verifier = DockerSandboxVerificationAdapter(backend, reuse_last_turn_result=True)
        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            allowed_paths=["src"],
            verification_requirements=["python3 -m unittest discover -s tests"],
        )
        raw_plan = TrustedVerificationPlan(command="python3 -m unittest discover -s tests")
        self.assertEqual(raw_plan.steps, [])
        resolved_plan = resolve_canonical_verification_plan(authorization=auth, explicit_plan=raw_plan)
        self.assertEqual(len(resolved_plan.steps), 1)
        canonical_digest = compute_verification_plan_digest(resolved_plan)

        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# eq"})
        v_res = VerificationResult(
            executed=True,
            passed=True,
            exit_status=0,
            provenance=VerificationProvenance.EXECUTED_TRUSTED,
            objective_id="PROMPT #001",
            plan_digest=canonical_digest,
            verified_delta_digest=delta.compute_manifest_digest(),
        )
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=v_res,
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth),
            plan_digest=canonical_digest,
        )
        # Validate using raw_plan (steps=[])
        backend.last_verification_result = v_res
        res_from_raw = verifier.verify("PROMPT #001", raw_plan)
        self.assertTrue(res_from_raw.passed)
        self.assertEqual(res_from_raw.provenance, VerificationProvenance.EXECUTED_TRUSTED)

        # Validate using resolved_plan (steps=[VerificationStep(...)])
        backend.last_verification_result = v_res
        res_from_resolved = verifier.verify("PROMPT #001", resolved_plan)
        self.assertTrue(res_from_resolved.passed)
        self.assertEqual(res_from_resolved.provenance, VerificationProvenance.EXECUTED_TRUSTED)

    # 60. Recovery rejects sibling prefix collision and intermediate junction escapes (ARCHB-TX-002)
    def test_60_recovery_rejects_sibling_prefix_and_intermediate_junction_escapes(self):
        with tempfile.TemporaryDirectory() as tmp_d:
            base = Path(tmp_d)
            repo = base / "repo"
            repo_backup = base / "repo_backup"
            repo.mkdir(parents=True, exist_ok=True)
            repo_backup.mkdir(parents=True, exist_ok=True)
            outside_file = repo_backup / "outside.txt"
            outside_file.write_text("OUTSIDE_SAFE_CONTENT", encoding="utf-8")

            # Create Windows directory junction repo/sub_junc -> repo_backup
            junc_path = repo / "sub_junc"
            mklink = subprocess.run(
                ["cmd", "/c", "mklink", "/J", str(junc_path), str(repo_backup)],
                capture_output=True,
                text=True,
            )
            self.assertEqual(mklink.returncode, 0, msg=f"mklink /J failed: {mklink.stderr}")

            sync = DirectSourceSynchronizer(repo)
            tx_dir = sync.transaction_dir / "tx_junction_escape"
            (tx_dir / "preimages").mkdir(parents=True, exist_ok=True)
            (tx_dir / "preimages" / "file_0000.bin").write_bytes(b"OVERWRITTEN_BY_ATTACK")
            import hashlib
            atk_sha = hashlib.sha256(b"OVERWRITTEN_BY_ATTACK").hexdigest()
            safe_sha = hashlib.sha256(b"OUTSIDE_SAFE_CONTENT").hexdigest()

            manifest = {
                "tx_id": "tx_junction_escape",
                "status": "APPLYING",
                "affected_paths": ["sub_junc/outside.txt"],
                "preimage_hashes": {"sub_junc/outside.txt": atk_sha},
                "postimage_hashes": {"sub_junc/outside.txt": safe_sha},
                "preimage_files": {"sub_junc/outside.txt": "file_0000.bin"},
            }
            manifest_file = tx_dir / "manifest.json"
            manifest_file.write_text(json.dumps(manifest), encoding="utf-8")

            with self.assertRaises((SymlinkEscapeError, PathTraversalError)):
                sync.recover_interrupted_transactions()

            # Outside target must remain completely untouched and journal evidence retained
            self.assertEqual(outside_file.read_text(encoding="utf-8"), "OUTSIDE_SAFE_CONTENT")
            self.assertTrue(manifest_file.is_file())

            # Remove junction before TemporaryDirectory cleanup
            subprocess.run(["cmd", "/c", "rmdir", str(junc_path)], capture_output=True)

    # 61. Adapter validates cached turn evidence offline without querying Docker daemon (ARCHB-VERIF-004)
    def test_61_adapter_validates_cached_turn_evidence_offline_without_docker(self):
        from unittest.mock import patch
        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        verifier = DockerSandboxVerificationAdapter(backend, reuse_last_turn_result=True)
        auth = ObjectiveAuthorization(
            "PROMPT #001",
            MutationExpectation.REQUIRED,
            allowed_paths=["src"],
            verification_requirements=["python3 -m unittest"],
        )
        plan = resolve_canonical_verification_plan(authorization=auth)
        plan_digest = compute_verification_plan_digest(plan)
        delta = WorkspaceDelta(modified=["src/calculator.py"], new_file_bytes={"src/calculator.py": b"# offline"})
        v_res = VerificationResult(
            executed=True,
            passed=True,
            exit_status=0,
            provenance=VerificationProvenance.EXECUTED_TRUSTED,
            objective_id="PROMPT #001",
            plan_digest=plan_digest,
            verified_delta_digest=delta.compute_manifest_digest(),
        )
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #001",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=v_res,
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth),
            plan_digest=plan_digest,
        )

        # Simulate Docker Desktop being completely offline
        with patch.object(
            DockerSandboxContainer,
            "check_runtime_prerequisites",
            return_value=(False, "Docker daemon offline"),
        ):
            self.assertFalse(backend.is_certified_isolated)

            # 1. Valid bound cached evidence succeeds offline and clears cache
            backend.last_verification_result = v_res
            res_ok = verifier.verify("PROMPT #001", plan)
            self.assertTrue(res_ok.passed)
            self.assertEqual(res_ok.provenance, VerificationProvenance.EXECUTED_TRUSTED)
            self.assertIsNone(backend.last_verification_result)

            # 2. Mismatched objective fails closed with binding mismatch (not daemon error) and clears cache
            backend.last_verification_result = v_res
            res_mismatch = verifier.verify("PROMPT #002", plan)
            self.assertFalse(res_mismatch.passed)
            self.assertEqual(res_mismatch.provenance, VerificationProvenance.UNVERIFIED)
            self.assertIn("objective mismatch", res_mismatch.limitations[0])
            self.assertIsNone(backend.last_verification_result)

            # 3. With cache empty and Docker offline, new verification refuses host fallback and fails closed
            res_no_cache = verifier.verify("PROMPT #001", plan)
            self.assertFalse(res_no_cache.passed)
            self.assertEqual(res_no_cache.provenance, VerificationProvenance.UNVERIFIED)
            self.assertIn("refusing host fallback", res_no_cache.limitations[0])

    # 62. Read-only snapshot inputs inclusion, exclusion, secrets, ignored, symlinks, missing, aliases & size limits (ARCHB-SNAP-002)
    def test_62_readonly_snapshot_paths_capture_and_negative_validations(self):
        from orchestrator.workspace_sync import WorkspaceIsolationError
        with tempfile.TemporaryDirectory() as tmp_d:
            repo = Path(tmp_d)
            subprocess.run(["git", "init"], cwd=str(repo), capture_output=True, check=True)
            subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=str(repo), capture_output=True, check=True)
            subprocess.run(["git", "config", "user.name", "Test User"], cwd=str(repo), capture_output=True, check=True)

            (repo / "src").mkdir(parents=True, exist_ok=True)
            (repo / "tests").mkdir(parents=True, exist_ok=True)
            (repo / "src" / "tracked_dep.py").write_text("TRACKED_VAL = 10\n", encoding="utf-8")
            (repo / ".gitignore").write_text("ignored_dir/\n*.ignored.py\n", encoding="utf-8")
            subprocess.run(["git", "add", "."], cwd=str(repo), capture_output=True, check=True)
            subprocess.run(["git", "commit", "-m", "init"], cwd=str(repo), capture_output=True, check=True)

            # Modify tracked file without committing + create untracked dependency + unrelated untracked + ignored + secret + live state
            (repo / "src" / "tracked_dep.py").write_bytes(b"TRACKED_VAL = 42\n")
            (repo / "src" / "untracked_dep.py").write_bytes(b"UNTRACKED_VAL = 99\n")
            (repo / "src" / "unrelated_untracked.py").write_bytes(b"UNRELATED = 1\n")
            (repo / "src" / "skip.ignored.py").write_bytes(b"IGNORED = 1\n")
            (repo / ".env").write_bytes(b"SECRET_KEY=123\n")
            (repo / ".orchestrator_state.json").write_bytes(b"{\"prompt\": 2}\n")
            (repo / "ORCHESTRATOR_HANDOFF.md").write_bytes(b"# Handoff\n")

            auth = ObjectiveAuthorization(
                objective_id="PROMPT #027",
                mutation_permission=MutationExpectation.REQUIRED,
                allowed_paths=["tests/test_new_feature.py"],
                readonly_snapshot_paths=["src/untracked_dep.py"],
                verification_requirements=["python3 -m unittest"],
            )
            snap = SnapshotBuilder(repo).capture_snapshot(authorization=auth)

            # 1-3 & 9 & 15-16: Tracked + listed untracked included with uncommitted contents; unlisted & ignored excluded
            self.assertIn("src/tracked_dep.py", snap.file_bytes)
            self.assertEqual(snap.file_bytes["src/tracked_dep.py"], b"TRACKED_VAL = 42\n")
            self.assertIn("src/untracked_dep.py", snap.file_bytes)
            self.assertEqual(snap.file_bytes["src/untracked_dep.py"], b"UNTRACKED_VAL = 99\n")
            self.assertIn("src/untracked_dep.py", snap.readonly_snapshot_paths)
            self.assertIn("src/untracked_dep.py", snap.protected_readonly_paths)
            self.assertNotIn("src/unrelated_untracked.py", snap.file_bytes)
            self.assertNotIn("src/skip.ignored.py", snap.file_bytes)
            self.assertNotIn(".env", snap.file_bytes)
            self.assertNotIn(".orchestrator_state.json", snap.file_bytes)
            self.assertEqual(auth.allowed_paths, ["tests/test_new_feature.py"])

            # 16. Explicitly listing an ignored file fails closed
            bad_ignored_auth = ObjectiveAuthorization(
                "PROMPT #027", MutationExpectation.REQUIRED,
                allowed_paths=["tests/test_new_feature.py"],
                readonly_snapshot_paths=["src/skip.ignored.py"],
            )
            with self.assertRaises(UnauthorizedPathError):
                SnapshotBuilder(repo).capture_snapshot(authorization=bad_ignored_auth)

            # 17-18. Explicitly listing a secret, credential, or live state file fails closed
            for forbidden_ro in (".env", ".orchestrator_state.json", "ORCHESTRATOR_HANDOFF.md", ".git/config"):
                bad_sec_auth = ObjectiveAuthorization(
                    "PROMPT #027", MutationExpectation.REQUIRED,
                    allowed_paths=["tests/test_new_feature.py"],
                    readonly_snapshot_paths=[forbidden_ro],
                )
                with self.assertRaises(UnauthorizedPathError):
                    SnapshotBuilder(repo).capture_snapshot(authorization=bad_sec_auth)

            # 19. Path traversal and junction escapes in readonly_snapshot_paths fail closed
            for trav in ("../outside.py", "/abs/path.py", "C:drive.py", "\\\\server\\share\\file.py"):
                bad_trav_auth = ObjectiveAuthorization(
                    "PROMPT #027", MutationExpectation.REQUIRED,
                    allowed_paths=["tests/test_new_feature.py"],
                    readonly_snapshot_paths=[trav],
                )
                with self.assertRaises(PathTraversalError):
                    SnapshotBuilder(repo).capture_snapshot(authorization=bad_trav_auth)

            # 20. Missing listed dependency produces clear WorkspaceIsolationError
            missing_auth = ObjectiveAuthorization(
                "PROMPT #027", MutationExpectation.REQUIRED,
                allowed_paths=["tests/test_new_feature.py"],
                readonly_snapshot_paths=["src/does_not_exist.py"],
            )
            with self.assertRaises(WorkspaceIsolationError):
                SnapshotBuilder(repo).capture_snapshot(authorization=missing_auth)

            #Wrong case on Windows NTFS is rejected
            wrong_case_auth = ObjectiveAuthorization(
                "PROMPT #027", MutationExpectation.REQUIRED,
                allowed_paths=["tests/test_new_feature.py"],
                readonly_snapshot_paths=["src/UNTRACKED_DEP.py"],
            )
            with self.assertRaises(WorkspaceIsolationError):
                SnapshotBuilder(repo).capture_snapshot(authorization=wrong_case_auth)

            # 21. Duplicate Windows case-alias entries in readonly_snapshot_paths rejected
            dup_auth = ObjectiveAuthorization(
                "PROMPT #027", MutationExpectation.REQUIRED,
                allowed_paths=["tests/test_new_feature.py"],
                readonly_snapshot_paths=["src/untracked_dep.py", "src/Untracked_Dep.py"],
            )
            with self.assertRaises(DuplicateNormalizedPathError):
                SnapshotBuilder(repo).capture_snapshot(authorization=dup_auth)

            # 22. Per-file and total snapshot size limits enforced
            with self.assertRaises(WorkspaceIsolationError):
                SnapshotBuilder(repo, max_file_bytes=5).capture_snapshot(authorization=auth)
            with self.assertRaises(WorkspaceIsolationError):
                SnapshotBuilder(repo, max_total_bytes=10).capture_snapshot(authorization=auth)

    # 63. Phase 2 policy binding and broker write/patch/delete denial on readonly_snapshot_paths (ARCHB-SNAP-002)
    def test_63_readonly_snapshot_paths_serialization_digest_and_mutation_denial(self):
        auth = ObjectiveAuthorization(
            objective_id="PROMPT #027",
            mutation_permission=MutationExpectation.REQUIRED,
            allowed_paths=["tests/test_new.py"],
            readonly_snapshot_paths=["src/ro_helper.py"],
            verification_requirements=["python3 -m unittest"],
        )
        # Serialization round-trip preserves readonly_snapshot_paths
        roundtrip = ObjectiveAuthorization.from_dict(auth.to_dict())
        self.assertEqual(roundtrip.readonly_snapshot_paths, ["src/ro_helper.py"])
        self.assertEqual(compute_authorization_digest(auth), compute_authorization_digest(roundtrip))

        # Changing readonly_snapshot_paths alters authorization digest and blocks Phase 2 promotion (item 14)
        auth_altered = ObjectiveAuthorization.from_dict(auth.to_dict())
        auth_altered.readonly_snapshot_paths = ["src/ro_helper.py", "src/another.py"]
        self.assertNotEqual(compute_authorization_digest(auth), compute_authorization_digest(auth_altered))

        backend = DockerExecutionBackend(workspace_root=self.repo_dir)
        plan = resolve_canonical_verification_plan(authorization=auth)
        plan_digest = compute_verification_plan_digest(plan)
        delta = WorkspaceDelta(created=["tests/test_new.py"], new_file_bytes={"tests/test_new.py": b"# ok"})
        v_res = VerificationResult(
            executed=True, passed=True, exit_status=0, provenance=VerificationProvenance.EXECUTED_TRUSTED,
            objective_id="PROMPT #027", plan_digest=plan_digest, verified_delta_digest=delta.compute_manifest_digest(),
        )
        backend.last_prepared_execution = PreparedExecution(
            objective_id="PROMPT #027",
            authorization=auth,
            baseline=SnapshotBaseline(self.repo_dir),
            delta=delta,
            verified_delta_digest=delta.compute_manifest_digest(),
            verification_result=v_res,
            attestation=None,
            response=HermesResponse("ok", "", 0, "s1", "ok"),
            loop_completed=True,
            authorization_digest=compute_authorization_digest(auth),
            plan_digest=plan_digest,
        )
        with self.assertRaises(UnverifiedSyncError):
            backend.commit_prepared_execution("PROMPT #027", True, ControllerDisposition.PASS, authorization=auth_altered)

        # Direct delta validation rejects modifying or deleting readonly_snapshot_paths even if allowed_paths is broad
        broad_auth = ObjectiveAuthorization(
            objective_id="PROMPT #027",
            mutation_permission=MutationExpectation.REQUIRED,
            allowed_paths=["src", "tests"],
            readonly_snapshot_paths=["src/ro_helper.py"],
        )
        with self.assertRaises(UnauthorizedPathError):
            validate_delta_authorization(
                WorkspaceDelta(modified=["src/ro_helper.py"], new_file_bytes={"src/ro_helper.py": b"hacked"}),
                broad_auth,
            )
        with self.assertRaises(UnauthorizedPathError):
            validate_delta_authorization(
                WorkspaceDelta(deleted=["src/ro_helper.py"]),
                broad_auth,
            )

    # 64. Container broker & shell modification/deletion of readonly_snapshot_paths fail closed (ARCHB-SNAP-002)
    def test_64_container_broker_and_shell_cannot_modify_or_delete_readonly_snapshot_inputs(self):
        self.assertTrue(self.docker_ready)
        with tempfile.TemporaryDirectory() as tmp_d:
            repo = Path(tmp_d)
            self._init_disposable_git_repo(repo)
            ro_file = repo / "src" / "untracked_ro_dep.py"
            ro_file.write_text("RO_CONSTANT = 777\n", encoding="utf-8")

            auth = ObjectiveAuthorization(
                objective_id="PROMPT #027",
                mutation_permission=MutationExpectation.REQUIRED,
                allowed_paths=["tests/test_created.py"],
                readonly_snapshot_paths=["src/untracked_ro_dep.py"],
                verification_requirements=["python3 -m unittest discover -s tests"],
            )

            # Subcase A: Broker write/patch/delete against readonly_snapshot_paths is denied, while read_file succeeds
            turns_broker = [
                {
                    "role": "assistant",
                    "content": "Read RO dep and attempt write/patch/delete against it",
                    "tool_calls": [
                        {"id": "c_read", "type": "function", "function": {"name": "read_file", "arguments": json.dumps({"path": "src/untracked_ro_dep.py"})}},
                        {"id": "c_write", "type": "function", "function": {"name": "write_file", "arguments": json.dumps({"path": "src/untracked_ro_dep.py", "content": "RO_CONSTANT = 0\n"})}},
                        {"id": "c_patch", "type": "function", "function": {"name": "patch_file", "arguments": json.dumps({"path": "src/untracked_ro_dep.py", "search": "777", "replace": "0"})}},
                        {"id": "c_del", "type": "function", "function": {"name": "delete_file", "arguments": json.dumps({"path": "src/untracked_ro_dep.py"})}},
                    ],
                },
                {"role": "assistant", "content": "END OF RESULT — PROMPT #027"},
            ]
            backend_a = DockerExecutionBackend(workspace_root=repo, model_client=ScriptedToolLoopModelClient(turns_broker))
            backend_a.execute("PROMPT #027", authorization=auth)
            self.assertTrue(backend_a.last_tool_history[0].allowed)
            self.assertIn("RO_CONSTANT = 777", backend_a.last_tool_history[0].result_summary)
            for denied_rec in backend_a.last_tool_history[1:]:
                self.assertFalse(denied_rec.allowed)
                self.assertFalse(denied_rec.executed_in_container)

            # Subcase B: Shell chmod +w & modification or deletion of readonly_snapshot_path is caught at export
            for shell_cmd in (
                "python3 -c \"import os; os.chmod('src/untracked_ro_dep.py', 0o644); open('src/untracked_ro_dep.py', 'w').write('HACKED')\"",
                "python3 -c \"import os; os.remove('src/untracked_ro_dep.py')\"",
            ):
                turns_shell = [
                    {
                        "role": "assistant",
                        "content": "Tamper with read-only dependency via shell",
                        "tool_calls": [
                            {"id": "c_tamper", "type": "function", "function": {"name": "run_command", "arguments": json.dumps({"command": shell_cmd})}},
                        ],
                    },
                    {"role": "assistant", "content": "END OF RESULT — PROMPT #027"},
                ]
                backend_b = DockerExecutionBackend(workspace_root=repo, model_client=ScriptedToolLoopModelClient(turns_shell))
                resp_b = backend_b.execute("PROMPT #027", authorization=auth)
                self.assertEqual(resp_b.exit_code, 1)
                self.assertIn("UNAUTHORIZED_DELTA_REJECTED", resp_b.stderr)
                prep_b = backend_b.last_prepared_execution
                self.assertTrue(prep_b.expired)
                self.assertIn("src/untracked_ro_dep.py", prep_b.unauthorized_deltas)
                with self.assertRaises(UnverifiedSyncError):
                    backend_b.commit_prepared_execution("PROMPT #027", True, ControllerDisposition.PASS, authorization=auth)
                self.assertEqual(ro_file.read_text(encoding="utf-8"), "RO_CONSTANT = 777\n")

    # 65. End-to-end two-phase execution using untracked readonly_snapshot_paths (ARCHB-SNAP-002)
    def test_65_two_phase_execution_with_untracked_readonly_dependencies_succeeds(self):
        self.assertTrue(self.docker_ready)
        with tempfile.TemporaryDirectory() as tmp_d:
            repo = Path(tmp_d)
            self._init_disposable_git_repo(repo)
            # Create an untracked helper module and a dirty unstaged user file
            (repo / "src" / "untracked_math_ext.py").write_text(
                "def triple(x: int) -> int:\n    return x * 3\n",
                encoding="utf-8",
            )
            (repo / "README.md").write_text("# Unstaged user edit preserved\n", encoding="utf-8")
            head_before = GitManager(repo).get_head()

            auth = ObjectiveAuthorization(
                objective_id="PROMPT #027",
                mutation_permission=MutationExpectation.REQUIRED,
                allowed_paths=["tests/test_triple.py"],
                readonly_snapshot_paths=["src/untracked_math_ext.py"],
                verification_requirements=["python3 -m unittest tests/test_triple.py"],
            )
            new_test_code = (
                "import unittest\n"
                "from src.untracked_math_ext import triple\n\n"
                "class TestTriple(unittest.TestCase):\n"
                "    def test_triple(self):\n"
                "        self.assertEqual(triple(7), 21)\n\n"
                "if __name__ == '__main__':\n"
                "    unittest.main()\n"
            )
            turns = [
                {
                    "role": "assistant",
                    "content": "Inspect untracked read-only module and create authorized test",
                    "tool_calls": [
                        {"id": "c1", "type": "function", "function": {"name": "read_file", "arguments": json.dumps({"path": "src/untracked_math_ext.py"})}},
                        {"id": "c2", "type": "function", "function": {"name": "write_file", "arguments": json.dumps({"path": "tests/test_triple.py", "content": new_test_code})}},
                    ],
                },
                {"role": "assistant", "content": "Completed.\nEND OF RESULT — PROMPT #027"},
            ]
            backend = DockerExecutionBackend(workspace_root=repo, model_client=ScriptedToolLoopModelClient(turns))
            resp = backend.execute("PROMPT #027", authorization=auth)
            self.assertEqual(resp.exit_code, 0)
            self.assertFalse((repo / "tests" / "test_triple.py").exists())

            sync_res = backend.commit_prepared_execution("PROMPT #027", True, ControllerDisposition.PASS, authorization=auth)
            self.assertTrue(sync_res.applied)
            self.assertTrue((repo / "tests" / "test_triple.py").is_file())
            self.assertEqual((repo / "README.md").read_text(encoding="utf-8"), "# Unstaged user edit preserved\n")
            self.assertEqual(GitManager(repo).get_head(), head_before)
            self.assertEqual(GitManager(repo).get_staged_files(), [])

    # 66. Reproduce PROMPT #026 readiness preflight on D:\Study_App in read-only mode (ARCHB-SNAP-002)
    def test_66_prompt_026_study_app_readiness_preflight_and_container_import(self):
        from orchestrator.workspace_sync import is_protected_from_mutation
        self.assertTrue(self.docker_ready)
        study_app_root = Path(__file__).resolve().parents[2]
        six_ro_deps = [
            "orchestrator/docker_backend.py",
            "orchestrator/execution_backend.py",
            "orchestrator/verification.py",
            "orchestrator/workspace_sync.py",
            "orchestrator/tests/__init__.py",
            "orchestrator/tests/test_architecture_b.py",
        ]
        pilot_target = "orchestrator/tests/test_architecture_b_pilot.py"
        pilot_host_path = study_app_root / pilot_target
        target_existed_before = pilot_host_path.is_file()
        target_bytes_before = pilot_host_path.read_bytes() if target_existed_before else None

        auth = ObjectiveAuthorization(
            objective_id="PROMPT #026",
            mutation_permission=MutationExpectation.REQUIRED,
            allowed_paths=[pilot_target],
            readonly_snapshot_paths=six_ro_deps,
            verification_requirements=["python3 -m unittest orchestrator/tests/test_architecture_b_pilot.py"],
        )
        self.assertEqual(auth.allowed_paths, [pilot_target])
        self.assertFalse(is_protected_from_mutation(pilot_target, auth))

        snap = SnapshotBuilder(study_app_root).capture_snapshot(authorization=auth)

        for dep in six_ro_deps:
            self.assertIn(dep, snap.file_bytes)
            self.assertIn(dep, snap.readonly_snapshot_paths)
            self.assertIn(dep, snap.protected_readonly_paths)
            self.assertNotIn(dep, auth.allowed_paths)
            self.assertTrue(is_protected_from_mutation(dep, auth))

        # Unlisted untracked files, secrets, and live state remain excluded
        self.assertNotIn("scripts/hermes_orchestrator.py", snap.file_bytes)
        self.assertNotIn(".orchestrator_state.json", snap.file_bytes)
        self.assertNotIn("ORCHESTRATOR_HANDOFF.md", snap.file_bytes)

        # Behavior-based invariant: snapshot capture must not create, delete, or modify the pilot target
        self.assertEqual(pilot_host_path.is_file(), target_existed_before)
        if target_existed_before:
            self.assertEqual(pilot_host_path.read_bytes(), target_bytes_before)
            self.assertIn(pilot_target, snap.file_bytes)
            self.assertEqual(snap.file_bytes[pilot_target], target_bytes_before)
            self.assertNotIn(pilot_target, snap.protected_readonly_paths)
        else:
            self.assertFalse(pilot_host_path.exists())
            self.assertNotIn(pilot_target, snap.file_bytes)

        # Verify inside a real disposable Docker container that all 6 dependencies import cleanly and are mode 0444
        container = DockerSandboxContainer(dispatch_id="PROMPT #026")
        try:
            container.start()
            container.import_snapshot(snap)
            res = container.exec_argv([
                "python3",
                "-c",
                (
                    "import os, stat, orchestrator.docker_backend, orchestrator.execution_backend, "
                    "orchestrator.verification, orchestrator.workspace_sync, orchestrator.tests.test_architecture_b; "
                    "mode = stat.S_IMODE(os.stat('/workspace/orchestrator/docker_backend.py').st_mode); "
                    "assert mode == 0o444, f'Expected 0o444, got {oct(mode)}'; "
                    "print('STUDY_APP_RO_IMPORTS_OK')"
                ),
            ])
            self.assertEqual(res.returncode, 0, msg=f"Container import failed: {res.stderr}")
            self.assertIn("STUDY_APP_RO_IMPORTS_OK", res.stdout)
        finally:
            container.stop_and_remove()

        # Verify container execution did not create, delete, or modify the pilot target on the host
        self.assertEqual(pilot_host_path.is_file(), target_existed_before)
        if target_existed_before:
            self.assertEqual(pilot_host_path.read_bytes(), target_bytes_before)
        else:
            self.assertFalse(pilot_host_path.exists())


if __name__ == "__main__":
    unittest.main()
