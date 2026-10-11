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

class EvidenceLabel(str, Enum):
    VERIFIED = "VERIFIED"
    USER_CONSTRAINT = "USER_CONSTRAINT"
    REPORTED = "REPORTED"
    INFERRED = "INFERRED"
    UNKNOWN = "UNKNOWN"

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
    mutations: MutationsRecord = field(default_factory=MutationsRecord)
    validation: List[ValidationRecord] = field(default_factory=list)
    evidence: List[EvidenceItem] = field(default_factory=list)
    findings: List[FindingItem] = field(default_factory=list)
    decision_gate: Optional[DecisionGate] = None
    limitations: List[str] = field(default_factory=list)
    next_action: NextAction = field(default_factory=lambda: NextAction(route="direct_parent", objective=""))
    captured_at: Optional[str] = None
    profile: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["controller_disposition"] = self.controller_disposition.value
        if self.evidence:
            for item in d.get("evidence", []):
                if isinstance(item.get("label"), EvidenceLabel):
                    item["label"] = item["label"].value
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ControllerResult":
        disp = data.get("controller_disposition", "PENDING")
        try:
            disp_enum = ControllerDisposition(disp)
        except ValueError:
            disp_enum = ControllerDisposition.PENDING

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

        return cls(
            schema_version=data.get("schema_version", "8.1"),
            correlation_id=data.get("correlation_id", "PROMPT #001"),
            executor=data.get("executor", "hermes-executor"),
            workflow=data.get("workflow", "direct_parent"),
            objective=data.get("objective", ""),
            native_status=data.get("native_status", "COMPLETED"),
            controller_disposition=disp_enum,
            mutations=muts,
            validation=validations,
            evidence=evidence_items,
            findings=findings,
            decision_gate=dg,
            limitations=data.get("limitations", []),
            next_action=na,
            captured_at=data.get("captured_at"),
            profile=data.get("profile")
        )

def format_correlation_id(seq: int) -> str:
    return f"PROMPT #{seq:03d}"

def extract_end_correlation_id(text: str) -> Optional[str]:
    match = re.search(r"END OF RESULT — PROMPT #(\d+)", text, re.IGNORECASE)
    if match:
        num = int(match.group(1))
        return format_correlation_id(num)
    match_alt = re.search(r"END OF RESULT\s*[-—:]*\s*PROMPT\s*#(\d+)", text, re.IGNORECASE)
    if match_alt:
        num = int(match_alt.group(1))
        return format_correlation_id(num)
    return None
