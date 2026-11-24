# M129 — strict Ubuntu24 blocker and historical evidence re-observation

Decision: **EXTERNAL_ADMIN_EVIDENCE_REQUIRED / STRICT_UBUNTU24_BLOCKED / CONTENT_READ_BLOCKED / RELEASE_BLOCKED**. No host policy changes, no independent approval.

## Current CI status

M128 head 58a4f4739afbae64bd4d889108b3c2b4cd3b509c, run [45461658057](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45461658057): Linux build/security passed; Windows native/portable and browser/IPC pending at observation. Three read-only evidence jobs failed independently:
- 138685556660 CONTROLLED_CROSS_PR_CONTEXT_COMPARISON_REFUSED
- 138685556810 CONTROLLED_UBUNTU24_REPEATABILITY_REFUSED
- 138685556990 CONTROLLED_DOCS_ONLY_CHECK_RUN_AUDIT_REFUSED

Their generic sanitized refusals do not establish HTTP rate limiting, changed repository identity, a new Electron startup failure or other specific cause. No reruns or weakening of checks performed. M127 run 45461288641 standalone Windows job and Linux security passed at observation. Overall statuses pending.

## Direct read-only re-observation of the original pinned historical records

Independently of those failed CI invocations (not independently of GitHub), queried Actions run metadata and jobs with filter=latest, per_page=100 for exactly the M28 historical runs. All three remain completed failures with the expected repository, event, head, branch, PR links and 13/13/14 jobs. Each lists one strict Ubuntu24 failure; all remaining jobs succeeded.

| Run | Head | PR | Jobs | Ubuntu22 strict | Ubuntu24 strict |
|---|---|---|---:|---|---|
| [43784985561](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/43784985561) | 7879d10780c4a89c11350e137f71600ce34d19d0 | 29 | 13 | success | failure |
| [43785621826](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/43785621826) | 3d600a8b186484ae04e8f8a64d7185e8d2a8cddf | 30 | 13 | success | failure |
| [43786218414](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/43786218414) | fcd5bcbae3829a9ae06651782fa4f054e53fa193 | 31 | 14 | success | failure |

Also queried PR #30/#31 and their file lists and check runs: both remain open drafts with expected head and base 7879d10780c4a89c11350e137f71600ce34d19d0. PR30 changes only added docs/ci-m26-docs-only-trigger-probe.md (25 lines); PR31 changes four expected code/docs files. PR30 has 13 check runs and PR31 has 14, all matching exact run/job details URLs, head SHA and GitHub Actions app. These are point-in-time connector observations, not a replay of CI's token/requests or evidence that all original validator predicates passed. Original refusals remain recorded. No required status rule or code changes. These checks are not approval.

## Latest completed controlled comparison available from M125

[Run 45413711697](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697), strict job 138520312005 and comparison job 138521164381: same archive SHA256 observed, Ubuntu22 namespace allowed and mapped native windows; Ubuntu24 namespace denied, AppArmor restriction enabled, X11 baseline mapped, Auto and direct Electron SIGTRAP before window. No AppArmor causality proof. Direct comparison job 138521236815 still reports awaiting-admin-authorization-and-external-aba-records. No independent real desktop/renderer evidence. M124 also had mandatory Ubuntu24 failure. No fresh successful strict result in this review.

## Stop condition / next work

M46 external A1/B/A2 protocol already specifies authorized disposable Ubuntu24 VM, independent administrator, package custody, GNOME/KDE real desktop baseline, narrow separately approved app-specific policy pilot only if appropriate, renderer confinement evidence and verified rollback. No such authorization or external observation supplied. Do not run a host policy change or disable sandbox to advance milestones. M127 manual checklist and M128 categorical intake are ready; no actual operator record.

M129 concludes that more identical synthetic runs do not remove the external blocker. M130 may audit the non-authorizing handoff and preview-only usability; native broker/content integration M131 and beta release M132 remain conditional. If no external test environment, pursue useful metadata-only preview improvements without expanding file permissions, or stop at this boundary. No merge, release, installation, real mod reads, strict sandbox waiver, or branch protection change. This review changes documentation only.
