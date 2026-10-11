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
        found_id = extract_end_correlation_id(executor_output)
        if not found_id:
            return (
                False,
                f"Missing correlation marker in executor output. Expected 'END OF RESULT — {expected_prompt_id}'.",
            )
        if found_id.upper() != expected_prompt_id.upper():
            return (
                False,
                f"Correlation mismatch: Expected '{expected_prompt_id}' but executor concluded with '{found_id}'.",
            )
        return (True, None)
