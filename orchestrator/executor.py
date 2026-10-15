import inspect
import re
from typing import Optional
from orchestrator.config import OrchestratorConfig
from orchestrator.execution_backend import (
    BackendRuntimeType,
    ExecutionBackend,
    ExecutionBackendNotAvailableError,
    UnavailableExecutionBackend,
)
from orchestrator.hermes_client import HermesClient, HermesResponse
from orchestrator.schema import ObjectiveAuthorization, TrustedVerificationPlan

CORRELATION_ID_PATTERN = re.compile(r"^PROMPT\s*#\d+$", re.IGNORECASE)

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

class FormattedExecutorPrompt(str):
    """
    Explicit trusted provenance contract representing an already canonically
    formatted executor prompt. Guarantees that the top-level wrapper was generated
    by the trusted orchestrator control plane for a specific correlation ID.
    """
    correlation_id: str

    def __new__(cls, content: str, correlation_id: str):
        obj = str.__new__(cls, content)
        obj.correlation_id = correlation_id
        return obj

def validate_canonical_envelope(content: str, expected_correlation_id: str) -> None:
    """
    Validate that content strictly conforms to the canonical executor envelope
    for expected_correlation_id.
    Enforces:
    - Exactly begins with EXECUTOR_WRAPPER_HEADER.format(correlation_id=expected_correlation_id).strip()
    - Exactly ends with f"Remember to finish with:\nEND OF RESULT — {expected_correlation_id}"
    - Contains a non-empty instruction body between header and trailer
    - Header correlation ID and closing directive correlation ID both match expected_correlation_id
    """
    clean_id = expected_correlation_id.strip()
    expected_header = EXECUTOR_WRAPPER_HEADER.format(correlation_id=clean_id).strip()
    expected_trailer = f"Remember to finish with:\nEND OF RESULT — {clean_id}"

    text = (content or "").strip()
    if not text:
        raise ValueError("Formatted prompt cannot be empty or whitespace.")

    if not text.startswith(expected_header):
        if text.startswith("[HERMES AUTONOMOUS EXECUTOR"):
            raise ValueError(
                f"Header correlation mismatch or forged header in preformatted prompt. "
                f"Expected header for '{clean_id}'."
            )
        raise ValueError(
            f"Preformatted prompt is missing the canonical executor header for '{clean_id}'."
        )

    if not text.endswith(expected_trailer):
        raise ValueError(
            f"Preformatted prompt is missing the canonical closing directive for '{clean_id}'."
        )

    body = text[len(expected_header):-len(expected_trailer)].strip()
    if not body:
        raise ValueError("Preformatted prompt contains an empty instruction body.")

class Executor:
    """
    Executor component that formats executor prompts and delegates execution
    exclusively to a validated ExecutionBackend instance.
    Host-local execution without an isolated backend is permanently prohibited.
    """
    def __init__(
        self,
        config: OrchestratorConfig,
        backend: Optional[ExecutionBackend] = None,
        client: Optional[HermesClient] = None,
    ):
        self.config = config
        self.backend = backend or UnavailableExecutionBackend()
        self._deprecated_client = client

    def format_prompt(self, prompt_id: str, prompt_content: str) -> FormattedExecutorPrompt:
        """
        Format the raw prompt body with the standard executor envelope and correlation.
        Preserves the prompt ID, authorized instructions, and required result contract.

        Security guarantees:
        - prompt_id must match 'PROMPT #NNN'.
        - If prompt_content is already a FormattedExecutorPrompt:
          - If its correlation_id matches prompt_id, returns it (idempotent).
          - If its correlation_id differs, raises ValueError (stale/conflicting ID rejected).
        - If prompt_content is an untrusted plain string:
          - If it attempts to supply a top-level wrapper ('[HERMES AUTONOMOUS EXECUTOR'),
            raises ValueError (untrusted spoofed wrapper rejected).
          - Appends the authoritative role header and appends the terminal directive unconditionally.
        """
        if not prompt_id or not isinstance(prompt_id, str):
            raise ValueError(f"Invalid correlation ID: prompt_id must be a non-empty string, got {prompt_id!r}.")

        clean_id = prompt_id.strip()
        if not CORRELATION_ID_PATTERN.match(clean_id):
            raise ValueError(f"Malformed correlation ID '{prompt_id}'. Expected format 'PROMPT #NNN'.")

        if prompt_content is None or not str(prompt_content).strip():
            raise ValueError("Prompt content cannot be empty or whitespace.")

        # If already formatted with trusted provenance:
        if isinstance(prompt_content, FormattedExecutorPrompt):
            if prompt_content.correlation_id.upper() != clean_id.upper():
                raise ValueError(
                    f"Stale correlation ID conflict: preformatted prompt was created for "
                    f"'{prompt_content.correlation_id}', but caller requested '{clean_id}'. "
                    "Reusing prewrapped prompts across different correlation IDs is prohibited."
                )
            validate_canonical_envelope(str(prompt_content), clean_id)
            return prompt_content

        # Untrusted raw content check:
        raw_text = str(prompt_content).strip()
        if raw_text.startswith("[HERMES AUTONOMOUS EXECUTOR"):
            raise ValueError(
                "Untrusted raw prompt body cannot supply top-level '[HERMES AUTONOMOUS EXECUTOR' wrapper. "
                "Executor role envelopes are controller-owned metadata and must not be supplied by model output."
            )

        header = EXECUTOR_WRAPPER_HEADER.format(correlation_id=clean_id).strip()
        trailer = f"Remember to finish with:\nEND OF RESULT — {clean_id}"

        # Canonical unconditional assembly
        full_text = f"{header}\n\n{raw_text}\n\n{trailer}"
        return FormattedExecutorPrompt(full_text, correlation_id=clean_id)

    def execute_prompt(
        self,
        prompt_id: str,
        prompt_content: str,
        authorization: Optional[ObjectiveAuthorization] = None,
        verification_plan: Optional[TrustedVerificationPlan] = None,
    ) -> HermesResponse:
        """
        Execute the prompt within the bound backend's isolation boundary.
        Fails closed if the backend is unavailable or uncertified.
        Never falls back to unrestricted host execution.
        """
        if not self.backend:
            raise ExecutionBackendNotAvailableError(
                "Executor dispatch failed: No execution backend is bound. "
                "Host-local execution is prohibited."
            )

        is_allowed = self.backend.is_certified_isolated or (
            getattr(self.backend, "runtime_type", None) == BackendRuntimeType.TEST_SIMULATED
        )
        if not is_allowed:
            raise ExecutionBackendNotAvailableError(
                f"Executor dispatch failed: Bound backend '{self.backend.runtime_type.value}' "
                "is not certified isolated. Host-local execution is permanently prohibited."
            )

        full_prompt = self.format_prompt(prompt_id, prompt_content)

        sig = inspect.signature(self.backend.execute)
        kwargs = {
            "prompt": full_prompt,
            "toolsets": self.config.executor_toolsets,
            "model": self.config.executor_model,
            "timeout": self.config.executor_timeout,
        }
        if "authorization" in sig.parameters:
            kwargs["authorization"] = authorization
        if "verification_plan" in sig.parameters:
            kwargs["verification_plan"] = verification_plan

        return self.backend.execute(**kwargs)
