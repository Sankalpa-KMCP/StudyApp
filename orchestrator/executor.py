from typing import Optional
from orchestrator.config import OrchestratorConfig
from orchestrator.hermes_client import HermesClient, HermesResponse

EXECUTOR_WRAPPER_HEADER = """[HERMES AUTONOMOUS EXECUTOR — ROLE: REPOSITORY IMPLEMENTER]
You are the Hermes Executor assigned to complete a bounded engineering objective.
You have access to terminal and file editing tools.

EXECUTION INSTRUCTIONS:
1. Implement the requested changes with minimal, clean diffs.
2. Run relevant tests, builds, and linters via terminal to verify your work.
3. Treat test failures and errors immediately; do not stop until verified.
4. Conclude your final response with:
   END OF RESULT — {correlation_id}
"""

class Executor:
    def __init__(self, config: OrchestratorConfig, client: HermesClient):
        self.config = config
        self.client = client

    def execute_prompt(
        self,
        prompt_id: str,
        prompt_content: str,
    ) -> HermesResponse:
        """Execute the prompt in a fresh Hermes instance with terminal/file tools."""
        header = EXECUTOR_WRAPPER_HEADER.format(correlation_id=prompt_id)
        full_prompt = f"{header}\n\n{prompt_content}\n\nRemember to finish with:\nEND OF RESULT — {prompt_id}"

        resp = self.client.run_query(
            prompt=full_prompt,
            toolsets=self.config.executor_toolsets,
            model=self.config.executor_model,
            timeout=self.config.executor_timeout,
        )
        return resp
