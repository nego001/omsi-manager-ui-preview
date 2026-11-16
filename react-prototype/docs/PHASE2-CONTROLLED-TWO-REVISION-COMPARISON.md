# OMSI Manager | Phase 2 / M19 — two-revision CI fixture comparison

**Branch:** feat/controlled-fixture-two-revision-ci-v1
**Base:** PR #22 / M18. All PRs remain Draft, no merge/release.

## Why M19 exists

M18 defined an immutable, SHA-256-scoped private comparison snapshot and
golden synthetic fixture contracts, but did not execute **two actual source
revisions**. M19 adds a **separate GitHub Actions job**, limited to a disposable
hosted CI workspace and a **fixed M18 baseline commit**:

- baseline: c260b0b5e6325c44766788a528e8a2aee8237333 (M18);
- candidate: the current PR revision supplied by GitHub checkout.

The two revision checkouts live in separate, ephemeral directories
`baseline/` and `candidate/`. Credentials are not
persisted in either checkout. This is independent of the build/Playwright
job. It does not modify the strict Ubuntu 24.04 sandbox matrix.

## Comparison protocol

1. The M19 orchestrator (candidate source code) creates **nine small fixed ZIP
   test fixtures in memory**, with deterministic filenames, timestamps and
   bytes. None is read from the user, downloaded or stored in a game folder.
2. For each single fixture, Python subprocess A uses **only the M18 checkout's
   analyzer modules** and subprocess B uses **only the candidate checkout's
   modules**. Each interpreter starts with `-I -S -B` and a minimal environment;
   both receive the **exact same bytes over standard input**.
3. Each child computes its own M18 regression snapshot and emits only the
   seven closed groups of already sanitized outcomes and counts. It does
   **not** emit its SHA-256 digest, paths, module names, original ZIP bytes
   or private information.
4. The parent reconstructs private, hash-scoped M18 snapshots from the
   identical fixture it supplied, validates typed group schemas, and invokes
   the M18 comparator. A changed contract is `reviewRequired`,
   with only the names of changed static groups. This marks a **manual
   review requirement**, not an automatically proven software defect.
5. If **any** fixture differs from the fixed baseline, the new CI job
   **fails**. No implicit acceptance/approval or baseline mutation.
   Child errors, timeouts, malformed outputs or unrecognized classifications
   fail closed with a constant message and without echoing stderr.

The nine fixtures include the seven existing M8/M17 fixture assessments,
plus one synthetic model through M13 with absent optional bones and one
through M14 with an optional bone and a vertex weight. That protects both
the decision layer and deeper O3D structural evidence from accidental drift.

## Security boundaries

- Inputs **only from source-controlled, original synthetic fixture constructors**.
- Orchestrator CLI accepts **no path, ZIP or commit arguments**; checkout paths
  are fixed to the workspace. Unit tests exercise functions directly.
- GitHub Actions checkout may contact GitHub to obtain two pinned source
  revisions; the **analyzer itself does no network access**.
- This CI-only orchestration uses subprocesses and temporary **source
  checkouts**, not real mod files or the OMSI installation. The end-user
  controlled ZIP reader still has no filesystem/subprocess/network APIs.
- CI already uses Python and performs no extra package installation for
  this comparison. Child stdout is strictly capped and stderr never logged.
- No unsigned baseline promotion or trust statement. A fixed Git commit SHA
  is *version identity*, not a signature of trusted source provenance.
- M18's strict byte-equivalence rule still applies; ZIP entry reorder or
  content change is a **different experiment**, not a code regression.

## Gates remain unchanged

The comparison result always states:
`baselineAuthenticityEstablished=false`,
`changeIsAutomaticallyProvenRegression=false`,
`realModValidated=false`,
`installationAuthorized=false`.

The main app continues to expose only the earlier synthetic diagnostics.
No real mod inspection, extraction, installation, real-game identification,
compatibility certification or library mutation. Even when this job passes,
**Ubuntu 24.04 X11 strict sandbox remains a mandatory release blocker**
(issue #4) and no PR can be merged or released automatically.
