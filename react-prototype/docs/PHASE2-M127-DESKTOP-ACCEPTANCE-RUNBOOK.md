# M127 — Desktop metadata-only acceptance runbook

Status: **AWAITING_AUTHORIZED_OPERATOR / NOT_EXECUTED / CONTENT_READ_BLOCKED / RELEASE_BLOCKED**.
M126 draft PR #133, commit edd3b28cec6d5a581a041bee28deca250da3de0b, run 45460026805: Linux build/security, Windows portable and native standalone jobs passed; browser running at snapshot; read-only docs-only GitHub check-run evidence job 138679767776 failed CONTROLLED_DOCS_ONLY_CHECK_RUN_AUDIT_REFUSED. Cause not established. No reclassification as pass.

## Candidate custody — exact M125 archived preview, not a release

[Run 45413711697](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697), head 07e14cc1a2682a8ec14fa3fe5914830e7bbf42c8, draft PR #132. Overall failed mandatory Ubuntu 24.04 strict X11. Candidate use only for separately authorized disposable desktop test, not daily-workstation installation.

| OS | Artifact name | Artifact ID | Outer Actions ZIP SHA-256 |
|---|---|---|---|
| Linux x64 | OMSI-Manager-Preview-Linux-x64-UNSIGNED | [14932127039](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697/artifacts/14932127039) | 500b5e3437144c979642640a8230b8e798f514a8d7621895a99e50823b12f413 |
| Windows x64 | OMSI-Manager-Preview-Windows-x64-UNSIGNED | [14932250410](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697/artifacts/14932250410) | 5ce6fcf6defe155024e2aa7777664e6ee8e980779936c1b5e36a41e6eeac4541 |

Artifact API metadata and job 138520311895 agree on outer digest; bytes were not independently downloaded or hashed by this review. Both listed as unexpired, expires 2026-12-08 14:26:21Z Windows and 14:33:31Z Linux. Expired/missing candidate: stop and establish a new pinned custody record, never silently substitute a newer artifact. Linux inner archive comparison reported b9e61efdb843c684e603985bd16599c18e892e43fbd48c67ac92879ee98136b6 in M125 job 138521164381; do not compare this value with the outer ZIP. Verify actual inner archive identity and matching provenance before extraction; outer ZIP digest is not executable signature.

Operator obtains separate approval for a disposable VM or dedicated test desktop, non-admin account, no real games or personal data, current OS patches, rollback snapshot, independent reviewer and trusted artifact acquisition. Never disable antivirus, sandbox, AppArmor or other restrictions. Independently download the exact outer ZIP from Actions, hash with sha256sum or PowerShell Get-FileHash -Algorithm SHA256, compare to the corresponding value above, and inspect archive entries using trusted tooling before extracting to a new empty isolated directory. Reject absolute/traversal paths, links, unexpected entries or mismatched hashes; do not run an archive automatically. Check inner archive and package provenance against the exact same run, privately record hashes of actual executable and app.asar, and have reviewer check the original evidence. Unsigned artifacts remain unsigned even if all checks match. Stop if acquisition, extraction or trust is uncertain.

## Test matrix — one record per actual environment

Linux GNOME Wayland/X11, KDE Wayland/X11, Hyprland Wayland, and Windows 10/11 x64 NTFS where an authorized test environment exists. Do not infer an unavailable session from hosted CI or another desktop. Ubuntu24 strict X11 and independent renderer confinement remain separate mandatory gates. No external environment is available or tested by M127.

Existing pilot scripts at the pinned source are optional instrumented tests for folder selection and Auto launcher, not the single-file metadata test. See scripts/manual-wayland-portal-smoke.mjs and scripts/manual-auto-launch-smoke.mjs. If used, source must match candidate head and package layout must be verified; run only in matching non-root interactive session after independent review. Never use dev/browser mode as proof of native chooser. Never use --no-sandbox, sudo Electron, a global user namespace change or a weaker fallback.

## Individual configuration acceptance (metadata only)

In a fresh disposable working directory, create a new uniquely named test folder containing two harmless ASCII files named alpha.bus and beta.cfg, with exactly 16 and 24 bytes respectively (ASCII A repeated 16 times and ASCII B repeated 24 times, no newline). Create a third file oversized.bus with 65537 ASCII A bytes, and empty.bus with zero bytes. No real configuration contents, symlinks or actual game files. Record independent lengths and SHA-256 of all four files before testing. Use the package's normal launcher and the application's Minha biblioteca screen, region "Pré-checagem de configuração local". The feature does not need a game folder or installation. Do not select any path outside the test directory.

| Case | Action | Expected categorical outcome |
|---|---|---|
| startup | launch normally; verify an actual owned/mapped app window | visible; otherwise stop, record startup-failed |
| cancellation | click "Selecionar arquivo para pré-checagem"; cancel native dialog | "Seleção cancelada." |
| first selection | select alpha.bus | ".bus · 16 bytes · conteúdo não aberto." |
| second selection | select beta.cfg | ".cfg · 24 bytes · conteúdo não aberto." (not stale first result) |
| oversize | select oversized.bus | fixed error, no metadata success |
| empty | select empty.bus | fixed error, no metadata success |
| navigation | if actual UI permits, leave or close originating document during pending chooser, then complete only the fixture choice | no stale success in new document; if not possible, unavailable |
| busy | if actual UI permits, attempt second selection while first chooser pending | no concurrent dialog; if not possible, unavailable |
| feature boundary | inspect library demonstration, blocked content button and UI outputs | fictitious diagnosis, no actual dependency reading, no repair/install action |
| cleanup | close application normally; compare all four lengths and hashes; delete only own disposable fixture after review | original fixture bytes match; test directory removed |

A visual metadata result and unchanged fixture bytes do not establish no content read; independent process-level observation and source/IPC audit would be needed. Native dialog appearance alone does not identify portal backend. Never request raw paths or credentials in public evidence. Failure, cancellation, mismatch or unavailable must be recorded; do not retry until green without recording first attempt. Only report a case passed when actually observed. If a test needs instrumentation not supported by actual UI, mark unavailable rather than altering program protections.

## Separate independent evidence and next step

Use the blank companion record; complete once per platform/session with reviewer and raw evidence held privately. Share only bounded categories and exact public artifact identifiers. Do not publish hashes of personal files, private paths, PIDs, screenshots containing personal data, machine IDs, raw stderr or policy contents. A human report is unverified until independent review. M128 may intake categorical evidence if authorized operator supplies it; otherwise remain blocked. For Ubuntu24 A/B/A, use existing M46 protocol and separate administrator authorization, not this checklist. No real content, native handle transfer, independent renderer confinement, sandbox waiver, merge or release is authorized. M127 changes documentation only.
