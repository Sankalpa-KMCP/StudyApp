import io
import json
import os
import posixpath
import re
import shlex
import shutil
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from orchestrator.circuit_breaker import CircuitBreaker
from orchestrator.execution_backend import (
    BackendRuntimeType,
    ExecutionBackend,
    ExecutionBackendNotAvailableError,
)
from orchestrator.git_manager import (
    PROTECTED_PATH_PATTERNS,
    is_path_authorized,
)
from orchestrator.hermes_client import HermesResponse
from orchestrator.schema import (
    AuthorizationEscalationError,
    ControllerDisposition,
    MutationExpectation,
    ObjectiveAuthorization,
    TrustedVerificationPlan,
    VerificationProvenance,
    VerificationResult,
    VerificationStep,
    compute_authorization_digest,
    compute_verification_plan_digest,
)
from orchestrator.workspace_sync import (
    DirectSourceSynchronizer,
    PathTraversalError,
    SnapshotBaseline,
    SnapshotBuilder,
    SyncResult,
    UnauthorizedPathError,
    UnverifiedSyncError,
    WorkspaceDelta,
    WorkspaceIsolationError,
    compute_files_manifest_digest,
    compute_workspace_delta,
    extract_and_validate_container_tar,
    is_protected_from_mutation,
    is_secret_or_orchestrator_internal_path,
    validate_delta_authorization,
    validate_safe_relative_posix_path,
)


DEFAULT_SANDBOX_IMAGE = "cursor_sandbox-dev:latest"
DEFAULT_PROXY_BASE_URL = "http://127.0.0.1:8045/v1"
DEFAULT_MODEL_NAME = "gemini-3.8-flash-high"
DEFAULT_PROVIDER_NAME = "custom:antigravity-manager"

# Commands permanently forbidden inside the coding tool loop (defense-in-depth)
FORBIDDEN_CONTAINER_COMMAND_PATTERNS = (
    re.compile(r"\bgit\s+(?:commit|push|add|stage|reset|clean|stash|rebase|merge|tag)\b", re.IGNORECASE),
    re.compile(r"\bdocker\b", re.IGNORECASE),
    re.compile(r"\bshutdown\b|\breboot\b", re.IGNORECASE),
)

# Disallowed compound shell tokens in argv-based verification steps
COMPOUND_SHELL_OPERATOR_TOKENS = frozenset({"&&", "||", ";", "|", ">", ">>", "<", "<<", "&", ";&", "|&"})
SUBSHELL_SUBSTITUTION_RE = re.compile(r"(?:`|\$\()")

# Explicit allowlist of environment variable names permitted in verification steps
ALLOWED_VERIFICATION_ENV_KEYS = frozenset({
    "PYTHONPATH",
    "PYTHONDONTWRITEBYTECODE",
    "PYTHONUNBUFFERED",
    "NODE_ENV",
    "NODE_OPTIONS",
    "CI",
    "TZ",
    "LANG",
    "LC_ALL",
    "NO_COLOR",
    "FORCE_COLOR",
})

REQUIRED_TOOL_PARAMS: Dict[str, Tuple[str, ...]] = {
    "list_files": (),
    "read_file": ("path",),
    "search_files": ("pattern",),
    "write_file": ("path", "content"),
    "patch_file": ("path", "old_string", "new_string"),
    "delete_file": ("path",),
    "run_command": ("command",),
}


def _has_unquoted_shell_operator(raw_cmd: str) -> bool:
    if SUBSHELL_SUBSTITUTION_RE.search(raw_cmd):
        return True
    lex = shlex.shlex(raw_cmd, posix=True, punctuation_chars=True)
    lex.whitespace_split = False
    for tok in lex:
        if tok in COMPOUND_SHELL_OPERATOR_TOKENS or any(op in tok for op in ("&&", "||", ";", "|", ">", "<")):
            # If the token is purely punctuation chars from shlex punctuation_chars=True, it was unquoted!
            if all(c in ";|&><" for c in tok):
                return True
    return False


def parse_structured_verification_step(
    raw_cmd: str,
    default_timeout: int = 120,
    allow_container_shell: bool = False,
) -> VerificationStep:
    """
    Parse a single verification requirement string into a structured VerificationStep.
    Rejects unquoted compound shell operators ('&&', '||', ';', '|', redirection, subshells)
    unless `allow_container_shell=True` is explicitly set.
    Extracts leading allowlisted KEY=VALUE environment assignments safely.
    """
    if not raw_cmd or not isinstance(raw_cmd, str) or not raw_cmd.strip():
        raise ValueError("Verification step command cannot be empty.")

    cleaned = raw_cmd.strip()
    for pattern in FORBIDDEN_CONTAINER_COMMAND_PATTERNS:
        if pattern.search(cleaned):
            raise ValueError(f"Verification command '{cleaned}' violates security policy.")

    if allow_container_shell:
        return VerificationStep(
            argv=["sh", "-c", cleaned],
            timeout=default_timeout,
            allow_container_shell=True,
            raw_command=cleaned,
        )

    if _has_unquoted_shell_operator(cleaned):
        raise ValueError(
            f"Compound shell syntax is rejected in argv verification step: {cleaned!r}. "
            "Specify multiple ordered VerificationStep entries or explicitly authorize allow_container_shell=True."
        )

    tokens = shlex.split(cleaned, posix=True)
    if not tokens:
        raise ValueError(f"Verification command produced no argv tokens: {cleaned!r}")

    env_map: Dict[str, str] = {}
    idx = 0
    while idx < len(tokens) and "=" in tokens[idx] and not tokens[idx].startswith("-"):
        key, val = tokens[idx].split("=", 1)
        if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", key):
            break
        if key not in ALLOWED_VERIFICATION_ENV_KEYS:
            raise ValueError(
                f"Environment variable '{key}' in verification command is not in ALLOWED_VERIFICATION_ENV_KEYS."
            )
        env_map[key] = val
        idx += 1

    argv = tokens[idx:]
    if not argv:
        raise ValueError(f"Verification command contains only environment assignments and no executable: {cleaned!r}")

    for tok in argv:
        if tok in COMPOUND_SHELL_OPERATOR_TOKENS:
            raise ValueError(f"Disallowed shell operator token '{tok}' in verification argv.")

    return VerificationStep(
        argv=argv,
        environment=env_map,
        timeout=default_timeout,
        allow_container_shell=False,
        raw_command=cleaned,
    )


def resolve_canonical_verification_plan(
    authorization: Optional[ObjectiveAuthorization],
    explicit_plan: Optional[TrustedVerificationPlan] = None,
    default_timeout: int = 120,
) -> TrustedVerificationPlan:
    """
    Resolve the canonical TrustedVerificationPlan once BEFORE opening execution.
    Never invents 'npm test' as an implicit fallback.
    """
    if explicit_plan is not None:
        if explicit_plan.steps:
            cmd_summary = explicit_plan.command or " ; ".join(
                s.raw_command or " ".join(s.argv) for s in explicit_plan.steps
            )
            return TrustedVerificationPlan(
                command=cmd_summary,
                argv=explicit_plan.steps[0].argv if len(explicit_plan.steps) == 1 else explicit_plan.argv,
                timeout=explicit_plan.timeout,
                environment=explicit_plan.environment,
                working_directory=explicit_plan.working_directory,
                allowed_to_run_host=explicit_plan.allowed_to_run_host,
                steps=list(explicit_plan.steps),
            )
        if explicit_plan.argv:
            step = VerificationStep(
                argv=list(explicit_plan.argv),
                working_directory=explicit_plan.working_directory or "/workspace",
                environment=dict(explicit_plan.environment or {}),
                timeout=explicit_plan.timeout,
                raw_command=explicit_plan.command or " ".join(explicit_plan.argv),
            )
            return TrustedVerificationPlan(
                command=step.raw_command,
                argv=step.argv,
                timeout=explicit_plan.timeout,
                environment=explicit_plan.environment,
                working_directory=explicit_plan.working_directory,
                allowed_to_run_host=explicit_plan.allowed_to_run_host,
                steps=[step],
            )
        if explicit_plan.command and explicit_plan.command.strip():
            step = parse_structured_verification_step(
                explicit_plan.command,
                default_timeout=explicit_plan.timeout,
            )
            return TrustedVerificationPlan(
                command=explicit_plan.command.strip(),
                argv=step.argv,
                timeout=explicit_plan.timeout,
                environment=step.environment or explicit_plan.environment,
                working_directory=explicit_plan.working_directory,
                allowed_to_run_host=explicit_plan.allowed_to_run_host,
                steps=[step],
            )
        return TrustedVerificationPlan(command="", steps=[])

    if authorization is None or not authorization.verification_requirements:
        return TrustedVerificationPlan(command="", steps=[])

    reqs = [r.strip() for r in authorization.verification_requirements if r and r.strip()]
    if not reqs:
        return TrustedVerificationPlan(command="", steps=[])

    steps: List[VerificationStep] = [
        parse_structured_verification_step(r, default_timeout=default_timeout) for r in reqs
    ]
    return TrustedVerificationPlan(
        command=" ; ".join(reqs),
        argv=steps[0].argv if len(steps) == 1 else None,
        timeout=default_timeout,
        steps=steps,
    )


@dataclass
class ResolvedModelEndpoint:
    """
    Non-secret model/provider configuration resolved from the installed Hermes runtime.
    Never exposes or stores raw API keys in logs or containers.
    """
    provider: str = DEFAULT_PROVIDER_NAME
    model: str = DEFAULT_MODEL_NAME
    base_url: str = DEFAULT_PROXY_BASE_URL
    config_source: str = "default"


def resolve_hermes_model_endpoint() -> ResolvedModelEndpoint:
    """
    Inspect the installed Hermes configuration read-only to resolve the active
    provider, model name, and localhost proxy endpoint without printing or leaking secrets.
    """
    local_app_data = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
    hermes_root = local_app_data / "hermes" / "hermes-agent"
    try:
        import sys as _sys
        added = False
        if hermes_root.is_dir() and str(hermes_root) not in _sys.path:
            _sys.path.insert(0, str(hermes_root))
            added = True
        try:
            from hermes_cli.config import load_config  # type: ignore
            cfg = load_config() or {}
            model_cfg = cfg.get("model", {}) if isinstance(cfg, dict) else {}
            provider = str(model_cfg.get("provider") or DEFAULT_PROVIDER_NAME)
            model_name = str(model_cfg.get("default") or model_cfg.get("name") or DEFAULT_MODEL_NAME)
            base_url = str(model_cfg.get("base_url") or DEFAULT_PROXY_BASE_URL).rstrip("/")
            return ResolvedModelEndpoint(
                provider=provider,
                model=model_name,
                base_url=base_url,
                config_source="hermes_cli.config",
            )
        finally:
            if added and str(hermes_root) in _sys.path:
                _sys.path.remove(str(hermes_root))
    except Exception:
        return ResolvedModelEndpoint()


@dataclass
class ContainerAttestation:
    """
    Physical runtime attestation evidence collected from a live Docker container
    via `docker inspect` and in-container verification probes.
    """
    container_id: str
    container_name: str
    image: str
    running: bool
    network_mode: str
    cap_drop: List[str]
    security_opt: List[str]
    privileged: bool
    host_mounts: List[str]
    effective_uid: int
    git_dir_absent: bool
    docker_sock_absent: bool
    python_version: str = ""
    node_version: str = ""

    @property
    def is_physically_attested(self) -> bool:
        return (
            bool(self.container_id)
            and self.running
            and self.network_mode == "none"
            and ("ALL" in self.cap_drop or "all" in [c.lower() for c in self.cap_drop])
            and any("no-new-privileges" in opt for opt in self.security_opt)
            and not self.privileged
            and len(self.host_mounts) == 0
            and self.effective_uid != 0
            and self.git_dir_absent
            and self.docker_sock_absent
        )


@dataclass
class PreparedExecution:
    """
    Immutable Phase 1 execution artifact holding the proposed changes, baseline hashes,
    verification outcome, and completion status prior to Phase 2 controller acceptance
    and working-tree synchronization.
    """
    objective_id: str
    authorization: ObjectiveAuthorization
    baseline: SnapshotBaseline
    delta: WorkspaceDelta
    verified_delta_digest: str
    verification_result: VerificationResult
    attestation: Optional[ContainerAttestation]
    response: HermesResponse
    loop_completed: bool
    failure_reason: Optional[str] = None
    applied: bool = False
    expired: bool = False
    authorization_digest: str = ""
    plan_digest: str = ""
    unauthorized_deltas: List[str] = field(default_factory=list)


class DockerSandboxContainer:
    """
    Manages a uniquely identified, disposable Docker container for Architecture B.
    Enforces:
    - Local image existence (--pull=never; never pulls or builds images)
    - Air-gapped network by default (--network=none)
    - All capabilities dropped (--cap-drop=ALL) and no-new-privileges
    - Non-root user execution (--user=1000:1000)
    - Explicit CPU, memory, and PID resource limits
    - Ephemeral tmpfs /workspace and /tmp with ZERO host bind mounts (-v)
    - Immediate container retirement and process-tree termination on command timeout
    """

    def __init__(
        self,
        image: str = DEFAULT_SANDBOX_IMAGE,
        cpus: str = "1",
        memory: str = "512m",
        pids_limit: str = "64",
        user: str = "1000:1000",
        network: str = "none",
        workspace_size: str = "256m",
        dispatch_id: str = "unassigned",
    ):
        self.image = image
        self.cpus = cpus
        self.memory = memory
        self.pids_limit = pids_limit
        self.user = user
        self.network = network
        self.workspace_size = workspace_size
        self.dispatch_id = re.sub(r"[^A-Za-z0-9_.-]", "_", dispatch_id)[:48] or "dispatch"
        self.container_name = f"hermes-archb-{uuid.uuid4().hex[:12]}"
        self.container_id: Optional[str] = None
        self.attestation: Optional[ContainerAttestation] = None
        self.timed_out: bool = False
        self.retired: bool = False
        self.forced_retirement: bool = False
        self._docker_bin = shutil.which("docker") or "docker"

    @classmethod
    def check_runtime_prerequisites(cls, image: str = DEFAULT_SANDBOX_IMAGE) -> Tuple[bool, str]:
        docker_bin = shutil.which("docker")
        if not docker_bin:
            return False, "Docker CLI binary not found on PATH."
        try:
            ver = subprocess.run(
                [docker_bin, "version", "--format", "{{.Server.Version}}"],
                capture_output=True,
                text=True,
                timeout=10,
                stdin=subprocess.DEVNULL,
            )
            if ver.returncode != 0:
                return False, f"Docker daemon is not responding: {ver.stderr.strip()}"

            img = subprocess.run(
                [docker_bin, "image", "inspect", image, "--format", "{{.Id}}"],
                capture_output=True,
                text=True,
                timeout=10,
                stdin=subprocess.DEVNULL,
            )
            if img.returncode != 0:
                return False, f"Required sandbox image '{image}' is not present locally (image pulls are prohibited)."

            return True, f"Docker server {ver.stdout.strip()} ready with cached image {image} ({img.stdout.strip()[:19]})"
        except Exception as exc:
            return False, f"Docker prerequisite check failed: {exc}"

    def start(self) -> ContainerAttestation:
        ok, reason = self.check_runtime_prerequisites(self.image)
        if not ok:
            raise ExecutionBackendNotAvailableError(reason)

        uid_part, gid_part = ("1000", "1000")
        if ":" in self.user:
            uid_part, gid_part = self.user.split(":", 1)

        cmd = [
            self._docker_bin, "run", "-d", "--rm",
            "--name", self.container_name,
            "--pull=never",
            f"--network={self.network}",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            f"--cpus={self.cpus}",
            f"--memory={self.memory}",
            f"--pids-limit={self.pids_limit}",
            f"--user={self.user}",
            "--label", "hermes-archb-sandbox=1",
            "--label", f"hermes-dispatch-id={self.dispatch_id}",
            "--tmpfs", f"/workspace:rw,exec,size={self.workspace_size},uid={uid_part},gid={gid_part}",
            "--tmpfs", f"/tmp:rw,nosuid,size=128m,uid={uid_part},gid={gid_part}",
            "-w", "/workspace",
            self.image,
            "sleep", "600",
        ]

        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
                check=True,
                stdin=subprocess.DEVNULL,
            )
            self.container_id = res.stdout.strip()
        except Exception as exc:
            self.stop_and_remove()
            raise ExecutionBackendNotAvailableError(
                f"Failed to start disposable sandbox container: {exc}"
            ) from exc

        try:
            self.attestation = self.verify_physical_attestation()
            if not self.attestation.is_physically_attested:
                raise ExecutionBackendNotAvailableError(
                    f"Container physical isolation attestation failed: {self.attestation}"
                )
            return self.attestation
        except Exception:
            self.stop_and_remove()
            raise

    def verify_physical_attestation(self) -> ContainerAttestation:
        if not self.container_id or self.retired:
            raise ExecutionBackendNotAvailableError("Container is not active.")

        insp = subprocess.run(
            [self._docker_bin, "inspect", self.container_id],
            capture_output=True,
            text=True,
            timeout=15,
            check=True,
            stdin=subprocess.DEVNULL,
        )
        data = json.loads(insp.stdout)[0]
        state = data.get("State", {})
        host_cfg = data.get("HostConfig", {})
        mounts = data.get("Mounts", []) or []
        binds = host_cfg.get("Binds") or []
        volumes_from = host_cfg.get("VolumesFrom") or []
        devices = host_cfg.get("Devices") or []

        all_mounts = [str(m.get("Source", "")) for m in mounts] + [str(b) for b in binds] + [str(v) for v in volumes_from] + [str(d) for d in devices]

        probe = self.exec_argv(
            [
                "sh", "-c",
                "id -u && "
                "(test ! -e /workspace/.git && echo NO_GIT || echo HAS_GIT) && "
                "(test ! -S /var/run/docker.sock && echo NO_SOCK || echo HAS_SOCK) && "
                "python3 --version 2>&1 && "
                "node --version 2>&1",
            ],
            timeout=15,
        )
        lines = [ln.strip() for ln in (probe.stdout or "").splitlines() if ln.strip()]
        uid_val = int(lines[0]) if lines and lines[0].isdigit() else 0
        no_git = "NO_GIT" in lines
        no_sock = "NO_SOCK" in lines
        py_ver = lines[3] if len(lines) > 3 else ""
        node_ver = lines[4] if len(lines) > 4 else ""

        return ContainerAttestation(
            container_id=self.container_id,
            container_name=self.container_name,
            image=self.image,
            running=bool(state.get("Running", False)),
            network_mode=str(host_cfg.get("NetworkMode", "")),
            cap_drop=list(host_cfg.get("CapDrop") or []),
            security_opt=list(host_cfg.get("SecurityOpt") or []),
            privileged=bool(host_cfg.get("Privileged", False)),
            host_mounts=all_mounts,
            effective_uid=uid_val,
            git_dir_absent=no_git,
            docker_sock_absent=no_sock,
            python_version=py_ver,
            node_version=node_ver,
        )

    def import_snapshot(self, baseline: SnapshotBaseline) -> None:
        if not self.container_id or self.retired:
            raise ExecutionBackendNotAvailableError("Container is not running or was retired.")
        # Clear /workspace first so shared/reused test containers start clean
        self.exec_argv(
            [
                "python3", "-c",
                "import os, shutil, stat\n"
                "for entry in os.listdir('/workspace'):\n"
                "    p = os.path.join('/workspace', entry)\n"
                "    try:\n"
                "        if os.path.isdir(p) and not os.path.islink(p):\n"
                "            for r, ds, fs in os.walk(p):\n"
                "                for f in fs:\n"
                "                    os.chmod(os.path.join(r, f), stat.S_IWRITE | stat.S_IREAD)\n"
                "            shutil.rmtree(p)\n"
                "        else:\n"
                "            os.chmod(p, stat.S_IWRITE | stat.S_IREAD)\n"
                "            os.unlink(p)\n"
                "    except Exception:\n"
                "        pass\n",
            ],
            timeout=15,
        )
        tar_bytes = baseline.build_tar_bytes()
        if not tar_bytes:
            return
        proc = subprocess.run(
            [self._docker_bin, "exec", "-i", "-w", "/workspace", self.container_id, "tar", "-xf", "-", "-C", "/workspace"],
            input=tar_bytes,
            capture_output=True,
            timeout=30,
        )
        if proc.returncode != 0:
            err = proc.stderr.decode("utf-8", errors="replace")
            raise RuntimeError(f"Failed to import workspace snapshot into container: {err}")

    def export_workspace(self) -> Dict[str, bytes]:
        if not self.container_id or self.retired:
            raise ExecutionBackendNotAvailableError(
                "Container is not running or was retired after timeout; export prohibited."
            )
        proc = subprocess.run(
            [self._docker_bin, "exec", "-w", "/workspace", self.container_id, "tar", "-cf", "-", "-C", "/workspace", "."],
            capture_output=True,
            timeout=30,
            stdin=subprocess.DEVNULL,
        )
        if proc.returncode != 0:
            err = proc.stderr.decode("utf-8", errors="replace")
            raise RuntimeError(f"Failed to export workspace from container: {err}")
        return extract_and_validate_container_tar(proc.stdout)

    def exec_argv(
        self,
        argv: List[str],
        timeout: int = 120,
        cwd: str = "/workspace",
        env: Optional[Dict[str, str]] = None,
        retire_on_timeout: bool = True,
    ) -> subprocess.CompletedProcess:
        if not self.container_id or self.retired:
            raise ExecutionBackendNotAvailableError(
                "Container is not running or was retired after timeout; further tool calls prohibited."
            )
        cmd = [self._docker_bin, "exec", "-w", cwd]
        if env:
            for k, v in sorted(env.items()):
                if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", k):
                    cmd.extend(["-e", f"{k}={v}"])
        cmd.append(self.container_id)
        cmd.extend(argv)

        try:
            return subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
                stdin=subprocess.DEVNULL,
            )
        except subprocess.TimeoutExpired:
            self.timed_out = True
            self.forced_retirement = True
            if retire_on_timeout:
                self.retired = True
                self.stop_and_remove()
            raise

    def exec_shell(
        self,
        command: str,
        timeout: int = 120,
        cwd: str = "/workspace",
        retire_on_timeout: bool = True,
    ) -> subprocess.CompletedProcess:
        return self.exec_argv(
            ["sh", "-c", command],
            timeout=timeout,
            cwd=cwd,
            retire_on_timeout=retire_on_timeout,
        )

    def stop_and_remove(self) -> None:
        target = self.container_id or self.container_name
        self.container_id = None
        self.retired = True
        if not target:
            return
        try:
            subprocess.run(
                [self._docker_bin, "rm", "-f", target],
                capture_output=True,
                text=True,
                timeout=20,
                stdin=subprocess.DEVNULL,
            )
        except Exception:
            pass


# OpenAI function-calling schema definitions for the Mediated Tool Broker
BROKER_TOOL_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List files in the isolated container workspace directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative directory path (default '.')"}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a text file from the isolated workspace with 1-indexed line numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative file path in workspace"},
                    "offset": {"type": "integer", "description": "1-indexed start line (default 1)"},
                    "limit": {"type": "integer", "description": "Max lines to read (default 200)"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "Search for a regex or substring pattern across files in the isolated workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Search pattern"},
                    "path": {"type": "string", "description": "Relative directory or file path (default '.')"},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Create or overwrite an authorized source file inside the isolated workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path of file to write"},
                    "content": {"type": "string", "description": "Complete file content"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "patch_file",
            "description": "Replace old_string with new_string in an authorized source file inside the isolated workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path of file to edit"},
                    "old_string": {"type": "string", "description": "Exact text to find"},
                    "new_string": {"type": "string", "description": "Replacement text"},
                },
                "required": ["path", "old_string", "new_string"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_file",
            "description": "Delete an authorized file inside the isolated workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative path of file to delete"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Run a build, lint, or test command strictly inside the isolated Docker container workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Shell command to execute inside container /workspace"},
                    "timeout": {"type": "integer", "description": "Timeout in seconds (default 60)"},
                },
                "required": ["command"],
            },
        },
    },
]


@dataclass
class ToolCallRecord:
    tool_name: str
    arguments: Dict[str, Any]
    allowed: bool
    result_summary: str
    executed_in_container: bool


class MediatedToolBroker:
    """
    Controller-owned tool broker that validates every model-proposed tool action
    against ObjectiveAuthorization and executes all allowed file and command operations
    exclusively inside the isolated DockerSandboxContainer.
    Never falls back to host shell execution.
    """

    def __init__(
        self,
        container: DockerSandboxContainer,
        authorization: ObjectiveAuthorization,
        retire_container_on_timeout: bool = True,
    ):
        self.container = container
        self.authorization = authorization
        self.retire_container_on_timeout = retire_container_on_timeout
        self.tool_history: List[ToolCallRecord] = []

    def _validate_read_path(self, raw_path: str) -> str:
        """
        Validate read path: rejects traversal and secret/orchestrator-internal files,
        but ALLOWS reading non-secret protected_resources (e.g. package.json, tsconfig.json)
        so the coding agent and build tools can inspect read-only project configurations.
        """
        if not raw_path or raw_path.strip() in (".", "./"):
            return "."
        rel_posix = validate_safe_relative_posix_path(raw_path)
        if is_secret_or_orchestrator_internal_path(rel_posix):
            raise UnauthorizedPathError(f"Access to secret or internal orchestrator path '{rel_posix}' is denied.")
        return rel_posix

    def _validate_write_path(self, raw_path: str) -> str:
        if self.authorization.mutation_permission == MutationExpectation.NOT_ALLOWED:
            raise AuthorizationEscalationError(
                f"Objective '{self.authorization.objective_id}' has mutation_permission=NOT_ALLOWED. "
                f"Write operation on '{raw_path}' is rejected."
            )
        rel_posix = validate_safe_relative_posix_path(raw_path)
        if is_protected_from_mutation(rel_posix, self.authorization):
            raise UnauthorizedPathError(f"Modification of protected or secret path '{rel_posix}' is denied.")
        if self.authorization.allowed_paths:
            if not is_path_authorized(rel_posix, self.authorization.allowed_paths):
                raise UnauthorizedPathError(
                    f"Path '{rel_posix}' is outside authorized path scope {self.authorization.allowed_paths}."
                )
        return rel_posix

    def _validate_command(self, command: str) -> None:
        if not command or not command.strip():
            raise ValueError("Empty command is not permitted.")
        if self.authorization.mutation_permission == MutationExpectation.NOT_ALLOWED:
            raise AuthorizationEscalationError(
                f"Objective '{self.authorization.objective_id}' is read-only (NOT_ALLOWED). "
                "Arbitrary run_command is prohibited to prevent shell redirection or sandbox mutation; "
                "use read_file, list_files, or search_files."
            )
        for pattern in FORBIDDEN_CONTAINER_COMMAND_PATTERNS:
            if pattern.search(command):
                raise AuthorizationEscalationError(
                    f"Command '{command}' violates sandbox security or Git history prohibitions."
                )
        for prohib in self.authorization.prohibitions:
            if prohib and prohib.lower() in command.lower():
                raise AuthorizationEscalationError(
                    f"Command '{command}' violates explicit objective prohibition '{prohib}'."
                )

    def dispatch_tool(self, tool_name: str, arguments: Any) -> str:
        """
        Validate and execute a single tool call inside the container.
        Returns a JSON-serialized tool result string for the model conversation.
        """
        if not isinstance(arguments, dict):
            err_msg = json.dumps({
                "error": f"MALFORMED_TOOL_ARGUMENTS: Expected JSON object for '{tool_name}', got {type(arguments).__name__}.",
                "allowed": False,
            })
            self.tool_history.append(ToolCallRecord(tool_name, {}, False, err_msg, False))
            return err_msg

        if tool_name not in REQUIRED_TOOL_PARAMS:
            err_msg = json.dumps({"error": f"UNKNOWN_TOOL: Unsupported tool '{tool_name}'.", "allowed": False})
            self.tool_history.append(ToolCallRecord(tool_name, arguments, False, err_msg, False))
            return err_msg

        for req_key in REQUIRED_TOOL_PARAMS[tool_name]:
            if req_key not in arguments or arguments[req_key] is None:
                err_msg = json.dumps({
                    "error": f"MISSING_REQUIRED_ARGUMENT: Tool '{tool_name}' requires parameter '{req_key}'.",
                    "allowed": False,
                })
                self.tool_history.append(ToolCallRecord(tool_name, arguments, False, err_msg, False))
                return err_msg
            if req_key in ("path", "pattern", "command", "content", "old_string", "new_string") and not isinstance(arguments[req_key], str):
                err_msg = json.dumps({
                    "error": f"INVALID_ARGUMENT_TYPE: Parameter '{req_key}' for '{tool_name}' must be a string.",
                    "allowed": False,
                })
                self.tool_history.append(ToolCallRecord(tool_name, arguments, False, err_msg, False))
                return err_msg

        try:
            if tool_name == "list_files":
                rel = self._validate_read_path(str(arguments.get("path", ".")))
                proc = self.container.exec_argv(
                    [
                        "python3", "-c",
                        "import os, sys, json\n"
                        "target = sys.argv[1]\n"
                        "if not os.path.exists(target):\n"
                        "    print(json.dumps({'error': f'Directory not found: {target}'}))\n"
                        "    sys.exit(0)\n"
                        "out = []\n"
                        "for r, dirs, files in os.walk(target):\n"
                        "    dirs[:] = [d for d in sorted(dirs) if d not in ('__pycache__', '.pytest_cache', '.git', 'node_modules')]\n"
                        "    for f in sorted(files):\n"
                        "        if not f.endswith('.pyc'):\n"
                        "            p = os.path.relpath(os.path.join(r, f), '/workspace').replace('\\\\', '/')\n"
                        "            out.append(p)\n"
                        "print(json.dumps({'files': out[:500]}))\n",
                        rel,
                    ],
                    timeout=15,
                    retire_on_timeout=self.retire_container_on_timeout,
                )
                output = proc.stdout.strip() or json.dumps({"error": proc.stderr.strip()})
                self.tool_history.append(ToolCallRecord(tool_name, arguments, True, output[:300], True))
                return output

            elif tool_name == "read_file":
                rel = self._validate_read_path(str(arguments["path"]))
                offset = max(1, int(arguments.get("offset", 1)))
                limit = max(1, min(1000, int(arguments.get("limit", 200))))
                proc = self.container.exec_argv(
                    [
                        "python3", "-c",
                        "import os, sys, json\n"
                        "p, off, lim = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])\n"
                        "if not os.path.exists(p):\n"
                        "    print(json.dumps({'error': f'File not found: {p}'}))\n"
                        "    sys.exit(0)\n"
                        "if os.path.isdir(p):\n"
                        "    print(json.dumps({'error': f'Path is a directory, not a file: {p}'}))\n"
                        "    sys.exit(0)\n"
                        "with open(p, 'r', encoding='utf-8', errors='replace') as f:\n"
                        "    text = f.read(100000)\n"
                        "lines = text.splitlines()\n"
                        "sliced = [f'{i}|{lines[i-1]}' for i in range(off, min(len(lines)+1, off+lim))]\n"
                        "print(json.dumps({'path': p, 'total_lines': len(lines), 'content': '\\n'.join(sliced)}))\n",
                        rel, str(offset), str(limit),
                    ],
                    timeout=15,
                    retire_on_timeout=self.retire_container_on_timeout,
                )
                output = proc.stdout.strip() if proc.returncode == 0 else json.dumps({"error": proc.stderr.strip()})
                self.tool_history.append(ToolCallRecord(tool_name, arguments, True, output[:300], True))
                return output

            elif tool_name == "search_files":
                pattern = str(arguments["pattern"])
                rel = self._validate_read_path(str(arguments.get("path", ".")))
                proc = self.container.exec_argv(
                    [
                        "python3", "-c",
                        "import os, re, sys, json\n"
                        "pat, target = re.compile(sys.argv[1]), sys.argv[2]\n"
                        "matches = []\n"
                        "paths = [target] if os.path.isfile(target) else [\n"
                        "    os.path.join(r, f) for r, d, fs in os.walk(target) for f in fs\n"
                        "    if '__pycache__' not in r and not f.endswith('.pyc')\n"
                        "]\n"
                        "for p in sorted(paths):\n"
                        "    try:\n"
                        "        with open(p, 'r', encoding='utf-8', errors='replace') as fh:\n"
                        "            for idx, ln in enumerate(fh, 1):\n"
                        "                if pat.search(ln):\n"
                        "                    rel_p = os.path.relpath(p, '/workspace').replace('\\\\', '/')\n"
                        "                    matches.append(f'{rel_p}:{idx}:{ln.strip()}')\n"
                        "    except Exception:\n"
                        "        pass\n"
                        "print(json.dumps({'matches': matches[:200]}))\n",
                        pattern, rel,
                    ],
                    timeout=15,
                    retire_on_timeout=self.retire_container_on_timeout,
                )
                output = proc.stdout.strip() if proc.returncode == 0 else json.dumps({"error": proc.stderr.strip()})
                self.tool_history.append(ToolCallRecord(tool_name, arguments, True, output[:300], True))
                return output

            elif tool_name == "write_file":
                rel = self._validate_write_path(str(arguments["path"]))
                content = str(arguments["content"])
                proc = self.container.exec_argv(
                    [
                        "python3", "-c",
                        "import os, sys, json\n"
                        "p, data = sys.argv[1], sys.argv[2]\n"
                        "os.makedirs(os.path.dirname(p) or '.', exist_ok=True)\n"
                        "with open(p, 'w', encoding='utf-8', newline='\\n') as f:\n"
                        "    f.write(data)\n"
                        "print(json.dumps({'status': 'ok', 'path': p, 'bytes_written': len(data.encode('utf-8'))}))\n",
                        rel, content,
                    ],
                    timeout=15,
                    retire_on_timeout=self.retire_container_on_timeout,
                )
                output = proc.stdout.strip() if proc.returncode == 0 else json.dumps({"error": proc.stderr.strip()})
                self.tool_history.append(ToolCallRecord(tool_name, arguments, True, output[:300], True))
                return output

            elif tool_name == "patch_file":
                rel = self._validate_write_path(str(arguments["path"]))
                old_s = str(arguments["old_string"])
                new_s = str(arguments["new_string"])
                proc = self.container.exec_argv(
                    [
                        "python3", "-c",
                        "import os, sys, json\n"
                        "p, old_s, new_s = sys.argv[1], sys.argv[2], sys.argv[3]\n"
                        "if not os.path.isfile(p):\n"
                        "    print(json.dumps({'error': f'File not found: {p}'}))\n"
                        "    sys.exit(0)\n"
                        "with open(p, 'r', encoding='utf-8') as f:\n"
                        "    text = f.read()\n"
                        "if old_s not in text:\n"
                        "    print(json.dumps({'error': 'old_string not found in file'}))\n"
                        "    sys.exit(0)\n"
                        "updated = text.replace(old_s, new_s, 1)\n"
                        "with open(p, 'w', encoding='utf-8', newline='\\n') as f:\n"
                        "    f.write(updated)\n"
                        "print(json.dumps({'status': 'ok', 'path': p}))\n",
                        rel, old_s, new_s,
                    ],
                    timeout=15,
                    retire_on_timeout=self.retire_container_on_timeout,
                )
                output = proc.stdout.strip() if proc.returncode == 0 else json.dumps({"error": proc.stderr.strip()})
                self.tool_history.append(ToolCallRecord(tool_name, arguments, True, output[:300], True))
                return output

            elif tool_name == "delete_file":
                rel = self._validate_write_path(str(arguments["path"]))
                proc = self.container.exec_argv(
                    [
                        "python3", "-c",
                        "import os, sys, json\n"
                        "p = sys.argv[1]\n"
                        "if os.path.exists(p):\n"
                        "    os.unlink(p)\n"
                        "    print(json.dumps({'status': 'deleted', 'path': p}))\n"
                        "else:\n"
                        "    print(json.dumps({'error': 'file not found'}))\n",
                        rel,
                    ],
                    timeout=15,
                    retire_on_timeout=self.retire_container_on_timeout,
                )
                output = proc.stdout.strip() if proc.returncode == 0 else json.dumps({"error": proc.stderr.strip()})
                self.tool_history.append(ToolCallRecord(tool_name, arguments, True, output[:300], True))
                return output

            elif tool_name == "run_command":
                command = str(arguments["command"])
                self._validate_command(command)
                cmd_timeout = max(1, min(300, int(arguments.get("timeout", 60))))
                proc = self.container.exec_shell(
                    command,
                    timeout=cmd_timeout,
                    retire_on_timeout=self.retire_container_on_timeout,
                )
                output = json.dumps({
                    "exit_code": proc.returncode,
                    "stdout": (proc.stdout or "")[-4000:],
                    "stderr": (proc.stderr or "")[-4000:],
                })
                self.tool_history.append(ToolCallRecord(tool_name, arguments, True, output[:300], True))
                return output

        except (AuthorizationEscalationError, UnauthorizedPathError, PathTraversalError, ValueError) as sec_err:
            err_payload = json.dumps({
                "error": f"SECURITY_POLICY_REJECTED: {type(sec_err).__name__}: {sec_err}",
                "allowed": False,
            })
            self.tool_history.append(ToolCallRecord(tool_name, arguments, False, err_payload, False))
            return err_payload
        except subprocess.TimeoutExpired:
            err_payload = json.dumps({
                "error": f"TIMEOUT_CONTAINER_RETIRED: Tool '{tool_name}' timed out inside container and container was terminated.",
                "timed_out": True,
            })
            self.tool_history.append(ToolCallRecord(tool_name, arguments, True, err_payload, True))
            return err_payload
        except Exception as exc:
            err_payload = json.dumps({"error": f"Tool execution error: {exc}"})
            self.tool_history.append(ToolCallRecord(tool_name, arguments, False, err_payload, False))
            return err_payload

        return json.dumps({"error": "Unhandled tool dispatch branch."})


class LocalModelAPIClient:
    """
    Host-side client for the existing configured localhost model proxy (http://127.0.0.1:8045/v1).
    Preserves existing model/provider configuration without copying any secrets into Docker.
    Supports both non-streaming and streaming chat completions with OpenAI tool-call parsing.
    """

    def __init__(
        self,
        endpoint: Optional[ResolvedModelEndpoint] = None,
        timeout: int = 120,
    ):
        self.endpoint = endpoint or resolve_hermes_model_endpoint()
        self.timeout = timeout

    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        model: Optional[str] = None,
        stream: bool = False,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        url = f"{self.endpoint.base_url.rstrip('/')}/chat/completions"
        payload: Dict[str, Any] = {
            "model": model or self.endpoint.model,
            "messages": messages,
            "temperature": 0.0,
            "stream": stream,
        }
        if tools:
            payload["tools"] = tools

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer local-proxy",
            },
            method="POST",
        )
        effective_timeout = timeout or self.timeout
        with urllib.request.urlopen(req, timeout=effective_timeout) as resp:
            raw_body = resp.read().decode("utf-8", errors="replace")
            if not stream:
                return json.loads(raw_body)
            return self._parse_sse_stream(raw_body)

    def _parse_sse_stream(self, raw_sse: str) -> Dict[str, Any]:
        content_parts: List[str] = []
        model_name = self.endpoint.model
        finish_reason = "stop"
        tool_calls_acc: Dict[int, Dict[str, Any]] = {}
        saw_done = False
        saw_chunk = False

        for line in raw_sse.splitlines():
            line_s = line.strip()
            if not line_s.startswith("data:"):
                continue
            data_str = line_s[5:].strip()
            if data_str == "[DONE]":
                saw_done = True
                continue
            if not data_str:
                continue
            try:
                chunk = json.loads(data_str)
                saw_chunk = True
            except Exception:
                return {
                    "model": model_name,
                    "incomplete_stream": True,
                    "choices": [{"index": 0, "message": {"role": "assistant", "content": ""}, "finish_reason": "length"}],
                }
            if chunk.get("model"):
                model_name = chunk["model"]
            choices = chunk.get("choices") or []
            if not choices:
                continue
            choice = choices[0]
            if choice.get("finish_reason"):
                finish_reason = choice["finish_reason"]
            delta = choice.get("delta") or {}
            if delta.get("content"):
                content_parts.append(delta["content"])
            for tc in delta.get("tool_calls") or []:
                idx = tc.get("index", 0)
                entry = tool_calls_acc.setdefault(
                    idx,
                    {"id": tc.get("id", f"call_{idx}"), "type": "function", "function": {"name": "", "arguments": ""}},
                )
                if tc.get("id"):
                    entry["id"] = tc["id"]
                fn = tc.get("function") or {}
                if fn.get("name"):
                    entry["function"]["name"] += fn["name"]
                if fn.get("arguments"):
                    entry["function"]["arguments"] += fn["arguments"]

        incomplete = (not saw_chunk) or (not saw_done)
        if incomplete:
            finish_reason = "length"

        msg: Dict[str, Any] = {
            "role": "assistant",
            "content": "".join(content_parts),
        }
        if tool_calls_acc:
            msg["tool_calls"] = [tool_calls_acc[k] for k in sorted(tool_calls_acc.keys())]
        return {
            "model": model_name,
            "incomplete_stream": incomplete,
            "choices": [{"index": 0, "message": msg, "finish_reason": finish_reason}],
        }


CODING_QUALITY_SYSTEM_PROMPT = """You are the Hermes Architecture B Coding Agent executing inside an isolated Docker workspace.
Follow this strict 7-stage engineering sequence:
1. DISCOVER: Inspect repository files and existing tests using list_files, read_file, search_files.
2. PLAN: Formulate a minimal, coherent change within authorized paths.
3. IMPLEMENT: Apply edits using write_file or patch_file.
4. VERIFY: Run relevant tests/checks inside the container using run_command.
5. REPAIR: If any check fails, diagnose and repair the code, then re-run verification.
6. AUDIT: Verify only authorized files were changed and no regressions remain.
7. REPORT: Summarize exact changed files, executed verification commands/exit codes, and conclude with the required END OF RESULT — PROMPT #NNN line.
"""


class DockerExecutionBackend(ExecutionBackend):
    """
    Operational Architecture B ExecutionBackend with a strict Two-Phase Execution
    and Source-Promotion Boundary:
    - PHASE 1 (PREPARE): Runs inside `execute()`. Captures baseline, runs model/tool loop
      in a disposable Docker container, executes the canonical TrustedVerificationPlan,
      and records `last_prepared_execution` (`PreparedExecution`) WITHOUT touching the
      real working tree.
    - PHASE 2 (ACCEPT AND APPLY): Runs via `commit_prepared_execution()` ONLY after
      `OrchestratorEngine` verifies completion, correlation, trusted verification, and
      `ControllerDisposition.PASS`.
    """

    def __init__(
        self,
        workspace_root: Path,
        image: str = DEFAULT_SANDBOX_IMAGE,
        model_client: Optional[Any] = None,
        max_tool_iterations: int = 15,
        auto_sync_to_working_tree: bool = False,
        cpus: str = "1",
        memory: str = "512m",
        pids_limit: str = "64",
    ):
        if auto_sync_to_working_tree:
            raise ValueError(
                "auto_sync_to_working_tree is permanently prohibited and removed in Architecture B (ARCHB-PROMO-001). "
                "Phase 1 execute() is strictly preparation-only; working-tree promotion requires explicit "
                "commit_prepared_execution() following controller reconciliation."
            )
        self.workspace_root = workspace_root.resolve()
        self.image = image
        self.model_client = model_client or LocalModelAPIClient()
        self.max_tool_iterations = max_tool_iterations
        self.cpus = cpus
        self.memory = memory
        self.pids_limit = pids_limit

        self.last_attestation: Optional[ContainerAttestation] = None
        self.last_delta: Optional[WorkspaceDelta] = None
        self.last_sync_result: Optional[SyncResult] = None
        self.last_verification_result: Optional[VerificationResult] = None
        self.last_prepared_execution: Optional[PreparedExecution] = None
        self.last_tool_history: List[ToolCallRecord] = []

    @property
    def runtime_type(self) -> BackendRuntimeType:
        return BackendRuntimeType.CERTIFIED_CONTAINER

    @property
    def is_certified_isolated(self) -> bool:
        ok, _ = DockerSandboxContainer.check_runtime_prerequisites(self.image)
        return ok

    def execute_in_new_sandbox(
        self,
        callback: Callable[[DockerSandboxContainer], Any],
        authorization: Optional[ObjectiveAuthorization] = None,
        dispatch_id: str = "manual",
    ) -> Any:
        builder = SnapshotBuilder(self.workspace_root)
        baseline = builder.capture_snapshot(authorization=authorization)
        container = DockerSandboxContainer(
            image=self.image,
            cpus=self.cpus,
            memory=self.memory,
            pids_limit=self.pids_limit,
            dispatch_id=dispatch_id,
        )
        try:
            self.last_attestation = container.start()
            container.import_snapshot(baseline)
            return callback(container)
        finally:
            container.stop_and_remove()

    def execute(
        self,
        prompt: str,
        toolsets: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 600,
        authorization: Optional[ObjectiveAuthorization] = None,
        verification_plan: Optional[TrustedVerificationPlan] = None,
    ) -> HermesResponse:
        if not self.is_certified_isolated:
            _, reason = DockerSandboxContainer.check_runtime_prerequisites(self.image)
            raise ExecutionBackendNotAvailableError(
                f"DockerExecutionBackend is not operational: {reason}"
            )

        effective_auth = authorization or ObjectiveAuthorization(
            objective_id="PROMPT #001",
            mutation_permission=MutationExpectation.NOT_ALLOWED,
            requires_verification=False,
        )

        # Resolve canonical verification plan BEFORE opening the container execution phase
        try:
            canonical_plan = resolve_canonical_verification_plan(
                authorization=effective_auth,
                explicit_plan=verification_plan,
            )
            plan_parse_error = None
        except ValueError as plan_err:
            canonical_plan = TrustedVerificationPlan(command="", steps=[])
            plan_parse_error = str(plan_err)

        plan_digest = compute_verification_plan_digest(canonical_plan)
        auth_digest = compute_authorization_digest(effective_auth)

        # 1. Capture disposable source snapshot & baseline hashes from host repository
        builder = SnapshotBuilder(self.workspace_root)
        baseline = builder.capture_snapshot(authorization=effective_auth)

        # 2. Launch disposable container & verify physical isolation attestation
        container = DockerSandboxContainer(
            image=self.image,
            cpus=self.cpus,
            memory=self.memory,
            pids_limit=self.pids_limit,
            dispatch_id=effective_auth.objective_id,
        )

        self.last_prepared_execution = None
        self.last_sync_result = None
        self.last_delta = None
        self.last_verification_result = None

        loop_completed = False
        is_truncated = False
        exit_code = 1
        failure_reason: Optional[str] = None
        final_text = ""
        seen_tool_call_ids: Set[str] = set()

        try:
            self.last_attestation = container.start()
            container.import_snapshot(baseline)

            broker = MediatedToolBroker(
                container=container,
                authorization=effective_auth,
                retire_container_on_timeout=True,
            )
            messages: List[Dict[str, Any]] = [
                {"role": "system", "content": CODING_QUALITY_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ]

            for _ in range(self.max_tool_iterations):
                resp_data = self.model_client.chat_completion(
                    messages=messages,
                    tools=BROKER_TOOL_DEFINITIONS,
                    model=model,
                    timeout=min(timeout, 120),
                )
                choices = resp_data.get("choices") or []
                if not choices:
                    failure_reason = "Model API returned empty choices list."
                    exit_code = 1
                    break

                choice = choices[0]
                finish_reason = choice.get("finish_reason") or "stop"
                msg = choice.get("message") or {}
                assistant_content = msg.get("content") or ""
                tool_calls = msg.get("tool_calls") or []

                if finish_reason == "length" or resp_data.get("incomplete_stream"):
                    final_text = assistant_content
                    is_truncated = True
                    loop_completed = False
                    exit_code = 1
                    failure_reason = "Model output truncated (finish_reason='length' or incomplete stream)."
                    break

                messages.append(msg)
                if not tool_calls:
                    if not assistant_content or not assistant_content.strip():
                        loop_completed = False
                        exit_code = 1
                        failure_reason = "Model returned empty final response without tool calls."
                    else:
                        final_text = assistant_content
                        loop_completed = True
                        exit_code = 0
                    break

                container_timed_out = False
                for idx, tc in enumerate(tool_calls):
                    raw_id = tc.get("id") if isinstance(tc, dict) else None
                    fn = (tc.get("function") if isinstance(tc, dict) else None) or {}
                    fn_name = str(fn.get("name") or "")
                    raw_args = fn.get("arguments")

                    # Validate tool_call_id uniqueness and validity
                    if not raw_id or not isinstance(raw_id, str) or not raw_id.strip() or raw_id in seen_tool_call_ids:
                        safe_id = f"invalid_id_{idx}" if not raw_id else f"{raw_id}_dup_{idx}"
                        err_out = json.dumps({
                            "error": f"INVALID_OR_DUPLICATE_TOOL_CALL_ID: Tool call ID {raw_id!r} is missing or duplicated.",
                            "allowed": False,
                        })
                        broker.tool_history.append(ToolCallRecord(fn_name, {}, False, err_out, False))
                        messages.append({
                            "role": "tool",
                            "tool_call_id": safe_id,
                            "name": fn_name or "unknown",
                            "content": err_out,
                        })
                        continue

                    seen_tool_call_ids.add(raw_id)

                    # Strict JSON argument parsing: NEVER silently substitute {} on malformed JSON!
                    parsed_args: Any = None
                    if raw_args is None or (isinstance(raw_args, str) and not raw_args.strip()):
                        parsed_args = {}
                    elif isinstance(raw_args, dict):
                        parsed_args = dict(raw_args)
                    elif isinstance(raw_args, str):
                        try:
                            parsed_args = json.loads(raw_args)
                        except Exception as json_exc:
                            err_out = json.dumps({
                                "error": f"MALFORMED_TOOL_ARGUMENTS: Invalid JSON arguments for '{fn_name}': {json_exc}",
                                "allowed": False,
                            })
                            broker.tool_history.append(
                                ToolCallRecord(fn_name, {"_raw": raw_args[:200]}, False, err_out, False)
                            )
                            messages.append({
                                "role": "tool",
                                "tool_call_id": raw_id,
                                "name": fn_name,
                                "content": err_out,
                            })
                            continue
                    else:
                        err_out = json.dumps({
                            "error": f"MALFORMED_TOOL_ARGUMENTS: Unsupported arguments type {type(raw_args).__name__}.",
                            "allowed": False,
                        })
                        broker.tool_history.append(ToolCallRecord(fn_name, {}, False, err_out, False))
                        messages.append({
                            "role": "tool",
                            "tool_call_id": raw_id,
                            "name": fn_name,
                            "content": err_out,
                        })
                        continue

                    if not isinstance(parsed_args, dict):
                        err_out = json.dumps({
                            "error": f"MALFORMED_TOOL_ARGUMENTS: Tool arguments must decode to a JSON object, got {type(parsed_args).__name__}.",
                            "allowed": False,
                        })
                        broker.tool_history.append(ToolCallRecord(fn_name, {}, False, err_out, False))
                        messages.append({
                            "role": "tool",
                            "tool_call_id": raw_id,
                            "name": fn_name,
                            "content": err_out,
                        })
                        continue

                    tool_output = broker.dispatch_tool(fn_name, parsed_args)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": raw_id,
                        "name": fn_name,
                        "content": tool_output,
                    })

                    if container.timed_out or container.forced_retirement:
                        container_timed_out = True
                        break

                if container_timed_out:
                    loop_completed = False
                    exit_code = 124
                    failure_reason = "Container command timed out and container was retired immediately."
                    final_text = "Container command timed out."
                    break
            else:
                # Iteration budget exhausted without a final non-tool assistant completion
                final_text = "Reached maximum tool iterations."
                loop_completed = False
                is_truncated = True
                exit_code = 1
                failure_reason = f"Iteration budget exhausted ({self.max_tool_iterations} turns)."

            self.last_tool_history = list(broker.tool_history)

            # If container was retired due to timeout, skip export and verification
            if container.timed_out or container.forced_retirement:
                self.last_delta = WorkspaceDelta()
                self.last_verification_result = VerificationResult(
                    executed=True,
                    passed=False,
                    exit_status=124,
                    provenance=VerificationProvenance.FAILED,
                    limitations=["Container command timed out; container retired without workspace export."],
                )
            else:
                # 3. Export container workspace & compute exact file deltas against baseline
                pre_verif_files = container.export_workspace()
                pre_verif_digest = compute_files_manifest_digest(pre_verif_files)
                delta = compute_workspace_delta(baseline, pre_verif_files)
                self.last_delta = delta

                # 4. Validate delta against authorization before running verification
                auth_error = None
                unauth_paths: List[str] = []
                try:
                    validate_delta_authorization(delta, effective_auth)
                except (UnauthorizedPathError, AuthorizationEscalationError, PathTraversalError) as sec_err:
                    auth_error = sec_err
                    for p_path in delta.all_affected_paths:
                        if is_protected_from_mutation(p_path, effective_auth):
                            unauth_paths.append(p_path)
                        elif effective_auth.allowed_paths and not is_path_authorized(p_path, effective_auth.allowed_paths):
                            unauth_paths.append(p_path)
                    if effective_auth.mutation_permission == MutationExpectation.NOT_ALLOWED and delta.has_changes:
                        unauth_paths = list(delta.all_affected_paths)
                    if not unauth_paths and delta.all_affected_paths:
                        unauth_paths = list(delta.all_affected_paths)

                if auth_error:
                    failure_reason = f"UNAUTHORIZED_DELTA_REJECTED: {type(auth_error).__name__}: {auth_error}"
                    loop_completed = False
                    exit_code = 1
                    verif_res = VerificationResult(
                        executed=False,
                        passed=False,
                        exit_status=126,
                        provenance=VerificationProvenance.FAILED,
                        command=canonical_plan.command,
                        objective_id=effective_auth.objective_id,
                        plan_digest=plan_digest,
                        verified_delta_digest=delta.compute_manifest_digest(),
                        limitations=[failure_reason],
                    )
                elif plan_parse_error:
                    verif_res = VerificationResult(
                        executed=False,
                        passed=False,
                        exit_status=126,
                        provenance=VerificationProvenance.FAILED,
                        objective_id=effective_auth.objective_id,
                        plan_digest=plan_digest,
                        verified_delta_digest=delta.compute_manifest_digest(),
                        limitations=[plan_parse_error],
                    )
                else:
                    # 5. Execute canonical verification inside the container BEFORE teardown
                    verif_res = self._run_in_container_verification(
                        container=container,
                        authorization=effective_auth,
                        verification_plan=canonical_plan,
                        delta_digest=delta.compute_manifest_digest(),
                    )

                # 6. Verify that running verification did not mutate workspace source files
                if not container.retired and verif_res.executed and not auth_error:
                    post_verif_files = container.export_workspace()
                    post_verif_digest = compute_files_manifest_digest(post_verif_files)
                    if post_verif_digest != pre_verif_digest:
                        verif_res = VerificationResult(
                            executed=True,
                            passed=False,
                            exit_status=1,
                            provenance=VerificationProvenance.FAILED,
                            command=verif_res.command,
                            argv=verif_res.argv,
                            observable_output=verif_res.observable_output,
                            objective_id=effective_auth.objective_id,
                            plan_digest=plan_digest,
                            verified_delta_digest=delta.compute_manifest_digest(),
                            limitations=[
                                "Workspace source files were mutated during verification; verification evidence invalidated."
                            ],
                            environment=verif_res.environment,
                        )

                self.last_verification_result = verif_res

        finally:
            container.stop_and_remove()

        response = HermesResponse(
            stdout=final_text,
            stderr=failure_reason or "",
            exit_code=exit_code,
            session_id=self.last_attestation.container_id[:12] if self.last_attestation else "docker_archb",
            clean_text=final_text.strip(),
            is_truncated=is_truncated,
        )

        # Record Phase 1 PreparedExecution artifact (working tree is STILL untouched!)
        delta_obj = self.last_delta or WorkspaceDelta()
        verif_obj = self.last_verification_result or VerificationResult(
            executed=False,
            passed=False,
            exit_status=-1,
            provenance=VerificationProvenance.UNVERIFIED,
            objective_id=effective_auth.objective_id,
            plan_digest=plan_digest,
            verified_delta_digest=delta_obj.compute_manifest_digest(),
        )
        verif_ok = (verif_obj.passed if effective_auth.requires_verification else True)
        execution_healthy = bool(
            loop_completed
            and exit_code == 0
            and not is_truncated
            and not container.timed_out
            and not container.forced_retirement
            and not auth_error
            and verif_ok
        )
        is_expired = not execution_healthy
        self.last_prepared_execution = PreparedExecution(
            objective_id=effective_auth.objective_id,
            authorization=effective_auth,
            baseline=baseline,
            delta=delta_obj,
            verified_delta_digest=delta_obj.compute_manifest_digest(),
            verification_result=verif_obj,
            attestation=self.last_attestation,
            response=response,
            loop_completed=loop_completed,
            failure_reason=failure_reason,
            expired=is_expired,
            authorization_digest=auth_digest,
            plan_digest=plan_digest,
            unauthorized_deltas=sorted(set(unauth_paths)),
        )

        return response

    def commit_prepared_execution(
        self,
        expected_objective_id: str,
        correlation_valid: bool,
        controller_disposition: ControllerDisposition,
        verification_result: Optional[VerificationResult] = None,
        authorization: Optional[ObjectiveAuthorization] = None,
    ) -> SyncResult:
        """
        PHASE 2: ACCEPT AND APPLY.
        Applies the prepared source changes from Phase 1 to the real working tree
        ONLY when all invariants hold:
        1. The model/tool loop completed successfully (exit_code == 0, not is_truncated, loop_completed).
        2. The expected result correlation is valid (correlation_valid == True).
        3. Genuine trusted verification succeeded (EXECUTED_TRUSTED and passed == True).
        4. The controller accepted the objective (controller_disposition == ControllerDisposition.PASS).
        5. Controller-owned authorization strictly matches the prepared authorization policy (ARCHB-PROMO-001).
        6. Prepared delta and verified delta digests are identical and unchanged.
        7. Real target files on the real working tree still match their original baseline.
        8. A recoverable synchronization transaction applies changes safely.
        """
        prepared = self.last_prepared_execution
        if prepared is None:
            raise UnverifiedSyncError("No PreparedExecution is available to commit.")
        if prepared.expired or prepared.applied:
            raise UnverifiedSyncError("PreparedExecution has already been consumed or expired.")

        if prepared.objective_id.strip().upper() != expected_objective_id.strip().upper():
            prepared.expired = True
            raise UnverifiedSyncError(
                f"PreparedExecution correlation mismatch: prepared for '{prepared.objective_id}', "
                f"requested '{expected_objective_id}'."
            )

        if not prepared.loop_completed or prepared.response.exit_code != 0 or prepared.response.is_truncated:
            prepared.expired = True
            raise UnverifiedSyncError(
                f"Phase 2 promotion refused: coding loop did not complete cleanly "
                f"(loop_completed={prepared.loop_completed}, exit_code={prepared.response.exit_code}, "
                f"is_truncated={prepared.response.is_truncated}, reason={prepared.failure_reason})."
            )

        if not correlation_valid:
            prepared.expired = True
            raise UnverifiedSyncError("Phase 2 promotion refused: result correlation marker is invalid.")

        if controller_disposition != ControllerDisposition.PASS:
            prepared.expired = True
            raise UnverifiedSyncError(
                f"Phase 2 promotion refused: controller disposition is '{controller_disposition.value}', not PASS."
            )

        # Revalidate authorization at Phase 2 (ARCHB-PROMO-001)
        active_auth = authorization or prepared.authorization
        active_auth_digest = compute_authorization_digest(active_auth)
        if active_auth_digest != prepared.authorization_digest:
            prepared.expired = True
            raise UnverifiedSyncError(
                "Phase 2 promotion refused: active authorization does not match prepared authorization policy."
            )

        # Detect in-place mutation of prepared.authorization
        if compute_authorization_digest(prepared.authorization) != prepared.authorization_digest:
            prepared.expired = True
            raise UnverifiedSyncError(
                "Phase 2 promotion refused: prepared authorization was mutated after Phase 1."
            )

        # Revalidate verification evidence (ARCHB-VERIF-002 / ARCHB-VERIF-003)
        prep_verif = prepared.verification_result
        if active_auth.requires_verification:
            if (
                prep_verif is None
                or not prep_verif.executed
                or not prep_verif.passed
                or prep_verif.provenance != VerificationProvenance.EXECUTED_TRUSTED
            ):
                prepared.expired = True
                raise UnverifiedSyncError(
                    f"Phase 2 promotion refused: prepared verification did not pass with EXECUTED_TRUSTED provenance "
                    f"(executed={getattr(prep_verif, 'executed', False)}, passed={getattr(prep_verif, 'passed', False)}, "
                    f"provenance={getattr(prep_verif, 'provenance', None)})."
                )

            if (
                not prep_verif.objective_id
                or not str(prep_verif.objective_id).strip()
                or prep_verif.objective_id.strip().upper() != expected_objective_id.strip().upper()
            ):
                prepared.expired = True
                raise UnverifiedSyncError(
                    f"Phase 2 promotion refused: prepared verification objective missing or mismatched "
                    f"('{getattr(prep_verif, 'objective_id', None)}' vs '{expected_objective_id}')."
                )

            if (
                not prepared.plan_digest
                or not str(prepared.plan_digest).strip()
                or not prep_verif.plan_digest
                or not str(prep_verif.plan_digest).strip()
                or prep_verif.plan_digest != prepared.plan_digest
            ):
                prepared.expired = True
                raise UnverifiedSyncError(
                    "Phase 2 promotion refused: prepared verification plan_digest is missing or does not match canonical plan."
                )

            if (
                not prepared.verified_delta_digest
                or not str(prepared.verified_delta_digest).strip()
                or not prep_verif.verified_delta_digest
                or not str(prep_verif.verified_delta_digest).strip()
                or prep_verif.verified_delta_digest != prepared.verified_delta_digest
            ):
                prepared.expired = True
                raise UnverifiedSyncError(
                    "Phase 2 promotion refused: prepared verification verified_delta_digest is missing or does not match prepared delta."
                )

            # If caller also passed verification_result, require full non-empty agreement and refuse external overrides
            if verification_result is not None:
                if (
                    not verification_result.executed
                    or not verification_result.passed
                    or verification_result.provenance != VerificationProvenance.EXECUTED_TRUSTED
                ):
                    prepared.expired = True
                    raise UnverifiedSyncError(
                        "Phase 2 promotion refused: supplied external verification result did not pass with EXECUTED_TRUSTED provenance."
                    )
                if (
                    not verification_result.objective_id
                    or not str(verification_result.objective_id).strip()
                    or verification_result.objective_id.strip().upper() != expected_objective_id.strip().upper()
                ):
                    prepared.expired = True
                    raise UnverifiedSyncError(
                        f"Phase 2 promotion refused: supplied verification objective missing or mismatched "
                        f"('{verification_result.objective_id}' vs '{expected_objective_id}')."
                    )
                if (
                    not verification_result.plan_digest
                    or not str(verification_result.plan_digest).strip()
                    or verification_result.plan_digest != prepared.plan_digest
                ):
                    prepared.expired = True
                    raise UnverifiedSyncError(
                        "Phase 2 promotion refused: supplied verification plan_digest is missing or does not match canonical plan."
                    )
                if (
                    not verification_result.verified_delta_digest
                    or not str(verification_result.verified_delta_digest).strip()
                    or verification_result.verified_delta_digest != prepared.verified_delta_digest
                ):
                    prepared.expired = True
                    raise UnverifiedSyncError(
                        "Phase 2 promotion refused: supplied verification verified_delta_digest is missing or does not match prepared delta."
                    )

        # Verify delta has not been mutated after verification
        current_digest = prepared.delta.compute_manifest_digest()
        if current_digest != prepared.verified_delta_digest:
            prepared.expired = True
            raise UnverifiedSyncError(
                "Phase 2 promotion refused: proposed delta digest changed after verification."
            )

        synchronizer = DirectSourceSynchronizer(self.workspace_root)
        try:
            sync_res = synchronizer.synchronize(
                delta=prepared.delta,
                baseline=prepared.baseline,
                authorization=active_auth,
                verification_result=prep_verif,
                require_trusted_verification=active_auth.requires_verification,
            )
            prepared.applied = True
            self.last_sync_result = sync_res
            return sync_res
        except Exception:
            prepared.expired = True
            raise

    def discard_prepared_execution(self, reason: str = "Discarded by controller") -> None:
        if self.last_prepared_execution is not None:
            self.last_prepared_execution.expired = True
            self.last_prepared_execution.failure_reason = reason

    def _run_in_container_verification(
        self,
        container: DockerSandboxContainer,
        authorization: ObjectiveAuthorization,
        verification_plan: Optional[TrustedVerificationPlan],
        delta_digest: Optional[str] = None,
    ) -> VerificationResult:
        try:
            plan = resolve_canonical_verification_plan(
                authorization=authorization,
                explicit_plan=verification_plan,
            )
        except ValueError as exc:
            return VerificationResult(
                executed=False,
                passed=False,
                exit_status=126,
                provenance=VerificationProvenance.FAILED,
                command=verification_plan.command if verification_plan else "",
                objective_id=authorization.objective_id,
                plan_digest=compute_verification_plan_digest(verification_plan) if verification_plan else "",
                verified_delta_digest=delta_digest,
                limitations=[str(exc)],
            )

        plan_digest = compute_verification_plan_digest(plan)

        if not plan.steps:
            return VerificationResult(
                executed=False,
                passed=False,
                exit_status=-1,
                provenance=VerificationProvenance.UNVERIFIED,
                objective_id=authorization.objective_id,
                plan_digest=plan_digest,
                verified_delta_digest=delta_digest,
                limitations=[
                    "Missing trusted verification plan: requires_verification is enabled, "
                    "but no verification_requirements or steps were defined."
                ],
            )

        combined_outputs: List[str] = []
        last_exit = 0
        all_argv: List[str] = []
        all_passed = True

        for idx, step in enumerate(plan.steps, 1):
            cmd_label = step.raw_command or " ".join(step.argv)
            for pattern in FORBIDDEN_CONTAINER_COMMAND_PATTERNS:
                if pattern.search(cmd_label):
                    return VerificationResult(
                        executed=False,
                        passed=False,
                        exit_status=126,
                        provenance=VerificationProvenance.FAILED,
                        command=cmd_label,
                        objective_id=authorization.objective_id,
                        plan_digest=plan_digest,
                        verified_delta_digest=delta_digest,
                        limitations=[f"Verification step #{idx} ('{cmd_label}') rejected by security policy."],
                    )
            all_argv.extend(step.argv)
            try:
                proc = container.exec_argv(
                    step.argv,
                    timeout=step.timeout,
                    cwd=step.working_directory or "/workspace",
                    env=step.environment,
                    retire_on_timeout=True,
                )
                step_ok = proc.returncode in (step.expected_exit_codes or [0])
                out_block = (
                    f"[Step {idx}/{len(plan.steps)}] $ {cmd_label} (exit {proc.returncode})\n"
                    f"{(proc.stdout or '')}\n{(proc.stderr or '')}"
                ).strip()
                combined_outputs.append(out_block)
                last_exit = proc.returncode
                if not step_ok:
                    all_passed = False
                    break
            except subprocess.TimeoutExpired:
                return VerificationResult(
                    executed=True,
                    passed=False,
                    exit_status=124,
                    provenance=VerificationProvenance.FAILED,
                    command=cmd_label,
                    argv=step.argv,
                    observable_output="\n\n".join(combined_outputs)[:4000],
                    objective_id=authorization.objective_id,
                    plan_digest=plan_digest,
                    verified_delta_digest=delta_digest,
                    limitations=[f"Verification step #{idx} ('{cmd_label}') timed out after {step.timeout}s inside container."],
                    environment=f"container:{container.container_name} ({container.image})",
                )

        att = container.attestation
        env_desc = (
            f"container:{container.container_name} image={container.image} "
            f"py={att.python_version if att else ''} node={att.node_version if att else ''}"
        ).strip()
        return VerificationResult(
            executed=True,
            passed=all_passed,
            exit_status=0 if all_passed else (last_exit if last_exit != 0 else 1),
            provenance=VerificationProvenance.EXECUTED_TRUSTED if all_passed else VerificationProvenance.FAILED,
            command=plan.command or " ; ".join(s.raw_command or " ".join(s.argv) for s in plan.steps),
            argv=all_argv,
            observable_output="\n\n".join(combined_outputs)[:4000],
            environment=env_desc,
            objective_id=authorization.objective_id,
            plan_digest=plan_digest,
            verified_delta_digest=delta_digest,
        )
