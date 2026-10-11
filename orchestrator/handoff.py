import datetime
import json
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any, Dict, List, Optional
from orchestrator.schema import ControllerDisposition, format_correlation_id

@dataclass
class CompletedTask:
    prompt_id: str
    objective: str
    files_changed: List[str]
    disposition: str
    timestamp: str

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

class HandoffManager:
    def __init__(self, handoff_path: Path, state_path: Path):
        self.handoff_path = handoff_path
        self.state_path = state_path

    def load_state(self) -> OrchestratorPersistentState:
        if self.state_path.is_file():
            try:
                data = json.loads(self.state_path.read_text(encoding="utf-8"))
                return OrchestratorPersistentState(**data)
            except Exception:
                pass
        return OrchestratorPersistentState()

    def save_state(self, state: OrchestratorPersistentState) -> None:
        self.state_path.write_text(
            json.dumps(asdict(state), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

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

---

## 2. Master Outcome

- **Master Outcome:** {state.master_outcome}
- **Definition of Done:** {state.definition_of_done}

---

## 3. Current Authorization

- **Source edits:** ALLOWED (Bounded to current active prompt)
- **Git stage:** ALLOWED on verified pass
- **Commit:** ALLOWED with prefix `[verified]` on controller PASS
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

---

## 7. Latest Validation Evidence

{latest_validation}

---

## 8. Exact Next Safest Action

{next_action_summary}
"""
        self.handoff_path.write_text(doc, encoding="utf-8")
