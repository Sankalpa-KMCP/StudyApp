import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

@dataclass
class OrchestratorConfig:
    workspace_root: Path = field(default_factory=lambda: Path(os.getcwd()).resolve())
    controller_model: Optional[str] = None
    executor_model: Optional[str] = None
    controller_toolsets: str = "terminal"
    executor_toolsets: str = "terminal,file"
    controller_timeout: int = 180
    executor_timeout: int = 600
    max_consecutive_failures: int = 3
    max_iterations: int = 50
    git_autocommit: bool = True
    handoff_filename: str = "ORCHESTRATOR_HANDOFF.md"
    state_filename: str = ".orchestrator_state.json"
    log_dirname: str = ".orchestrator_logs"
    hermes_bin: str = "hermes"

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
