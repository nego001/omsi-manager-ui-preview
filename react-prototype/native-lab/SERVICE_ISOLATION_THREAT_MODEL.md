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
| Distinct OS principal | Dedicated low-privilege service identity or service SID with an independently audited token | Dedicated non-root service UID, restricted groups and reviewed systemd sandboxing | **Not implemented** |
| Authenticated peer | Local-only named pipe with restrictive DACL, server identity validation and audited client token validation | Local Unix-domain socket with restrictive filesystem permissions and `SO_PEERCRED` verification | **Not implemented** |
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
