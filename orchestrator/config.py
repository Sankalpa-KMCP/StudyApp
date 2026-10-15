import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

NO_TOOLS_SENTINEL: str = "none"

@dataclass
class OrchestratorConfig:
    workspace_root: Path = field(default_factory=lambda: Path(os.getcwd()).resolve())
    controller_model: Optional[str] = None
    executor_model: Optional[str] = None
    # Controller inference is strictly tool-free. Explicit installed-runtime sentinel 'none'
    # resolves to exactly 0 tools. An empty string evaluates to falsy and activates default tools.
    controller_toolsets: str = NO_TOOLS_SENTINEL
    executor_toolsets: str = "terminal,file"
    controller_timeout: int = 180
    executor_timeout: int = 600
    max_consecutive_failures: int = 3
    max_iterations: int = 50
    git_autocommit: bool = False
    handoff_filename: str = "ORCHESTRATOR_HANDOFF.md"
    state_filename: str = ".orchestrator_state.json"
    log_dirname: str = ".orchestrator_logs"
    hermes_bin: str = "hermes"

    # Control-Plane Security & Integrity Controls
    # DEPRECATED: A boolean alone cannot authorize execution.
    certified_sandbox_backend: bool = False
    strict_authorization_required: bool = True  # Strict operator authorization by default
    allowed_mutation_paths: List[str] = field(default_factory=list)

    def __post_init__(self):
        # Validate that controller_toolsets is strictly tool-free
        if self.controller_toolsets is not None:
            cleaned = self.controller_toolsets.strip().lower()
            if cleaned and cleaned != NO_TOOLS_SENTINEL:
                raise ValueError(
                    f"Contradictory security configuration: controller_toolsets cannot be '{self.controller_toolsets}'. "
                    f"Controller execution is strictly tool-free ({NO_TOOLS_SENTINEL!r})."
                )

    @property
    def handoff_path(self) -> Path:
        return self.workspace_root / self.handoff_filename

    @property
    def state_path(self) -> Path:
        return self.workspace_root / self.state_filename

    @property
    def log_dir(self) -> Path:
        p = self.workspace_root / self.log_dirname
        p.mkdir(parents=True, exist_ok=True)
        return p

    def is_executor_backend_certified(self) -> bool:
        """
        DEPRECATED & PERMANENTLY DISABLED.
        A configuration boolean alone must never manufacture backend certification.
        True backend certification requires an injected ExecutionBackend with runtime isolation.
        """
        return False
