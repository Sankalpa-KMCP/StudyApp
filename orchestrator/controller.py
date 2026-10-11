import json
import re
from typing import Dict, List, Optional, Tuple
from orchestrator.config import OrchestratorConfig
from orchestrator.hermes_client import HermesClient, HermesResponse
from orchestrator.schema import (
    ControllerDisposition,
    ControllerResult,
    format_correlation_id,
)

CONTROLLER_SYSTEM_PROMPT = """You are the Hermes Project Controller and Technical Lead, operating under AI Coding Orchestrator V8.1.
Your role is to govern project scope, maintain the master outcome, dispatch bounded objectives to the Hermes Executor, reconcile observable evidence, and decide next actions.

STRICT PRINCIPLES:
1. You NEVER edit code files directly. Code execution and editing belong exclusively to the Executor.
2. One meaningful bounded objective per dispatch (e.g. implement a complete subcomponent, fix a specific bug class, add tests and verify). Do NOT dispatch microscopic single-command tasks.
3. Every dispatch must be correlated: begins with PROMPT #<number> and expects END OF RESULT — PROMPT #<number>.
4. Reconcile observable evidence from real test runs and diffs. Executor claims are hypotheses until backed by tool outputs.
5. Dispositions are strictly: PASS, PARTIAL, BLOCKED, FAIL.
   - PASS: Objective verified with clean test/diff evidence. Ready to commit.
   - PARTIAL: Progress made but incomplete or secondary tests need repair.
   - FAIL: Objective failed, tests broken, or regressions introduced.
   - BLOCKED: Critical blocker or decision gate required from user.
"""

class Controller:
    def __init__(self, config: OrchestratorConfig, client: HermesClient):
        self.config = config
        self.client = client

    def formulate_next_prompt(
        self,
        sequence_number: int,
        master_outcome: str,
        definition_of_done: str,
        handoff_content: str,
        git_diff: str,
        previous_failure_context: Optional[str] = None,
    ) -> Tuple[str, str]:
        """Formulate the next bounded prompt for the executor.

        Returns (prompt_id, prompt_text).
        """
        prompt_id = format_correlation_id(sequence_number)

        planning_request = f"""{CONTROLLER_SYSTEM_PROMPT}

CURRENT STATE:
- Master Outcome: {master_outcome}
- Definition of Done: {definition_of_done}
- Next Correlation ID: {prompt_id}

ORCHESTRATOR HANDOFF SUMMARY:
\"\"\"
{handoff_content[:3000]}
\"\"\"

GIT RECENT DIFF:
\"\"\"
{git_diff[:2000] if git_diff else "Clean working directory"}
\"\"\"
"""
        if previous_failure_context:
            planning_request += f"""
PREVIOUS DISPATCH FAILED/PARTIAL:
\"\"\"
{previous_failure_context[:3000]}
\"\"\"
Formulate a TARGETED REPAIR prompt to fix the issues identified above.
"""
        else:
            planning_request += """
Formulate the NEXT MEANINGFUL BOUNDED OBJECTIVE toward achieving the Master Outcome.
"""

        planning_request += f"""
TASK:
Emit the dispatch prompt for the Hermes Executor.
It MUST start with `{prompt_id}`.
It must include:
1. Objective & Scope
2. Constraints (preserve invariants, do not break existing tests)
3. Decisive Verification Required (exact test/build commands to run)
4. Instruction: Conclude your result with `END OF RESULT — {prompt_id}`.

Format your output as:
=== OBJECTIVE_TITLE ===
<One sentence title of the objective>
=== EXECUTOR_PROMPT ===
{prompt_id}
...
"""

        resp = self.client.run_query(
            prompt=planning_request,
            toolsets=self.config.controller_toolsets,
            model=self.config.controller_model,
            timeout=self.config.controller_timeout,
        )

        text = resp.clean_text

        # Extract title and prompt
        title = "Execute bounded objective"
        prompt_text = text

        title_match = re.search(r"=== OBJECTIVE_TITLE ===\s*\n(.*?)\n===", text, re.DOTALL)
        if title_match:
            title = title_match.group(1).strip()

        body_match = re.search(r"=== EXECUTOR_PROMPT ===\s*\n([\s\S]+)", text)
        if body_match:
            prompt_text = body_match.group(1).strip()
        else:
            # Fallback: ensure prompt starts with prompt_id
            if not prompt_text.startswith(prompt_id):
                prompt_text = f"{prompt_id}\n\n{prompt_text}"

        return title, prompt_text

    def reconcile_result(
        self,
        prompt_id: str,
        objective: str,
        executor_output: str,
        git_diff_stat: str,
    ) -> ControllerResult:
        """Reconcile the executor's output against CONTROLLER_RESULT_SCHEMA.json rules."""
        reconcile_request = f"""{CONTROLLER_SYSTEM_PROMPT}

RECONCILIATION TASK:
Evaluate the executor result for {prompt_id}.

OBJECTIVE:
{objective}

EXECUTOR OUTPUT:
\"\"\"
{executor_output[-4000:] if len(executor_output) > 4000 else executor_output}
\"\"\"

GIT CHANGES:
\"\"\"
{git_diff_stat or "No git changes recorded"}
\"\"\"

Evaluate the evidence and return a JSON object adhering to this schema:
{{
  "schema_version": "8.1",
  "correlation_id": "{prompt_id}",
  "executor": "hermes-executor",
  "workflow": "direct_parent",
  "objective": "{objective}",
  "native_status": "COMPLETED",
  "controller_disposition": "PASS | PARTIAL | FAIL | BLOCKED",
  "mutations": {{
    "files_changed": [],
    "git_mutation": true,
    "unexpected_deltas": []
  }},
  "validation": [
    {{
      "kind": "test | lint | build | inspection",
      "executed": true,
      "result": "PASS | FAIL | SKIPPED",
      "command_or_check": "command run"
    }}
  ],
  "evidence": [
    {{
      "label": "VERIFIED | REPORTED | INFERRED",
      "summary": "Evidence finding"
    }}
  ],
  "findings": [],
  "limitations": [],
  "next_action": {{
    "route": "direct_parent",
    "objective": "Next recommended step"
  }}
}}

CRITICAL RULES:
- If all required tests ran and passed without regressions, set controller_disposition = "PASS".
- If tests failed, compilation failed, or code has unverified claims, set controller_disposition = "FAIL" or "PARTIAL".
- Respond with ONLY the raw JSON block.
"""

        resp = self.client.run_query(
            prompt=reconcile_request,
            toolsets=self.config.controller_toolsets,
            model=self.config.controller_model,
            timeout=self.config.controller_timeout,
        )

        clean = resp.clean_text
        # Extract JSON block
        json_match = re.search(r"(\{[\s\S]*\})", clean)
        if json_match:
            try:
                data = json.loads(json_match.group(1))
                return ControllerResult.from_dict(data)
            except Exception:
                pass

        # Fallback heuristic if JSON parsing fails
        disposition = ControllerDisposition.FAIL
        if "PASS" in clean and "FAIL" not in clean:
            disposition = ControllerDisposition.PASS
        elif "PARTIAL" in clean:
            disposition = ControllerDisposition.PARTIAL
        elif "BLOCKED" in clean:
            disposition = ControllerDisposition.BLOCKED

        return ControllerResult(
            correlation_id=prompt_id,
            objective=objective,
            controller_disposition=disposition,
            limitations=["Fallback parsing applied for controller reconciliation."],
        )
