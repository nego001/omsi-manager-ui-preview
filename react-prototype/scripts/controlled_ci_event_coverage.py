"""M25: source-only, fail-closed check for unfiltered PR safety CI.

No required check is selected and no GitHub rules are changed. An observed
workflow definition is NOT proof that a real docs-only PR was executed.
"""
from __future__ import annotations
from pathlib import Path
import re

SCHEMA = "synthetic-pr-coverage-contract-v1"
CRITICAL = (
    "build", "native_auto_x11", "native_x11_evidence_compare",
    "arch_portable_audit", "windows_native_lab", "windows_portable",
    "portable_pair_audit", "synthetic_two_revision_contract",
)
PR_ONLY = (
    "github_independent_review_observation",
    "github_base_policy_codeowners_observation",
    "github_default_branch_rollout_plan",
    "github_ci_context_readiness_audit",
)


def _refuse():
    raise ValueError("CONTROLLED_PR_COVERAGE_REFUSED")


def evaluate_unfiltered_pr_coverage(source: str) -> dict:
    """Check triggers and dependencies without inferring required check IDs."""
    if (type(source) is not str or not 0 < len(source) <= 100_000 or
            "\r" in source or source.count("\njobs:\n") != 1):
        _refuse()
    header, jobtext = source.split("\njobs:\n", 1)
    if (not header.startswith("name: React Prototype Validation\non:\n") or
            header.count("\non:\n") != 1 or
            "\n  pull_request_target:" in header or
            "\n  workflow_run:" in header):
        _refuse()
    event = header.splitlines()
    on_idx = event.index("on:")
    stop = next((i for i in range(on_idx + 1, len(event))
                 if event[i] and not event[i].startswith(" ")), len(event))
    events = event[on_idx + 1:stop]
    if events != [
        "  push:",
        "    branches: [feat/react-nine-screens-safe, main]",
        "  pull_request:",
    ]:
        # In particular, refuse paths/paths-ignore and branch/type filters.
        _refuse()

    tokens = list(re.finditer(r"(?m)^  ([a-z][a-z0-9_]*):\s*$", jobtext))
    if not 0 < len(tokens) <= 64:
        _refuse()
    ids = [m.group(1) for m in tokens]
    if len(set(ids)) != len(ids) or not set(CRITICAL + PR_ONLY) <= set(ids):
        _refuse()

    needs = {}
    for i, item in enumerate(tokens):
        key = item.group(1)
        end = tokens[i + 1].start() if i + 1 < len(tokens) else len(jobtext)
        job = jobtext[item.end():end]
        # Only top-level job keys, not step-level conditions.
        attrs = [line.strip() for line in job.splitlines()
                 if line.startswith("    ") and
                 not line.startswith("      ") and
                 not line.strip().startswith("#")]
        if any(a.startswith("continue-on-error:") for a in attrs):
            _refuse()
        condition = [a for a in attrs if a.startswith("if:")]
        if key in CRITICAL:
            allowed = ["if: ${{ always() }}"] if key == "native_x11_evidence_compare" else []
            if condition != allowed:
                _refuse()
        if key in PR_ONLY and condition != [
                "if: github.event_name == 'pull_request'"]:
            _refuse()
        dependencies = [a[7:] for a in attrs if a.startswith("needs: ")]
        if len(dependencies) > 1:
            _refuse()
        raw = dependencies[0].strip() if dependencies else ""
        if not raw:
            entries = ()
        elif re.fullmatch(r"[a-z][a-z0-9_]*", raw):
            entries = (raw,)
        elif raw.startswith("[") and raw.endswith("]"):
            entries = tuple(x.strip() for x in raw[1:-1].split(","))
        else:
            _refuse()
        if any(x not in ids or x == key for x in entries):
            _refuse()
        needs[key] = entries
        if key == "native_auto_x11":
            active = "\n".join(line for line in job.splitlines()
                               if not line.lstrip().startswith("#"))
            required = (
                "runner: [ubuntu-24.04, ubuntu-22.04]",
                "fail-fast: false",
                "runs-on: ${{ matrix.runner }}",
            )
            if any(x not in active for x in required) or (
                    "continue-on-error" in active or "--no-sandbox" in active):
                _refuse()
    if (needs["native_auto_x11"] != ("build",) or
            needs["native_x11_evidence_compare"] != (
                "build", "native_auto_x11") or
            needs["arch_portable_audit"] != ("build",) or
            needs["portable_pair_audit"] != ("build", "windows_portable")):
        _refuse()

    return {
        "schema": SCHEMA,
        "pullRequestUnfilteredByPaths": True,
        "pullRequestUnfilteredByBaseBranch": True,
        "pushToMainDeclared": True,
        "criticalJobDefinitions": len(CRITICAL),
        "prOnlyInformationalJobDefinitions": len(PR_ONLY),
        "strictUbuntu24And22MatrixRetained": True,
        "strictNativeX11FailureMandatory": True,
        "actualDocsOnlyPullRequestExecutionVerified": False,
        "workflowExistsOnMainVerified": False,
        "exactRequiredCheckContextsVerified": False,
        "requiredCheckContextsSelected": [],
        "branchProtectionChanged": False,
        "ubuntu24StrictSandboxWaived": False,
        "mergeAuthorized": False,
        "installationAuthorized": False,
    }


def inspect_checked_out_workflow():
    path = Path(__file__).resolve().parents[2] / ".github/workflows/react-prototype.yml"
    return evaluate_unfiltered_pr_coverage(path.read_text("utf-8"))


if __name__ == "__main__":
    import json
    import sys
    try:
        print(json.dumps(inspect_checked_out_workflow(), sort_keys=True))
    except (ValueError, OSError, UnicodeError):
        print("CONTROLLED_PR_COVERAGE_REFUSED", file=sys.stderr)
        raise SystemExit(1)
