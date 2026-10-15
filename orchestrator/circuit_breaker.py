import re
from dataclasses import dataclass
from typing import Optional, Tuple
from orchestrator.schema import extract_end_correlation_id

@dataclass
class CircuitBreakerStatus:
    is_blocked: bool
    reason: Optional[str] = None

class CircuitBreaker:
    def __init__(self, max_consecutive_failures: int = 3):
        self.max_consecutive_failures = max_consecutive_failures

    def check(self, consecutive_failures: int) -> CircuitBreakerStatus:
        if consecutive_failures >= self.max_consecutive_failures:
            return CircuitBreakerStatus(
                is_blocked=True,
                reason=(
                    f"Circuit breaker tripped: {consecutive_failures} consecutive failures "
                    f"reached the threshold of {self.max_consecutive_failures}. "
                    "Halting to prevent token burn and infinite loop. Manual review required."
                ),
            )
        return CircuitBreakerStatus(is_blocked=False)

    def verify_correlation(
        self, expected_prompt_id: str, executor_output: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Verify that executor_output concludes with a valid, authenticated, standalone
        terminal correlation marker matching expected_prompt_id.
        Fails closed on missing, embedded, quoted, fenced, duplicated, or mismatched markers.
        """
        if not executor_output or not isinstance(executor_output, str):
            return (False, f"Executor output is empty or non-string; expected terminal marker for '{expected_prompt_id}'.")

        found_id = extract_end_correlation_id(executor_output)
        if not found_id:
            # Provide actionable diagnostic reason without accepting invalid placement
            marker_pattern = re.compile(r"END OF RESULT\s*[-—:]*\s*PROMPT\s*#\d+", re.IGNORECASE)
            matches = marker_pattern.findall(executor_output)
            if len(matches) > 1:
                return (
                    False,
                    f"Invalid correlation marker: output contains {len(matches)} competing correlation markers. "
                    f"Expected exactly one standalone terminal line 'END OF RESULT — {expected_prompt_id}' at the end.",
                )
            elif len(matches) == 1:
                return (
                    False,
                    f"Invalid correlation marker placement: marker '{matches[0]}' is embedded, quoted, inside code fences, "
                    f"or followed by trailing output. Expected standalone terminal line 'END OF RESULT — {expected_prompt_id}'.",
                )
            else:
                return (
                    False,
                    f"Missing correlation marker in executor output. Expected terminal line 'END OF RESULT — {expected_prompt_id}'.",
                )

        if found_id.upper() != expected_prompt_id.upper():
            return (
                False,
                f"Correlation mismatch: Expected '{expected_prompt_id}' but executor concluded with '{found_id}'.",
            )

        return (True, None)
