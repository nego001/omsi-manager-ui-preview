# OMSI Manager | Phase 2 / M22 — base-branch rules and CODEOWNERS observation

**Branch:** feat/github-base-policy-codeowners-audit-v1  
**Base:** PR #25 / M21. **Draft only; no merge or release.**

## Goal

M21 checks actual GitHub PR review submissions. A review observation
does not mean that all branch policies have been fulfilled. M22 adds a
**read-only** GitHub Actions observer to inspect active target-branch rules
and CODEOWNERS at the **exact target base SHA** from the PR event.

M22 never approves a PR, modifies repository rules, merges code,
touches mods, or waives the Ubuntu 24.04 strict X11 blocker.

## Evidence sources and limits

- GitHub REST GET PR, GET target branch, and GET effective active rules
  for the target branch, including applicable rulesets at repository
  and organization level (disabled/evaluate rules are not active).
- Counts active pull_request rules, required_status_checks rules, the
  configured minimum review count, and the code-owner-review rule flag.
  These are **observed policy settings**, not satisfied review/checks.
- The branch object's protected flag is only an observation. Full
  classic branch protection details require elevated Administration
  read permission and are NOT verified by this CI token.
- CODEOWNERS is read from **the base commit**, not the feature branch,
  with GitHub's precedence: .github/CODEOWNERS > CODEOWNERS > docs/CODEOWNERS.
  Only source category and assignment-like line count are returned.
- No attempt to implement GitHub's complete CODEOWNERS matcher, validate
  owner permissions or establish which changed files are covered.
- Special GitHub native stacked-PR base semantics and every merge rule
  are not certified. The audit concerns the event's direct target base.

If GitHub reports zero rules, this does not prove classic protection is
absent. If CODEOWNERS is absent, this is reported as **not configured on
the target base**, not as an approval.

## Output

Fixed, anonymous statuses:

- draftUnreviewedPolicyObservation
- noEnforcedRulesObservedNotApproval
- activeReviewRuleObservedNotSatisfied
- incompleteBranchProtectionEvidence

All of these remain FALSE regardless of any reported rules or owners:

- codeownersCoverageVerified
- classicProtectionDetailsVerified
- branchProtectionSatisfied
- requiredChecksSatisfied
- independentCodeownerApprovalVerified
- mergeEligibilityVerified
- ubuntu24StrictSandboxGateWaived
- realModValidated
- installationAuthorized

Only fixed category names and bounded counts are returned. No CODEOWNERS
patterns, GitHub usernames, hashes, paths, review text, or credentials
appear in the report.

## CI-only safety

Job github_base_policy_codeowners_observation:
- Runs only for pull_request events on disposable GitHub-hosted Ubuntu 22.04.
- GITHUB_TOKEN restricted to contents:read and pull-requests:read.
- No credentials persisted in the checkout.
- Only fixed api.github.com HTTPS routes; redirects denied to prevent
  forwarding credentials to a different host.
- Strict bounded JSON and CODEOWNERS decoding; any unknown API failure,
  moved base SHA, wrong ref, malformed rule or oversized data fails
  closed with CONTROLLED_BASE_POLICY_AUDIT_REFUSED.
- Missing individual CODEOWNERS paths (404) are treated as absence.
- Adversarial tests use fake metadata only: no real mod or GitHub writes.

**A green M22 job proves that a read-only observation ran, never that
the branch is mergeable or the code owner has approved it.**

M20 regression comparison remains required; Ubuntu 24.04 X11 strict
sandbox issue #4 remains blocking. Draft PRs cannot be auto-merged.

References:
https://docs.github.com/en/rest/repos/rules#get-rules-for-a-branch
https://docs.github.com/en/rest/branches/branch-protection#get-branch-protection
https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
