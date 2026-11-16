# OMSI Manager | Phase 2 / M24 — CI check-context readiness (read-only)

**Branch:** feat/github-ci-context-readiness-audit-v1  
**Base:** PR #27 (M23). **Draft, no merge/release, no branch-rule writes.**

## The problem

Before enabling required checks on the repository default branch, we
must know whether those checks **actually execute** on every relevant
pull request and resolve to stable GitHub status-check contexts.

Observations already confirmed from the real repository:

- The default branch is **main**.
- The React Prototype Validation workflow was **not present on main**
  when inspected; it exists on the current feature-branch stack.
- The candidate workflow has a **pull_request.paths filter** permitting
  only react-prototype/** and .github/workflows/react-prototype.yml.
  Changes limited to other paths might not trigger the workflow. A
  branch-protection rule requiring one of its checks could remain pending.
- Its push trigger names **feat/react-nine-screens-safe**, not main.
  Default-branch post-merge push coverage has not been established.
- The pinned completed M22 CI run #43781261747 had 10 successful jobs
  and **one failed strict-sandbox Ubuntu 24.04 X11 job**. Ubuntu 22.04
  strict-sandbox succeeded.
- The X11 matrix has **two separate observable job labels**; the
  successful 22.04 job does not replace the failing 24.04 job.
- Other jobs have dependencies (for example X11 native requires build,
  and the forensic comparison requires both build and native X11).
  These dependencies and conditional execution affect when checks exist
  and what their final conclusions mean.

**We must not simply copy every Actions job name into required checks.**
An observed Actions job display name from a PR is a **candidate label**,
not authoritative proof of the exact check-run context selectable in
GitHub branch protection. M24 intentionally DOES NOT select any.

## M24 implementation

CI-only, read-only module controlled_ci_context_readiness.py:

1. Reads only the repository-controlled workflow source from this
   checkout; extracts fixed top-level job names, narrowly supported
   matrix expansion and dependencies, PR path filtering and push coverage.
2. Queries GitHub REST for repository/default branch and checks whether
   the candidate workflow actually exists at the **main commit SHA**.
3. Queries the completed, pinned M22 workflow run #43781261747 and its
   job names/states, and the current PR run and its job states.
4. Correlates fixed candidate job display labels with actual observed
   Actions jobs. Current in-progress jobs count as pending, **not passed**.
5. Exposes only static status categories, source-derived job labels and
   bounded counts. No authorization, repository token, real model file,
   source-archive hash, or arbitrary API output is published.
6. Returns **requiredCheckContextsSelected=[]**, always.
   exactRequiredCheckContextsVerified, safeToEnforceRequiredChecks,
   mergeAuthorized, branchRulesChanged and ubuntu24SandboxWaived
   remain false regardless of the outcome.

Readiness categories, ordered by conservative priority:

- defaultBranchWorkflowMissing
- ubuntu24ReferenceFailureBlocks
- pathFilteredChecksCanRemainPending
- noDefaultBranchPushCoverage
- manualRequiredContextConfirmationNeeded

Even the last status is **not** authorization to configure protections.

The new Actions job has permissions **contents: read** and
**actions: read** only. The GitHub API helper from M22 uses the fixed
api.github.com host, bounded responses and denies redirects.
No rulesets, CODEOWNERS, reviewers, PR statuses or files are edited.

## Safe next steps (manual, not performed by M24)

1. Investigate and resolve issue #4 Ubuntu 24.04 X11 with strict sandbox.
   Never mark it optional, suppress failures or bypass AppArmor/kernel.
2. Bring a reviewed, working workflow into main, preserving all mandatory
   security gates. This is a separate maintainership/release decision.
3. Make truly required checks run for **all relevant PRs**, even when
   changes are outside react-prototype/**. Do not rely on a path-filtered
   workflow to satisfy universal required check contexts.
4. Verify and stabilize default-branch events and dependencies.
5. Check actual check-run context names, event source/identity and
   completions via GitHub's check-runs or branch-protection controls
   on repeated relevant PRs; check for ambiguous duplicate names.
6. Only after an independent reviewer is confirmed, CODEOWNERS is
   properly reviewed, and gates are reliably green, manually test and
   enable reversible branch protection. No bypass identities.

This plan is conservative on purpose: **a green informational M24 job
means that the audit ran, not that protection is ready to turn on**.

## Non-goals and protections

- No extraction or reading of real OMSI mods, game folders, network
  from the end-user archive reader, installation or library mutation.
- No permissions/host policy/sandbox changes, merging or release.
- No automatic assertion of provenance, compatibility or game identity.
- No choosing reviewers or status checks by guesswork.
- PR remains Draft and the Ubuntu 24.04 strict-sandbox failure continues
  to block project homologation.

Reference: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
