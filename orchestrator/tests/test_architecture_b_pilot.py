import copy
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
from typing import Any, Dict, List, Optional, Tuple
from unittest.mock import patch

from orchestrator.schema import (
    MutationExpectation,
    ObjectiveAuthorization,
    VerificationProvenance,
    VerificationResult,
)
from orchestrator.docker_backend import (
    ContainerAttestation,
    DEFAULT_MODEL_NAME,
    DEFAULT_SANDBOX_IMAGE,
    DockerExecutionBackend,
    DockerSandboxContainer,
    MediatedToolBroker,
)
from orchestrator.workspace_sync import (
    SnapshotBaseline,
    extract_and_validate_container_tar,
)


class ScriptedPilotModelClient:
    """
    Deterministic multi-turn model client that records deep-copied snapshots
    of `messages` passed to `chat_completion` on every turn while driving the
    real `DockerExecutionBackend.execute()` loop and `MediatedToolBroker`.
    """

    def __init__(self, turns: List[Dict[str, Any]], finish_reasons: Optional[List[str]] = None):
        self.turns = list(turns)
        self.finish_reasons = finish_reasons or ["stop"] * len(turns)
        self.call_count = 0
        self.received_messages: List[List[Dict[str, Any]]] = []
        self.received_tools: List[Any] = []

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Any = None,
        model: Any = None,
        stream: bool = False,
        timeout: int = 120,
    ) -> Dict[str, Any]:
        self.received_messages.append(copy.deepcopy(messages))
        self.received_tools.append(copy.deepcopy(tools))
        if self.call_count < len(self.turns):
            msg = copy.deepcopy(self.turns[self.call_count])
            fr = (
                self.finish_reasons[self.call_count]
                if self.call_count < len(self.finish_reasons)
                else "stop"
            )
            self.call_count += 1
        else:
            msg = {"role": "assistant", "content": "END OF RESULT — PROMPT #001"}
            fr = "stop"
        return {
            "model": model or DEFAULT_MODEL_NAME,
            "choices": [{"index": 0, "message": msg, "finish_reason": fr}],
        }


class LocalDirectorySandboxFake:
    """
    Replaces only the Docker CLI transport layer on `DockerSandboxContainer`
    with a local temporary directory while keeping `DockerExecutionBackend.execute()`
    and `MediatedToolBroker` completely real and unmocked.
    """

    def __init__(self) -> None:
        self.sandbox_root = Path(tempfile.mkdtemp(prefix="archb_pilot_sandbox_"))
        self.exec_argv_calls: List[List[str]] = []
        self.exec_shell_calls: List[str] = []
        self.started: bool = False
        self.stopped: bool = False

    def cleanup(self) -> None:
        shutil.rmtree(self.sandbox_root, ignore_errors=True)

    def make_attestation(self, container: DockerSandboxContainer) -> ContainerAttestation:
        return ContainerAttestation(
            container_id=container.container_id or "pilot_fake_container_1234567890",
            container_name=container.container_name,
            image=container.image,
            running=True,
            network_mode="none",
            cap_drop=["ALL"],
            security_opt=["no-new-privileges"],
            privileged=False,
            host_mounts=[],
            effective_uid=1000,
            git_dir_absent=True,
            docker_sock_absent=True,
            python_version="Python 3.11.0",
            node_version="v20.0.0",
        )

    def start(self, container: DockerSandboxContainer) -> ContainerAttestation:
        self.started = True
        container.container_id = "pilot_fake_container_1234567890"
        container.retired = False
        container.timed_out = False
        container.forced_retirement = False
        container.attestation = self.make_attestation(container)
        return container.attestation

    def import_snapshot(self, container: DockerSandboxContainer, baseline: SnapshotBaseline) -> None:
        for item in self.sandbox_root.iterdir():
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
        tar_bytes = baseline.build_tar_bytes()
        if not tar_bytes:
            return
        files_map = extract_and_validate_container_tar(tar_bytes)
        for rel_posix, raw_bytes in files_map.items():
            dest = self.sandbox_root / rel_posix
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(raw_bytes)

    def export_workspace(self, container: DockerSandboxContainer) -> Dict[str, bytes]:
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w") as tf:
            for root, dirs, files in os.walk(self.sandbox_root):
                dirs[:] = [
                    d
                    for d in sorted(dirs)
                    if d not in ("__pycache__", ".pytest_cache", ".git", "node_modules")
                ]
                for fname in sorted(files):
                    if fname.endswith(".pyc"):
                        continue
                    full_path = Path(root) / fname
                    rel_posix = full_path.relative_to(self.sandbox_root).as_posix()
                    tf.add(str(full_path), arcname=rel_posix, recursive=False)
        return extract_and_validate_container_tar(buf.getvalue())

    def exec_argv(
        self,
        container: DockerSandboxContainer,
        argv: List[str],
        timeout: int = 120,
        cwd: str = "/workspace",
        env: Optional[Dict[str, str]] = None,
        retire_on_timeout: bool = True,
    ) -> subprocess.CompletedProcess:
        self.exec_argv_calls.append(list(argv))
        translated_argv = [
            arg.replace("/workspace", str(self.sandbox_root)) if isinstance(arg, str) else arg
            for arg in argv
        ]
        if translated_argv and translated_argv[0] in ("python3", "python"):
            translated_argv[0] = sys.executable
        run_env = os.environ.copy()
        if env:
            run_env.update(env)
        return subprocess.run(
            translated_argv,
            cwd=str(self.sandbox_root),
            env=run_env,
            capture_output=True,
            text=True,
            timeout=timeout,
            stdin=subprocess.DEVNULL,
        )

    def exec_shell(
        self,
        container: DockerSandboxContainer,
        command: str,
        timeout: int = 120,
        cwd: str = "/workspace",
        env: Optional[Dict[str, str]] = None,
        retire_on_timeout: bool = True,
    ) -> subprocess.CompletedProcess:
        self.exec_shell_calls.append(command)
        return self.exec_argv(
            container,
            ["sh", "-c", command],
            timeout=timeout,
            cwd=cwd,
            env=env,
            retire_on_timeout=retire_on_timeout,
        )

    def stop_and_remove(self, container: DockerSandboxContainer) -> None:
        self.stopped = True
        container.retired = True
        container.container_id = None


class TestArchitectureBPilot(unittest.TestCase):
    """
    Pilot verification suite proving malformed tool argument rejection,
    `tool_call_id` preservation, out-of-scope write protection, and subsequent
    turn recovery through the real `DockerExecutionBackend.execute()` loop
    and `MediatedToolBroker`.
    """

    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="archb_pilot_repo_"))
        self.repo_dir = self.temp_dir / "repo"
        self.repo_dir.mkdir(parents=True, exist_ok=True)
        self._init_git_repo(self.repo_dir)
        self.sandbox_fake = LocalDirectorySandboxFake()

    def tearDown(self) -> None:
        self.sandbox_fake.cleanup()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _init_git_repo(self, root: Path) -> None:
        subprocess.run(["git", "init"], cwd=str(root), capture_output=True, check=True)
        subprocess.run(
            ["git", "config", "core.autocrlf", "false"],
            cwd=str(root),
            capture_output=True,
            check=True,
        )
        subprocess.run(
            ["git", "config", "user.email", "pilot@example.com"],
            cwd=str(root),
            capture_output=True,
            check=True,
        )
        subprocess.run(
            ["git", "config", "user.name", "Pilot Tester"],
            cwd=str(root),
            capture_output=True,
            check=True,
        )

        (root / "src").mkdir(parents=True, exist_ok=True)
        (root / "docs").mkdir(parents=True, exist_ok=True)
        (root / "src" / "__init__.py").write_bytes(b"")
        (root / "src" / "calculator.py").write_bytes(
            b"def add(a: int, b: int) -> int:\n"
            b"    return a - b\n"
        )
        (root / "docs" / "notes.md").write_bytes(
            b"# Protected Notes\nOriginal content must remain untouched.\n"
        )
        (root / "README.md").write_bytes(b"# Pilot Repo\n")
        subprocess.run(["git", "add", "."], cwd=str(root), capture_output=True, check=True)
        subprocess.run(
            ["git", "commit", "-m", "Initial baseline commit"],
            cwd=str(root),
            capture_output=True,
            check=True,
        )

    def _patch_container_transport(self):
        fake = self.sandbox_fake

        def _check_prereq(cls_or_image: Any = DEFAULT_SANDBOX_IMAGE) -> Tuple[bool, str]:
            return True, "ok"

        return patch.multiple(
            DockerSandboxContainer,
            check_runtime_prerequisites=classmethod(lambda cls, image=DEFAULT_SANDBOX_IMAGE: (True, "ok")),
            start=lambda container_self: fake.start(container_self),
            verify_physical_attestation=lambda container_self: fake.make_attestation(container_self),
            import_snapshot=lambda container_self, baseline: fake.import_snapshot(container_self, baseline),
            export_workspace=lambda container_self: fake.export_workspace(container_self),
            exec_argv=lambda container_self, argv, timeout=120, cwd="/workspace", env=None, retire_on_timeout=True: (
                fake.exec_argv(
                    container_self,
                    argv,
                    timeout=timeout,
                    cwd=cwd,
                    env=env,
                    retire_on_timeout=retire_on_timeout,
                )
            ),
            exec_shell=lambda container_self, command, timeout=120, cwd="/workspace", env=None, retire_on_timeout=True: (
                fake.exec_shell(
                    container_self,
                    command,
                    timeout=timeout,
                    cwd=cwd,
                    env=env,
                    retire_on_timeout=retire_on_timeout,
                )
            ),
            stop_and_remove=lambda container_self: fake.stop_and_remove(container_self),
             create=True,
        )

    def test_malformed_args_tool_call_id_preservation_scope_protection_and_turn_recovery(self) -> None:
        """
        End-to-end test through the real `DockerExecutionBackend.execute()` loop
        and `MediatedToolBroker` proving invariants (a), (b), (c), (d), and (e):
          (a) Invalid JSON tool arguments (e.g. "{malformed") and non-dict JSON
              arguments (e.g. "[1,2]") are rejected with MALFORMED_TOOL_ARGUMENTS
              and never invoke the proposed tool in the container.
          (b) The model-visible tool error message appended to `messages`
              (role="tool") preserves the exact originating `tool_call_id`.
          (c) A subsequent well-formed tool call in Turn 2 executes normally via
              `MediatedToolBroker`.
          (d) An out-of-scope or malformed write attempt never mutates
              unauthorized files.
          (e) The test exercises real `DockerExecutionBackend.execute()` and
              `MediatedToolBroker` logic.
        """
        turns = [
            # Turn 1: Malformed JSON string, non-dict JSON array, and out-of-scope write attempt
            {
                "role": "assistant",
                "content": "Turn 1: attempting malformed and out-of-scope tool calls.",
                "tool_calls": [
                    {
                        "id": "call_id_malformed_json_01",
                        "type": "function",
                        "function": {
                            "name": "write_file",
                            "arguments": "{malformed",
                        },
                    },
                    {
                        "id": "call_id_non_dict_json_02",
                        "type": "function",
                        "function": {
                            "name": "write_file",
                            "arguments": "[1,2]",
                        },
                    },
                    {
                        "id": "call_id_out_of_scope_write_03",
                        "type": "function",
                        "function": {
                            "name": "write_file",
                            "arguments": json.dumps(
                                {
                                    "path": "docs/notes.md",
                                    "content": "HACKED UNAUTHORIZED CONTENT\n",
                                }
                            ),
                        },
                    },
                ],
            },
            # Turn 2: Recovery with well-formed read_file and authorized write_file
            {
                "role": "assistant",
                "content": "Turn 2: recovering with valid tool calls on authorized path.",
                "tool_calls": [
                    {
                        "id": "call_id_valid_read_04",
                        "type": "function",
                        "function": {
                            "name": "read_file",
                            "arguments": json.dumps({"path": "src/calculator.py"}),
                        },
                    },
                    {
                        "id": "call_id_valid_write_05",
                        "type": "function",
                        "function": {
                            "name": "write_file",
                            "arguments": json.dumps(
                                {
                                    "path": "src/calculator.py",
                                    "content": (
                                        "def add(a: int, b: int) -> int:\n"
                                        "    return a + b\n"
                                    ),
                                }
                            ),
                        },
                    },
                ],
            },
            # Turn 3: Final completion message
            {
                "role": "assistant",
                "content": "Repaired src/calculator.py successfully.\nEND OF RESULT — PROMPT #001",
            },
        ]

        model_client = ScriptedPilotModelClient(turns)
        backend = DockerExecutionBackend(
            workspace_root=self.repo_dir,
            model_client=model_client,
        )
        auth = ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.REQUIRED,
            allowed_paths=["src"],
            verification_requirements=["python3 -c 'print(1)'"],
        )

        # Spy on MediatedToolBroker.dispatch_tool while executing the REAL method
        real_dispatch = MediatedToolBroker.dispatch_tool
        dispatched_calls: List[Tuple[str, Any]] = []

        def _spy_dispatch(broker_self: MediatedToolBroker, tool_name: str, arguments: Any) -> str:
            dispatched_calls.append((tool_name, copy.deepcopy(arguments)))
            return real_dispatch(broker_self, tool_name, arguments)

        def _fake_in_container_verification(
            container: DockerSandboxContainer,
            authorization: ObjectiveAuthorization,
            verification_plan: Any,
            delta_digest: str = "",
        ) -> VerificationResult:
            return VerificationResult(
                executed=True,
                passed=True,
                exit_status=0,
                provenance=VerificationProvenance.EXECUTED_TRUSTED,
                command="python3 -c 'print(1)'",
                argv=["python3", "-c", "print(1)"],
                observable_output="1\n",
                objective_id=authorization.objective_id,
                verified_delta_digest=delta_digest,
            )

        with self._patch_container_transport(), patch.object(
            MediatedToolBroker, "dispatch_tool", autospec=True, side_effect=_spy_dispatch
        ), patch.object(
            backend, "_run_in_container_verification", side_effect=_fake_in_container_verification
        ):
            # Capture exec_argv count after Turn 1 by inspecting inside Turn 2's chat_completion
            response = backend.execute("PROMPT #001", authorization=auth)

        # --- Invariant (e): Real DockerExecutionBackend.execute() and MediatedToolBroker ran ---
        self.assertEqual(response.exit_code, 0, f"Expected exit_code=0, got stderr={response.stderr!r}")
        self.assertIn("END OF RESULT — PROMPT #001", response.clean_text)
        self.assertEqual(model_client.call_count, 3)
        self.assertIsNotNone(backend.last_prepared_execution)
        self.assertFalse(backend.last_prepared_execution.expired)
        self.assertEqual(len(backend.last_tool_history), 5)

        # --- Invariant (a): Invalid JSON ("{malformed") & non-dict JSON ("[1,2]") rejected with
        # MALFORMED_TOOL_ARGUMENTS and NEVER invoke the proposed tool in the container ---
        rec_malformed_json = backend.last_tool_history[0]
        self.assertEqual(rec_malformed_json.tool_name, "write_file")
        self.assertFalse(rec_malformed_json.allowed)
        self.assertFalse(rec_malformed_json.executed_in_container)
        self.assertIn("MALFORMED_TOOL_ARGUMENTS", rec_malformed_json.result_summary)

        rec_non_dict_json = backend.last_tool_history[1]
        self.assertEqual(rec_non_dict_json.tool_name, "write_file")
        self.assertFalse(rec_non_dict_json.allowed)
        self.assertFalse(rec_non_dict_json.executed_in_container)
        self.assertIn("MALFORMED_TOOL_ARGUMENTS", rec_non_dict_json.result_summary)

        # Neither malformed call reached MediatedToolBroker.dispatch_tool or container.exec_argv:
        # Only the 3 well-formed JSON object calls (1 out-of-scope in Turn 1 + 2 valid in Turn 2)
        # were passed to broker.dispatch_tool, and only the 2 authorized calls in Turn 2 ran exec_argv!
        self.assertEqual(len(dispatched_calls), 3)
        self.assertEqual(len(self.sandbox_fake.exec_argv_calls), 2)

        # Also verify direct MediatedToolBroker.dispatch_tool rejection of non-dict arguments
        direct_broker = MediatedToolBroker(
            container=DockerSandboxContainer(image=DEFAULT_SANDBOX_IMAGE),
            authorization=auth,
        )
        direct_err_raw = direct_broker.dispatch_tool("write_file", ["not", "a", "dict"])
        direct_err = json.loads(direct_err_raw)
        self.assertFalse(direct_err["allowed"])
        self.assertIn("MALFORMED_TOOL_ARGUMENTS", direct_err["error"])
        self.assertFalse(direct_broker.tool_history[0].executed_in_container)

        # --- Invariant (b): Model-visible tool error messages appended to `messages` (role="tool")
        # preserve the exact originating `tool_call_id` ---
        # Inspect messages received by model_client at Turn 2 (index 1)
        turn_2_messages = model_client.received_messages[1]
        tool_messages_turn_1 = [m for m in turn_2_messages if m.get("role") == "tool"]
        self.assertEqual(len(tool_messages_turn_1), 3)

        self.assertEqual(tool_messages_turn_1[0]["tool_call_id"], "call_id_malformed_json_01")
        self.assertEqual(tool_messages_turn_1[0]["name"], "write_file")
        err_payload_0 = json.loads(tool_messages_turn_1[0]["content"])
        self.assertFalse(err_payload_0["allowed"])
        self.assertIn("MALFORMED_TOOL_ARGUMENTS", err_payload_0["error"])

        self.assertEqual(tool_messages_turn_1[1]["tool_call_id"], "call_id_non_dict_json_02")
        self.assertEqual(tool_messages_turn_1[1]["name"], "write_file")
        err_payload_1 = json.loads(tool_messages_turn_1[1]["content"])
        self.assertFalse(err_payload_1["allowed"])
        self.assertIn("MALFORMED_TOOL_ARGUMENTS", err_payload_1["error"])

        self.assertEqual(tool_messages_turn_1[2]["tool_call_id"], "call_id_out_of_scope_write_03")
        self.assertEqual(tool_messages_turn_1[2]["name"], "write_file")
        err_payload_2 = json.loads(tool_messages_turn_1[2]["content"])
        self.assertFalse(err_payload_2["allowed"])
        self.assertIn("UnauthorizedPathError", err_payload_2["error"])

        # --- Invariant (c): Subsequent well-formed tool calls in Turn 2 execute normally
        # via MediatedToolBroker ---
        rec_valid_read = backend.last_tool_history[3]
        self.assertEqual(rec_valid_read.tool_name, "read_file")
        self.assertTrue(rec_valid_read.allowed)
        self.assertTrue(rec_valid_read.executed_in_container)

        rec_valid_write = backend.last_tool_history[4]
        self.assertEqual(rec_valid_write.tool_name, "write_file")
        self.assertTrue(rec_valid_write.allowed)
        self.assertTrue(rec_valid_write.executed_in_container)

        turn_3_messages = model_client.received_messages[2]
        tool_messages_all = [m for m in turn_3_messages if m.get("role") == "tool"]
        self.assertEqual(len(tool_messages_all), 5)
        self.assertEqual(tool_messages_all[3]["tool_call_id"], "call_id_valid_read_04")
        read_payload = json.loads(tool_messages_all[3]["content"])
        self.assertEqual(read_payload["path"], "src/calculator.py")
        self.assertIn("return a - b", read_payload["content"])

        self.assertEqual(tool_messages_all[4]["tool_call_id"], "call_id_valid_write_05")
        write_payload = json.loads(tool_messages_all[4]["content"])
        self.assertEqual(write_payload["status"], "ok")
        self.assertEqual(write_payload["path"], "src/calculator.py")

        # --- Invariant (d): Out-of-scope or malformed write attempts never mutate
        # unauthorized files in either the sandbox container or host repository ---
        rec_out_of_scope = backend.last_tool_history[2]
        self.assertEqual(rec_out_of_scope.tool_name, "write_file")
        self.assertFalse(rec_out_of_scope.allowed)
        self.assertFalse(rec_out_of_scope.executed_in_container)
        self.assertIn("UnauthorizedPathError", rec_out_of_scope.result_summary)

        # Sandbox file `docs/notes.md` and host `docs/notes.md` remain identical to baseline
        self.assertEqual(
            (self.sandbox_fake.sandbox_root / "docs" / "notes.md").read_text(encoding="utf-8"),
            "# Protected Notes\nOriginal content must remain untouched.\n",
        )
        self.assertEqual(
            (self.repo_dir / "docs" / "notes.md").read_text(encoding="utf-8"),
            "# Protected Notes\nOriginal content must remain untouched.\n",
        )

        # Only `src/calculator.py` appears in the exported workspace delta
        self.assertIsNotNone(backend.last_delta)
        self.assertEqual(backend.last_delta.modified, ["src/calculator.py"])
        self.assertEqual(
            backend.last_delta.new_file_bytes.get("src/calculator.py"),
            ("def add(a: int, b: int) -> int:\n    return a + b\n").encode("utf-8"),
        )
        self.assertEqual(backend.last_delta.created, [])
        self.assertEqual(backend.last_delta.deleted, [])
        self.assertNotIn("docs/notes.md", backend.last_delta.all_affected_paths)


if __name__ == "__main__":
    unittest.main()
