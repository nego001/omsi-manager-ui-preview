# OMSI Manager | Phase 2 / M25 — unfiltered PR CI coverage

**Branch:** feat/github-unfiltered-required-ci-coverage-v1  
**Parent:** PR #28 / M24. **Draft, no merge or release.**

## What M24 demonstrated

The candidate React Prototype Validation workflow existed only in the
feature-branch stack, **not** on the default `main` branch. Its
`pull_request.paths` filter excluded PRs that changed only unrelated
files, while its push trigger did not include `main`.

A required GitHub check is unsafe to configure if some PRs never trigger
the underlying workflow, because the check may remain pending forever.
The actual required check context IDs have **not** been verified or
selected. The Ubuntu 24.04 real-window sandbox check has **not passed**.

## M25 code change

The candidate workflow now declares:

```yaml
on:
  push:
    branches: [feat/react-nine-screens-safe, main]
  pull_request:
```

This removes path, base-branch and PR-event-type filtering from the
candidate workflow. Once this workflow is present on the applicable
branch, a docs-only or other outside-`react-prototype` PR is no
longer excluded by the workflow's `pull_request` trigger definition.

This statement refers to **trigger configuration**, not a tested
end-to-end docs-only PR, guarantee of runner availability or proof of a
successful required status check. GitHub may still block or fail runs
for legitimate security or service reasons.

The push trigger now includes `main` for future post-merge verification.
This does not put the workflow on `main` now: the change remains in a
**Draft feature PR**.

## Mandatory safety checks remain mandatory

- The existing `build` job and both X11 strict-sandbox matrix jobs
  retain their original dependency chain.
- `native_auto_x11` still has `needs: build`,
  `fail-fast: false`, and runner matrix
  `[ubuntu-24.04, ubuntu-22.04]`.
- `native_x11_evidence_compare` may still run after a failed native
  job only to upload sanitized forensic evidence. Its success **does not
  waive or replace** the failed Ubuntu 24.04 native test.
- Windows native/portable, Arch, the same-commit archive audit, and
  the two-revision synthetic-fixture regression contracts remain
  separate jobs. Critical jobs cannot acquire new job-level conditions
  or `continue-on-error` unnoticed by the M25 contract.
- Existing strict X11 workflow-admission tests run unchanged.

The new `controlled_ci_event_coverage.py` checks the exact trigger
shape, that the default-branch push remains declared, the existence of
the critical jobs and the dependency of native X11, Arch and archive
parity jobs. It rejects new PR `paths`, `paths-ignore`,
`branches`, `branches-ignore`, narrowed `types`, a
`pull_request_target` trigger, conditional critical jobs and X11
`continue-on-error`.

The candidate workflow's `build` job runs the new M25 adversarial
tests early, before the main test suite. The tests use only synthetic
workflow-string mutations.

## Explicit blockers

The following **remain false**:

- actualDocsOnlyPullRequestExecutionVerified;
- workflowExistsOnMainVerified;
- exactRequiredCheckContextsVerified;
- branchProtectionChanged;
- ubuntu24StrictSandboxWaived;
- mergeAuthorized;
- installationAuthorized.

`requiredCheckContextsSelected` is deliberately **empty**.

### Next human review steps

1. Review this broadening of PR-trigger coverage and its CI resource
   cost, especially for docs-only changes. The stronger coverage is
   intentional if these jobs may later become required checks.
2. Resolve issue #4 on Ubuntu 24.04 using unchanged strict-sandbox
   evidence. Never suppress a red run to make protections green.
3. Test actual docs-only and code PRs through GitHub Actions, with a
   workflow present on the appropriate target branch.
4. Independently verify exact check-run contexts, event sources,
   matrix suffixes and consistent execution across branches.
5. Establish trusted independent reviewers and CODEOWNERS policies.
6. Only then consider manually configuring required checks and branch
   rules, with a verified rollback procedure.

## Security boundary

No real OMSI mod inspection, install, archive extraction, game-folder
access, library mutation, privileges, token escalation, auto-merge,
review submission, branch protection or X11/AppArmor relaxation.

M25 changes only the **candidate workflow triggers, its test guard,
and documentation**. All PRs remain Draft.
