import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from orchestrator.schema import ObservedMutations

# Protected repository and orchestrator paths that cannot be staged or committed
PROTECTED_PATH_PATTERNS = {
    ".git",
    ".orchestrator",
    ".orchestrator_logs",
    ".orchestrator_state.json",
    "ORCHESTRATOR_HANDOFF.md",
    "config.json",
    "run_orchestrator.py",
}

def normalize_git_path(p: str) -> str:
    """
    Normalize path to posix relative path with Windows case-folding for comparison.
    Handles Windows backslashes, leading/trailing slashes, and platform-specific casing.
    """
    if not p or not isinstance(p, str):
        return ""
    clean = p.replace("\\", "/").strip().strip("/")
    if sys.platform == "win32":
        return clean.lower()
    return clean

def is_path_authorized(candidate_path: str, allowed_paths: Optional[List[str]]) -> bool:
    """Check if candidate_path is authorized by allowed_paths boundaries."""
    if not allowed_paths:
        return True
    cand_norm = normalize_git_path(candidate_path)
    for a in allowed_paths:
        a_norm = normalize_git_path(a)
        if not a_norm:
            continue
        if cand_norm == a_norm or cand_norm.startswith(a_norm.rstrip("/") + "/"):
            return True
    return False

class GitManager:
    def __init__(self, workspace_root: Path):
        self.workspace_root = workspace_root.resolve()

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

    def _run_git_bytes(self, args: List[str]) -> Tuple[int, bytes, bytes]:
        try:
            proc = subprocess.run(
                ["git"] + args,
                cwd=str(self.workspace_root),
                capture_output=True,
            )
            return proc.returncode, proc.stdout, proc.stderr
        except Exception as e:
            return 1, b"", str(e).encode("utf-8", errors="replace")

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

    def get_status_porcelain_v1_z(self) -> Dict[str, Dict[str, Any]]:
        """
        Parse machine-readable NUL-delimited git status --porcelain=v1 -z.
        Handles renames, unquoted spaces, quotes, and Unicode filenames safely.
        """
        code, out_bytes, _ = self._run_git_bytes(["status", "--porcelain=v1", "-z"])
        if code != 0 or not out_bytes:
            return {}

        results: Dict[str, Dict[str, Any]] = {}
        entries = out_bytes.split(b"\x00")
        i = 0
        while i < len(entries):
            entry = entries[i]
            if not entry:
                i += 1
                continue
            if len(entry) < 3:
                i += 1
                continue

            st = entry[:2].decode("utf-8", errors="replace")
            path_bytes = entry[3:]
            path = path_bytes.decode("utf-8", errors="replace")
            is_rename = ("R" in st or "C" in st)
            orig_path = None

            if is_rename:
                # Next NUL-delimited entry is orig_path
                if i + 1 < len(entries):
                    orig_path = entries[i + 1].decode("utf-8", errors="replace")
                    i += 1

            norm = normalize_git_path(path)
            results[norm] = {
                "status": st,
                "is_rename": is_rename,
                "orig_path": orig_path,
                "raw_path": path,
            }
            i += 1

        return results

    def get_changed_files(self) -> List[str]:
        """Return all tracked and untracked files modified in the working tree."""
        z_dict = self.get_status_porcelain_v1_z()
        return [info["raw_path"] for info in z_dict.values()]

    def capture_baseline(self) -> Dict[str, str]:
        """Capture working tree baseline mapping normalized paths to porcelain status codes."""
        z_dict = self.get_status_porcelain_v1_z()
        return {norm: info["status"] for norm, info in z_dict.items()}

    def compute_observed_mutations(
        self,
        baseline: Dict[str, str],
        allowed_paths: Optional[List[str]] = None,
    ) -> ObservedMutations:
        """
        Compute observed filesystem and Git changes strictly relative to the captured baseline.
        Handles additions, tracked edits, deletions, renames, and Windows casing/separators.
        """
        current_z = self.get_status_porcelain_v1_z()
        current_status = {norm: info["status"] for norm, info in current_z.items()}

        tracked_mod: List[str] = []
        untracked_add: List[str] = []
        deleted: List[str] = []
        staged: List[str] = []
        pre_existing: List[str] = []

        # Identify pre-existing files unchanged during this turn
        for norm_p, st in baseline.items():
            if norm_p in current_status and current_status[norm_p] == st:
                raw = current_z[norm_p]["raw_path"]
                pre_existing.append(raw)

        # Identify new or modified files
        for norm_p, info in current_z.items():
            st = info["status"]
            raw = info["raw_path"]
            if norm_p not in baseline:
                # Newly added, modified, or untracked file
                if "?" in st:
                    untracked_add.append(raw)
                elif "D" in st:
                    deleted.append(raw)
                else:
                    tracked_mod.append(raw)
                if st[0] in ("M", "A", "D", "R", "C"):
                    staged.append(raw)
            elif current_status[norm_p] != baseline[norm_p]:
                # Status transitioned during this task
                tracked_mod.append(raw)
                if st[0] in ("M", "A", "D", "R", "C"):
                    staged.append(raw)

        # Identify deletions of files present in baseline
        for norm_p in baseline:
            if norm_p not in current_status:
                deleted.append(norm_p)

        has_deltas = bool(tracked_mod or untracked_add or deleted or staged)

        # Check authorization boundaries on observed paths
        unauthorized_deltas: List[str] = []
        if allowed_paths:
            all_changed = set(tracked_mod + untracked_add + deleted + staged)
            for raw_p in all_changed:
                if not is_path_authorized(raw_p, allowed_paths):
                    unauthorized_deltas.append(raw_p)

        return ObservedMutations(
            tracked_modified=sorted(tracked_mod),
            untracked_added=sorted(untracked_add),
            deleted=sorted(deleted),
            staged=sorted(staged),
            pre_existing_modified=sorted(pre_existing),
            has_deltas=has_deltas,
            unauthorized_deltas=sorted(unauthorized_deltas),
        )

    def get_staged_files(self) -> List[str]:
        """Return files currently staged in the index."""
        code, out, _ = self._run_git(["diff", "--cached", "--name-only"])
        if code != 0 or not out:
            return []
        return [line.strip() for line in out.splitlines() if line.strip()]

    def get_untracked_files(self) -> List[str]:
        """Return untracked files in the working tree."""
        code, out, _ = self._run_git(["ls-files", "--others", "--exclude-standard"])
        if code != 0 or not out:
            return []
        return [line.strip() for line in out.splitlines() if line.strip()]

    def get_diff_stat(self) -> str:
        code, out, _ = self._run_git(["diff", "--stat"])
        return out if code == 0 else ""

    def validate_explicit_paths(self, paths: List[str]) -> Tuple[bool, List[str], Optional[str]]:
        """
        Validate that every path in `paths` is explicitly bounded, resolves within
        workspace_root, is not a protected path, does not attempt directory traversal,
        and is an actual file. Fails closed on any ambiguity.
        """
        if not paths:
            return False, [], "No paths provided for validation"

        validated: List[str] = []
        for raw in paths:
            if not raw or not isinstance(raw, str) or not raw.strip():
                return False, [], "Empty or whitespace path provided"

            raw_str = raw.strip()
            try:
                candidate = (self.workspace_root / raw_str).resolve()
            except Exception as e:
                return False, [], f"Path resolution error for '{raw_str}': {e}"

            # 1. Enforce strict boundary within workspace_root (anti-traversal)
            try:
                rel = candidate.relative_to(self.workspace_root)
            except ValueError:
                return False, [], f"Path traversal rejected: '{raw_str}' resolves outside workspace root"

            rel_posix = rel.as_posix()

            # 2. Prevent protected files / directories
            first_part = rel.parts[0] if rel.parts else ""
            if first_part in PROTECTED_PATH_PATTERNS or rel_posix in PROTECTED_PATH_PATTERNS:
                return False, [], f"Protected path rejected: '{rel_posix}'"

            # 3. Path must be a file or modified/untracked file in working tree, not a directory
            if candidate.is_dir():
                return False, [], f"Directories cannot be explicitly staged directly: '{rel_posix}'"

            validated.append(rel_posix)

        return True, validated, None

    def stage_paths_authorized(
        self,
        explicit_paths: List[str],
        authorized: bool = False,
    ) -> Tuple[bool, str]:
        """
        Stage explicit, validated paths.
        Requires explicit authorization (`authorized=True`).
        Never invokes `git add -A` or stages unrequested files.
        """
        if not authorized:
            return False, "Unauthorized: Staging requires explicit authorization."

        is_valid, validated_paths, error_msg = self.validate_explicit_paths(explicit_paths)
        if not is_valid:
            return False, f"Staging rejected by path validation: {error_msg}"

        cmd = ["add", "--"] + validated_paths
        code, out, err = self._run_git(cmd)
        if code != 0:
            return False, f"Git add failed: {err or out}"

        return True, f"Successfully staged {len(validated_paths)} files: {', '.join(validated_paths)}"

    def commit_authorized(
        self,
        commit_message: str,
        authorized: bool = False,
    ) -> Tuple[bool, str]:
        """
        Commit staged changes.
        Requires explicit authorization (`authorized=True`).
        Does not stage changes automatically.
        """
        if not authorized:
            return False, "Unauthorized: Commit requires explicit authorization."

        if not commit_message or not commit_message.strip():
            return False, "Commit rejected: Empty commit message."

        staged = self.get_staged_files()
        if not staged:
            return False, "Commit rejected: No changes staged in index."

        code, out, err = self._run_git(["commit", "-m", commit_message.strip()])
        if code != 0:
            return False, f"Git commit failed: {err or out}"

        return True, f"Committed: {commit_message.strip()}"

    def commit_verified(self, prompt_id: str, summary: str) -> Tuple[bool, str]:
        """
        DEPRECATED & DISABLED.
        Automated un-gated commits are permanently disabled per V8.1 fail-closed security governance.
        """
        return False, (
            "Unauthorized: Automated commit_verified is permanently disabled. "
            "Git staging and committing require separate explicit authorization "
            "via stage_paths_authorized and commit_authorized."
        )
