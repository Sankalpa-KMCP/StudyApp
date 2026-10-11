import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

@dataclass
class HermesResponse:
    stdout: str
    stderr: str
    exit_code: int
    session_id: Optional[str]
    clean_text: str

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
        if custom_path and shutil.which(custom_path):
            return custom_path
        if custom_path and Path(custom_path).is_file():
            return str(Path(custom_path).resolve())

        found = shutil.which("hermes")
        if found:
            return found

        # Fallback to standard Windows location
        known_windows_path = Path(r"C:\Users\chamidu\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe")
        if known_windows_path.is_file():
            return str(known_windows_path)

        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            alt = Path(local_app_data) / "hermes" / "hermes-agent" / "venv" / "Scripts" / "hermes.exe"
            if alt.is_file():
                return str(alt)

        return "hermes"

    def strip_decorations(self, text: str) -> str:
        # Strip reasoning box rendered in TUI/CLI if present
        # Format: ┌─ Reasoning ─...┐ ... └...┘ or ANSI codes
        ansi_regex = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
        cleaned = ansi_regex.sub("", text)
        cleaned = re.sub(r"┌─+ Reasoning ─+[\s\S]*?└─+┘", "", cleaned)
        cleaned = re.sub(r"┌─+.*?─+[\s\S]*?└─+┘", "", cleaned)
        return cleaned.strip()

    def run_query(
        self,
        prompt: str,
        toolsets: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 300,
        yolo: bool = True,
        extra_args: Optional[List[str]] = None,
    ) -> HermesResponse:
        cmd = [self.hermes_bin, "chat", "-q", prompt, "-Q"]
        if yolo:
            cmd.append("--yolo")

        if toolsets:
            cmd.extend(["-t", toolsets])

        target_model = model or self.default_model
        if target_model:
            cmd.extend(["-m", target_model])

        if extra_args:
            cmd.extend(extra_args)

        try:
            proc = subprocess.run(
                cmd,
                cwd=str(self.workspace_root),
                capture_output=True,
                text=True,
                timeout=timeout,
                encoding="utf-8",
                errors="replace",
            )
            stdout = proc.stdout or ""
            stderr = proc.stderr or ""
            exit_code = proc.returncode
        except subprocess.TimeoutExpired as e:
            stdout = e.stdout or "" if hasattr(e, "stdout") else ""
            stderr = f"Timed out after {timeout} seconds"
            exit_code = 124
        except Exception as e:
            stdout = ""
            stderr = f"Subprocess execution error: {str(e)}"
            exit_code = 1

        session_id = None
        sid_match = re.search(r"session_id:\s*([a-zA-Z0-9_-]+)", stderr + "\n" + stdout)
        if sid_match:
            session_id = sid_match.group(1)

        clean = self.strip_decorations(stdout)
        return HermesResponse(
            stdout=stdout,
            stderr=stderr,
            exit_code=exit_code,
            session_id=session_id,
            clean_text=clean,
        )
