import os
import re
import shutil
import signal
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

@dataclass
class HermesResponse:
    stdout: str
    stderr: str
    exit_code: int
    session_id: Optional[str]
    clean_text: str
    raw_stdout: str = ""
    raw_stderr: str = ""
    is_truncated: bool = False

def terminate_process_tree(pid: int) -> None:
    """
    Safely terminate a specific process and all of its direct descendants.
    Strictly scoped to the given PID; never targets processes by name or port.
    """
    if pid <= 0:
        return

    if sys.platform == "win32":
        try:
            # On Windows, taskkill /F /T /PID <pid> terminates the process tree rooted at pid
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                capture_output=True,
                timeout=10,
            )
        except Exception:
            pass
    else:
        # On POSIX systems, attempt process group kill first, then fallback to single pid
        try:
            pgid = os.getpgid(pid)
            os.killpg(pgid, signal.SIGKILL)
        except Exception:
            try:
                os.kill(pid, signal.SIGKILL)
            except Exception:
                pass

SAFE_CLI_EXTRA_ARGS_ALLOWLIST = frozenset({
    "-v", "--verbose",
    "-Q", "--quiet",
    "--pass-session-id",
    "--checkpoints",
})

SAFE_PARAMETRIC_FLAGS = frozenset({
    "--max-turns",
    "--source",
})

def validate_extra_args(extra_args: Optional[List[str]]) -> List[str]:
    """
    Validate extra CLI arguments against a strict security allowlist.
    Permanently rejects:
    - Toolset overrides: -t, --toolsets, -t*, --toolsets=*
    - Approval bypass: --yolo
    - Skills/bundle injection: -s, --skills, -s*, --skills=*
    - Profile switching: -p, --profile, -p*, --profile=*
    - Model/provider flags: -m, --model, --provider
    - Hooks/plugins/rules: --accept-hooks, --ignore-rules, --ignore-user-config, --safe-mode
    - Query overrides: -q, --query, -z, --oneshot
    - Argument terminators: --
    """
    if not extra_args:
        return []

    validated: List[str] = []
    i = 0
    while i < len(extra_args):
        arg = extra_args[i]
        if not isinstance(arg, str):
            raise ValueError(f"extra_args entries must be strings, got {type(arg).__name__}: {arg!r}")

        clean = arg.strip()
        if not clean:
            i += 1
            continue

        clean_lower = clean.lower()
        # Explicit rejection of security-sensitive overrides in any syntax
        if (
            clean_lower == "-t"
            or clean_lower.startswith("-t")
            or clean_lower == "--toolsets"
            or clean_lower.startswith("--toolsets=")
            or clean_lower.startswith("--toolsets")
            or clean_lower == "--yolo"
            or clean_lower.startswith("--yolo")
            or clean_lower == "-p"
            or clean_lower.startswith("-p")
            or clean_lower == "--profile"
            or clean_lower.startswith("--profile=")
            or clean_lower == "-s"
            or clean_lower.startswith("-s")
            or clean_lower == "--skills"
            or clean_lower.startswith("--skills=")
            or clean_lower == "-m"
            or clean_lower.startswith("-m")
            or clean_lower == "--model"
            or clean_lower.startswith("--model=")
            or clean_lower == "--provider"
            or clean_lower.startswith("--provider=")
            or clean_lower == "-q"
            or clean_lower.startswith("-q")
            or clean_lower == "--query"
            or clean_lower.startswith("--query=")
            or clean_lower == "-z"
            or clean_lower.startswith("-z")
            or clean_lower == "--oneshot"
            or clean_lower.startswith("--oneshot=")
            or clean_lower in {"--accept-hooks", "--ignore-rules", "--ignore-user-config", "--safe-mode", "--"}
        ):
            raise ValueError(
                f"Disallowed CLI security override in extra_args: '{arg}'. "
                "Overriding toolsets, approvals (--yolo), profiles, skills, hooks, queries, or model parameters via extra_args is strictly prohibited."
            )

        if clean in SAFE_CLI_EXTRA_ARGS_ALLOWLIST:
            validated.append(clean)
            i += 1
        elif clean in SAFE_PARAMETRIC_FLAGS:
            if i + 1 >= len(extra_args):
                raise ValueError(f"Flag '{clean}' requires a value parameter.")
            val = extra_args[i + 1].strip()
            if val.startswith("-"):
                raise ValueError(f"Flag '{clean}' value cannot start with '-': {val!r}")
            if clean == "--max-turns" and (not val.isdigit() or int(val) <= 0):
                raise ValueError(f"--max-turns value must be a positive integer, got {val!r}")
            validated.extend([clean, val])
            i += 2
        elif any(clean.startswith(f"{f}=") for f in SAFE_PARAMETRIC_FLAGS):
            flag, val = clean.split("=", 1)
            val = val.strip()
            if not val or val.startswith("-"):
                raise ValueError(f"Flag '{flag}' value cannot be empty or start with '-': {val!r}")
            if flag == "--max-turns" and (not val.isdigit() or int(val) <= 0):
                raise ValueError(f"--max-turns value must be a positive integer, got {val!r}")
            validated.append(f"{flag}={val}")
            i += 1
        else:
            raise ValueError(
                f"Unrecognized or unapproved CLI argument in extra_args: '{arg}'. "
                "Only safe diagnostic options are permitted in extra_args."
            )

    return validated

class HermesClient:
    def __init__(
        self,
        hermes_bin: Optional[str] = None,
        workspace_root: Optional[Path] = None,
        default_model: Optional[str] = None,
    ):
        self.workspace_root = workspace_root or Path(os.getcwd()).resolve()
        self.hermes_bin = self._resolve_hermes_bin(hermes_bin)
        self.default_model = default_model

    def _resolve_hermes_bin(self, custom_path: Optional[str]) -> str:
        """Resolve hermes executable dynamically without hardcoded machine paths."""
        if custom_path and shutil.which(custom_path):
            return custom_path
        if custom_path and Path(custom_path).is_file():
            return str(Path(custom_path).resolve())

        found = shutil.which("hermes")
        if found:
            return found

        # Dynamic LOCALAPPDATA resolution on Windows
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            alt_win = Path(local_app_data) / "hermes" / "hermes-agent" / "venv" / "Scripts" / "hermes.exe"
            if alt_win.is_file():
                return str(alt_win)
            alt_posix = Path(local_app_data) / "hermes" / "hermes-agent" / "venv" / "bin" / "hermes"
            if alt_posix.is_file():
                return str(alt_posix)

        # Python environment sibling executable
        sys_hermes = Path(sys.executable).parent / "hermes.exe"
        if sys_hermes.is_file():
            return str(sys_hermes)

        return "hermes"

    def strip_decorations(self, text: str) -> str:
        """
        Normalize Hermes CLI/TUI output:
        - Strip ANSI escape sequences.
        - Strip completed TUI reasoning boxes.
        - Strip unclosed or truncated reasoning boxes (e.g. from timeouts or crashes).
        - Strip generic Unicode box-drawing decoration.
        - Preserve legitimate user-facing text and raw evidence outside decoration.
        """
        if not text:
            return ""

        # 1. Strip ANSI escape sequences
        ansi_regex = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
        cleaned = ansi_regex.sub("", text)

        # 2. Strip completed Reasoning box blocks (with closed bottom border)
        cleaned = re.sub(
            r"┌[─\-\s]*Reasoning[─\-\s]*┐[\s\S]*?└[─\-\s]*┘\n?",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )

        # 3. Strip unclosed Reasoning box blocks (truncated or timed out mid-reasoning)
        cleaned = re.sub(
            r"┌[─\-\s]*Reasoning[─\-\s]*┐[\s\S]*$",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )

        # 4. Strip generic completed decorative boxes
        cleaned = re.sub(
            r"┌[─\-]+.*?┐[\s\S]*?└[─\-]+┘\n?",
            "",
            cleaned,
        )

        # 5. Strip generic unclosed decorative boxes at the end of output
        cleaned = re.sub(
            r"┌[─\-]+.*?┐[\s\S]*$",
            "",
            cleaned,
        )

        # 6. Clean isolated border/separator lines
        cleaned_lines = []
        for line in cleaned.splitlines():
            # If line is entirely composed of box-drawing characters or horizontal dashes
            if re.match(r"^[\s─━│┃┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬\-]+$", line):
                continue
            # Strip leading box-drawing pipe from vertical content if present
            line_stripped = re.sub(r"^[\s│┃║]\s?", "", line)
            cleaned_lines.append(line_stripped)

        return "\n".join(cleaned_lines).strip()

    def build_cli_cmd(
        self,
        prompt: str,
        toolsets: Optional[str] = None,
        model: Optional[str] = None,
        yolo: bool = False,
        extra_args: Optional[List[str]] = None,
    ) -> List[str]:
        """
        Build and validate CLI arguments for a headless Hermes invocation.
        Enforces:
        - Toolset specification cannot be None or empty string (both silently activate all tools).
        - Tool-free invocation must explicitly pass 'none'.
        - Only appends --yolo when explicitly requested with yolo=True.
        """
        if toolsets is None or not toolsets.strip():
            raise ValueError(
                "Explicit toolset specification is required. Pass 'none' for tool-free execution "
                "or explicit toolsets (e.g. 'terminal,file'). Omitting toolsets or passing an empty "
                "string silently activates all default tools."
            )

        cmd = [self.hermes_bin, "chat", "-q", prompt, "-Q"]
        if yolo:
            cmd.append("--yolo")

        cmd.extend(["-t", toolsets.strip()])

        target_model = model or self.default_model
        if target_model:
            cmd.extend(["-m", target_model])

        validated_extra = validate_extra_args(extra_args)
        if validated_extra:
            cmd.extend(validated_extra)

        self._audit_cli_cmd_invariants(cmd, expected_toolsets=toolsets.strip(), expected_yolo=yolo)

        return cmd

    def _audit_cli_cmd_invariants(self, cmd: List[str], expected_toolsets: str, expected_yolo: bool) -> None:
        """Post-construction command array invariant audit ensuring no unexpected overrides exist."""
        # 1. Exactly one '-t' flag
        t_indices = [idx for idx, val in enumerate(cmd) if val == "-t"]
        if len(t_indices) != 1:
            raise ValueError(f"Command invariant violation: expected exactly one '-t' flag, found {len(t_indices)}.")
        if t_indices[0] + 1 >= len(cmd) or cmd[t_indices[0] + 1] != expected_toolsets:
            raise ValueError(
                f"Command invariant violation: '-t' flag value does not match expected toolset '{expected_toolsets}'."
            )

        # 2. No other token may start with -t or --toolsets
        for idx, token in enumerate(cmd):
            if idx in (t_indices[0], t_indices[0] + 1):
                continue
            token_lower = token.lower()
            if (
                token_lower == "-t"
                or token_lower.startswith("-t")
                or token_lower == "--toolsets"
                or token_lower.startswith("--toolsets")
            ):
                raise ValueError(f"Command invariant violation: unexpected toolset token '{token}'.")

        # 3. If expected_yolo is False, --yolo must NOT appear anywhere in cmd
        if not expected_yolo and "--yolo" in cmd:
            raise ValueError("Command invariant violation: '--yolo' is present when expected_yolo=False.")

        # 4. If expected_toolsets is 'none', verify '-t none'
        if expected_toolsets == "none" and cmd[t_indices[0] + 1] != "none":
            raise ValueError("Command invariant violation: tool-free command does not set '-t none'.")

    def run_query(
        self,
        prompt: str,
        toolsets: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 300,
        yolo: bool = False,
        extra_args: Optional[List[str]] = None,
    ) -> HermesResponse:
        """
        Execute Hermes in a headless CLI process with lifecycle ownership and process-tree termination.
        """
        cmd = self.build_cli_cmd(
            prompt=prompt,
            toolsets=toolsets,
            model=model,
            yolo=yolo,
            extra_args=extra_args,
        )

        is_truncated = False
        proc = None
        stdout = ""
        stderr = ""
        exit_code = 1

        try:
            # Use Popen to retain handle for process-tree cleanup
            proc = subprocess.Popen(
                cmd,
                cwd=str(self.workspace_root),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            stdout, stderr = proc.communicate(timeout=timeout)
            exit_code = proc.returncode
        except subprocess.TimeoutExpired:
            is_truncated = True
            exit_code = 124
            if proc:
                # Terminate entire owned process tree to prevent orphan background workers
                terminate_process_tree(proc.pid)
                try:
                    stdout, stderr = proc.communicate(timeout=5)
                except Exception:
                    stdout = stdout or ""
                    stderr = stderr or ""
            stderr = (stderr or "") + f"\n[HermesClient] Command timed out after {timeout}s; process tree terminated."
        except Exception as e:
            exit_code = 1
            stderr = f"[HermesClient] Launch failure: {str(e)}"
            if proc:
                terminate_process_tree(proc.pid)

        raw_stdout = stdout or ""
        raw_stderr = stderr or ""

        # Extract session_id if present
        session_id = None
        sid_match = re.search(r"session_id:\s*([a-zA-Z0-9_-]+)", raw_stderr + "\n" + raw_stdout)
        if sid_match:
            session_id = sid_match.group(1)

        clean = self.strip_decorations(raw_stdout)

        return HermesResponse(
            stdout=raw_stdout,
            stderr=raw_stderr,
            exit_code=exit_code,
            session_id=session_id,
            clean_text=clean,
            raw_stdout=raw_stdout,
            raw_stderr=raw_stderr,
            is_truncated=is_truncated,
        )

def get_resolved_tool_names(toolsets: Optional[str] = None) -> List[str]:
    """
    Query the installed Hermes runtime toolset resolver to verify which tools
    are actually active for a given toolset specification.
    Returns the list of tool function names.
    Enforces:
    - 'none' returns empty list [] (zero tools).
    - None or empty resolves to the installed Hermes default tool catalog.
    """
    import os
    import sys
    from pathlib import Path

    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        hermes_agent_dir = Path(local_app_data) / "hermes" / "hermes-agent"
        if hermes_agent_dir.is_dir() and str(hermes_agent_dir) not in sys.path:
            sys.path.insert(0, str(hermes_agent_dir))

    try:
        from model_tools import get_tool_definitions
    except ImportError:
        return []

    if toolsets is None:
        enabled = None
    elif not toolsets.strip() or toolsets.strip().lower() == "none":
        enabled = ["none"]
    else:
        enabled = [t.strip() for t in toolsets.split(",") if t.strip()]

    defs = get_tool_definitions(enabled_toolsets=enabled, quiet_mode=True)
    return [t.get("function", {}).get("name", "") for t in defs if isinstance(t, dict)]
