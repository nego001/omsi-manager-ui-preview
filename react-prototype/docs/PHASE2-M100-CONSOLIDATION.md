# M100 — Phase 2 consolidation (2026-11-24)

## Decision

**BLOCKED_RELEASE / READ_ONLY_PREVIEW / SYNTHETIC_REPAIR_LAB_ONLY.**
This is a documentation-only checkpoint pinned to M99 commit `baf17f154a322ebd964df14c1b09cde636af1d12` (PR #106). No application code, workflow, security policy, branch rule, permissions, or release changes. This audit is not an independent approval.

## Verified CI snapshots

| Revision | CI run | Linux build, security, browser, IPC | Windows portable | Ubuntu 22 X11 strict | Ubuntu 24 X11 strict |
|---|---|---|---|---|---|
| M95 corrected | [45322545454](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45322545454) | pass | pass | pass | fail |
| M96 corrected | [45322555419](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45322555419) | pass | pass | pass | fail |
| M97 | [45322611771](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45322611771) | pass | pass | pass | fail |
| M98 | [45322742881](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45322742881) | pass | pass | pass | fail |
| M99 | [45322879892](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45322879892) | pass | pass | pass | fail |

All five overall workflows failed. M96 additionally failed the pinned base-policy observation. No overall pass may be inferred from successful component jobs.

M99 Linux build job 138205344158: security 305/305 pass, zero skipped/fail; Playwright 1101 passed; native folder IPC E2E OK. Windows preview job 138205343973: security 302 pass, 3 skipped, zero fail (305 declared); unsigned portable preview job success. Same-commit archive provenance and Arch container ELF audit jobs success; neither signs the package nor demonstrates a real Arch/Hyprland desktop.

## Ubuntu 24.04 mandatory gate

M99 jobs [strict X11](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45322879892/job/138208735102), [cross-runner comparison](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45322879892/job/138209760988), and [direct exit comparison](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45322879892/job/138209344888).

- Both runners reported the same archive SHA-256. Ubuntu 22 mapped native X11 windows; Ubuntu 24 did not.
- Xvfb baseline xmessage mapped on Ubuntu 24. Auto launcher and direct Electron control exited SIGTRAP for GNOME/KDE labels, before native window verification.
- Ubuntu 24 observed AppArmor module/restriction enabled and independent user namespace probe permission-denied; Ubuntu 22 probe allowed. Correlation, not proven AppArmor causality.
- Sanitized comparison classification: namespace-restriction-correlated-with-startup-failure. Admin handoff status: ubuntu24-native-window-blocked.
- Existing M45–M50 external review and ABA intake remain applicable; no approved external pilot or authenticated external evidence was supplied. No policy changes, bypass flags, global userns relaxation or gate waiver.
- Required next evidence: independent administrator approval and disposable VM/host identity, independently verified executed package, scoped app-specific policy review, baseline/pilot/rollback observations with real GNOME/KDE sessions and independently verified renderer confinement, rollback verification and mandatory strict Ubuntu 24 CI pass. Do not conflate Xvfb labels with real desktop sessions.

## Governance

M96 job 138204464051 refused with CONTROLLED_BASE_POLICY_AUDIT_REFUSED. Event pinned base SHA 719d5e3395e2b005e93528632d5195ac8bc75684 while M95 correction advanced the base to 4cf1527d11ecd305ae6a8992b6d48da63f229ba8; this is a plausible mismatch explanation, not a confirmed sole cause (log deliberately categorical). M97–M99 base observation jobs passed; M99 job 138205343836 reports exact head/base match, draft PR, base protected flag false, zero active rules reported, no CODEOWNERS file on that base, and no independent approval, satisfied required checks, or merge eligibility. This is read-only branch metadata, not proof about default-branch classic rules. Keep gate; obtain repository-owner review of branch policy and independent approval; use fresh exact-head/base evidence before any merge. No branch rule writes or self-approval.

## Runtime boundary review at M99

- Main/preload expose game inspection, Steam/custom location, selection/preferences and candidate structure hints, including explicit directory selection. M78–M80 implement limited local candidate inventory and session library; not a mod content parser. Read-only with respect to game files; application preference state is separate.
- M81A–M87: synthetic parser/reader/reference resolution, report, review guidance, rehearsal and revision comparison. No runtime diagnostic integration.
- M88–M99: self-created temporary file experiments, manifest, restart observation, sequential publication, multi-file assessment, reversal, cooperating reservations and stale-claim review. No native lock, atomic group restore, authenticated cross-restart backup, production repair or real mod validation.
- Both package scripts exclude scripts/, native-lab/, tests/ and other development directories from app.asar; Linux packaging explicitly copies selected desktop integration/session diagnostics scripts separately. Main/preload direct imports inspected; no M81–M99 lab entry point observed. This is a static source review, not a complete transitive or packaged-byte audit.
- M98 exclusion applies to cooperating workers only. M99 missing reservation is not retried. No automatic recovery/reclaim.

## Next engineering gate (M101)

Keep write/recovery interfaces absent. Prioritize production boundary and packaging verification: inspect actual archive inventory in CI, assert absence of synthetic repair entry points and dependency graph reachability, and recheck existing native-picker/epoch permissions. Only after a separate review design a bounded **read-only** real OMSI configuration inspection adapter with explicit native selection, platform/encoding contract, containment, identity/change checks, size/entry budgets, cancellation, sanitized results and fail-closed behavior. No real file content or new IPC authorization in this checkpoint.

Before release: resolve Ubuntu24 strict native gate, obtain independent policy/review evidence, validate actual native desktop sessions (including Hyprland if claimed), confirm artifact provenance/signing as required, and rerun applicable tests against exact release commit. All repair/write permissions remain blocked; no merge or release authorized.
