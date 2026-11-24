# M120 — native diagnostic consolidation (2026-11-24)

**METADATA_ONLY_PREVIEW / NATIVE_FIXTURE_LAB_ADVANCED / CONTENT_READ_BLOCKED / RELEASE_BLOCKED.**
Documentation only, pinned to M119 77a40a290ae0831cd7d2cd6514f8d1b72f96fbe1. No independent approval inferred.

## Exact evidence snapshot

| Milestone | Run | Observed evidence |
|---|---|---|
| M109 4ad6483 | [45408220884](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45408220884) | Browser and actual Electron IPC steps passed, simulated picker replies only |
| M111 641b4d7 | [45409115767](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45409115767) | Linux descriptor fixture security passed; Windows portable passed |
| M112 original 3b2046c | [45409450868](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45409450868) | Native C# CS0165 compile failure; Windows portable passed |
| M112 corrected 399de47 | [45409987780](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45409987780) | C# compile passed; native fixture execution failed |
| M113 corrected de60267 | [45410013093](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45410013093) | Linux security passed; Windows native execution failed; base observation failed |
| M114 0cfd6b5 | [45410122851](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45410122851) | Linux security passed; native Windows fixture execution failed |
| M115 e93a59c | [45410453016](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45410453016) | Linux security and actual Windows fixed-format test passed; M112 suite still failed |
| M116 6dea0ef | [45410723964](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45410723964) | Linux metadata fixture security passed; Windows diagnostic located parent-replaced:before-open |
| M117 90e530a | [45410973467](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45410973467) | Windows metadata test passed with ambiguity skipped; native suite had two failures |
| M118 db90f3a | [45411273980](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45411273980) | Linux build/security passed, browser running and IPC pending; Windows portable and standalone passed |
| M119 77a40a2 | [45411854125](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45411854125) | Linux build/security passed; Windows standalone compile passed, tests running; Windows portable security running; browser/IPC pending |

Snapshot is step/job evidence, not a completed overall workflow certification. Original failures retained in history. M118 native job 138505401989: 139 passed, five skipped, zero failed, 144 declared. Actual parent replacement unavailable because OS refused rename setup; actual file reparse refusal passed. Actual dependency case collision unavailable; actual link refusal passed. M118 portable job 138505401977: 343/355 security passed, 12 skipped, zero failed; separate 3/3 tests and 218/220 recovery tests (two skipped). Packaged archive inspected 19 Electron modules, static imports and lab/test exclusions; unsigned and not certified. M119 current native suite results pending; do not claim repeatability.

## Scope inventory

Production preview: Steam/custom install discovery, local inventory, directory structure hints, native individual config metadata selection (fixed picker/filter, no file content). UI contains explicitly fictional diagnostics. M108 metadata permission does not imply content authorization. M113 shared pure report validation is renderer code; M102–M106/M111–M119 laboratory reader/consent/bridge paths and standalone native executable remain outside packaged runtime. M115 reads actual bytes only from fixed self-created fixtures; M116/M117 observe independent synthetic dependency directories. M118/M119 aggregate independent reports, not a linked same-file identity chain. No native consent from an actual user, dependency content reads, real mod validation, repair, install, backup or delete capability.

## Gates still closed

- M119 base-policy job 138507475227 observed no active rules, no CODEOWNERS, base protected flag false, draft and exact revision matched. Independent review job 138507473868: zero submitted/current-head approvals; pending independent review. Successful read-only observation is not approval.
- M119 historical strict Ubuntu24 job 138507474017 reproduced metadata of three earlier pinned failures; currentRevisionStrictUbuntu24Passing=false, admin pilot not approved, AppArmor causality unproven, no host change or waiver. M119 current strict matrix not completed. Ubuntu22 is not a substitute.
- Windows parent replacement and case ambiguity unavailable; Linux lacks dedicated dependency hardlink fixture and Windows lacks partial budget counterpart. Synthetic comparator cannot establish full parity. No validated native ownership/consent handoff to packaged Electron or bounded real-world scan lifecycle.
- No proof of race-free containment, all ABA prevention, hard OS I/O deadlines or real desktop native dialog/portal behavior. Signing and independent review remain outstanding.

## Proposed next phase (not authorization)

M121: test a single self-created Linux fixture tree with native config read and actual metadata lookup in the same retained directory identity; no path arguments or production imports. M122: equivalent Windows test with fixed fixture, report unavailable cases honestly. M123: add cross-platform gap cases (Linux dependency hardlinks, Windows budget exhaustion) and reproduce parent replacement/case collision only where the OS permits; never weaken policies to force them. M124: review monotonic deadlines, cancellation/resource cleanup and byte transport boundaries. M125: document a separately reviewed explicit consent and native handle handoff proposal, including unsupported-system refusal. M126: independent desktop/Ubuntu24 gate evidence before considering any real-content runtime change. Actual real-file reading, installation, deletion and repair remain blocked unless their own gates are satisfied. No merge, release, host policy change or sandbox waiver in M120.
