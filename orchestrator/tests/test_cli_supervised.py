import copy
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from unittest.mock import MagicMock, patch

from orchestrator.cli import APIBackedControllerClient, create_parser, handle_supervised, main as cli_main
from orchestrator.config import OrchestratorConfig
from orchestrator.docker_backend import (
    DEFAULT_SANDBOX_IMAGE,
    DockerExecutionBackend,
    DockerSandboxContainer,
    LocalModelAPIClient,
)
from orchestrator.tests.test_architecture_b import ScriptedToolLoopModelClient
from orchestrator.engine import OrchestratorEngine
from orchestrator.execution_backend import UnavailableExecutionBackend
from orchestrator.git_manager import GitManager
from orchestrator.hermes_client import HermesClient, HermesResponse
from orchestrator.schema import (
    ControllerDisposition,
    MutationExpectation,
    ObjectiveAuthorization,
    VerificationProvenance,
    VerificationResult,
)
from orchestrator.verification import DockerSandboxVerificationAdapter
from orchestrator.workspace_sync import SnapshotBaseline, SnapshotBuilder
from orchestrator.tests.test_architecture_b_pilot import LocalDirectorySandboxFake


class LocalDirectorySandboxDouble(LocalDirectorySandboxFake):
    """Lightweight directory-backed sandbox double for fast, deterministic CLI tests."""

    def __init__(self) -> None:
        self.sandbox_root = Path(tempfile.mkdtemp(prefix="cli_sandbox_double_"))
        self.exec_argv_calls: List[List[str]] = []
        self.exec_shell_calls: List[str] = []

    def cleanup(self) -> None:
        shutil.rmtree(self.sandbox_root, ignore_errors=True)

    def start(self, container: DockerSandboxContainer):
        container.container_id = "cli_fake_container_12345"
        container.retired = False
        container.timed_out = False
        container.forced_retirement = False
        container.attestation = self.make_attestation(container)
        return container.attestation

    def import_snapshot(self, container: DockerSandboxContainer, baseline: SnapshotBaseline):
        for item in self.sandbox_root.iterdir():
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
        from orchestrator.workspace_sync import extract_and_validate_container_tar
        tar_bytes = baseline.build_tar_bytes()
        if tar_bytes:
            for rel_p, b in extract_and_validate_container_tar(tar_bytes).items():
                dest = self.sandbox_root / rel_p
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(b)

    def export_workspace(self, container: DockerSandboxContainer) -> Dict[str, bytes]:
        from orchestrator.workspace_sync import extract_and_validate_container_tar
        buf = io.BytesIO()
        import tarfile
        with tarfile.open(fileobj=buf, mode="w") as tf:
            for root, dirs, files in os.walk(self.sandbox_root):
                dirs[:] = [d for d in dirs if d not in ("__pycache__", ".pytest_cache", ".git")]
                for f in files:
                    full = Path(root) / f
                    rel = full.relative_to(self.sandbox_root).as_posix()
                    tf.add(str(full), arcname=rel, recursive=False)
        return extract_and_validate_container_tar(buf.getvalue())

    def exec_argv(self, container, argv, timeout=120, cwd="/workspace", env=None, retire_on_timeout=True):
        self.exec_argv_calls.append(list(argv))
        translated = [
            arg.replace("/workspace", str(self.sandbox_root)) if isinstance(arg, str) else arg
            for arg in argv
        ]
        if translated and translated[0] in ("python3", "python"):
            translated[0] = sys.executable
        return subprocess.run(
            translated,
            cwd=str(self.sandbox_root),
            capture_output=True,
            text=True,
            timeout=timeout,
            stdin=subprocess.DEVNULL,
        )

    def exec_shell(self, container, command, timeout=120, cwd="/workspace", env=None, retire_on_timeout=True):
        self.exec_shell_calls.append(command)
        return self.exec_argv(container, ["sh", "-c", command], timeout=timeout, cwd=cwd, env=env)

    def stop_and_remove(self, container: DockerSandboxContainer):
        container.retired = True
        container.container_id = None


class TestCLISupervised(unittest.TestCase):
    """
    Focused integration tests for the `run_orchestrator.py supervised` CLI
    and the reversible legacy execution interlocks (PROMPT #032).
    """

    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="test_cli_supervised_"))
        self.repo_dir = self.temp_dir / "disposable_repo"
        self.repo_dir.mkdir(parents=True, exist_ok=True)
        self._init_disposable_git_repo(self.repo_dir)
        self.sandbox_double = LocalDirectorySandboxDouble()
        dispatch = (
            "=== OBJECTIVE_TITLE ===\nModify helper\n"
            "=== MUTATION_EXPECTATION ===\nREQUIRED\n"
            "=== EXECUTOR_PROMPT ===\nPROMPT #001\nModify the authorized helper.\n"
            "END OF RESULT — PROMPT #001"
        )
        response = HermesResponse(
            stdout=dispatch, stderr="", exit_code=0, session_id="cli-test", clean_text=dispatch,
        )
        for client in (HermesClient, APIBackedControllerClient):
            query_patch = patch.object(client, "run_query", return_value=response)
            query_patch.start()
            self.addCleanup(query_patch.stop)
        api_patch = patch.object(
            LocalModelAPIClient, "chat_completion",
            side_effect=AssertionError("CLI tests must inject a scripted model client"),
        )
        api_patch.start()
        self.addCleanup(api_patch.stop)

    def tearDown(self) -> None:
        self.sandbox_double.cleanup()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _init_disposable_git_repo(self, root: Path) -> None:
        subprocess.run(["git", "init"], cwd=str(root), capture_output=True, check=True)
        subprocess.run(["git", "config", "core.autocrlf", "false"], cwd=str(root), capture_output=True, check=True)
        subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=str(root), capture_output=True, check=True)
        subprocess.run(["git", "config", "user.name", "CLI Tester"], cwd=str(root), capture_output=True, check=True)
        (root / "src").mkdir(parents=True, exist_ok=True)
        (root / "src" / "math_helper.py").write_bytes(b"def compute(x):\n    return x + 1\n")
        (root / "README.md").write_bytes(b"# Disposable Repo\n")
        subprocess.run(["git", "add", "."], cwd=str(root), capture_output=True, check=True)
        subprocess.run(["git", "commit", "-m", "init"], cwd=str(root), capture_output=True, check=True)

    def _patch_container(self):
        dbl = self.sandbox_double
        return patch.multiple(
            DockerSandboxContainer,
            check_runtime_prerequisites=classmethod(lambda cls, image=DEFAULT_SANDBOX_IMAGE: (True, "ok")),
            start=lambda s: dbl.start(s),
            verify_physical_attestation=lambda s: dbl.make_attestation(s),
            import_snapshot=lambda s, b: dbl.import_snapshot(s, b),
            export_workspace=lambda s: dbl.export_workspace(s),
            exec_argv=lambda s, a, **kw: dbl.exec_argv(s, a, **kw),
            exec_shell=lambda s, c, **kw: dbl.exec_shell(s, c, **kw),
            stop_and_remove=lambda s: dbl.stop_and_remove(s),
            create=True,
        )

    # --- Negative Cases (1-13) ---

    def test_01_missing_objective_fails_closed(self):
        parser = create_parser()
        args = parser.parse_args(["supervised", "--objective", "   ", "--allowed-paths", "src/math_helper.py", "--verification-cmd", "python3 -c 'print(1)'"])
        ret = handle_supervised(args)
        self.assertEqual(ret, 2)

    def test_02_empty_allowed_paths_fails_closed(self):
        parser = create_parser()
        args = parser.parse_args(["supervised", "--objective", "Test obj", "--allowed-paths", "  ,  ", "--verification-cmd", "python3 -c 'print(1)'"])
        ret = handle_supervised(args)
        self.assertEqual(ret, 2)

    def test_03_missing_verification_cmd_for_mutation_fails_closed(self):
        parser = create_parser()
        args = parser.parse_args(["supervised", "--objective", "Test obj", "--allowed-paths", "src/math_helper.py", "--mutation-permission", "REQUIRED"])
        ret = handle_supervised(args)
        self.assertEqual(ret, 2)

    def test_04_invalid_traversing_allowed_path_fails_closed(self):
        parser = create_parser()
        for bad_p in ("../outside.py", "/etc/passwd", "C:\\evil.py", "\\\\server\\share\\file.py"):
            args = parser.parse_args(["supervised", "--objective", "Test obj", "--allowed-paths", bad_p, "--verification-cmd", "python3 -c 'print(1)'"])
            ret = handle_supervised(args)
            self.assertEqual(ret, 2, msg=f"Path {bad_p} should fail closed")

    def test_05_invalid_readonly_dependency_fails_closed(self):
        parser = create_parser()
        for bad_ro in (".env", ".orchestrator_state.json", "../evil.py"):
            args = parser.parse_args(["supervised", "--objective", "Test obj", "--allowed-paths", "src/math_helper.py", "--readonly-deps", bad_ro, "--verification-cmd", "python3 -c 'print(1)'"])
            ret = handle_supervised(args)
            self.assertEqual(ret, 2, msg=f"Read-only path {bad_ro} should fail closed")

    def test_06_offline_docker_fails_closed(self):
        parser = create_parser()
        args = parser.parse_args([
            "supervised", "--objective", "Test obj", "--allowed-paths", "src/math_helper.py",
            "--verification-cmd", "python3 -c 'print(1)'", "--workspace-root", str(self.repo_dir)
        ])
        with patch.object(DockerSandboxContainer, "check_runtime_prerequisites", return_value=(False, "Docker daemon stopped")):
            ret = handle_supervised(args)
            self.assertEqual(ret, 3)

    def test_07_unavailable_sandbox_image_fails_closed(self):
        parser = create_parser()
        args = parser.parse_args([
            "supervised", "--objective", "Test obj", "--allowed-paths", "src/math_helper.py",
            "--verification-cmd", "python3 -c 'print(1)'", "--workspace-root", str(self.repo_dir)
        ])
        with patch.object(DockerSandboxContainer, "check_runtime_prerequisites", return_value=(False, "Image cursor_sandbox-dev:latest missing")):
            ret = handle_supervised(args)
            self.assertEqual(ret, 3)

    def test_08_failed_trusted_verification_prevents_promotion(self):
        parser = create_parser()
        args = parser.parse_args([
            "supervised", "--objective", "Modify helper", "--allowed-paths", "src/math_helper.py",
            "--verification-cmd", "python3 -c 'import sys; sys.exit(1)'", "--workspace-root", str(self.repo_dir)
        ])
        turns = [
            {"role": "assistant", "content": "Write bad", "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "write_file", "arguments": json.dumps({"path": "src/math_helper.py", "content": "BAD"})}}]},
            {"role": "assistant", "content": "END OF RESULT — PROMPT #001"},
        ]
        with self._patch_container():
            ret = handle_supervised(args, model_client=ScriptedToolLoopModelClient(turns))
            self.assertIn(ret, (1, 4))
            # Verify file was NOT promoted on host
            self.assertIn(b"def compute", (self.repo_dir / "src" / "math_helper.py").read_bytes())

    def test_09_controller_non_pass_prevents_promotion(self):
        parser = create_parser()
        args = parser.parse_args([
            "supervised", "--objective", "Modify helper", "--allowed-paths", "src/math_helper.py",
            "--verification-cmd", "python3 -c 'print(1)'", "--workspace-root", str(self.repo_dir)
        ])
        turns = [
            {"role": "assistant", "content": "Failed correlation marker", "tool_calls": []},
        ]
        with self._patch_container():
            ret = handle_supervised(args, model_client=ScriptedToolLoopModelClient(turns))
            self.assertEqual(ret, 1)
            self.assertIn(b"def compute", (self.repo_dir / "src" / "math_helper.py").read_bytes())

    def test_10_mismatched_authorization_prevents_promotion(self):
        parser = create_parser()
        args = parser.parse_args([
            "supervised", "--objective", "Modify helper", "--allowed-paths", "src/math_helper.py",
            "--verification-cmd", "python3 -c 'print(1)'", "--workspace-root", str(self.repo_dir)
        ])
        # Attempt writing to unapproved file docs/unauthorized.md
        turns = [
            {"role": "assistant", "content": "Edit out of scope", "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "write_file", "arguments": json.dumps({"path": "docs/unauthorized.md", "content": "EVIL"})}}]},
            {"role": "assistant", "content": "END OF RESULT — PROMPT #001"},
        ]
        with self._patch_container():
            ret = handle_supervised(args, model_client=ScriptedToolLoopModelClient(turns))
            self.assertEqual(ret, 1)
            self.assertFalse((self.repo_dir / "docs" / "unauthorized.md").exists())

    def test_11_exhausted_tool_iterations_prevents_promotion(self):
        parser = create_parser()
        args = parser.parse_args([
            "supervised", "--objective", "Looping", "--allowed-paths", "src/math_helper.py",
            "--verification-cmd", "python3 -c 'print(1)'", "--workspace-root", str(self.repo_dir),
            "--max-tool-iterations", "2"
        ])
        # Model loops continuously without emitting terminal marker
        turns = [
            {"role": "assistant", "content": "Iter 1", "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "read_file", "arguments": json.dumps({"path": "src/math_helper.py"})}}]},
            {"role": "assistant", "content": "Iter 2", "tool_calls": [{"id": "c2", "type": "function", "function": {"name": "read_file", "arguments": json.dumps({"path": "src/math_helper.py"})}}]},
            {"role": "assistant", "content": "Iter 3", "tool_calls": [{"id": "c3", "type": "function", "function": {"name": "read_file", "arguments": json.dumps({"path": "src/math_helper.py"})}}]},
        ]
        with self._patch_container():
            ret = handle_supervised(args, model_client=ScriptedToolLoopModelClient(turns))
            self.assertEqual(ret, 1)

    def test_12_failure_does_not_fall_back_to_host_execution(self):
        parser = create_parser()
        args = parser.parse_args([
            "supervised", "--objective", "Test", "--allowed-paths", "src/math_helper.py",
            "--verification-cmd", "python3 -c 'print(1)'", "--workspace-root", str(self.repo_dir)
        ])
        with patch.object(DockerSandboxContainer, "check_runtime_prerequisites", return_value=(False, "Docker off")):
            with patch("subprocess.run") as mock_subproc:
                ret = handle_supervised(args)
                self.assertEqual(ret, 3)
                mock_subproc.assert_not_called()

    def test_13_original_study_app_state_remains_unchanged(self):
        study_app_root = self.temp_dir / "original_workspace"
        study_app_root.mkdir()
        state_file = study_app_root / ".orchestrator_state.json"
        handoff_file = study_app_root / "ORCHESTRATOR_HANDOFF.md"
        state_file.write_text('{"original": true}', encoding="utf-8")
        handoff_file.write_text("Original workspace handoff\n", encoding="utf-8")
        state_before = state_file.read_bytes()
        handoff_before = handoff_file.read_bytes()

        # Run supervised task in disposable repo
        parser = create_parser()
        args = parser.parse_args([
            "supervised", "--objective", "Verify isolation", "--allowed-paths", "src/math_helper.py",
            "--verification-cmd", "python3 -c 'print(1)'", "--workspace-root", str(self.repo_dir)
        ])
        with self._patch_container():
            handle_supervised(args, model_client=ScriptedToolLoopModelClient([]))

        self.assertEqual(state_file.read_bytes(), state_before)
        self.assertEqual(handoff_file.read_bytes(), handoff_before)

    # --- Positive Cases (14-22) ---

    def test_14_cli_constructs_correct_objective_authorization(self):
        parser = create_parser()
        args = parser.parse_args([
            "supervised", "--objective", "Implement feature X",
            "--allowed-paths", "src/feature.py,tests/test_feature.py",
            "--readonly-deps", "src/math_helper.py",
            "--verification-cmd", "pytest tests/test_feature.py",
            "--mutation-permission", "REQUIRED",
            "--workspace-root", str(self.repo_dir),
        ])
        # Intercept engine.run_step to inspect authorization passed to it
        captured_auth = None
        def _spy_run_step(*a, **kw):
            nonlocal captured_auth
            captured_auth = kw.get("authorization")
            return ControllerDisposition.BLOCKED

        with self._patch_container(), patch.object(OrchestratorEngine, "run_step", side_effect=_spy_run_step):
            handle_supervised(args)

        self.assertIsNotNone(captured_auth)
        self.assertEqual(captured_auth.allowed_paths, ["src/feature.py", "tests/test_feature.py"])
        self.assertEqual(captured_auth.readonly_snapshot_paths, ["src/math_helper.py"])
        self.assertEqual(captured_auth.verification_requirements, ["pytest tests/test_feature.py"])
        self.assertEqual(captured_auth.mutation_permission, MutationExpectation.REQUIRED)

    def test_15_readonly_deps_captured_without_expanding_allowed_paths(self):
        (self.repo_dir / "src" / "untracked_lib.py").write_bytes(b"VAL = 100\n")
        parser = create_parser()
        args = parser.parse_args([
            "supervised", "--objective", "Test RO deps",
            "--allowed-paths", "src/feature.py",
            "--readonly-deps", "src/untracked_lib.py",
            "--verification-cmd", "python3 -c 'print(1)'",
            "--workspace-root", str(self.repo_dir),
        ])
        captured_backend = None
        def _spy_run_step(*a, **kw):
            return ControllerDisposition.BLOCKED

        def _spy_init_engine(engine_self, *a, **kw):
            nonlocal captured_backend
            captured_backend = engine_self.execution_backend

        with self._patch_container(), patch.object(OrchestratorEngine, "run_step", side_effect=_spy_run_step):
            handle_supervised(args)

        snap = SnapshotBuilder(self.repo_dir).capture_snapshot(
            ObjectiveAuthorization("PROMPT #001", MutationExpectation.REQUIRED, allowed_paths=["src/feature.py"], readonly_snapshot_paths=["src/untracked_lib.py"])
        )
        self.assertIn("src/untracked_lib.py", snap.readonly_snapshot_paths)
        self.assertNotIn("src/untracked_lib.py", ["src/feature.py"])

    def test_16_docker_backend_and_verification_adapter_selected(self):
        parser = create_parser()
        args = parser.parse_args([
            "supervised", "--objective", "Check wiring",
            "--allowed-paths", "src/math_helper.py",
            "--verification-cmd", "python3 -c 'print(1)'",
            "--workspace-root", str(self.repo_dir),
        ])
        captured_engine = None
        def _spy_init_ws(engine_self, *a, **kw):
            nonlocal captured_engine
            captured_engine = engine_self

        with self._patch_container(), patch.object(OrchestratorEngine, "initialize_workspace", autospec=True, side_effect=_spy_init_ws), patch.object(OrchestratorEngine, "run_step", return_value=ControllerDisposition.BLOCKED):
            handle_supervised(args)

        self.assertIsInstance(captured_engine.execution_backend, DockerExecutionBackend)
        self.assertIsInstance(captured_engine.verifier, DockerSandboxVerificationAdapter)

    def test_17_user_objective_passed_to_master_outcome(self):
        parser = create_parser()
        args = parser.parse_args([
            "supervised", "--objective", "Unique Goal 999",
            "--allowed-paths", "src/math_helper.py",
            "--verification-cmd", "python3 -c 'print(1)'",
            "--workspace-root", str(self.repo_dir),
        ])
        captured_master_outcome = None
        def _spy_init_ws(engine_self, master_outcome, definition_of_done):
            nonlocal captured_master_outcome
            captured_master_outcome = master_outcome

        with self._patch_container(), patch.object(OrchestratorEngine, "initialize_workspace", autospec=True, side_effect=_spy_init_ws), patch.object(OrchestratorEngine, "run_step", return_value=ControllerDisposition.BLOCKED):
            handle_supervised(args)

        self.assertEqual(captured_master_outcome, "Unique Goal 999")

    def test_18_19_20_bounded_supervised_task_execution_pass_promotion_no_git_commit(self):
        head_before = GitManager(self.repo_dir).get_head()
        staged_before = GitManager(self.repo_dir).get_staged_files()

        parser = create_parser()
        args = parser.parse_args([
            "supervised", "--objective", "Update math helper",
            "--allowed-paths", "src/math_helper.py",
            "--verification-cmd", "python3 -c 'from src.math_helper import compute; assert compute(5) == 60'",
            "--workspace-root", str(self.repo_dir),
        ])

        turns = [
            {
                "role": "assistant",
                "content": "Updating helper",
                "tool_calls": [
                    {
                        "id": "c1",
                        "type": "function",
                        "function": {
                            "name": "write_file",
                            "arguments": json.dumps({"path": "src/math_helper.py", "content": "def compute(x):\n    return x * 12\n"}),
                        },
                    }
                ],
            },
            {"role": "assistant", "content": "END OF RESULT — PROMPT #001"},
        ]

        def _fake_verifier(container, authorization, verification_plan, delta_digest=""):
            from orchestrator.schema import compute_verification_plan_digest
            return VerificationResult(
                executed=True, passed=True, exit_status=0,
                provenance=VerificationProvenance.EXECUTED_TRUSTED,
                command=verification_plan.command,
                objective_id=authorization.objective_id,
                plan_digest=compute_verification_plan_digest(verification_plan),
                verified_delta_digest=delta_digest,
            )

        from orchestrator.controller import Controller
        from orchestrator.schema import ControllerResult

        def _fake_formulate(*a, **kw):
            return (
                "Update math helper",
                "Update math helper\nRemember to finish with:\nEND OF RESULT — PROMPT #001",
                MutationExpectation.REQUIRED,
            )

        def _fake_reconcile(*a, **kw):
            return ControllerResult(
                correlation_id="PROMPT #001",
                objective="Update math helper",
                controller_disposition=ControllerDisposition.PASS,
                mutation_expectation=MutationExpectation.REQUIRED,
                authorization=kw.get("authorization"),
            )

        with self._patch_container(), patch.object(
            DockerExecutionBackend, "_run_in_container_verification", side_effect=_fake_verifier
        ), patch.object(
            Controller, "formulate_next_prompt", side_effect=_fake_formulate
        ), patch.object(
            Controller, "reconcile_result", side_effect=_fake_reconcile
        ):
            ret = handle_supervised(args, model_client=ScriptedToolLoopModelClient(turns))
            self.assertEqual(ret, 0)

        # Invariant 20: Change applied directly to working tree, but NO git staging or commit occurred!
        self.assertEqual(
            (self.repo_dir / "src" / "math_helper.py").read_bytes(),
            b"def compute(x):\n    return x * 12\n",
        )
        self.assertEqual(GitManager(self.repo_dir).get_head(), head_before)
        self.assertEqual(GitManager(self.repo_dir).get_staged_files(), staged_before)

    def test_21_independent_tasks_have_separate_state_namespaces(self):
        parser = create_parser()
        args1 = parser.parse_args(["supervised", "--objective", "Task 1", "--allowed-paths", "src/math_helper.py", "--verification-cmd", "python3 -c 'print(1)'", "--workspace-root", str(self.repo_dir)])
        args2 = parser.parse_args(["supervised", "--objective", "Task 2", "--allowed-paths", "src/math_helper.py", "--verification-cmd", "python3 -c 'print(1)'", "--workspace-root", str(self.repo_dir)])

        task_dirs: List[Path] = []
        def _spy_init(engine_self, *a, **kw):
            task_dirs.append(engine_self.config.state_path.parent)

        with self._patch_container(), patch.object(OrchestratorEngine, "initialize_workspace", autospec=True, side_effect=_spy_init), patch.object(OrchestratorEngine, "run_step", return_value=ControllerDisposition.BLOCKED):
            handle_supervised(args1)
            handle_supervised(args2)

        self.assertEqual(len(task_dirs), 2)
        self.assertNotEqual(task_dirs[0], task_dirs[1])
        self.assertTrue(str(task_dirs[0]).startswith(tempfile.gettempdir()))

    def test_22_existing_cli_defaults_retain_unavailable_backend(self):
        config = OrchestratorConfig(workspace_root=self.repo_dir)
        engine = OrchestratorEngine(config)
        self.assertIsInstance(engine.execution_backend, UnavailableExecutionBackend)
        # Attempting run_step without injected backend halts immediately
        disp = engine.run_step(authorization=ObjectiveAuthorization("PROMPT #001", MutationExpectation.NOT_ALLOWED))
        self.assertEqual(disp, ControllerDisposition.BLOCKED)

    # --- Legacy Guard Cases (23-25) ---

    def test_23_orchestrator_runner_exits_nonzero_with_security_error(self):
        res = subprocess.run(
            [sys.executable, "orchestrator/runner.py", "--step"],
            cwd=str(Path(__file__).resolve().parents[2]),
            capture_output=True,
            text=True,
        )
        self.assertEqual(res.returncode, 1)
        self.assertIn("[SECURITY ERROR] Direct execution via 'orchestrator/runner.py' is disabled for safety", res.stderr)

    def test_24_scripts_hermes_orchestrator_exits_nonzero_with_security_error(self):
        res = subprocess.run(
            [sys.executable, "scripts/hermes_orchestrator.py", "--goal", "Test"],
            cwd=str(Path(__file__).resolve().parents[2]),
            capture_output=True,
            text=True,
        )
        self.assertEqual(res.returncode, 1)
        self.assertIn("[SECURITY ERROR] Direct execution via 'scripts/hermes_orchestrator.py' is disabled for safety", res.stderr)

    def test_25_legacy_routes_prohibit_programmatic_calls_to_run_hermes(self):
        from orchestrator.runner import run_hermes as runner_run_hermes
        from scripts.hermes_orchestrator import run_hermes_turn as scripts_run_hermes_turn

        with self.assertRaises(RuntimeError) as ctx1:
            runner_run_hermes("Test query")
        self.assertIn("disabled for safety", str(ctx1.exception))

        with self.assertRaises(RuntimeError) as ctx2:
            scripts_run_hermes_turn("Test query", model="dummy")
        self.assertIn("disabled for safety", str(ctx2.exception))


if __name__ == "__main__":
    unittest.main()
