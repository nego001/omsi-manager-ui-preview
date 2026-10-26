# Service isolation threat model (design only)

**Status: NOT IMPLEMENTED.** This document specifies non-negotiable security gates for a possible future Windows/Linux verifier service. There is no production service, installer, socket listener, privileged user, ACL provisioning, TPM integration or protected key store in this repository. The current Node child-process witness remains an unprivileged **test-only** simulation. It is excluded from `app.asar` and cannot authorize a real OMSI operation.

## Existing lab contract

- Admission lives in `synthetic-service-boundary.cjs`. A frame has **exactly** `{"id":N,"op":"arm|verify|shutdown"}` with canonical ordering and serialization, at most 160 UTF-8 bytes. The decoder discards oversize frames before accumulating them.
- IDs strictly increase within one child process. Admission caps valid commands at 32 and total attempts at 128. Restarting the process **resets** this admission state; it is not replay protection across sessions or machines.
- Client-supplied paths, hashes, keys, claimed service identity or elevation flags are refused. The worker never signs arbitrary input; `arm` signs the immutable nonce-marked disposable witness chosen at process startup.
- No client request can set `principalSeparationProven`, `peerCredentialsVerified`, `osProtectedChannel`, `persistentKeyCustodyProven`, `operationsEnabled` or `supportsRealGameInspection` to true. The lab policy declares all these guarantees **false**.

## Minimum implementation gates

| Required gate | Windows candidate | Linux candidate | Status |
| --- | --- | --- | --- |
| Distinct OS principal | Dedicated low-privilege service identity or service SID with an independently audited token | Dedicated non-root service UID, restricted groups and reviewed systemd sandboxing | **Synthetic real-SID/NTFS and Linux real-UID tests in ephemeral CI; production service not implemented** |
| Authenticated peer | Local-only named pipe with restrictive DACL, server identity validation and audited client token validation | Local Unix-domain socket with restrictive filesystem permissions and `SO_PEERCRED` verification | **Linux temporary socket `SO_PEERCRED` denial tested; production channel not implemented** |
| Filesystem constraints | Explicit deny on game, mods, profile and arbitrary user paths; verify ACLs and reparse-point behavior | Deny game/mod/home file access; explicit sandbox, mount namespace / path rules and symlink audit | **Not implemented** |
| Key custody | Access-controlled service-only key, explicit lifecycle/rotation/backup policy, investigated DPAPI/CNG or hardware protection | Credentials isolated from UI user, key lifecycle, sealed/ephemeral storage review and memory process inspection controls | **Not implemented** |
| Deployment identity | Verifiable service binary, release provenance, controlled startup, no implicit administrator elevation | Signed/reproducible artifact policy, restricted unit definition, controlled startup and restart | **Not implemented** |
| Protocol robustness | Bounded bytes, typed schema, challenge/session binding, replay protection, hard timeouts, throttling | Same, plus authenticated Unix-socket peer and transport-level tests | **Only bounded lab stdin protocol exists** |
| Failure handling | Deny on verifier death, missing key, bad evidence, failed peer validation or incomplete restore | Same and explicit sandbox/permission failure tests | **Only synthetic failure cases covered** |

## Adversaries and negative requirements

A compromised UI, helper process, mod archive, web resource or same-user application is **untrusted**, even if it can send syntactically valid requests. No self-reported UID, role, signature, admin flag or IPC field can establish the sender's principal. A process running under the **same user** is not a separate protection boundary. Root/Administrator, kernel-level actors, debugging/injection, key extraction, IPC interception, replaced binaries, replay after restart, partial writes, malicious links and directory races remain unproven or out of scope.

Do not treat `HMAC matched`, `completion_observed_not_durable`, a passing UI test, or a successful Windows package build as proof of a successful file operation. This lab may record claims about synthetic fixtures; it is not a transaction coordinator.

## Explicit release blockers

1. Independent design review of privilege separation, IPC authentication and key custody for **each OS**.
2. Integration tests run as genuinely different operating-system principals, proving both authorized and unauthorized peer identities.
3. OS-level filesystem-denial tests, including path substitution/reparse points, symlink/hardlink behavior and race testing.
4. Verifiable binary/build and service-installation provenance, an opt-in installation model and safe removal of service permissions.
5. Recovery/failure specification for key loss, verifier crash, abrupt shutdown and incomplete evidence, with no inferred success.
6. Explicit new user authorization and a separate threat-model review before considering **any** game/mod write operation.

**Current immutable safety boundaries:** `operationsEnabled:false`, `supportsRealGameInspection:false`, `guaranteesNoABA:false`, `atomicPathContainmentProven:false`. Keep PR #1 in draft; do not merge to main or install a service from these laboratory files.

## Linux hosted-runner real-UID experiment (fixture-only)

The new `synthetic-linux-principal-lab.py` runs **only** within GitHub Actions on explicitly marked `github-hosted` Linux runners using `sudo`. It deliberately refuses the admin orchestration path on developer machines, self-hosted runners, or missing `RUNNER_TEMP`. It creates three short-lived users: a service process UID, an authorized client UID, and an unauthorized client UID, plus a newly allocated, unpredictable `/tmp/omsi-principal-lab-*` subtree on the hosted Linux VM. `RUNNER_TEMP` is required as a hosted-runner environment guard, but is deliberately **not used for the child fixture** because its parent permissions prevent traversal by different UIDs. At exit, it terminates the disposable socket subprocess, deletes the subtree and removes the synthetic test users. Nothing registers a systemd unit, installs a package, alters user home directories or touches OMSI files.

The service-user subprocess creates a 32-byte **test canary** under a private `0700` directory and a `0600` file. Actual kernel DAC tests require that *both* client UIDs receive `PermissionError` for that file, and the service UID can read it. A world-connectable **test socket** (intentionally `0666` for this proof) tests defense beyond basic socket permissions: the server calls Linux `SO_PEERCRED` on the accepted connection and accepts only one fixed `probe` operation from the authorized UID. The outsider, client-supplied UID/role assertion, arbitrary installation operation and client pathname field must all be denied. No secret is signed or returned. This proves narrowly that separate kernel UIDs and kernel-reported peer UIDs work inside a hosted, disposable CI VM.

**Not a production service:** socket directory access on a production system would need restrictive mode/group and peer authorization; the demonstration's `0666` socket exists solely to test `SO_PEERCRED` rejection. Real deployment needs a service definition, managed service UID, validated caller identity, a production ACL/sandbox, lifecycle hardening, key custody and new security review. It does not prove Windows service SID/DACL behavior, SELinux/AppArmor confinement, symlink/race resistance, remote access isolation or any OMSI file operation.

An explicit OS-hosted test can pass while the release blocker **“production service with distinct principal”** remains unsatisfied.

## Windows hosted-runner SID/NTFS experiment (fixture-only)

The new `synthetic-windows-principal-lab.ps1` is restricted to hosted GitHub Actions Windows jobs running with temporary administrative privileges. It creates two randomized standard local accounts with distinct Windows SIDs, uses an unpredictable disposable folder under the hosted VM's `Public` directory (the runner's private `RUNNER_TEMP` would not be traversable by these accounts), and creates a synthetic 32-byte canary under a restricted NTFS directory. `icacls` removes inherited rules from the service-only child and grants its service SID read/execute, with SYSTEM and Administrators for setup/cleanup.

An actual Windows `LogonUser` token and `WindowsIdentity.RunImpersonated` must demonstrate that the temporary service account can read the canary and the unrelated account is denied. No real OMSI paths are accessed, and no Windows service, persistent account, named pipe or credential manager is installed. The script removes both users and the fixture in `finally` even when a test fails.

**This does not prove Windows authenticated IPC**: local token impersonation and an NTFS DACL do not establish a server-validated named-pipe client, service SID isolation, a production launch/restart model, or protected service key custody. The release blocker for a real Windows service remains open.

## Linux portable desktop preview is separate from an isolated service

A native Linux x64 Electron portable build and GUI smoke test are now planned in the CI `build` job. They package the same React/Electron **read-only preview** using `@electron/packager` and check the emitted ELF GUI under `xvfb` with a synthetic OMSI directory. The archive, if validated, is an unsigned, experimental `.tar.gz` and SHA-256 checksum. It is not an Arch Linux native package, systemd unit, Proton/Wine adapter, OMSI 2 runtime, nor a mod installation manager. The Windows-only Win32 lab and PowerShell scripts remain excluded from the packaged `app.asar`.

Packaging the preview for Linux does **not** satisfy any of the privileged verifier-service release gates above.

## Windows named-pipe local SID check (synthetic proof only)

The hosted Windows SID/NTFS fixture now also instantiates a disposable `NamedPipeServerStream` with `PipeOptions.CurrentUserOnly` **under the temporary service account's impersonated token**. An unrelated disposable account's token must not connect, while the service account must connect and transmit one fixed test byte. A passing test shows Windows kernel enforcement of a local same-user-only pipe in this laboratory, and reports `PASS_WINDOWS_CURRENT_USER_ONLY_NAMED_PIPE_DENIAL`.

This deliberately does **not** implement the eventual service's authenticated caller identity, permission to invoke arbitrary UI operations, named-pipe DACL for a *distinct* authorized client, ACL lifecycle, service process token isolation, long-running server, session binding or robust protocol replay prevention. In production, `CurrentUserOnly` would exclude every client running under another user, even authorized ones; designing a suitable restricted ACL and verifying the caller's security token are separate release blockers. Nothing is deployed on the user's machine.
