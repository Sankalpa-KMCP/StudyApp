import os
import shlex
import subprocess
import sys
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, List, Optional
from orchestrator.schema import TrustedVerificationPlan, VerificationProvenance, VerificationResult

class VerificationAdapter(ABC):
    """Abstract interface for independent verification backends."""

    @abstractmethod
    def verify(self, objective_id: str, plan: TrustedVerificationPlan) -> VerificationResult:
        """Execute or corroborate verified acceptance criteria."""
        pass

class DeterministicVerificationAdapter(VerificationAdapter):
    """
    Deterministic verification adapter for test suites, CI fixtures, and simulated environments.
    Requires explicit registration for simulated results.
    Never implicitly returns passing verification for an unknown objective.
    All simulated outcomes are explicitly labeled with VerificationProvenance.SIMULATED.
    """
    def __init__(self, simulated_results: Optional[Dict[str, VerificationResult]] = None):
        self.simulated_results: Dict[str, VerificationResult] = simulated_results or {}
        self.default_result: Optional[VerificationResult] = None

    def set_default(self, result: VerificationResult) -> None:
        if result.provenance == VerificationProvenance.UNVERIFIED:
            result.provenance = VerificationProvenance.SIMULATED
        self.default_result = result

    def register(self, objective_id: str, result: VerificationResult) -> None:
        if result.provenance == VerificationProvenance.UNVERIFIED:
            result.provenance = VerificationProvenance.SIMULATED
        self.simulated_results[objective_id] = result

    def verify(self, objective_id: str, plan: TrustedVerificationPlan) -> VerificationResult:
        if objective_id in self.simulated_results:
            res = self.simulated_results[objective_id]
            if res.provenance == VerificationProvenance.UNVERIFIED:
                res.provenance = VerificationProvenance.SIMULATED
            return res

        if self.default_result is not None:
            res = self.default_result
            if res.provenance == VerificationProvenance.UNVERIFIED:
                res.provenance = VerificationProvenance.SIMULATED
            return res

        # Fail closed: No implicit passing verification for unconfigured objectives!
        return VerificationResult(
            executed=False,
            passed=False,
            exit_status=-1,
            provenance=VerificationProvenance.UNVERIFIED,
            command=plan.command,
            limitations=[
                f"No simulated verification fixture registered for '{objective_id}'. "
                "Implicit passing fallbacks are strictly prohibited."
            ],
        )

class SubprocessVerificationAdapter(VerificationAdapter):
    """
    Controller-owned subprocess verification adapter.
    Executes authorized verification commands strictly without shell=True,
    using validated argv lists.
    """
    def __init__(self, workspace_root: Path, allow_host_execution: bool = False):
        self.workspace_root = workspace_root.resolve()
        self.allow_host_execution = allow_host_execution

    def verify(self, objective_id: str, plan: TrustedVerificationPlan) -> VerificationResult:
        if not self.allow_host_execution and not plan.allowed_to_run_host:
            return VerificationResult(
                executed=False,
                passed=False,
                exit_status=126,
                provenance=VerificationProvenance.UNVERIFIED,
                command=plan.command,
                limitations=[
                    "Host execution gate: Subprocess test execution on unrestricted host is not permitted "
                    "without explicit authorization."
                ]
            )

        cmd_argv = plan.argv
        if not cmd_argv:
            if not plan.command or not plan.command.strip():
                return VerificationResult(
                    executed=False,
                    passed=False,
                    exit_status=1,
                    provenance=VerificationProvenance.UNVERIFIED,
                    limitations=["Empty verification command provided."]
                )
            try:
                cmd_argv = shlex.split(plan.command, posix=(sys.platform != "win32"))
            except Exception as e:
                return VerificationResult(
                    executed=False,
                    passed=False,
                    exit_status=1,
                    provenance=VerificationProvenance.UNVERIFIED,
                    limitations=[f"Failed to parse verification command into argv list: {e}"]
                )

        cwd = plan.working_directory or str(self.workspace_root)
        try:
            # shell=False is strictly enforced! Never execute untrusted shell strings!
            proc = subprocess.run(
                cmd_argv,
                cwd=cwd,
                shell=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=plan.timeout,
                env=plan.environment or os.environ.copy()
            )
            passed = (proc.returncode == 0)
            combined_output = (proc.stdout + "\n" + proc.stderr).strip()
            return VerificationResult(
                executed=True,
                passed=passed,
                exit_status=proc.returncode,
                provenance=VerificationProvenance.EXECUTED_TRUSTED if passed else VerificationProvenance.FAILED,
                command=" ".join(cmd_argv),
                argv=cmd_argv,
                observable_output=combined_output[:4000]
            )
        except subprocess.TimeoutExpired:
            return VerificationResult(
                executed=True,
                passed=False,
                exit_status=124,
                provenance=VerificationProvenance.FAILED,
                command=" ".join(cmd_argv),
                limitations=[f"Verification command timed out after {plan.timeout}s."]
            )
        except Exception as e:
            return VerificationResult(
                executed=False,
                passed=False,
                exit_status=1,
                provenance=VerificationProvenance.UNVERIFIED,
                command=" ".join(cmd_argv) if cmd_argv else plan.command,
                limitations=[f"Verification execution failure: {str(e)}"]
            )

class NoOpVerificationAdapter(VerificationAdapter):
    """
    Default fail-closed verification adapter when no trusted verification backend is configured.
    """
    def verify(self, objective_id: str, plan: TrustedVerificationPlan) -> VerificationResult:
        return VerificationResult(
            executed=False,
            passed=False,
            exit_status=-1,
            provenance=VerificationProvenance.UNVERIFIED,
            command=plan.command,
            limitations=["No trusted verification backend is configured."]
        )


class DockerSandboxVerificationAdapter(VerificationAdapter):
    """
    Trusted container-isolated verification adapter for Architecture B.
    Executes controller-approved verification commands strictly inside a disposable
    DockerSandboxContainer. Never falls back to host shell execution.
    """
    def __init__(self, docker_backend: object, reuse_last_turn_result: bool = True):
        self.docker_backend = docker_backend
        self.reuse_last_turn_result = reuse_last_turn_result

    def verify(self, objective_id: str, plan: TrustedVerificationPlan) -> VerificationResult:
        from orchestrator.docker_backend import DockerExecutionBackend, resolve_canonical_verification_plan
        from orchestrator.schema import (
            MutationExpectation,
            ObjectiveAuthorization,
            compute_verification_plan_digest,
        )

        if not isinstance(self.docker_backend, DockerExecutionBackend):
            return VerificationResult(
                executed=False,
                passed=False,
                exit_status=-1,
                provenance=VerificationProvenance.UNVERIFIED,
                command=plan.command if plan else None,
                limitations=["Invalid docker_backend bound to DockerSandboxVerificationAdapter."],
            )

        if self.reuse_last_turn_result and self.docker_backend.last_verification_result is not None:
            cached = self.docker_backend.last_verification_result
            self.docker_backend.last_verification_result = None
            last_prep = getattr(self.docker_backend, "last_prepared_execution", None)

            plan_parse_error = None
            canonical_plan = None
            if plan is not None:
                try:
                    canonical_plan = resolve_canonical_verification_plan(
                        authorization=getattr(last_prep, "authorization", None),
                        explicit_plan=plan,
                    )
                except ValueError as exc:
                    plan_parse_error = str(exc)

            expected_plan_digest = compute_verification_plan_digest(canonical_plan) if canonical_plan else ""

            # Validate all bindings fail-closed
            binding_mismatches = []
            if plan_parse_error:
                binding_mismatches.append(f"Invalid verification plan: {plan_parse_error}")
            if last_prep is None:
                binding_mismatches.append("No active PreparedExecution artifact exists on the backend.")
            elif last_prep.expired or last_prep.applied:
                binding_mismatches.append(
                    f"PreparedExecution artifact is already expired or applied (expired={last_prep.expired}, applied={last_prep.applied})."
                )
            elif last_prep.objective_id.strip().upper() != objective_id.strip().upper():
                binding_mismatches.append(
                    f"PreparedExecution objective mismatch (prepared for '{last_prep.objective_id}', requested '{objective_id}')."
                )
            elif getattr(last_prep, "verified_delta_digest", "") != getattr(cached, "verified_delta_digest", ""):
                binding_mismatches.append(
                    "PreparedExecution verified_delta_digest mismatch with cached verification result."
                )

            if not cached.executed:
                binding_mismatches.append("Cached verification was not genuinely executed.")
            if not cached.objective_id or cached.objective_id.strip().upper() != objective_id.strip().upper():
                binding_mismatches.append(
                    f"Cached verification objective mismatch (cached '{cached.objective_id}', requested '{objective_id}')."
                )
            if not cached.plan_digest or not str(cached.plan_digest).strip():
                binding_mismatches.append("Cached verification lacks plan_digest.")
            elif expected_plan_digest and cached.plan_digest != expected_plan_digest:
                binding_mismatches.append("Cached verification plan digest mismatch with active plan.")
            elif last_prep is not None and getattr(last_prep, "plan_digest", "") and cached.plan_digest != last_prep.plan_digest:
                binding_mismatches.append("Cached verification plan digest mismatch with prepared plan_digest.")
            if not cached.verified_delta_digest or not str(cached.verified_delta_digest).strip():
                binding_mismatches.append("Cached verification lacks verified source-delta digest.")

            if binding_mismatches:
                return VerificationResult(
                    executed=False,
                    passed=False,
                    exit_status=126,
                    provenance=VerificationProvenance.UNVERIFIED,
                    command=plan.command if plan else None,
                    objective_id=objective_id,
                    plan_digest=expected_plan_digest,
                    limitations=[
                        f"Cached verification evidence rejected: {'; '.join(binding_mismatches)}. Refusing cross-task verification reuse."
                    ],
                )

            return cached

        # Clear any stale cached verification result before checking live Docker availability
        self.docker_backend.last_verification_result = None

        if not self.docker_backend.is_certified_isolated:
            return VerificationResult(
                executed=False,
                passed=False,
                exit_status=-1,
                provenance=VerificationProvenance.UNVERIFIED,
                command=plan.command if plan else None,
                limitations=["Docker sandbox runtime or local image is unavailable; refusing host fallback."],
            )

        if plan is None or (not getattr(plan, "steps", None) and (not plan.command or not plan.command.strip())):
            return VerificationResult(
                executed=False,
                passed=False,
                exit_status=-1,
                provenance=VerificationProvenance.UNVERIFIED,
                limitations=["Missing trusted verification plan: no verification commands or steps specified."],
            )

        auth = ObjectiveAuthorization(
            objective_id=objective_id,
            mutation_permission=MutationExpectation.NOT_ALLOWED,
            requires_verification=True,
        )
        try:
            return self.docker_backend.execute_in_new_sandbox(
                callback=lambda container: self.docker_backend._run_in_container_verification(
                    container=container,
                    authorization=auth,
                    verification_plan=plan,
                ),
                authorization=auth,
                dispatch_id=objective_id,
            )
        except Exception as exc:
            return VerificationResult(
                executed=False,
                passed=False,
                exit_status=1,
                provenance=VerificationProvenance.UNVERIFIED,
                command=plan.command,
                limitations=[f"Docker sandbox verification failed: {exc}"],
            )
