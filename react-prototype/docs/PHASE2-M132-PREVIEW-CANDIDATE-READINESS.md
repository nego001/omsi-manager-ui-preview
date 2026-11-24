# M132 — experimental preview candidate readiness

**PREVIEW_CANDIDATE_PENDING_CI / UNSIGNED / NOT_BETA / CONTENT_READ_BLOCKED / RELEASE_BLOCKED.**
No binary release, version bump, merge, signing claim, host policy change or runtime source modification.

## Pinned candidate

M131 draft PR #138, commit fbe561b89f3b3426b8fc5a765b280373dbeaa34f, [run 45464785611](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45464785611). This is the code revision containing the clearer metadata-only panel. M132 is a documentation update, not a newly validated binary. At the point of this review:
- Linux job 138696670694: build and security passed; browser running; IPC and Linux archive upload pending.
- Windows job 138696670487: build, security, packaging and real GUI smoke steps completed; validation/compression running, preview upload pending.
- Windows standalone job 138696670667 passed.
- GitHub historical strict sandbox read-only job passed; cross-PR check contexts job 138696671037 failed. No cause established here.
- Windows screenshots artifact 14954452768 present, but not a portable package. Neither M131 portable package was listed in the artifact snapshot. Do not invent download IDs, digests or claim a validated executable. Re-query exact run after completion; record actual artifact IDs and digests only when available.

M130 [45462358501](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45462358501) completed with all jobs passing except mandatory Ubuntu24 strict X11. Do not transfer its pass results to M131. The older M125 unsigned artifacts and their custody record in M127 are a different revision, not the M131 UI.

## Scope for the user

| Available in preview (subject to candidate CI) | Boundary |
|---|---|
| Catalog, favorites, filters, details, declarative reports | Metadata or illustration, not real compatibility or installed state |
| Steam/custom installation discovery and ETS2/ATS mod-folder profiles | Limited observations, no modifications |
| Selected-folder candidate inventory and OMSI structure hints | Non-recursive metadata; not verified installation |
| Individual .bus/.ovh/.cfg selection and precheck | 1–65536 bytes, candidate extension and size, no name/path shown, no content/dependency reads |
| M131 clearer local result, limits, busy state, clear action | Transient renderer state; no new file API |
| Dependency examples and review guidance | Explicitly fictional |
| Native linked config/dependency reader, consent and rollback labs | Test-only, excluded from packaged runtime |
| Real diagnosis/repair/backup/restore/install/remove/update | Blocked |

Do not confuse importing an explicitly selected declarative JSON catalog with opening game configuration content. Neither operation authorizes changes to a game.

## Admission requirements

Before labeling a candidate beta: completed current CI including strict Ubuntu24; matching current archive/actual executable custody and signature as required; authorized desktop acceptance on real supported sessions; actual native picker/handle provenance and independent renderer confinement; independent review and enforced branch protection. M126/M129 document unresolved strict sandbox and historical evidence refusal. M127/M128 supply manual checklist and categorical claim intake but no external result. Do not waive gates or use a weaker fallback.

M132 only records readiness and updates the README so users do not mistake a hosted static demo, an Electron preview, a native lab or a beta release for one another. If M131 CI completes with a regression, correct and revalidate that exact scope; if successful except the known external gates, record the actual candidate artifacts as unsigned, test-only. For subsequent useful development, improve preview-only UX and metadata reports based on the product decision register; defer real-content broker integration until external evidence is supplied. No release authorized.
