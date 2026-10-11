import subprocess
from pathlib import Path
from typing import List, Optional, Tuple

class GitManager:
    def __init__(self, workspace_root: Path):
        self.workspace_root = workspace_root

    def _run_git(self, args: List[str]) -> Tuple[int, str, str]:
        try:
            proc = subprocess.run(
                ["git"] + args,
                cwd=str(self.workspace_root),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
        except Exception as e:
            return 1, "", str(e)

    def get_branch(self) -> str:
        code, out, _ = self._run_git(["rev-parse", "--abbrev-ref", "HEAD"])
        return out if code == 0 else "unknown"

    def get_head(self) -> str:
        code, out, _ = self._run_git(["rev-parse", "--short", "HEAD"])
        return out if code == 0 else "unknown"

    def get_status_summary(self) -> str:
        code, out, _ = self._run_git(["status", "--short"])
        if code != 0 or not out:
            return "Clean working tree"
        lines = out.splitlines()
        return f"{len(lines)} files modified / untracked"

    def get_changed_files(self) -> List[str]:
        code, out, _ = self._run_git(["status", "--porcelain"])
        if code != 0 or not out:
            return []
        files = []
        for line in out.splitlines():
            parts = line.strip().split(maxsplit=1)
            if len(parts) == 2:
                files.append(parts[1])
        return files

    def get_diff_stat(self) -> str:
        code, out, _ = self._run_git(["diff", "--stat"])
        return out if code == 0 else ""

    def commit_verified(self, prompt_id: str, summary: str) -> Tuple[bool, str]:
        # Staging
        code, _, err = self._run_git(["add", "-A"])
        if code != 0:
            return False, f"Git add failed: {err}"

        # Check if there are changes to commit
        code, out, _ = self._run_git(["status", "--porcelain"])
        if not out:
            return True, "No changes to commit (working tree clean)"

        commit_msg = f"[verified] {prompt_id}: {summary.strip()}"
        code, out, err = self._run_git(["commit", "-m", commit_msg])
        if code != 0:
            return False, f"Git commit failed: {err or out}"
        return True, f"Committed: {commit_msg}"
