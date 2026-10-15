import json
import re
from typing import Dict, List, Optional, Tuple
from orchestrator.config import NO_TOOLS_SENTINEL, OrchestratorConfig
from orchestrator.hermes_client import HermesClient, HermesResponse
from orchestrator.schema import (
    AuthorizationEscalationError,
    ControllerDisposition,
    ControllerResult,
    EvidenceItem,
    EvidenceLabel,
    MissingAuthorizationError,
    MutationExpectation,
    ObjectiveAuthorization,
    ObservedMutations,
    VerificationProvenance,
    VerificationResult,
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
   - PASS: Objective verified with clean test/diff evidence.
   - PARTIAL: Progress made but incomplete or secondary tests need repair.
   - FAIL: Objective failed, tests broken, or regressions introduced.
   - BLOCKED: Critical blocker or decision gate required from user.
"""

class MalformedDispatchError(Exception):
    """Raised when the Controller produces an ambiguous, malformed, or invalid dispatch prompt."""
    pass

def is_competing_prompt_envelope(line: str) -> bool:
    """
    Check if a line serves as a competing standalone prompt envelope header.
    Examples that match: 'PROMPT #001', 'PROMPT #002:', 'PROMPT #003 -'
    Examples that DO NOT match: 'PROMPT #001 introduced a regression', 'PROMPT #001 diff showed tests failed'
    """
    cleaned = line.strip()
    return bool(re.match(r"^PROMPT\s*#\d+\s*[:—\-]?\s*$", cleaned, re.IGNORECASE))

def parse_controller_dispatch(text: str, expected_prompt_id: str) -> Tuple[str, str, MutationExpectation]:
    """
    Deterministic parser for Controller dispatch prompts.
    Enforces:
    - Exactly one objective title and executor prompt section.
    - Explicit or cleanly inferred mutation expectations (REQUIRED, OPTIONAL, NOT_ALLOWED).
    - Leading prompt envelope must match expected_prompt_id on the first non-empty line.
    - Historical prompt references in the body (e.g. 'PROMPT #001 introduced a regression') are accepted as valid task content.
    - Rejects competing leading envelopes, duplicate sections, empty fields, or malformed markers.
    """
    if not text or not isinstance(text, str):
        raise MalformedDispatchError("Empty or non-string controller response")

    # Strip outer markdown code fences if model wrapped entire dispatch
    text_clean = text.strip()
    fence_match = re.match(r"^```(?:markdown|text)?\s*\n([\s\S]*?)\n```$", text_clean, re.IGNORECASE)
    if fence_match:
        text_clean = fence_match.group(1).strip()

    title_marker = "=== OBJECTIVE_TITLE ==="
    prompt_marker = "=== EXECUTOR_PROMPT ==="
    mutation_marker = "=== MUTATION_EXPECTATION ==="

    title_matches = len(re.findall(re.escape(title_marker), text_clean))
    prompt_matches = len(re.findall(re.escape(prompt_marker), text_clean))
    mutation_matches = len(re.findall(re.escape(mutation_marker), text_clean))

    if title_matches == 0:
        raise MalformedDispatchError("Missing '=== OBJECTIVE_TITLE ===' marker in controller output")
    if title_matches > 1:
        raise MalformedDispatchError(f"Ambiguous dispatch: found {title_matches} '=== OBJECTIVE_TITLE ===' markers")

    if prompt_matches == 0:
        raise MalformedDispatchError("Missing '=== EXECUTOR_PROMPT ===' marker in controller output")
    if prompt_matches > 1:
        raise MalformedDispatchError(f"Ambiguous dispatch: found {prompt_matches} '=== EXECUTOR_PROMPT ===' markers")

    if mutation_matches > 1:
        raise MalformedDispatchError(f"Ambiguous dispatch: found {mutation_matches} '=== MUTATION_EXPECTATION ===' markers")

    # Parse sections
    title = ""
    prompt_body = ""
    mutation_expectation = MutationExpectation.REQUIRED

    if mutation_matches == 1:
        pattern = re.compile(
            re.escape(title_marker) + r"\s*\n(.*?)\n\s*" +
            re.escape(mutation_marker) + r"\s*\n(.*?)\n\s*" +
            re.escape(prompt_marker) + r"\s*\n([\s\S]+)$",
            re.DOTALL
        )
        match = pattern.search(text_clean)
        if not match:
            raise MalformedDispatchError("Malformed dispatch section ordering: expected TITLE -> MUTATION_EXPECTATION -> PROMPT")
        title = match.group(1).strip()
        mut_raw = match.group(2).strip().upper()
        prompt_body = match.group(3).strip()

        try:
            mutation_expectation = MutationExpectation(mut_raw)
        except ValueError:
            raise MalformedDispatchError(
                f"Invalid MUTATION_EXPECTATION '{mut_raw}'; must be REQUIRED, OPTIONAL, or NOT_ALLOWED"
            )
    else:
        pattern = re.compile(
            re.escape(title_marker) + r"\s*\n(.*?)\n\s*" + re.escape(prompt_marker) + r"\s*\n([\s\S]+)$",
            re.DOTALL
        )
        match = pattern.search(text_clean)
        if not match:
            raise MalformedDispatchError("Malformed dispatch structure: markers must appear in sequence with content")
        title = match.group(1).strip()
        prompt_body = match.group(2).strip()

        # Infer mutation expectation when omitted based on objective keywords
        title_lower = title.lower()
        read_only_keywords = ["audit", "inspect", "diagnose", "research", "verify", "check", "review", "test-only"]
        mutating_keywords = ["fix", "implement", "create", "add", "refactor", "update", "modify", "patch", "repair"]

        is_read_only = any(kw in title_lower for kw in read_only_keywords)
        is_mutating = any(kw in title_lower for kw in mutating_keywords)

        if is_read_only and not is_mutating:
            mutation_expectation = MutationExpectation.NOT_ALLOWED
        else:
            mutation_expectation = MutationExpectation.REQUIRED

    if not title or len(title) < 3:
        raise MalformedDispatchError(f"Invalid objective title: '{title}' (must be at least 3 characters)")

    if not prompt_body:
        raise MalformedDispatchError("Empty executor prompt body")

    # Strict leading envelope validation: the very first non-empty line must match expected_prompt_id
    body_lines = [l.strip() for l in prompt_body.splitlines() if l.strip()]
    if not body_lines:
        raise MalformedDispatchError("Executor prompt body contains no text lines")

    first_line = body_lines[0]
    lead_match = re.match(r"^PROMPT #(\d+)", first_line)
    if not lead_match:
        raise MalformedDispatchError(
            f"Prompt body must begin strictly with leading '{expected_prompt_id}', got: '{first_line[:40]}'"
        )

    lead_id = format_correlation_id(int(lead_match.group(1)))
    if lead_id.upper() != expected_prompt_id.upper():
        raise MalformedDispatchError(
            f"Prompt ID mismatch: expected leading '{expected_prompt_id}', but prompt begins with '{lead_id}'"
        )

    # Check for competing leading envelopes (multiple standalone prompt envelope headers)
    if len(body_lines) > 1 and is_competing_prompt_envelope(body_lines[1]):
        raise MalformedDispatchError(
            f"Ambiguous dispatch: multiple leading prompt envelopes detected ('{body_lines[0]}' and '{body_lines[1]}')"
        )

    return title, prompt_body, mutation_expectation

def extract_single_json_object(text: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    Strict, deterministic JSON object extractor.
    Accepts exactly one unambiguous JSON object.
    Distinguishes explicit JSON code blocks from unrelated surrounding markdown code blocks (e.g. bash, diff).
    Fails closed on multiple competing JSON objects, truncated JSON, or invalid schemas.
    """
    if not text or not isinstance(text, str):
        return None, "Empty or non-string response text"

    # 1. Search for explicit ```json ... ``` code blocks
    json_blocks = re.findall(r"```(?:json)\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if len(json_blocks) > 1:
        return None, f"Ambiguous response: found {len(json_blocks)} competing json code blocks"
    elif len(json_blocks) == 1:
        target = json_blocks[0].strip()
    else:
        # Check all code blocks if no explicit ```json block
        all_blocks = re.findall(r"```([a-zA-Z0-9_-]*)\s*([\s\S]*?)\s*```", text)
        if len(all_blocks) == 1 and all_blocks[0][0].lower() in ("", "text"):
            target = all_blocks[0][1].strip()
        elif len(all_blocks) > 1:
            # Check if exactly one block parses as valid JSON dictionary
            json_candidates = []
            for tag, content in all_blocks:
                c_clean = content.strip()
                if c_clean.startswith("{") and c_clean.endswith("}"):
                    try:
                        parsed = json.loads(c_clean)
                        if isinstance(parsed, dict):
                            json_candidates.append(parsed)
                    except Exception:
                        pass
            if len(json_candidates) == 1:
                return json_candidates[0], None
            elif len(json_candidates) > 1:
                return None, f"Ambiguous response: found {len(json_candidates)} competing markdown code blocks containing JSON"
            else:
                target = text.strip()
        else:
            target = text.strip()

    # 2. Balanced brace scanner for top-level JSON objects
    objects: List[Tuple[int, int, str]] = []
    depth = 0
    start = -1
    in_string = False
    escape = False

    for i, c in enumerate(target):
        if c == '"' and not escape:
            in_string = not in_string
        elif not in_string:
            if c == '{':
                if depth == 0:
                    start = i
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0 and start != -1:
                    objects.append((start, i + 1, target[start:i+1]))
                    start = -1
        if c == '\\' and not escape:
            escape = True
        else:
            escape = False

    if len(objects) == 0:
        return None, "No JSON object found in response"

    # Filter candidates that parse into valid JSON dicts
    valid_dicts: List[dict] = []
    last_err: Optional[str] = None
    for _, _, obj_str in objects:
        try:
            data = json.loads(obj_str)
            if isinstance(data, dict):
                valid_dicts.append(data)
            else:
                last_err = "Parsed JSON root is not an object/dictionary"
        except Exception as e:
            last_err = f"JSON parsing failed: {str(e)}"

    if len(valid_dicts) == 0:
        return None, last_err or "No valid JSON dictionary found in candidate blocks"
    if len(valid_dicts) > 1:
        return None, f"Ambiguous response: found {len(valid_dicts)} competing top-level JSON objects"

    return valid_dicts[0], None

class ContradictorySecurityConfigurationError(ValueError):
    """Raised when configuration attempts to assign mutating or non-zero tools to the Controller."""
    pass

class Controller:
    def __init__(self, config: OrchestratorConfig, client: HermesClient):
        self.config = config
        self.client = client
        self._validate_security_invariants()

    def _validate_security_invariants(self) -> None:
        """
        Validate that controller configuration enforces strictly zero tools.
        Contradictory security configurations (e.g. requesting terminal, file, or other tools)
        are rejected immediately before any query can be dispatched.
        """
        raw_toolsets = getattr(self.config, "controller_toolsets", None)
        if raw_toolsets is not None:
            cleaned = str(raw_toolsets).strip().lower()
            if cleaned and cleaned != NO_TOOLS_SENTINEL:
                raise ContradictorySecurityConfigurationError(
                    f"Contradictory security configuration: controller_toolsets is set to '{raw_toolsets}'. "
                    f"Controller execution is an enforced invariant requiring strictly zero tools ('{NO_TOOLS_SENTINEL}'). "
                    "Configuring mutating or non-zero tools for the Controller is permanently prohibited."
                )

    def formulate_next_prompt(
        self,
        sequence_number: int,
        master_outcome: str,
        definition_of_done: str,
        handoff_content: str,
        git_diff: str,
        authorization: Optional[ObjectiveAuthorization] = None,
        previous_failure_context: Optional[str] = None,
    ) -> Tuple[str, str, MutationExpectation]:
        """
        Formulate the next bounded prompt for the executor.
        Returns (objective_title, prompt_text, mutation_expectation).
        Enforces:
        - Controller-owned authorization bounds. Model cannot escalate mutation permissions.
        - Raises AuthorizationEscalationError if model requests mutation beyond granted authorization.
        - Raises MalformedDispatchError on ambiguous or invalid dispatch format.
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

Format your output EXACTLY as:
=== OBJECTIVE_TITLE ===
<One sentence title of the objective>
=== MUTATION_EXPECTATION ===
REQUIRED | OPTIONAL | NOT_ALLOWED
=== EXECUTOR_PROMPT ===
{prompt_id}
...
"""

        self._validate_security_invariants()
        resp = self.client.run_query(
            prompt=planning_request,
            toolsets=NO_TOOLS_SENTINEL,
            model=self.config.controller_model,
            timeout=self.config.controller_timeout,
            yolo=False,
        )

        text = resp.clean_text

        # Deterministic extraction and parsing
        title, prompt_text, proposed_expectation = parse_controller_dispatch(text, prompt_id)

        # Enforce Controller-Owned Authorization contract
        effective_expectation = proposed_expectation
        if authorization is not None:
            if authorization.mutation_permission == MutationExpectation.NOT_ALLOWED:
                if proposed_expectation in (MutationExpectation.REQUIRED, MutationExpectation.OPTIONAL):
                    raise AuthorizationEscalationError(
                        f"Model requested '{proposed_expectation.value}' mutation but controller "
                        f"authorized strictly 'NOT_ALLOWED' for {prompt_id}. Self-escalation rejected."
                    )
                effective_expectation = MutationExpectation.NOT_ALLOWED
            elif authorization.mutation_permission == MutationExpectation.REQUIRED:
                if proposed_expectation == MutationExpectation.NOT_ALLOWED:
                    raise AuthorizationEscalationError(
                        f"Model requested 'NOT_ALLOWED' when controller authorized strictly 'REQUIRED' for {prompt_id}."
                    )
                effective_expectation = MutationExpectation.REQUIRED
            elif authorization.mutation_permission == MutationExpectation.OPTIONAL:
                effective_expectation = proposed_expectation

        return title, prompt_text, effective_expectation

    def reconcile_result(
        self,
        prompt_id: str,
        objective: str,
        executor_output: str,
        git_diff_stat: str,
        changed_files: Optional[List[str]] = None,
        executor_exit_code: int = 0,
        correlation_valid: bool = True,
        correlation_error: Optional[str] = None,
        is_truncated: bool = False,
        mutation_expectation: MutationExpectation = MutationExpectation.REQUIRED,
        reported_already_correct: bool = False,
        authorization: Optional[ObjectiveAuthorization] = None,
        verification_result: Optional[VerificationResult] = None,
        observed_mutations: Optional[ObservedMutations] = None,
    ) -> ControllerResult:
        """
        Reconcile executor output against controller-owned rules and verifiable evidence.
        Enforces:
        - Strict exit code and process completion check.
        - Strict correlation token verification.
        - Single JSON extraction with non-JSON fence differentiation.
        - Controller-owned mutation authorization (model-reported files_changed cannot satisfy mutation requirement).
        - Elimination of untrusted "already correct" substring heuristics.
        - Independent verification evidence trust boundary.
        """
        changed_files = changed_files or []

        # Effective authorization rules
        effective_mutation = (
            authorization.mutation_permission
            if authorization is not None
            else mutation_expectation
        )
        requires_verification = (
            authorization.requires_verification
            if authorization is not None
            else (effective_mutation == MutationExpectation.REQUIRED)
        )

        # 1. Hard fail-closed execution checks
        if executor_exit_code != 0 or is_truncated:
            return ControllerResult(
                correlation_id=prompt_id,
                objective=objective,
                controller_disposition=ControllerDisposition.FAIL,
                mutation_expectation=effective_mutation,
                authorization=authorization,
                limitations=[
                    f"Executor terminated with non-zero exit code ({executor_exit_code}) or output was truncated."
                ],
            )

        if not correlation_valid:
            return ControllerResult(
                correlation_id=prompt_id,
                objective=objective,
                controller_disposition=ControllerDisposition.FAIL,
                mutation_expectation=effective_mutation,
                authorization=authorization,
                limitations=[
                    f"Missing or mismatched correlation token: {correlation_error or 'Invalid correlation'}"
                ],
            )

        reconcile_request = f"""{CONTROLLER_SYSTEM_PROMPT}

RECONCILIATION TASK:
Evaluate the executor result for {prompt_id}.

OBJECTIVE:
{objective}
MUTATION EXPECTATION:
{effective_mutation.value}

EXECUTOR OUTPUT:
\"\"\"
{executor_output[-4000:] if len(executor_output) > 4000 else executor_output}
\"\"\"

GIT CHANGES:
\"\"\"
{git_diff_stat or "No git changes recorded"}
Files changed: {changed_files}
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
      "label": "REPORTED",
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
- If all required checks ran and passed without regressions, set controller_disposition = "PASS".
- If checks failed, compilation failed, or code has unverified claims, set controller_disposition = "FAIL" or "PARTIAL".
- Respond with ONLY the raw JSON block.
"""

        self._validate_security_invariants()
        resp = self.client.run_query(
            prompt=reconcile_request,
            toolsets=NO_TOOLS_SENTINEL,
            model=self.config.controller_model,
            timeout=self.config.controller_timeout,
            yolo=False,
        )

        clean = resp.clean_text

        # 2. Extract single unambiguous JSON object
        data, err = extract_single_json_object(clean)
        if err or not data:
            return ControllerResult(
                correlation_id=prompt_id,
                objective=objective,
                controller_disposition=ControllerDisposition.FAIL,
                mutation_expectation=effective_mutation,
                authorization=authorization,
                limitations=[f"Failed to extract valid reconciliation JSON: {err or 'Unknown error'}"],
            )

        # 3. Verify correlation ID matches
        json_corr_id = data.get("correlation_id", "")
        if json_corr_id.upper() != prompt_id.upper():
            return ControllerResult(
                correlation_id=prompt_id,
                objective=objective,
                controller_disposition=ControllerDisposition.FAIL,
                mutation_expectation=effective_mutation,
                authorization=authorization,
                limitations=[
                    f"Reconciliation JSON correlation ID mismatch: expected '{prompt_id}', got '{json_corr_id}'"
                ],
            )

        result = ControllerResult.from_dict(data)
        result.mutation_expectation = effective_mutation
        result.authorization = authorization
        result.verification_result = verification_result
        result.observed_mutations = observed_mutations

        # Mark model evidence items as REPORTED (untrusted self-report)
        for item in result.evidence:
            if item.label == EvidenceLabel.VERIFIED:
                item.label = EvidenceLabel.REPORTED

        # 4. Independent Mutation Corroboration (Section C)
        # Model-reported files_changed can NEVER satisfy mutation requirement.
        if observed_mutations is not None:
            has_actual_mutations = observed_mutations.has_deltas
            unauthorized_deltas = observed_mutations.unauthorized_deltas
            result.mutations.files_changed = list(
                observed_mutations.tracked_modified + observed_mutations.untracked_added
            )
        else:
            has_actual_mutations = bool(git_diff_stat) or bool(changed_files)
            unauthorized_deltas = []
            result.mutations.files_changed = list(changed_files)

        if unauthorized_deltas:
            result.controller_disposition = ControllerDisposition.FAIL
            result.limitations.append(
                f"Reconciliation override: Mutations observed outside authorized paths: {unauthorized_deltas}"
            )

        if effective_mutation == MutationExpectation.NOT_ALLOWED:
            if has_actual_mutations:
                result.controller_disposition = ControllerDisposition.FAIL
                result.limitations.append(
                    "Reconciliation override: Read-only objective unexpectedly mutated repository files."
                )

        elif effective_mutation == MutationExpectation.REQUIRED:
            if not has_actual_mutations:
                result.controller_disposition = ControllerDisposition.FAIL
                result.limitations.append(
                    "Reconciliation override: Implementation objective required mutations but no changes were recorded "
                    "in Git relative to baseline."
                )

        # 5. Independent Verification Evidence Trust Boundary (Section B & C)
        if requires_verification:
            if verification_result is None or not verification_result.executed:
                if result.controller_disposition == ControllerDisposition.PASS:
                    result.controller_disposition = ControllerDisposition.PARTIAL
                    result.limitations.append(
                        "Reconciliation gate: Controller cannot award PASS without independent verified evidence. "
                        "Executor claims are REPORTED but no trusted controller verification was executed."
                    )
            elif not verification_result.passed:
                result.controller_disposition = ControllerDisposition.FAIL
                result.limitations.append(
                    f"Reconciliation override: Trusted verification check failed (exit code {verification_result.exit_status})."
                )
            else:
                if verification_result.provenance == VerificationProvenance.SIMULATED:
                    result.limitations.append(
                        "Notice: Verification evidence is SIMULATED by test fixture (not independently executed in production)."
                    )
                    result.evidence.append(EvidenceItem(
                        label=EvidenceLabel.REPORTED,
                        summary=f"Simulated verification check (exit {verification_result.exit_status}): {verification_result.command or 'simulated'}",
                        source="simulated_verification_adapter"
                    ))
                else:
                    result.evidence.append(EvidenceItem(
                        label=EvidenceLabel.VERIFIED,
                        summary=f"Trusted verification check passed cleanly (exit {verification_result.exit_status}): {verification_result.command or 'verified'}",
                        source="trusted_verification_adapter"
                    ))

        # 6. Check reported validation records for explicit failures
        failed_checks = [
            v for v in result.validation
            if str(v.result).upper() == "FAIL"
        ]
        if failed_checks:
            result.controller_disposition = ControllerDisposition.FAIL
            result.limitations.append(
                "Reconciliation override: Controller claimed PASS but validation records contain failed checks."
            )

        return result
