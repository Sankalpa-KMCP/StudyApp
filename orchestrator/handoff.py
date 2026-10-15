import datetime
import json
import os
import shutil
import sys
import tempfile
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Tuple
from orchestrator.schema import ControllerDisposition, format_correlation_id

class CorruptedStateError(Exception):
    """Raised when persisted orchestrator state is damaged, empty, or unparseable."""
    pass

class StateLockError(Exception):
    """Raised when the orchestrator state lock cannot be acquired."""
    pass

class InFlightWorkError(Exception):
    """Raised when an un-reconciled in-flight active prompt is detected on startup."""
    pass

@dataclass
class CompletedTask:
    prompt_id: str
    objective: str
    files_changed: List[str]
    disposition: str
    timestamp: str
    mutation_expectation: str = "REQUIRED"

@dataclass
class OrchestratorPersistentState:
    sequence_number: int = 1
    master_outcome: str = "Implement authorized project features"
    definition_of_done: str = "All tests pass, bundle size within budget, git clean"
    current_sdlc_stage: str = "Implementation"
    consecutive_failures: int = 0
    last_disposition: str = ControllerDisposition.PENDING.value
    completed_tasks: List[Dict[str, Any]] = field(default_factory=list)
    active_prompt_id: Optional[str] = None
    active_objective: Optional[str] = None
    active_mutation_expectation: Optional[str] = None
    active_authorization: Optional[Dict[str, Any]] = None
    current_task_objective: Optional[str] = None
    current_task_authorization: Optional[Dict[str, Any]] = None
    current_task_attempt: int = 1

class HandoffManager:
    def __init__(self, handoff_path: Path, state_path: Path):
        self.handoff_path = Path(handoff_path).resolve()
        self.state_path = Path(state_path).resolve()
        self.backup_path = self.state_path.with_suffix(".json.bak")
        self.lock_path = self.state_path.with_name(f"{self.state_path.name}.lock")

        # In-process reentrancy tracking
        self._lock_thread_ident: Optional[int] = None
        self._lock_depth: int = 0
        self._held_lock_file: Optional[Any] = None
        self._internal_thread_lock = threading.RLock()

    @contextmanager
    def state_lock(self, timeout: float = 5.0) -> Iterator[None]:
        """
        Process-level and reentrant thread-level file lock.
        Protects state operations and full execution lifecycles against concurrent runners.
        Uses msvcrt on Windows and fcntl on POSIX. Reentrant within the same thread.
        """
        current_thread = threading.get_ident()
        with self._internal_thread_lock:
            if self._lock_thread_ident == current_thread and self._lock_depth > 0:
                self._lock_depth += 1
                is_reentrant = True
            else:
                is_reentrant = False

        if is_reentrant:
            try:
                yield
            finally:
                with self._internal_thread_lock:
                    self._lock_depth -= 1
            return

        # Acquire OS-level file lock
        self.lock_path.parent.mkdir(parents=True, exist_ok=True)
        start_time = time.time()
        lock_file = None

        while True:
            try:
                lock_file = open(self.lock_path, "a+b")
                if sys.platform == "win32":
                    import msvcrt
                    lock_file.seek(0)
                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except (IOError, OSError, BlockingIOError):
                if lock_file:
                    try:
                        lock_file.close()
                    except Exception:
                        pass
                    lock_file = None
                if time.time() - start_time >= timeout:
                    raise StateLockError(
                        f"Could not acquire orchestrator state lock at '{self.lock_path}' after {timeout}s. "
                        "Another orchestrator instance may be running."
                    )
                time.sleep(0.05)

        with self._internal_thread_lock:
            self._lock_thread_ident = current_thread
            self._lock_depth = 1
            self._held_lock_file = lock_file

        try:
            yield
        finally:
            with self._internal_thread_lock:
                self._lock_depth -= 1
                if self._lock_depth <= 0:
                    self._lock_depth = 0
                    self._lock_thread_ident = None
                    f_to_close = self._held_lock_file
                    self._held_lock_file = None
                else:
                    f_to_close = None

            if f_to_close:
                try:
                    if sys.platform == "win32":
                        import msvcrt
                        f_to_close.seek(0)
                        msvcrt.locking(f_to_close.fileno(), msvcrt.LK_UNLCK, 1)
                    else:
                        import fcntl
                        fcntl.flock(f_to_close.fileno(), fcntl.LOCK_UN)
                except Exception:
                    pass
                finally:
                    try:
                        f_to_close.close()
                    except Exception:
                        pass

    @contextmanager
    def execution_lifecycle_lock(self, timeout: float = 10.0) -> Iterator[None]:
        """
        Execution-scoped single-writer lock protecting the full lifecycle:
        LOAD -> CLAIM -> PLAN -> DISPATCH -> RECONCILE -> PERSIST.
        Prevents concurrent instances from claiming the same prompt ID or interleaving state.
        """
        with self.state_lock(timeout=timeout):
            yield

    def load_state(self) -> OrchestratorPersistentState:
        """
        Load persistent state.
        Fails closed on corrupted, empty, or invalid state.
        Never silently resets sequence_number to 1 when a damaged file exists.
        """
        if self.state_path.is_file():
            raw_content = ""
            try:
                raw_content = self.state_path.read_text(encoding="utf-8").strip()
            except Exception as e:
                raise CorruptedStateError(
                    f"Failed to read persisted state file at '{self.state_path}': {e}. "
                    "Automatic reset to sequence 1 is prohibited."
                )

            if not raw_content:
                raise CorruptedStateError(
                    f"Persisted state file at '{self.state_path}' is empty (0 bytes). "
                    "Automatic reset to sequence 1 is prohibited."
                )

            try:
                data = json.loads(raw_content)
                if not isinstance(data, dict):
                    raise ValueError("State JSON root must be an object")
                # Filter unknown fields for robust forwards/backwards compatibility
                valid_fields = set(OrchestratorPersistentState.__dataclass_fields__.keys())
                filtered_data = {k: v for k, v in data.items() if k in valid_fields}
                return OrchestratorPersistentState(**filtered_data)
            except Exception as e:
                backup_msg = f" Backup available at '{self.backup_path}'." if self.backup_path.is_file() else " No backup found."
                raise CorruptedStateError(
                    f"Persisted state at '{self.state_path}' is corrupted: {e}.{backup_msg} "
                    "Silently resetting sequence_number to 1 is strictly prohibited."
                )

        return OrchestratorPersistentState()

    def save_state(self, state: OrchestratorPersistentState) -> None:
        """
        Atomically write persistent state using unique temporary sibling file + os.replace.
        Maintains an atomic backup copy (.bak).
        """
        self.state_path.parent.mkdir(parents=True, exist_ok=True)

        state_dict = asdict(state)
        json_data = json.dumps(state_dict, indent=2, ensure_ascii=False)

        with self.state_lock():
            # 1. Create atomic backup of current state if it exists
            if self.state_path.is_file():
                backup_tmp_fd, backup_tmp_str = tempfile.mkstemp(
                    prefix=".backup_tmp_",
                    suffix=".json",
                    dir=str(self.state_path.parent)
                )
                backup_tmp_path = Path(backup_tmp_str)
                try:
                    current_raw = self.state_path.read_text(encoding="utf-8")
                    with os.fdopen(backup_tmp_fd, "w", encoding="utf-8") as bf:
                        bf.write(current_raw)
                        bf.flush()
                        os.fsync(bf.fileno())
                    os.replace(backup_tmp_path, self.backup_path)
                except Exception:
                    if backup_tmp_path.exists():
                        try:
                            backup_tmp_path.unlink()
                        except Exception:
                            pass

            # 2. Write new state to unique sibling temporary file
            tmp_fd, tmp_path_str = tempfile.mkstemp(
                prefix=".state_tmp_",
                suffix=".json",
                dir=str(self.state_path.parent)
            )
            tmp_path = Path(tmp_path_str)

            try:
                with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
                    f.write(json_data)
                    f.flush()
                    os.fsync(f.fileno())

                # 3. Atomically replace destination
                os.replace(tmp_path, self.state_path)
            except Exception:
                if tmp_path.exists():
                    try:
                        tmp_path.unlink()
                    except Exception:
                        pass
                raise

    def diagnose_state(self) -> Dict[str, Any]:
        """
        Read-only diagnostic inspection of primary state and backup files.
        Never mutates any files.
        """
        diag: Dict[str, Any] = {
            "state_path": str(self.state_path),
            "state_exists": self.state_path.is_file(),
            "state_valid": False,
            "backup_path": str(self.backup_path),
            "backup_exists": self.backup_path.is_file(),
            "backup_valid": False,
            "has_in_flight_work": False,
            "active_prompt_id": None,
            "error": None,
            "recovery_disposition": "UNKNOWN"
        }

        # Check primary state
        if self.state_path.is_file():
            try:
                raw = self.state_path.read_text(encoding="utf-8").strip()
                if raw:
                    data = json.loads(raw)
                    if isinstance(data, dict):
                        diag["state_valid"] = True
                        diag["active_prompt_id"] = data.get("active_prompt_id")
                        if data.get("active_prompt_id"):
                            diag["has_in_flight_work"] = True
            except Exception as e:
                diag["error"] = f"Primary state parse error: {str(e)}"

        # Check backup
        if self.backup_path.is_file():
            try:
                b_raw = self.backup_path.read_text(encoding="utf-8").strip()
                if b_raw:
                    b_data = json.loads(b_raw)
                    if isinstance(b_data, dict):
                        diag["backup_valid"] = True
            except Exception:
                pass

        # Evaluate disposition
        if diag["state_valid"]:
            if diag["has_in_flight_work"]:
                diag["recovery_disposition"] = "UNRESOLVED_IN_FLIGHT"
            else:
                diag["recovery_disposition"] = "CLEAN_VALID"
        elif self.state_path.is_file():
            if diag["backup_valid"]:
                diag["recovery_disposition"] = "CORRUPT_WITH_VALID_BACKUP"
            else:
                diag["recovery_disposition"] = "CORRUPT_NO_BACKUP"
        else:
            diag["recovery_disposition"] = "MISSING"

        return diag

    def write_handoff_doc(
        self,
        state: OrchestratorPersistentState,
        git_branch: str = "master",
        git_head: str = "HEAD",
        working_tree: str = "Clean",
        latest_validation: str = "Tests executed",
        next_action_summary: str = "Awaiting next bounded objective",
    ) -> None:
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        completed_md = ""
        for task in state.completed_tasks[-10:]:
            files_str = ", ".join(task.get("files_changed", [])) or "None"
            completed_md += f"""- **{task.get('prompt_id')}**: {task.get('objective')}
  - Disposition: `{task.get('disposition')}`
  - Mutation Expectation: `{task.get('mutation_expectation', 'REQUIRED')}`
  - Files: `{files_str}`
  - Completed: {task.get('timestamp')}
"""

        doc = f"""# AI Session Handoff — Dual-Hermes Autonomous Orchestrator

## 1. Handoff Header

- **Project:** Study Dashboard
- **Controller:** Hermes (Tech Lead Mode)
- **Executor:** Hermes (Implementer Mode)
- **Date/Time:** {now_str}
- **Current SDLC Stage:** {state.current_sdlc_stage}
- **Active Prompt ID:** {state.active_prompt_id or format_correlation_id(state.sequence_number)}
- **Last Controller Disposition:** `{state.last_disposition}`
- **Consecutive Failures:** {state.consecutive_failures}
- **Active Mutation Expectation:** `{state.active_mutation_expectation or 'UNSPECIFIED'}`

---

## 2. Master Outcome

- **Master Outcome:** {state.master_outcome}
- **Definition of Done:** {state.definition_of_done}

---

## 3. Current Authorization

- **Source edits:** ALLOWED (Bounded strictly to active objective)
- **Git stage / commit:** NOT ALLOWED (Requires separate operator authorization)
- **Push / History rewrite:** NOT ALLOWED

---

## 4. Repository State

- **Branch:** {git_branch}
- **HEAD:** {git_head}
- **Working tree:** {working_tree}

---

## 5. Completed Work

{completed_md or "No tasks completed yet."}

---

## 6. Current In-Scope Objective

- **Prompt ID:** {state.active_prompt_id or format_correlation_id(state.sequence_number)}
- **Objective:** {state.active_objective or "Formulating next bounded objective"}
- **Mutation Expectation:** {state.active_mutation_expectation or "UNSPECIFIED"}

---

## 7. Latest Validation Evidence

{latest_validation}

---

## 8. Exact Next Safest Action

{next_action_summary}
"""
        tmp_fd, tmp_path_str = tempfile.mkstemp(
            prefix=".handoff_tmp_",
            suffix=".md",
            dir=str(self.handoff_path.parent)
        )
        tmp_path = Path(tmp_path_str)
        try:
            with os.fdopen(tmp_fd, "w", encoding="utf-8") as f:
                f.write(doc)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, self.handoff_path)
        except Exception:
            if tmp_path.exists():
                try:
                    tmp_path.unlink()
                except Exception:
                    pass
            raise
