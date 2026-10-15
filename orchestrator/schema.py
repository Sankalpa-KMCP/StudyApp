import hashlib
import json
import re
from dataclasses import dataclass, asdict, field
from enum import Enum
from typing import Any, Dict, List, Optional

class ControllerDisposition(str, Enum):
    PASS = "PASS"
    PARTIAL = "PARTIAL"
    BLOCKED = "BLOCKED"
    FAIL = "FAIL"
    PENDING = "PENDING"

class MutationExpectation(str, Enum):
    REQUIRED = "REQUIRED"
    OPTIONAL = "OPTIONAL"
    NOT_ALLOWED = "NOT_ALLOWED"

class EvidenceLabel(str, Enum):
    VERIFIED = "VERIFIED"
    USER_CONSTRAINT = "USER_CONSTRAINT"
    REPORTED = "REPORTED"
    INFERRED = "INFERRED"
    UNKNOWN = "UNKNOWN"

class VerificationProvenance(str, Enum):
    UNVERIFIED = "UNVERIFIED"
    SIMULATED = "SIMULATED"
    EXECUTED_TRUSTED = "EXECUTED_TRUSTED"
    FAILED = "FAILED"

class AuthorizationEscalationError(Exception):
    """Raised when model dispatch requests mutation beyond controller authorization."""
    pass

class MissingAuthorizationError(Exception):
    """Raised when required objective authorization metadata is missing."""
    pass

class ExecutionBackendNotCertifiedError(Exception):
    """Raised when autonomous execution is attempted without a certified execution sandbox."""
    pass

class UnresolvedInFlightWorkError(Exception):
    """Raised when pre-existing in-flight work is detected on engine startup."""
    pass

@dataclass
class ObjectiveAuthorization:
    """
    Typed, controller-owned objective authorization contract.
    Guarantees that mutation permissions, allowed paths, and verification rules
    originate exclusively from trusted operator/controller policy, not model output.
    """
    objective_id: str
    mutation_permission: MutationExpectation
    allowed_paths: List[str] = field(default_factory=list)
    readonly_snapshot_paths: List[str] = field(default_factory=list)
    verification_requirements: List[str] = field(default_factory=list)
    protected_resources: List[str] = field(default_factory=list)
    prohibitions: List[str] = field(default_factory=lambda: ["git push", "git commit --amend", "history rewrite"])
    source_of_authorization: str = "operator_policy"
    requires_verification: bool = True

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["mutation_permission"] = self.mutation_permission.value
        return d

    def compute_policy_digest(self) -> str:
        return compute_authorization_digest(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ObjectiveAuthorization":
        mut_perm_str = data.get("mutation_permission", "REQUIRED")
        try:
            mut_perm = MutationExpectation(mut_perm_str)
        except ValueError:
            mut_perm = MutationExpectation.REQUIRED
        return cls(
            objective_id=data.get("objective_id", ""),
            mutation_permission=mut_perm,
            allowed_paths=data.get("allowed_paths", []),
            readonly_snapshot_paths=data.get("readonly_snapshot_paths", []),
            verification_requirements=data.get("verification_requirements", []),
            protected_resources=data.get("protected_resources", []),
            prohibitions=data.get("prohibitions", []),
            source_of_authorization=data.get("source_of_authorization", "operator_policy"),
            requires_verification=data.get("requires_verification", True),
        )

@dataclass
class ModelProposedDispatch:
    """Untrusted proposed dispatch details emitted by the LLM."""
    title: str
    prompt_body: str
    proposed_mutation_expectation: MutationExpectation
    suggested_verification: Optional[str] = None

@dataclass
class VerificationStep:
    """
    A single structured, controller-owned verification step.
    """
    argv: List[str]
    working_directory: str = "/workspace"
    environment: Dict[str, str] = field(default_factory=dict)
    timeout: int = 120
    expected_exit_codes: List[int] = field(default_factory=lambda: [0])
    allow_container_shell: bool = False
    raw_command: str = ""

@dataclass
class TrustedVerificationPlan:
    """Authorized plan for independent verification."""
    command: str = ""
    argv: Optional[List[str]] = None
    timeout: int = 300
    environment: Optional[Dict[str, str]] = None
    working_directory: Optional[str] = None
    allowed_to_run_host: bool = False
    steps: List[VerificationStep] = field(default_factory=list)

def compute_authorization_digest(auth: Optional["ObjectiveAuthorization"]) -> str:
    """
    Deterministic cryptographic SHA-256 digest of ObjectiveAuthorization policy.
    Serializes all security-relevant fields without lossy normalization.
    """
    if auth is None:
        return ""
    data = {
        "objective_id": auth.objective_id.strip().upper(),
        "mutation_permission": auth.mutation_permission.value,
        "allowed_paths": sorted(set(auth.allowed_paths or [])),
        "readonly_snapshot_paths": sorted(set(auth.readonly_snapshot_paths or [])),
        "verification_requirements": [r.strip() for r in (auth.verification_requirements or []) if r.strip()],
        "protected_resources": sorted(set(auth.protected_resources or [])),
        "prohibitions": sorted(set(auth.prohibitions or [])),
        "requires_verification": bool(auth.requires_verification),
    }
    raw = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def compute_verification_plan_digest(plan: Optional["TrustedVerificationPlan"]) -> str:
    """
    Deterministic cryptographic SHA-256 digest of TrustedVerificationPlan.
    """
    if plan is None:
        return ""
    steps_data = []
    for s in (plan.steps or []):
        steps_data.append({
            "argv": list(s.argv or []),
            "working_directory": s.working_directory,
            "environment": sorted((s.environment or {}).items()),
            "timeout": s.timeout,
            "expected_exit_codes": sorted(s.expected_exit_codes or [0]),
            "allow_container_shell": bool(s.allow_container_shell),
        })
    data = {
        "command": plan.command.strip() if plan.command else "",
        "steps": steps_data,
        "timeout": plan.timeout,
    }
    raw = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

@dataclass
class VerificationResult:
    """Independent verification outcome produced by trusted verification adapter."""
    executed: bool = False
    passed: bool = False
    exit_status: int = -1
    provenance: VerificationProvenance = VerificationProvenance.UNVERIFIED
    command: Optional[str] = None
    argv: Optional[List[str]] = None
    observable_output: str = ""
    limitations: List[str] = field(default_factory=list)
    environment: Optional[str] = None
    objective_id: Optional[str] = None
    plan_digest: Optional[str] = None
    verified_delta_digest: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["provenance"] = self.provenance.value
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "VerificationResult":
        prov_str = data.get("provenance", "UNVERIFIED")
        try:
            prov = VerificationProvenance(prov_str)
        except ValueError:
            prov = VerificationProvenance.UNVERIFIED
        return cls(
            executed=data.get("executed", False),
            passed=data.get("passed", False),
            exit_status=data.get("exit_status", -1),
            provenance=prov,
            command=data.get("command"),
            argv=data.get("argv"),
            observable_output=data.get("observable_output", ""),
            limitations=data.get("limitations", []),
            environment=data.get("environment"),
            objective_id=data.get("objective_id"),
            plan_digest=data.get("plan_digest"),
            verified_delta_digest=data.get("verified_delta_digest"),
        )

@dataclass
class ObservedMutations:
    """Observed filesystem and Git mutations relative to pre-execution baseline."""
    tracked_modified: List[str] = field(default_factory=list)
    untracked_added: List[str] = field(default_factory=list)
    deleted: List[str] = field(default_factory=list)
    staged: List[str] = field(default_factory=list)
    pre_existing_modified: List[str] = field(default_factory=list)
    has_deltas: bool = False
    unauthorized_deltas: List[str] = field(default_factory=list)

@dataclass
class ValidationRecord:
    kind: str
    executed: bool
    result: str
    command_or_check: Optional[str] = None
    target_or_environment: Optional[str] = None

@dataclass
class EvidenceItem:
    label: EvidenceLabel
    summary: str
    source: Optional[str] = None

@dataclass
class FindingItem:
    summary: str
    status: str
    id: Optional[str] = None
    severity: Optional[str] = None
    confidence: Optional[str] = None
    attribution: Optional[str] = None

@dataclass
class DecisionGate:
    required: bool
    summary: str
    kind: Optional[str] = None
    options: List[str] = field(default_factory=list)
    recommendation: Optional[str] = None

@dataclass
class NextAction:
    route: Optional[str]
    objective: Optional[str]
    requires_new_authorization: bool = False

@dataclass
class MutationsRecord:
    files_changed: List[str] = field(default_factory=list)
    git_mutation: bool = False
    git_state: Optional[str] = None
    unexpected_deltas: List[str] = field(default_factory=list)

@dataclass
class ControllerResult:
    schema_version: str = "8.1"
    correlation_id: str = "PROMPT #001"
    executor: str = "hermes-executor"
    workflow: str = "direct_parent"
    objective: str = ""
    native_status: str = "COMPLETED"
    controller_disposition: ControllerDisposition = ControllerDisposition.PENDING
    mutation_expectation: MutationExpectation = MutationExpectation.REQUIRED
    mutations: MutationsRecord = field(default_factory=MutationsRecord)
    validation: List[ValidationRecord] = field(default_factory=list)
    evidence: List[EvidenceItem] = field(default_factory=list)
    findings: List[FindingItem] = field(default_factory=list)
    decision_gate: Optional[DecisionGate] = None
    limitations: List[str] = field(default_factory=list)
    next_action: NextAction = field(default_factory=lambda: NextAction(route="direct_parent", objective=""))
    captured_at: Optional[str] = None
    profile: Optional[str] = None
    authorization: Optional[ObjectiveAuthorization] = None
    observed_mutations: Optional[ObservedMutations] = None
    verification_result: Optional[VerificationResult] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["controller_disposition"] = self.controller_disposition.value
        d["mutation_expectation"] = self.mutation_expectation.value
        if self.evidence:
            for item in d.get("evidence", []):
                if isinstance(item.get("label"), EvidenceLabel):
                    item["label"] = item["label"].value
        if self.authorization:
            d["authorization"]["mutation_permission"] = self.authorization.mutation_permission.value
        if self.verification_result:
            d["verification_result"]["provenance"] = self.verification_result.provenance.value
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ControllerResult":
        disp = data.get("controller_disposition", "PENDING")
        try:
            disp_enum = ControllerDisposition(disp)
        except ValueError:
            disp_enum = ControllerDisposition.PENDING

        mut_exp_str = data.get("mutation_expectation", "REQUIRED")
        try:
            mut_exp_enum = MutationExpectation(mut_exp_str)
        except ValueError:
            mut_exp_enum = MutationExpectation.REQUIRED

        muts_data = data.get("mutations", {})
        muts = MutationsRecord(
            files_changed=muts_data.get("files_changed", []),
            git_mutation=muts_data.get("git_mutation", False),
            git_state=muts_data.get("git_state"),
            unexpected_deltas=muts_data.get("unexpected_deltas", [])
        )

        validations = [
            ValidationRecord(
                kind=v.get("kind", "check"),
                executed=v.get("executed", False),
                result=v.get("result", "UNKNOWN"),
                command_or_check=v.get("command_or_check"),
                target_or_environment=v.get("target_or_environment")
            )
            for v in data.get("validation", [])
        ]

        evidence_items = []
        for e in data.get("evidence", []):
            lbl_raw = e.get("label", "REPORTED")
            try:
                lbl = EvidenceLabel(lbl_raw)
            except ValueError:
                lbl = EvidenceLabel.REPORTED
            evidence_items.append(EvidenceItem(
                label=lbl,
                summary=e.get("summary", ""),
                source=e.get("source")
            ))

        findings = [
            FindingItem(
                summary=f.get("summary", ""),
                status=f.get("status", "OPEN"),
                id=f.get("id"),
                severity=f.get("severity"),
                confidence=f.get("confidence"),
                attribution=f.get("attribution")
            )
            for f in data.get("findings", [])
        ]

        dg_data = data.get("decision_gate")
        dg = None
        if dg_data:
            dg = DecisionGate(
                required=dg_data.get("required", False),
                summary=dg_data.get("summary", ""),
                kind=dg_data.get("kind"),
                options=dg_data.get("options", []),
                recommendation=dg_data.get("recommendation")
            )

        na_data = data.get("next_action", {})
        na = NextAction(
            route=na_data.get("route"),
            objective=na_data.get("objective"),
            requires_new_authorization=na_data.get("requires_new_authorization", False)
        )

        auth_data = data.get("authorization")
        auth = ObjectiveAuthorization.from_dict(auth_data) if auth_data else None

        verif_data = data.get("verification_result")
        verif = VerificationResult.from_dict(verif_data) if verif_data else None

        return cls(
            schema_version=data.get("schema_version", "8.1"),
            correlation_id=data.get("correlation_id", "PROMPT #001"),
            executor=data.get("executor", "hermes-executor"),
            workflow=data.get("workflow", "direct_parent"),
            objective=data.get("objective", ""),
            native_status=data.get("native_status", "COMPLETED"),
            controller_disposition=disp_enum,
            mutation_expectation=mut_exp_enum,
            mutations=muts,
            validation=validations,
            evidence=evidence_items,
            findings=findings,
            decision_gate=dg,
            limitations=data.get("limitations", []),
            next_action=na,
            captured_at=data.get("captured_at"),
            profile=data.get("profile"),
            authorization=auth,
            verification_result=verif,
        )

def format_correlation_id(seq: int) -> str:
    return f"PROMPT #{seq:03d}"

def extract_end_correlation_id(text: str) -> Optional[str]:
    """
    Strict terminal correlation marker extractor.
    Accepts marker ONLY when:
    - It is a complete standalone terminal line at the permitted end of normalized result.
    - Matches exact 'END OF RESULT — PROMPT #NNN' format.
    - Not quoted (e.g. not '\"END OF RESULT...\"' or inside quotes).
    - Not inside fenced code blocks (```...```).
    - Outside of explanatory prose.
    - No trailing non-whitespace output following the marker line.
    - Unique closing marker (rejects duplicate markers).
    """
    if not text or not isinstance(text, str):
        return None

    # 1. Remove all complete fenced code blocks to prevent sample/example marker matching
    stripped = re.sub(r"```[\s\S]*?```", "", text)

    # 2. Split into lines and check non-empty lines
    lines = [line.strip() for line in stripped.splitlines() if line.strip()]
    if not lines:
        return None

    last_line = lines[-1]

    # 3. Must not be quoted or enclosed in quotes/backticks
    if last_line.startswith(('"', "'", "`")) or last_line.endswith(('"', "'", "`")):
        return None

    # 4. Must be a complete, standalone line matching the exact marker pattern
    match = re.match(r"^END OF RESULT\s*[-—:]*\s*PROMPT\s*#(\d+)$", last_line, re.IGNORECASE)
    if not match:
        return None

    found_seq = int(match.group(1))
    expected_token = format_correlation_id(found_seq)

    # 5. Must be unique in the un-fenced text (reject duplicate markers)
    marker_pattern = re.compile(r"END OF RESULT\s*[-—:]*\s*PROMPT\s*#\d+", re.IGNORECASE)
    all_markers = marker_pattern.findall(stripped)
    if len(all_markers) != 1:
        return None

    return expected_token
