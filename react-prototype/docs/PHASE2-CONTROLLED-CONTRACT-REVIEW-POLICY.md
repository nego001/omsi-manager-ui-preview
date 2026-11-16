# OMSI Manager | Phase 2 / M20 — review policy for synthetic contract changes

**Branch:** feat/controlled-fixture-review-policy-v1
**Base:** PR #23 (M19). **Status:** Draft only; no merge/release.

## Purpose

M19 compares **nine original ZIP test fixtures** with two independently
checked-out revisions of the analyzer. A changed result was classified
`reviewRequired` and the job failed. M20 adds a **human-review policy
classification** that tells maintainers whether the observed change was
unexpected or has a **declared intent awaiting independent human review**.

M20 does **not** approve any change. It does **not** read GitHub review
comments, trust a self-declared approval, auto-merge, sign a baseline, or
waive other CI gates. Writing a change declaration is NOT a review.

## Strict review states

| Review state | When produced | Can the CI job pass? |
|---|---|---|
| `stableNoReviewRequested` | All nine fixture comparisons are stable, and no declaration is present | **Yes, for this job only** |
| `unexpectedDriftNeedsReview` | At least one fixture changed and no declaration exists | **No** |
| `declaredIntentStillNeedsHumanReview` | A valid, exact declaration matches changed contract groups and baseline | **No** |

Any change to the reserved `safetyInvariants` group, forged
permission flag, wrong summary schema, wrong fixture count, stale change
declaration, unknown group, wrong baseline, invalid reason or malformed
data causes **fail-closed refusal** with the fixed message
`CONTROLLED_CONTRACT_REVIEW_REFUSED`.

A proposal never becomes a completed review solely because its values
are syntactically valid. There is **no approval/waiver state**.

## Source-controlled proposed declaration

The CI code intentionally defines:
`CI_CHANGE_DECLARATION = None`.

For an *intentional future* behavior change, a developer may separately
propose a typed `ContractChangeDeclaration` with only:

- Exact M18 reference commit:
  `c260b0b5e6325c44766788a528e8a2aee8237333`.
- Sorted, exact names of **changed, reviewable contract groups** (never
  safety invariants).
- A fixed reason category:
  `classification-rule-adjustment`,
  `reference-linking-correction`,
  `bounded-o3d-hints-revision`, or
  `multi-stage-contract-refactor`.
- The public review tracking issue number **2**.

Reason categories must match the affected groups; a generic multi-stage
reason only applies to changes spanning at least two distinct categories.
Arbitrary explanations, names, ZIP paths, hashes or file content cannot
be injected into the policy's public result.

Even if the declaration matches, CI stays **red on drift**, and a person
must review the PR and its evidence separately. External branch protection,
code owner review and administrative decisions are **out of scope** for this
module. No claim of genuine human approval is generated here.

## CI integration

M20 is called by the actual M19 job immediately after comparing nine
synthetic fixtures. It accepts only the sealed M19 summary and refuses
extra fields, wrong counter types, inconsistencies or upgraded safety flags.
The M19 CLI still exits with status 1 for any changed contract. It also
exits with status 1 if the M20 policy does not explicitly return
`ciPassAllowed: true`, which is possible only for nine
stable comparisons with **no** declaration.

The public M19 CI output includes one additional, sanitized
`changeReviewPolicy` block containing a fixed status, static group
names and the following always-false claims:

- humanApprovalVerified
- baselineReapprovedAutomatically
- pullRequestAutoMergeAllowed
- ubuntu24StrictSandboxGateWaived
- realModValidated
- installationAuthorized

## Test coverage / unchanged gates

CI tests cover all three review states, correct vs incompatible
declarations, stale approval attempts, wrong baseline/review issue,
truncated or forged M19 summaries, negative/boolean counters, duplicate
or unknown groups, safety-invariant promotion attempts, privacy, and
end-to-end integration with the M19 comparison code through mocked
subprocess calls (the analyzer still processes real synthetic ZIP bytes).

Nothing in M20 changes the protected X11 CI workflow, the prior M18
baseline, ZIP budgets, O3D fixture parser, game installation or the
product's permitted filesystem operations. No real mod inspection,
extraction, network/IPC in the product, or release actions.

**The strict Ubuntu 24.04 X11 failure tracked in issue #4 continues to
block the overall project even if all M20 tests are green.**
