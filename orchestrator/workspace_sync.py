import hashlib
import io
import json
import os
import posixpath
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import unicodedata
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from orchestrator.git_manager import (
    PROTECTED_PATH_PATTERNS,
    is_path_authorized,
    normalize_git_path,
)
from orchestrator.schema import (
    AuthorizationEscalationError,
    MissingAuthorizationError,
    MutationExpectation,
    ObjectiveAuthorization,
    VerificationProvenance,
    VerificationResult,
)


class WorkspaceIsolationError(Exception):
    """Base error for disposable workspace snapshot and synchronization violations."""
    pass


class SymlinkEscapeError(WorkspaceIsolationError):
    """Raised when a symlink, hardlink, junction, or special file is encountered."""
    pass


class PathTraversalError(WorkspaceIsolationError):
    """Raised when a path attempts to escape the workspace boundary."""
    pass


class UnauthorizedPathError(WorkspaceIsolationError):
    """Raised when a proposed file mutation falls outside authorized path scope or targets a protected resource."""
    pass


class StaleBaselineConflictError(WorkspaceIsolationError):
    """Raised when the real working tree changed concurrently since the snapshot baseline was captured."""
    pass


class UnverifiedSyncError(WorkspaceIsolationError):
    """Raised when attempting to synchronize changes without passing trusted verification."""
    pass


class SyncTransactionRollbackError(WorkspaceIsolationError):
    """Raised when an error occurs during working-tree synchronization and changes are rolled back."""
    pass


class CorruptedTransactionError(WorkspaceIsolationError):
    """Raised when an on-disk transaction manifest or preimage journal is damaged or unparseable."""
    pass


class DuplicateNormalizedPathError(WorkspaceIsolationError):
    """Raised when two paths collide under Windows case-folding or Unicode normalization."""
    pass


# Default snapshot size bounds (10 MB per file, 100 MB total snapshot)
MAX_SNAPSHOT_FILE_BYTES: int = 10 * 1024 * 1024
MAX_SNAPSHOT_TOTAL_BYTES: int = 100 * 1024 * 1024

# Directory names permanently excluded from disposable container snapshots
EXCLUDED_SNAPSHOT_DIRS: Set[str] = {
    ".git",
    ".orchestrator",
    ".orchestrator_logs",
    ".orchestrator_sync_tx",
    ".hermes",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "node_modules",
    ".venv",
    "venv",
}

# Root-level orchestrator state/control files excluded from container snapshots
EXCLUDED_ROOT_STATE_FILES: Set[str] = {
    ".orchestrator_state.json",
    ".orchestrator_state.json.bak",
    ".orchestrator_state.json.lock",
    "ORCHESTRATOR_HANDOFF.md",
    "run_orchestrator.py",
}

# Secret/credential filenames excluded at any directory depth
EXCLUDED_SECRET_FILENAMES: Set[str] = {
    ".npmrc",
    ".pypirc",
    ".netrc",
}

SECRET_FILENAME_PATTERNS = (
    re.compile(r"^\.env(?:\..+)?$", re.IGNORECASE),
    re.compile(r"^.*\.(?:pem|key|pfx|p12|kdbx)$", re.IGNORECASE),
    re.compile(r"^id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?$", re.IGNORECASE),
    re.compile(r"^.*(?:secret|credential|token|apikey|api_key).*\.json$", re.IGNORECASE),
)

TRANSIENT_EXPORT_DIRS: Set[str] = {
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "node_modules",
    ".git",
    ".orchestrator_sync_tx",
}

TRANSIENT_EXPORT_SUFFIXES = (".pyc", ".pyo", ".pyd")


def compute_bytes_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def compute_files_manifest_digest(files_map: Dict[str, bytes]) -> str:
    """Compute a deterministic cryptographic digest over a mapping of {rel_posix: bytes}."""
    h = hashlib.sha256()
    for rel_posix in sorted(files_map.keys()):
        if is_transient_runtime_artifact(rel_posix):
            continue
        h.update(rel_posix.encode("utf-8"))
        h.update(b"\x00")
        h.update(compute_bytes_sha256(files_map[rel_posix]).encode("ascii"))
        h.update(b"\n")
    return h.hexdigest()


def normalize_collision_key(rel_posix: str) -> str:
    """
    Canonical collision key combining Unicode NFC normalization and Windows case-folding.
    Used to detect duplicate case-insensitive or Unicode-equivalent paths.
    """
    nfc = unicodedata.normalize("NFC", rel_posix)
    return nfc.replace("\\", "/").strip().strip("/").lower()


def is_symlink_or_reparse_point(path: Path) -> bool:
    """
    Detect POSIX symlinks and Windows NTFS junctions / reparse points without following them.
    """
    try:
        if path.is_symlink() or os.path.islink(str(path)):
            return True
        st = os.lstat(str(path))
        if stat.S_ISLNK(st.st_mode):
            return True
        file_attrs = getattr(st, "st_file_attributes", 0)
        if file_attrs & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400):
            return True
    except OSError:
        return False
    return False


def host_file_exact_case_exists(workspace_root: Path, rel_posix: str) -> bool:
    """
    Check whether `rel_posix` exists on the host with the EXACT letter casing specified.
    On case-insensitive filesystems like Windows NTFS, path.is_file() folds case
    (e.g. 'Foo.txt' matches 'foo.txt'). This function walks path components and verifies
    that each segment matches `os.listdir()` verbatim.
    """
    try:
        curr = workspace_root.resolve()
        parts = rel_posix.replace("\\", "/").strip("/").split("/")
        for idx, part in enumerate(parts):
            if not curr.is_dir():
                return False
            entries = os.listdir(curr)
            if part not in entries:
                return False
            curr = curr / part
        return curr.is_file()
    except (OSError, ValueError):
        return False


def validate_safe_relative_posix_path(raw_path: str) -> str:
    """
    Validate and normalize a relative path into canonical POSIX format (preserving case).
    Rejects absolute paths, Windows drive letters, NUL bytes, and '..' traversal.
    """
    if not raw_path or not isinstance(raw_path, str):
        raise PathTraversalError("Path must be a non-empty string.")
    if "\x00" in raw_path:
        raise PathTraversalError("NUL byte forbidden in path.")

    cleaned = unicodedata.normalize("NFC", raw_path).replace("\\", "/").strip()
    while cleaned.startswith("./"):
        cleaned = cleaned[2:]
    cleaned = cleaned.rstrip("/")

    if not cleaned or cleaned == ".":
        raise PathTraversalError(f"Invalid empty/root relative path: {raw_path!r}")

    if cleaned.startswith("/") or re.match(r"^[A-Za-z]:", cleaned):
        raise PathTraversalError(f"Absolute or drive-qualified path rejected: {raw_path!r}")

    parts = cleaned.split("/")
    for part in parts:
        if not part or part == ".":
            raise PathTraversalError(f"Malformed path segment in {raw_path!r}")
        if part == "..":
            raise PathTraversalError(f"Parent directory traversal ('..') rejected in {raw_path!r}")

    return "/".join(parts)


def is_secret_or_orchestrator_internal_path(rel_posix: str) -> bool:
    """
    Return True ONLY if rel_posix is a secret/credential file, .git metadata,
    or live orchestrator state/log file that must NEVER enter a container snapshot.
    Does NOT exclude legitimate nested application files like 'src/config.json' or
    non-secret protected build files (e.g. 'package.json').
    """
    parts = rel_posix.split("/")
    for part in parts[:-1]:
        if part in EXCLUDED_SNAPSHOT_DIRS or part.lower() in EXCLUDED_SNAPSHOT_DIRS:
            return True

    filename = parts[-1]
    if filename in EXCLUDED_SNAPSHOT_DIRS or filename in EXCLUDED_SECRET_FILENAMES:
        return True

    if rel_posix in EXCLUDED_ROOT_STATE_FILES or filename in {
        ".orchestrator_state.json",
        ".orchestrator_state.json.bak",
        ".orchestrator_state.json.lock",
        "ORCHESTRATOR_HANDOFF.md",
    }:
        return True

    for pattern in SECRET_FILENAME_PATTERNS:
        if pattern.match(filename):
            return True

    return False


def is_protected_from_mutation(
    rel_posix: str,
    authorization: Optional[ObjectiveAuthorization] = None,
) -> bool:
    """
    Return True if rel_posix is protected from modification/deletion/promotion.
    Includes:
    - All secret and orchestrator-internal paths
    - Root-level PROTECTED_PATH_PATTERNS (e.g. root 'config.json', 'run_orchestrator.py')
    - Any path matching `authorization.protected_resources`
    - Any path explicitly listed in `authorization.readonly_snapshot_paths` (ARCHB-SNAP-002)
    """
    if is_secret_or_orchestrator_internal_path(rel_posix):
        return True
    parts = rel_posix.split("/")
    if rel_posix in PROTECTED_PATH_PATTERNS or parts[0] in PROTECTED_PATH_PATTERNS:
        return True
    if authorization and authorization.protected_resources:
        if any(is_path_authorized(rel_posix, [p]) for p in authorization.protected_resources):
            return True
    if authorization and getattr(authorization, "readonly_snapshot_paths", None):
        target_norm = normalize_collision_key(rel_posix)
        for ro_raw in authorization.readonly_snapshot_paths:
            try:
                ro_clean = validate_safe_relative_posix_path(str(ro_raw))
            except Exception:
                continue
            if normalize_collision_key(ro_clean) == target_norm:
                return True
    return False


# Keep alias for backward compatibility with imports
is_excluded_or_secret_path = is_secret_or_orchestrator_internal_path


def is_transient_runtime_artifact(rel_posix: str) -> bool:
    """Return True for bytecode/test cache files generated during container test runs."""
    parts = rel_posix.split("/")
    for part in parts[:-1]:
        if part in TRANSIENT_EXPORT_DIRS:
            return True
    filename = parts[-1]
    if filename in TRANSIENT_EXPORT_DIRS or filename.endswith(TRANSIENT_EXPORT_SUFFIXES):
        return True
    return False


def check_no_file_directory_conflicts(paths: List[str]) -> None:
    """
    Ensure no path in `paths` is both a file and a parent directory of another file.
    """
    file_norms: Dict[str, str] = {}
    dir_norms: Dict[str, str] = {}
    for p in paths:
        norm = normalize_collision_key(p)
        if norm in dir_norms:
            raise WorkspaceIsolationError(
                f"File-versus-directory conflict: '{p}' collides with directory prefix of '{dir_norms[norm]}'."
            )
        file_norms[norm] = p
        parts = norm.split("/")
        for idx in range(1, len(parts)):
            prefix = "/".join(parts[:idx])
            if prefix in file_norms:
                raise WorkspaceIsolationError(
                    f"File-versus-directory conflict: '{p}' has parent directory '{prefix}' which is a file ('{file_norms[prefix]}')."
                )
            dir_norms[prefix] = p


@dataclass
class SnapshotBaseline:
    """
    Immutable cryptographic baseline of a workspace snapshot prior to isolated execution.
    """
    workspace_root: Path
    file_hashes: Dict[str, str] = field(default_factory=dict)       # norm_path -> sha256
    file_bytes: Dict[str, bytes] = field(default_factory=dict)      # exact rel_posix -> exact bytes
    norm_to_posix: Dict[str, str] = field(default_factory=dict)     # norm_path -> exact rel_posix
    tracked_paths: Set[str] = field(default_factory=set)            # norm_path set
    authorized_untracked_paths: Set[str] = field(default_factory=set)
    readonly_snapshot_paths: Set[str] = field(default_factory=set)  # norm_path set (ARCHB-SNAP-002)
    protected_readonly_paths: Set[str] = field(default_factory=set) # norm_path set

    def has_path(self, rel_path: str) -> bool:
        return normalize_collision_key(rel_path) in self.file_hashes

    def sha256_for(self, rel_path: str) -> Optional[str]:
        return self.file_hashes.get(normalize_collision_key(rel_path))

    def build_tar_bytes(
        self,
        uid: int = 1000,
        gid: int = 1000,
        uname: str = "node",
        gname: str = "node",
    ) -> bytes:
        """
        Serialize the snapshot files into an in-memory POSIX tar archive for container import.
        Guarantees zero symlinks, zero .git metadata, and deterministic ownership.
        Protected non-secret files are included for reading/building with mode 0o444.
        """
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w") as tf:
            for rel_posix in sorted(self.file_bytes.keys()):
                data = self.file_bytes[rel_posix]
                norm = normalize_collision_key(rel_posix)
                info = tarfile.TarInfo(name=rel_posix)
                info.size = len(data)
                info.mode = 0o444 if norm in self.protected_readonly_paths else 0o644
                info.uid = uid
                info.gid = gid
                info.uname = uname
                info.gname = gname
                info.type = tarfile.REGTYPE
                tf.addfile(info, io.BytesIO(data))
        return buf.getvalue()


@dataclass
class WorkspaceDelta:
    """
    Exact file deltas computed between a container's exported /workspace and SnapshotBaseline.
    Preserves exact case-sensitive paths while accounting for case-only renames on Windows.
    """
    modified: List[str] = field(default_factory=list)
    created: List[str] = field(default_factory=list)
    deleted: List[str] = field(default_factory=list)
    renamed: List[Tuple[str, str]] = field(default_factory=list)  # (old_path, new_path)
    new_file_bytes: Dict[str, bytes] = field(default_factory=dict)  # rel_posix -> bytes for modified & created

    @property
    def has_changes(self) -> bool:
        return bool(self.modified or self.created or self.deleted or self.renamed)

    @property
    def all_affected_paths(self) -> List[str]:
        paths: Set[str] = set(self.modified) | set(self.created) | set(self.deleted)
        for old_p, new_p in self.renamed:
            paths.add(old_p)
            paths.add(new_p)
        return sorted(paths)

    def compute_manifest_digest(self) -> str:
        """Cryptographic SHA-256 digest of all proposed changes in this delta."""
        h = hashlib.sha256()
        for m in sorted(self.modified):
            h.update(f"M:{m}:{compute_bytes_sha256(self.new_file_bytes[m])}\n".encode("utf-8"))
        for c in sorted(self.created):
            h.update(f"A:{c}:{compute_bytes_sha256(self.new_file_bytes[c])}\n".encode("utf-8"))
        for d in sorted(self.deleted):
            h.update(f"D:{d}\n".encode("utf-8"))
        for old_p, new_p in sorted(self.renamed):
            h.update(f"R:{old_p}->{new_p}\n".encode("utf-8"))
        return h.hexdigest()


@dataclass
class SyncResult:
    """
    Auditable record of a direct source synchronization operation.
    """
    applied: bool
    transaction_id: str = ""
    modified_files: List[str] = field(default_factory=list)
    created_files: List[str] = field(default_factory=list)
    deleted_files: List[str] = field(default_factory=list)
    renamed_files: List[Tuple[str, str]] = field(default_factory=list)
    verification_provenance: VerificationProvenance = VerificationProvenance.UNVERIFIED
    rolled_back: bool = False
    summary: str = ""


class SnapshotBuilder:
    """
    Constructs a clean, isolated source snapshot from a host Git repository.
    Separates:
    1. Secret / orchestrator-internal files (permanently excluded from snapshot).
    2. Protected read-only files (included in snapshot for builds/imports, blocked from mutation).
    3. Authorized editable tracked & untracked source files.
    4. Unrelated untracked files (excluded from snapshot).
    """

    def __init__(
        self,
        workspace_root: Path,
        max_file_bytes: int = MAX_SNAPSHOT_FILE_BYTES,
        max_total_bytes: int = MAX_SNAPSHOT_TOTAL_BYTES,
    ):
        self.workspace_root = workspace_root.resolve()
        self.max_file_bytes = max_file_bytes
        self.max_total_bytes = max_total_bytes

    def _git_ls_files_z(self, args: List[str]) -> List[str]:
        try:
            proc = subprocess.run(
                ["git"] + args,
                cwd=str(self.workspace_root),
                capture_output=True,
                timeout=30,
                stdin=subprocess.DEVNULL,
            )
            if proc.returncode != 0:
                return []
            entries = proc.stdout.split(b"\x00")
            return [e.decode("utf-8", errors="replace") for e in entries if e]
        except Exception:
            return []

    def capture_snapshot(
        self,
        authorization: Optional[ObjectiveAuthorization] = None,
        extra_allowed_untracked: Optional[List[str]] = None,
        extra_readonly_files: Optional[List[str]] = None,
    ) -> SnapshotBaseline:
        if is_symlink_or_reparse_point(self.workspace_root):
            raise SymlinkEscapeError(f"Workspace root itself cannot be a symlink/junction: {self.workspace_root}")

        tracked_raw = self._git_ls_files_z(["ls-files", "-z"])
        untracked_raw = self._git_ls_files_z(["ls-files", "--others", "--exclude-standard", "-z"])
        ignored_raw = self._git_ls_files_z(["ls-files", "--others", "-i", "--exclude-standard", "-z"])

        is_git_repo = (self.workspace_root / ".git").exists() or bool(tracked_raw or untracked_raw or ignored_raw)
        if not is_git_repo:
            for root, dirs, files in os.walk(self.workspace_root, followlinks=False):
                root_path = Path(root)
                dirs[:] = [
                    d for d in dirs
                    if d not in EXCLUDED_SNAPSHOT_DIRS and not is_symlink_or_reparse_point(root_path / d)
                ]
                for f in files:
                    full_p = root_path / f
                    rel_p = full_p.relative_to(self.workspace_root).as_posix()
                    tracked_raw.append(rel_p)

        ignored_norms: Set[str] = set()
        if is_git_repo:
            for raw_ig in ignored_raw:
                try:
                    ig_posix = validate_safe_relative_posix_path(raw_ig)
                    ignored_norms.add(normalize_collision_key(ig_posix))
                except Exception:
                    continue

        allowed_untracked_scopes: List[str] = []
        if authorization and authorization.allowed_paths:
            allowed_untracked_scopes.extend(authorization.allowed_paths)
        if extra_allowed_untracked:
            allowed_untracked_scopes.extend(extra_allowed_untracked)

        readonly_input_list: List[str] = []
        if authorization and getattr(authorization, "readonly_snapshot_paths", None):
            readonly_input_list.extend(authorization.readonly_snapshot_paths)
        if extra_readonly_files:
            readonly_input_list.extend(extra_readonly_files)

        baseline = SnapshotBaseline(workspace_root=self.workspace_root)
        total_bytes = 0

        # 1. Process tracked files (includes non-secret protected files as read-only build inputs)
        for raw_rel in tracked_raw:
            rel_posix = validate_safe_relative_posix_path(raw_rel)
            if is_secret_or_orchestrator_internal_path(rel_posix):
                continue

            self._assert_no_symlink_in_chain(rel_posix)
            full_path = self.workspace_root / rel_posix
            if not full_path.exists() or full_path.is_dir():
                continue

            data = full_path.read_bytes()
            if len(data) > self.max_file_bytes:
                raise WorkspaceIsolationError(
                    f"Snapshot file '{rel_posix}' size ({len(data)} bytes) exceeds limit ({self.max_file_bytes} bytes)."
                )
            total_bytes += len(data)
            if total_bytes > self.max_total_bytes:
                raise WorkspaceIsolationError(
                    f"Total snapshot size ({total_bytes} bytes) exceeds limit ({self.max_total_bytes} bytes)."
                )

            norm = normalize_collision_key(rel_posix)
            if norm in baseline.norm_to_posix and baseline.norm_to_posix[norm] != rel_posix:
                raise DuplicateNormalizedPathError(
                    f"Case or Unicode collision in snapshot between '{baseline.norm_to_posix[norm]}' and '{rel_posix}'."
                )
            baseline.file_bytes[rel_posix] = data
            baseline.file_hashes[norm] = compute_bytes_sha256(data)
            baseline.norm_to_posix[norm] = rel_posix
            baseline.tracked_paths.add(norm)
            if is_protected_from_mutation(rel_posix, authorization) or (
                authorization is not None
                and bool(authorization.allowed_paths)
                and not is_path_authorized(rel_posix, authorization.allowed_paths)
            ):
                baseline.protected_readonly_paths.add(norm)

        # 2. Process explicitly authorized untracked files (excluding secrets and protected paths)
        for raw_rel in untracked_raw:
            rel_posix = validate_safe_relative_posix_path(raw_rel)
            if is_secret_or_orchestrator_internal_path(rel_posix):
                continue
            if is_protected_from_mutation(rel_posix, authorization):
                continue

            if not allowed_untracked_scopes or not is_path_authorized(rel_posix, allowed_untracked_scopes):
                continue

            self._assert_no_symlink_in_chain(rel_posix)
            full_path = self.workspace_root / rel_posix
            if not full_path.is_file():
                continue

            data = full_path.read_bytes()
            if len(data) > self.max_file_bytes:
                raise WorkspaceIsolationError(
                    f"Snapshot file '{rel_posix}' size ({len(data)} bytes) exceeds limit ({self.max_file_bytes} bytes)."
                )
            total_bytes += len(data)
            if total_bytes > self.max_total_bytes:
                raise WorkspaceIsolationError(
                    f"Total snapshot size ({total_bytes} bytes) exceeds limit ({self.max_total_bytes} bytes)."
                )

            norm = normalize_collision_key(rel_posix)
            if norm in baseline.norm_to_posix and baseline.norm_to_posix[norm] != rel_posix:
                raise DuplicateNormalizedPathError(
                    f"Case or Unicode collision in snapshot between '{baseline.norm_to_posix[norm]}' and '{rel_posix}'."
                )
            baseline.file_bytes[rel_posix] = data
            baseline.file_hashes[norm] = compute_bytes_sha256(data)
            baseline.norm_to_posix[norm] = rel_posix
            baseline.authorized_untracked_paths.add(norm)

        # 3. Process explicitly trusted read-only snapshot inputs (ARCHB-SNAP-002)
        seen_readonly_norms: Dict[str, str] = {}
        for raw_ro in readonly_input_list:
            if not isinstance(raw_ro, str) or not raw_ro.strip():
                raise WorkspaceIsolationError("Invalid empty or non-string entry in readonly_snapshot_paths.")
            rel_posix = validate_safe_relative_posix_path(raw_ro)
            norm = normalize_collision_key(rel_posix)

            if norm in seen_readonly_norms and seen_readonly_norms[norm] != rel_posix:
                raise DuplicateNormalizedPathError(
                    f"Duplicate case-normalized path in readonly_snapshot_paths: '{seen_readonly_norms[norm]}' vs '{rel_posix}'."
                )
            seen_readonly_norms[norm] = rel_posix

            if is_secret_or_orchestrator_internal_path(rel_posix):
                raise UnauthorizedPathError(
                    f"Secret, credential, or live orchestrator state path '{rel_posix}' is prohibited in readonly_snapshot_paths."
                )

            if is_git_repo and norm in ignored_norms:
                raise UnauthorizedPathError(
                    f"Git-ignored path '{rel_posix}' is prohibited in readonly_snapshot_paths."
                )

            self._assert_no_symlink_in_chain(rel_posix)
            full_path = self.workspace_root / rel_posix
            if not full_path.exists() or not full_path.is_file() or not host_file_exact_case_exists(self.workspace_root, rel_posix):
                raise WorkspaceIsolationError(
                    f"Required readonly_snapshot_path '{rel_posix}' does not exist as a regular file with exact casing."
                )

            if norm in baseline.norm_to_posix:
                if baseline.norm_to_posix[norm] != rel_posix:
                    raise DuplicateNormalizedPathError(
                        f"Case or Unicode collision in snapshot between '{baseline.norm_to_posix[norm]}' and '{rel_posix}'."
                    )
                baseline.readonly_snapshot_paths.add(norm)
                baseline.protected_readonly_paths.add(norm)
                continue

            data = full_path.read_bytes()
            if len(data) > self.max_file_bytes:
                raise WorkspaceIsolationError(
                    f"Read-only snapshot file '{rel_posix}' size ({len(data)} bytes) exceeds limit ({self.max_file_bytes} bytes)."
                )
            total_bytes += len(data)
            if total_bytes > self.max_total_bytes:
                raise WorkspaceIsolationError(
                    f"Total snapshot size ({total_bytes} bytes) exceeds limit ({self.max_total_bytes} bytes)."
                )

            baseline.file_bytes[rel_posix] = data
            baseline.file_hashes[norm] = compute_bytes_sha256(data)
            baseline.norm_to_posix[norm] = rel_posix
            baseline.readonly_snapshot_paths.add(norm)
            baseline.protected_readonly_paths.add(norm)

        check_no_file_directory_conflicts(list(baseline.file_bytes.keys()))
        return baseline

    def _assert_no_symlink_in_chain(self, rel_posix: str) -> None:
        curr = self.workspace_root
        for part in rel_posix.split("/"):
            curr = curr / part
            if is_symlink_or_reparse_point(curr):
                raise SymlinkEscapeError(
                    f"Symlink or junction escape rejected in workspace snapshot: '{rel_posix}'"
                )
        try:
            resolved = curr.resolve()
            resolved.relative_to(self.workspace_root)
        except ValueError:
            raise PathTraversalError(
                f"Path resolution escaped workspace root: '{rel_posix}' -> '{resolved}'"
            )


def extract_and_validate_container_tar(tar_bytes: bytes) -> Dict[str, bytes]:
    """
    Parse a tar archive exported from the container's /workspace directory.
    Rejects symlinks, hardlinks, device nodes, path traversal, and case/Unicode collisions.
    Filters out transient runtime caches (__pycache__, .pyc, .pytest_cache).
    """
    exported: Dict[str, bytes] = {}
    seen_collision_keys: Dict[str, str] = {}

    with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:*") as tf:
        for member in tf.getmembers():
            raw_name = member.name
            if raw_name in (".", "./", ""):
                continue

            if member.issym() or member.islnk():
                raise SymlinkEscapeError(
                    f"Container workspace export rejected: symlink/hardlink detected at '{raw_name}' -> '{member.linkname}'"
                )
            if member.isdev() or member.isfifo() or member.ischr() or member.isblk():
                raise SymlinkEscapeError(
                    f"Container workspace export rejected: special device/FIFO file detected at '{raw_name}'"
                )

            rel_posix = validate_safe_relative_posix_path(raw_name)

            if member.isdir():
                continue

            if not member.isfile():
                raise SymlinkEscapeError(f"Unsupported tar member type for '{rel_posix}'")

            if is_transient_runtime_artifact(rel_posix):
                continue

            coll_key = normalize_collision_key(rel_posix)
            if coll_key in seen_collision_keys and seen_collision_keys[coll_key] != rel_posix:
                raise DuplicateNormalizedPathError(
                    f"Duplicate normalized path collision in container export: "
                    f"'{seen_collision_keys[coll_key]}' vs '{rel_posix}'"
                )
            seen_collision_keys[coll_key] = rel_posix

            f_obj = tf.extractfile(member)
            if f_obj is None:
                continue
            exported[rel_posix] = f_obj.read()

    check_no_file_directory_conflicts(list(exported.keys()))
    return exported


def compute_workspace_delta(
    baseline: SnapshotBaseline,
    exported_files: Dict[str, bytes],
) -> WorkspaceDelta:
    """
    Compute exact file deltas (modified, created, deleted, renamed) between
    SnapshotBaseline and exported container workspace files.
    Accurately detects both content-matched renames and Windows case-only renames,
    and rejects duplicate case/Unicode normalized target paths.
    """
    exported_norm_to_posix: Dict[str, str] = {}
    exported_hashes: Dict[str, str] = {}
    exported_bytes_by_posix: Dict[str, bytes] = {}

    for rel_posix, content in exported_files.items():
        clean_posix = validate_safe_relative_posix_path(rel_posix)
        if is_transient_runtime_artifact(clean_posix):
            continue
        norm = normalize_collision_key(clean_posix)
        if norm in exported_norm_to_posix and exported_norm_to_posix[norm] != clean_posix:
            raise DuplicateNormalizedPathError(
                f"Duplicate case-insensitive or Unicode-normalized path in workspace delta: "
                f"'{exported_norm_to_posix[norm]}' vs '{clean_posix}'"
            )
        exported_norm_to_posix[norm] = clean_posix
        exported_hashes[norm] = compute_bytes_sha256(content)
        exported_bytes_by_posix[clean_posix] = content

    check_no_file_directory_conflicts(list(exported_bytes_by_posix.keys()))

    modified: List[str] = []
    created: List[str] = []
    deleted: List[str] = []
    renamed: List[Tuple[str, str]] = []
    new_file_bytes: Dict[str, bytes] = {}

    created_norms: List[str] = []
    deleted_norms: List[str] = []

    for norm, new_hash in exported_hashes.items():
        posix_path = exported_norm_to_posix[norm]
        if norm in baseline.file_hashes:
            orig_posix = baseline.norm_to_posix[norm]
            if posix_path != orig_posix:
                # Case-only rename detected (e.g. src/Foo.py -> src/foo.py)!
                renamed.append((orig_posix, posix_path))
                deleted.append(orig_posix)
                created.append(posix_path)
                new_file_bytes[posix_path] = exported_bytes_by_posix[posix_path]
            elif new_hash != baseline.file_hashes[norm]:
                modified.append(orig_posix)
                new_file_bytes[orig_posix] = exported_bytes_by_posix[posix_path]
        else:
            created_norms.append(norm)

    for norm in baseline.file_hashes:
        if norm not in exported_hashes:
            deleted_norms.append(norm)

    # Detect content-matched renames across distinct normalized paths
    matched_created: Set[str] = set()
    for d_norm in deleted_norms:
        d_hash = baseline.file_hashes[d_norm]
        for c_norm in created_norms:
            if c_norm in matched_created:
                continue
            if exported_hashes[c_norm] == d_hash:
                old_posix = baseline.norm_to_posix[d_norm]
                new_posix = exported_norm_to_posix[c_norm]
                renamed.append((old_posix, new_posix))
                matched_created.add(c_norm)
                break

    for c_norm in created_norms:
        new_posix = exported_norm_to_posix[c_norm]
        created.append(new_posix)
        new_file_bytes[new_posix] = exported_bytes_by_posix[new_posix]

    for d_norm in deleted_norms:
        deleted.append(baseline.norm_to_posix[d_norm])

    return WorkspaceDelta(
        modified=sorted(modified),
        created=sorted(created),
        deleted=sorted(deleted),
        renamed=sorted(renamed),
        new_file_bytes=new_file_bytes,
    )


def validate_delta_authorization(
    delta: WorkspaceDelta,
    authorization: Optional[ObjectiveAuthorization],
) -> None:
    """
    Validate that all proposed file mutations in `delta` comply with `authorization`.
    Fails closed if authorization is missing, mutation is NOT_ALLOWED, a protected or
    secret file is touched, or any path falls outside `authorization.allowed_paths`.
    """
    if authorization is None:
        raise MissingAuthorizationError("ObjectiveAuthorization is required to validate workspace mutations.")

    if not delta.has_changes:
        return

    if authorization.mutation_permission == MutationExpectation.NOT_ALLOWED:
        raise AuthorizationEscalationError(
            f"Objective '{authorization.objective_id}' is authorized as NOT_ALLOWED (read-only), "
            f"but container modified files: {delta.all_affected_paths}"
        )

    for rel_posix in delta.all_affected_paths:
        clean_posix = validate_safe_relative_posix_path(rel_posix)
        if is_protected_from_mutation(clean_posix, authorization):
            raise UnauthorizedPathError(
                f"Protected or secret path '{clean_posix}' cannot be modified, deleted, or synchronized."
            )
        if authorization.allowed_paths:
            if not is_path_authorized(clean_posix, authorization.allowed_paths):
                raise UnauthorizedPathError(
                    f"Out-of-scope file modification rejected: '{clean_posix}' is not within "
                    f"authorized paths {authorization.allowed_paths}."
                )


class DirectSourceSynchronizer:
    """
    Controlled, durably recoverable working-tree synchronizer for Architecture B (Phase 2).
    Enforces:
    - Scope & protected-resource validation
    - Genuine EXECUTED_TRUSTED verification requirement
    - Stale-baseline conflict check (no overwriting concurrent user edits)
    - Durable on-disk preimage transaction journal (.orchestrator_sync_tx) surviving process crashes
    - Idempotent recovery that never destroys post-crash user edits
    - Zero Git staging, commits, or history mutations
    """

    def __init__(
        self,
        workspace_root: Path,
        fault_injector: Optional[Callable[[str], None]] = None,
        crash_injector: Optional[Callable[[str], None]] = None,
        transaction_dir: Optional[Path] = None,
    ):
        self.workspace_root = workspace_root.resolve()
        self.fault_injector = fault_injector
        self.crash_injector = crash_injector
        self.transaction_dir = (transaction_dir or (self.workspace_root / ".orchestrator_sync_tx")).resolve()

    def diagnose_transactions(self) -> List[Dict[str, Any]]:
        """
        Return operator-visible diagnostic records of all synchronization transactions on disk.
        """
        if not self.transaction_dir.is_dir():
            return []
        records: List[Dict[str, Any]] = []
        for entry in sorted(self.transaction_dir.iterdir()):
            manifest_path = entry / "manifest.json"
            if entry.is_dir() and manifest_path.is_file():
                try:
                    data = json.loads(manifest_path.read_text(encoding="utf-8"))
                    records.append(data)
                except Exception as exc:
                    records.append({"tx_id": entry.name, "status": "CORRUPTED", "error": str(exc)})
        return records

    def get_interrupted_transactions(self) -> List[Dict[str, Any]]:
        return [
            tx for tx in self.diagnose_transactions()
            if tx.get("status") in ("PREPARED", "APPLYING", "ROLLBACK_NEEDED", "CORRUPTED")
        ]

    def recover_interrupted_transactions(self) -> List[str]:
        """
        Idempotently recover any interrupted ('PREPARED', 'APPLYING', 'ROLLBACK_NEEDED')
        transactions from their durable on-disk preimage journals without destroying
        concurrent user edits or allowing path traversal escapes.
        """
        if not self.transaction_dir.is_dir():
            return []
        recovered_ids: List[str] = []
        for entry in sorted(self.transaction_dir.iterdir()):
            if is_symlink_or_reparse_point(entry):
                raise SymlinkEscapeError(f"Transaction directory entry '{entry.name}' is a symlink or junction.")
            if not entry.is_dir():
                continue
            manifest_path = entry / "manifest.json"
            if is_symlink_or_reparse_point(manifest_path):
                raise SymlinkEscapeError(f"Transaction manifest '{manifest_path}' is a symlink or junction.")
            if not manifest_path.is_file():
                continue

            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except Exception as exc:
                raise CorruptedTransactionError(
                    f"Damaged transaction manifest in '{entry.name}': {exc}. "
                    "Cannot parse manifest JSON. Operator intervention required; "
                    "do not delete transaction evidence."
                )

            status = manifest.get("status")
            if status == "CORRUPTED":
                raise CorruptedTransactionError(
                    f"Transaction '{entry.name}' is recorded as CORRUPTED: {manifest.get('error')}. "
                    "Operator recovery required."
                )

            if status not in ("PREPARED", "APPLYING", "ROLLBACK_NEEDED"):
                continue

            tx_id = str(manifest.get("tx_id") or entry.name)

            # Case A: Interrupted PREPARED transaction.
            # At 'PREPARED' stage, host files were NEVER touched (status transitions to
            # 'APPLYING' before any deletion or write begins). This is demonstrably safe
            # to cancel idempotently without modifying host files.
            if status == "PREPARED":
                manifest["status"] = "CANCELLED"
                manifest["cancelled_at"] = time.time()
                self._write_manifest_atomic(manifest_path, manifest)
                recovered_ids.append(tx_id)
                continue

            # Case B: Interrupted APPLYING or ROLLBACK_NEEDED transaction.
            affected_paths_raw = manifest.get("affected_paths")
            if not isinstance(affected_paths_raw, list):
                raise CorruptedTransactionError(
                    f"Corrupted transaction '{tx_id}': 'affected_paths' is missing or not a list."
                )

            preimage_hashes = manifest.get("preimage_hashes")
            postimage_hashes = manifest.get("postimage_hashes")
            preimage_files = manifest.get("preimage_files")
            if not isinstance(preimage_hashes, dict) or not isinstance(postimage_hashes, dict) or not isinstance(preimage_files, dict):
                raise CorruptedTransactionError(
                    f"Corrupted transaction '{tx_id}': missing required hash/file mappings."
                )

            # Validate all affected paths strictly for lexical safety, parent-chain symlink/junction freedom, and workspace containment
            clean_paths: List[str] = []
            for raw_p in affected_paths_raw:
                clean_p = validate_safe_relative_posix_path(str(raw_p))
                curr = self.workspace_root
                for part in clean_p.split("/"):
                    curr = curr / part
                    if is_symlink_or_reparse_point(curr):
                        raise SymlinkEscapeError(
                            f"Host path or parent directory in journal '{clean_p}' is a symlink or junction."
                        )
                target = (self.workspace_root / clean_p).resolve()
                if not target.is_relative_to(self.workspace_root):
                    raise PathTraversalError(f"Journal path traversal escape in '{tx_id}': '{raw_p}'")
                clean_paths.append(clean_p)

            # Validate all preimage file references strictly
            raw_preimages_dir = entry / "preimages"
            if raw_preimages_dir.exists() and is_symlink_or_reparse_point(raw_preimages_dir):
                raise SymlinkEscapeError(f"Preimages directory in '{tx_id}' is a symlink or junction.")
            preimages_dir = raw_preimages_dir.resolve()
            if not preimages_dir.is_relative_to(self.transaction_dir):
                raise PathTraversalError(f"Preimages directory escape in '{tx_id}'.")
            for rel_posix, blob_name in preimage_files.items():
                if (
                    not isinstance(blob_name, str)
                    or not re.match(r"^[A-Za-z0-9_.-]+$", blob_name)
                    or blob_name in (".", "..")
                ):
                    raise PathTraversalError(
                        f"Preimage filename escape or invalid character in '{tx_id}': {blob_name!r}"
                    )
                raw_blob = raw_preimages_dir / blob_name
                if is_symlink_or_reparse_point(raw_blob):
                    raise SymlinkEscapeError(f"Preimage file '{blob_name}' in '{tx_id}' is a symlink or junction.")
                blob_path = raw_blob.resolve()
                if not blob_path.is_relative_to(preimages_dir):
                    raise PathTraversalError(f"Preimage path traversal escape in '{tx_id}': '{blob_name}'")

            # Verify preimage integrity before any rollback mutation
            for rel_posix in clean_paths:
                pre_sha = preimage_hashes.get(rel_posix)
                if pre_sha is not None:
                    blob_name = preimage_files.get(rel_posix)
                    if not blob_name:
                        raise CorruptedTransactionError(
                            f"Missing preimage mapping for '{rel_posix}' in transaction '{tx_id}'."
                        )
                    blob_path = preimages_dir / blob_name
                    if not blob_path.is_file():
                        raise CorruptedTransactionError(
                            f"Missing preimage file '{blob_name}' for '{rel_posix}' in transaction '{tx_id}'."
                        )
                    actual_sha = compute_bytes_sha256(blob_path.read_bytes())
                    if actual_sha != pre_sha:
                        raise CorruptedTransactionError(
                            f"Preimage integrity mismatch for '{rel_posix}' in '{tx_id}' (expected {pre_sha}, got {actual_sha})."
                        )

            # First pass: verify no file was modified by the user AFTER the interrupted transaction
            for rel_posix in clean_paths:
                host_path = self.workspace_root / rel_posix
                pre_sha = preimage_hashes.get(rel_posix)
                post_sha = postimage_hashes.get(rel_posix)

                if host_file_exact_case_exists(self.workspace_root, rel_posix):
                    curr_sha = compute_bytes_sha256(host_path.read_bytes())
                    if curr_sha != pre_sha and curr_sha != post_sha:
                        raise StaleBaselineConflictError(
                            f"Transaction recovery aborted for '{tx_id}': file '{rel_posix}' was modified "
                            "concurrently by the user after transaction interruption. Refusing to overwrite user work."
                        )

            # Second pass: restore preimages idempotently.
            # To handle Windows case-only renames cleanly without collisions:
            # 1. Unlink newly created files (pre_sha is None) that match postimage.
            for rel_posix in clean_paths:
                host_path = self.workspace_root / rel_posix
                pre_sha = preimage_hashes.get(rel_posix)
                if pre_sha is None and host_file_exact_case_exists(self.workspace_root, rel_posix):
                    curr_sha = compute_bytes_sha256(host_path.read_bytes())
                    if curr_sha == postimage_hashes.get(rel_posix):
                        host_path.unlink()

            # 2. Restore prior file contents (pre_sha is not None).
            for rel_posix in clean_paths:
                host_path = self.workspace_root / rel_posix
                pre_sha = preimage_hashes.get(rel_posix)
                if pre_sha is not None:
                    exact_exists = host_file_exact_case_exists(self.workspace_root, rel_posix)
                    needs_restore = (not exact_exists) or (
                        compute_bytes_sha256(host_path.read_bytes()) != pre_sha
                    )
                    if needs_restore:
                        blob_name = preimage_files[rel_posix]
                        pre_file = preimages_dir / blob_name
                        orig_bytes = pre_file.read_bytes()
                        self._atomic_write_host_file(rel_posix, orig_bytes)

            manifest["status"] = "ROLLED_BACK"
            manifest["recovered_at"] = time.time()
            self._write_manifest_atomic(manifest_path, manifest)
            recovered_ids.append(tx_id)

        return recovered_ids

    def synchronize(
        self,
        delta: WorkspaceDelta,
        baseline: SnapshotBaseline,
        authorization: Optional[ObjectiveAuthorization],
        verification_result: Optional[VerificationResult] = None,
        require_trusted_verification: bool = True,
    ) -> SyncResult:
        # 0. Refuse synchronization if an unresolved interrupted transaction exists on disk
        interrupted = self.get_interrupted_transactions()
        if interrupted:
            raise SyncTransactionRollbackError(
                f"Synchronization refused: unresolved interrupted transaction(s) present: "
                f"{[t.get('tx_id') for t in interrupted]}. Run recover_interrupted_transactions() first."
            )

        # 1. Validate authorization & path scope
        validate_delta_authorization(delta, authorization)
        assert authorization is not None

        if not delta.has_changes:
            return SyncResult(
                applied=False,
                verification_provenance=(
                    verification_result.provenance if verification_result else VerificationProvenance.UNVERIFIED
                ),
                summary="No source changes to synchronize.",
            )

        # 2. Enforce trusted verification gate before touching working tree
        if require_trusted_verification and authorization.requires_verification:
            if verification_result is None or not verification_result.executed:
                raise UnverifiedSyncError(
                    "Synchronization refused: required verification was not executed."
                )
            if verification_result.provenance == VerificationProvenance.SIMULATED:
                raise UnverifiedSyncError(
                    "Synchronization refused: simulated verification cannot certify direct source promotion."
                )
            if not verification_result.passed or verification_result.provenance != VerificationProvenance.EXECUTED_TRUSTED:
                raise UnverifiedSyncError(
                    f"Synchronization refused: verification did not pass with EXECUTED_TRUSTED provenance "
                    f"(passed={verification_result.passed}, provenance={verification_result.provenance.value})."
                )

        # 3. Verify real working tree still matches captured baseline for all affected files
        self._verify_no_stale_baseline_conflicts(delta, baseline)

        # 4. Write durable on-disk transaction journal & preimages ("PREPARED")
        tx_id = f"tx_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"
        tx_dir = self.transaction_dir / tx_id
        preimages_dir = tx_dir / "preimages"
        preimages_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = tx_dir / "manifest.json"

        preimage_hashes: Dict[str, Optional[str]] = {}
        postimage_hashes: Dict[str, Optional[str]] = {}
        preimage_files: Dict[str, str] = {}
        backup_existing: Dict[str, Optional[bytes]] = {}

        for idx, rel_posix in enumerate(delta.all_affected_paths):
            host_path = self.workspace_root / rel_posix
            if host_file_exact_case_exists(self.workspace_root, rel_posix):
                raw_bytes = host_path.read_bytes()
                backup_existing[rel_posix] = raw_bytes
                preimage_hashes[rel_posix] = compute_bytes_sha256(raw_bytes)
                blob_name = f"file_{idx:04d}.bin"
                preimage_files[rel_posix] = blob_name
                self._write_bytes_fsync(preimages_dir / blob_name, raw_bytes)
            else:
                backup_existing[rel_posix] = None
                preimage_hashes[rel_posix] = None

            if rel_posix in delta.new_file_bytes:
                postimage_hashes[rel_posix] = compute_bytes_sha256(delta.new_file_bytes[rel_posix])
            else:
                postimage_hashes[rel_posix] = None

        manifest: Dict[str, Any] = {
            "tx_id": tx_id,
            "objective_id": authorization.objective_id,
            "status": "PREPARED",
            "created_at": time.time(),
            "affected_paths": delta.all_affected_paths,
            "modified": list(delta.modified),
            "created": list(delta.created),
            "deleted": list(delta.deleted),
            "renamed": [list(r) for r in delta.renamed],
            "preimage_hashes": preimage_hashes,
            "postimage_hashes": postimage_hashes,
            "preimage_files": preimage_files,
        }
        self._write_manifest_atomic(manifest_path, manifest)

        # 5. Transition journal to "APPLYING" and apply changes
        manifest["status"] = "APPLYING"
        self._write_manifest_atomic(manifest_path, manifest)

        try:
            # Apply deletions first (supports case-only renames on Windows NTFS cleanly)
            for rel_posix in delta.deleted:
                if self.crash_injector:
                    self.crash_injector(rel_posix)
                if self.fault_injector:
                    self.fault_injector(rel_posix)
                target = self.workspace_root / rel_posix
                if target.exists():
                    target.unlink()

            # Apply creations and modifications
            for rel_posix in sorted(set(delta.modified + delta.created)):
                if self.crash_injector:
                    self.crash_injector(rel_posix)
                if self.fault_injector:
                    self.fault_injector(rel_posix)
                content = delta.new_file_bytes[rel_posix]
                self._atomic_write_host_file(rel_posix, content)

        except BaseException as exc:
            if isinstance(exc, SystemExit) or getattr(exc, "_simulate_hard_crash", False):
                # Hard process termination simulation: leave journal in APPLYING on disk!
                raise
            manifest["status"] = "ROLLBACK_NEEDED"
            manifest["error"] = str(exc)
            self._write_manifest_atomic(manifest_path, manifest)
            try:
                self._rollback(backup_existing)
            except Exception as rb_exc:
                manifest["rollback_error"] = str(rb_exc)
                self._write_manifest_atomic(manifest_path, manifest)
                raise SyncTransactionRollbackError(
                    f"Synchronization failed and in-process rollback encountered errors (tx={tx_id}, status=ROLLBACK_NEEDED): {exc}; rollback_error={rb_exc}"
                ) from exc
            manifest["status"] = "ROLLED_BACK"
            manifest["rolled_back_at"] = time.time()
            self._write_manifest_atomic(manifest_path, manifest)
            raise SyncTransactionRollbackError(
                f"Synchronization failed and was cleanly rolled back (tx={tx_id}): {exc}"
            ) from exc

        manifest["status"] = "APPLIED"
        manifest["applied_at"] = time.time()
        self._write_manifest_atomic(manifest_path, manifest)

        return SyncResult(
            applied=True,
            transaction_id=tx_id,
            modified_files=list(delta.modified),
            created_files=list(delta.created),
            deleted_files=list(delta.deleted),
            renamed_files=list(delta.renamed),
            verification_provenance=(
                verification_result.provenance if verification_result else VerificationProvenance.UNVERIFIED
            ),
            rolled_back=False,
            summary=(
                f"Synchronized {len(delta.modified)} modified, {len(delta.created)} created, "
                f"{len(delta.deleted)} deleted files to working tree (tx={tx_id}) without Git stage/commit."
            ),
        )

    def _verify_no_stale_baseline_conflicts(
        self,
        delta: WorkspaceDelta,
        baseline: SnapshotBaseline,
    ) -> None:
        deleted_norms = {normalize_collision_key(d) for d in delta.deleted}
        for rel_posix in delta.all_affected_paths:
            clean_posix = validate_safe_relative_posix_path(rel_posix)
            host_path = self.workspace_root / clean_posix
            if is_symlink_or_reparse_point(host_path):
                raise SymlinkEscapeError(f"Host target path '{clean_posix}' is a symlink or junction.")

            # Check parent directories are not files on host
            curr = self.workspace_root
            for part in clean_posix.split("/")[:-1]:
                curr = curr / part
                if is_symlink_or_reparse_point(curr):
                    raise SymlinkEscapeError(f"Host parent directory '{curr}' is a symlink or junction.")
                if curr.is_file():
                    rel_parent = curr.relative_to(self.workspace_root).as_posix()
                    if normalize_collision_key(rel_parent) not in deleted_norms:
                        raise WorkspaceIsolationError(
                            f"File-versus-directory conflict on host: '{rel_parent}' is an existing file."
                        )

            if host_path.is_dir():
                raise WorkspaceIsolationError(
                    f"Destination conflict on host: '{clean_posix}' is an existing directory."
                )

            expected_sha = baseline.sha256_for(clean_posix)
            if expected_sha is not None:
                if not host_path.is_file():
                    raise StaleBaselineConflictError(
                        f"Stale baseline conflict: '{clean_posix}' existed at baseline capture "
                        "but was concurrently removed on the host."
                    )
                current_sha = compute_bytes_sha256(host_path.read_bytes())
                if current_sha != expected_sha:
                    raise StaleBaselineConflictError(
                        f"Stale baseline conflict: '{clean_posix}' was modified on the host "
                        "after snapshot baseline capture. Refusing to overwrite user changes."
                    )
            else:
                if host_path.exists():
                    raise StaleBaselineConflictError(
                        f"Stale baseline conflict: newly created file '{clean_posix}' already appeared "
                        "on the host working tree after baseline capture."
                    )

    def _write_bytes_fsync(self, path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())

    def _write_manifest_atomic(self, manifest_path: Path, data: Dict[str, Any]) -> None:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        raw = json.dumps(data, indent=2).encode("utf-8")
        fd, tmp_p = tempfile.mkstemp(prefix=".manifest_tmp_", dir=str(manifest_path.parent))
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(raw)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_p, str(manifest_path))
        except Exception:
            if os.path.exists(tmp_p):
                try:
                    os.unlink(tmp_p)
                except OSError:
                    pass
            raise

    def _atomic_write_host_file(self, rel_posix: str, content: bytes) -> None:
        target = self.workspace_root / rel_posix
        parent = target.parent
        parent.mkdir(parents=True, exist_ok=True)
        if is_symlink_or_reparse_point(parent) or is_symlink_or_reparse_point(target):
            raise SymlinkEscapeError(f"Refusing to write through symlink at '{rel_posix}'.")

        fd, tmp_path = tempfile.mkstemp(prefix=".sync_tmp_", dir=str(parent))
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(content)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, str(target))
        except Exception:
            if os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
            raise

    def _rollback(self, backup_existing: Dict[str, Optional[bytes]]) -> None:
        rollback_errors: List[str] = []
        # Pass 1: Remove paths whose original preimage was absent (newly created paths),
        # using exact-case existence checks so Windows NTFS never unlinks a case-alias preimage.
        for rel_posix, orig_bytes in backup_existing.items():
            if orig_bytes is None:
                target = self.workspace_root / rel_posix
                try:
                    if host_file_exact_case_exists(self.workspace_root, rel_posix):
                        target.unlink()
                except Exception as exc:
                    rollback_errors.append(f"Failed to unlink '{rel_posix}': {exc}")

        # Pass 2: Restore paths with genuine original preimages, preserving original casing and bytes.
        for rel_posix, orig_bytes in backup_existing.items():
            if orig_bytes is not None:
                try:
                    self._atomic_write_host_file(rel_posix, orig_bytes)
                except Exception as exc:
                    rollback_errors.append(f"Failed to restore '{rel_posix}': {exc}")

        if rollback_errors:
            raise RuntimeError("; ".join(rollback_errors))
