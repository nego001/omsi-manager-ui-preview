# OMSI Manager | Phase 2 / M21: independent PR review observation

**Branch:** feat/github-independent-review-observation-v1  
**Base:** PR #24 / M20. **Draft, no merge or release.**

## Scope

M20 allowed a source-controlled statement of intent for a synthetic
contract change, but never treated this as an independent GitHub approval.
M21 adds a separate, read-only CI job that queries **actual GitHub REST
review submissions** for the exact pull request in the GitHub event.

A successful M21 observation is **not PR approval**, and a detected
approval is **not release authorization**.

## Review evidence conditions

A positive independent approval observation requires all of these:

1. PR is open; API PR number and current head commit SHA match the GitHub
   event exactly. Draft PRs remain Draft regardless of review records.
2. The reviewer's **latest submitted review** is APPROVED on the exact
   current head. PENDING is ignored; later COMMENTED, DISMISSED or
   CHANGES_REQUESTED entries cannot inherit older approvals.
3. Reviewer login is different from the author's login, regardless of
   capitalization; bots never count.
4. GitHub reports association OWNER, MEMBER or COLLABORATOR.
5. A separate read-only permissions lookup confirms GitHub write,
   maintain or admin access. Read/triage access does not qualify.
6. If a qualifying reviewer requested changes on this head, that state
   takes precedence over somebody else's positive review.

The API cannot authenticate a person's real-life identity. The module
does not inspect all branch-protection rules or CODEOWNERS requirements.

## Public output

Only fixed statuses and aggregate counts, no usernames, email addresses,
review text, commit hashes, paths or credentials:

- draftPendingIndependentReview
- independentReviewPending
- independentChangesRequested
- independentApprovalObservedNotRelease
- approvalOnPreviousCommitNotCurrentHead

The audit always reports the following as FALSE:
verifiedRealHumanIdentity, branchProtectionSatisfied,
m20RegressionGateWaived, pullRequestAutoMergeAllowed,
ubuntu24StrictSandboxGateWaived, realModValidated,
installationAuthorized.

A positive result does not permit auto-approval, merge, installing real
mods, or dismissing any open GitHub issue.

## CI design and limits

Job: github_independent_review_observation, running only for pull_request
events in an ephemeral GitHub-hosted Ubuntu 22.04 runner.

- Checks out the repository with credentials NOT persisted.
- Actions token permissions: contents: read and pull-requests: read only.
- The CLI accepts no arbitrary PR URLs, paths or repository selection:
  it uses the exact repository, PR number and head SHA in event variables.
- GitHub API queries are read-only, limited to two pages (fewer than
  200 review records) and up to 16 reviewer permission lookups.
- Any GitHub API failure or malformed/suspicious evidence refuses with
  the fixed error CONTROLLED_GITHUB_REVIEW_AUDIT_REFUSED.
- The pure classifier is independently tested with mock metadata;
  the CI command queries GitHub read-only and prints sanitized counts.
- No methods submit a review, dismiss, merge, mutate branch protection,
  read real OMSI mods, change game directories or allow installation.

**A green audit job means only that live review metadata was inspected.**
The M20 regression gate and Ubuntu 24.04 strict X11 gate remain unchanged,
blocking release whenever they fail. PRs stay Draft, unmerged.
