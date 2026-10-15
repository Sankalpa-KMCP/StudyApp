from abc import ABC, abstractmethod
from enum import Enum
from typing import Callable, Dict, List, Optional
from orchestrator.hermes_client import HermesResponse

class BackendRuntimeType(str, Enum):
    UNAVAILABLE = "UNAVAILABLE"
    TEST_SIMULATED = "TEST_SIMULATED"
    CERTIFIED_CONTAINER = "CERTIFIED_CONTAINER"
    CERTIFIED_VM = "CERTIFIED_VM"

class ExecutionBackendNotAvailableError(Exception):
    """Raised when execution is attempted without a certified execution backend."""
    pass

class ExecutionBackend(ABC):
    """
    Abstract contract representing an execution backend.
    Decouples the orchestrator control plane from host-local CLI execution.
    Guarantees that a configuration boolean alone cannot authorize host execution.
    """

    @property
    @abstractmethod
    def runtime_type(self) -> BackendRuntimeType:
        """Return the runtime type of this execution backend."""
        pass

    @property
    @abstractmethod
    def is_certified_isolated(self) -> bool:
        """
        Return True ONLY if this backend genuinely enforces OS-level filesystem,
        network, and credential isolation (e.g. isolated container or microVM).
        """
        pass

    @abstractmethod
    def execute(
        self,
        prompt: str,
        toolsets: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 600,
    ) -> HermesResponse:
        """Execute a prompt within the backend's isolation boundary."""
        pass

class UnavailableExecutionBackend(ExecutionBackend):
    """
    Default fail-closed execution backend.
    Permanently refuses host-local --yolo execution when no isolated sandbox exists.
    """

    @property
    def runtime_type(self) -> BackendRuntimeType:
        return BackendRuntimeType.UNAVAILABLE

    @property
    def is_certified_isolated(self) -> bool:
        return False

    def execute(
        self,
        prompt: str,
        toolsets: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 600,
    ) -> HermesResponse:
        raise ExecutionBackendNotAvailableError(
            "No certified execution backend is available. Host-local --yolo execution "
            "is prohibited. A certified container or VM backend must be provisioned."
        )

class TestSimulatedBackend(ExecutionBackend):
    """
    Test-only execution backend for explicit dependency injection in test fixtures.
    Executes mock or simulated responses without invoking any host-local subprocess.
    """

    def __init__(self, response_handler: Optional[Callable[[str], HermesResponse]] = None):
        self.response_handler = response_handler or (lambda p: HermesResponse(
            stdout="[TestSimulatedBackend] Executed\nEND OF RESULT — PROMPT #001",
            stderr="",
            exit_code=0,
            session_id="test_sim",
            clean_text="[TestSimulatedBackend] Executed\nEND OF RESULT — PROMPT #001",
        ))
        self.recorded_executions: List[Dict[str, str]] = []

    @property
    def runtime_type(self) -> BackendRuntimeType:
        return BackendRuntimeType.TEST_SIMULATED

    @property
    def is_certified_isolated(self) -> bool:
        # False for production; test fixtures explicitly recognize TEST_SIMULATED
        return False

    def execute(
        self,
        prompt: str,
        toolsets: Optional[str] = None,
        model: Optional[str] = None,
        timeout: int = 600,
    ) -> HermesResponse:
        self.recorded_executions.append({
            "prompt": prompt,
            "toolsets": toolsets or "",
            "model": model or "",
        })
        return self.response_handler(prompt)
