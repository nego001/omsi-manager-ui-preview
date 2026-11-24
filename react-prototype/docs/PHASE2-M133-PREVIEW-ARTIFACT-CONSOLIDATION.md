# M133 — experimental preview artifact consolidation (24/11/2026)

**UNSIGNED_PREVIEW / CI_PARTIAL_PASS / CONTENT_READ_BLOCKED / RELEASE_BLOCKED.** Documentation only. No release, installer, runtime permission change or merge.

## Completed M131 candidate

Draft PR #138, head fbe561b89f3b3426b8fc5a765b280373dbeaa34f, [run 45464785611](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45464785611), completed failure. Two failed jobs: cross-PR context comparison 138696671037 and mandatory Ubuntu24 strict X11 138701381415. Do not claim full CI success.

- Linux build/security/browser/IPC and packaged GUI passed (138696670694). The M131 narrow interface layout test and mocked-dialog IPC clear-result assertion passed in their respective suites.
- Windows portable build/security/package and GUI passed (138696670487); security 362 passed, 16 skipped, zero failed, 378 declared. Both new M131 projection tests passed. M101 verified 19 Electron modules, static imports and lab/test exclusion; signature and sandbox certification flags false.
- Windows standalone lab passed (138696670667): 150 passed, six skipped, zero failed, 156 declared.
- Ubuntu22 strict X11 and Windows/Linux archive provenance jobs passed; Ubuntu24 mandatory strict gate failed again. No independent desktop, portal, native handle or renderer confinement evidence. Historical cross-PR refusal persists; root cause not established.

## Exact M131 artifact custody

Both listed unexpired at observation. Outer Actions ZIP SHA256 from API agrees with downloaded digest in same-commit provenance job 138701381521. This review did not independently download/hash the bytes or verify package signatures. These are experimental artifacts only, for independently authorized disposable test environment under the M127 procedure updated to this exact candidate; not recommended for daily workstation installation.

| Platform | Exact artifact ID | Outer SHA256 | Expiry UTC |
|---|---|---|---|
| Linux x64 | [14955067819](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45464785611/artifacts/14955067819) | 751d9b7192b976ded39077886e3f23bcbcddcd0e90087a344c06e3f8716bb1c5 | 2026-12-08 19:03:16 |
| Windows x64 | [14954887183](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45464785611/artifacts/14954887183) | 6d82bdd92fc6d860fb455e8d5a1679360fd21941a0b52814bc21b4818562bd4c | 2026-12-08 18:57:52 |

Visual review: [14955625979](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45464785611/artifacts/14955625979), Windows runtime screenshots [14954452768](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45464785611/artifacts/14954452768). These are screenshot artifacts, not programs. No visual fidelity certification inferred; screenshots not independently inspected in this review.

Do not reuse M125 hashes for M131 or treat M128 pinned M125 claim intake as M131 evidence. Separate reviewed custody record required for any newer candidate. Expired or mismatched bytes: stop, no substitution.

## M132 documentation revision

Head 2cbbb75cdeeae6f1d89c6336f0ec508a47a307c0, run 45465200391: Linux build/security/browser/IPC/packaged GUI, Windows standalone and portable package/GUI jobs passed; provenance passed. Ubuntu24 strict real-window step failed; run still in progress at observation. Its distinct artifacts were listed but not adopted as the completed candidate in this review.

## Next work

M134: improve session-local inventory usability, with fixed bounded metadata, search/filter, clear state and no persistence of private paths. M135: improve presentation of inspection status. M136–M137: integrate visual navigation without real content access. Continue product decision register priorities. All native content, modification, installation and release gates remain closed. No repeated synthetic approval claims in place of external desktop evidence.
