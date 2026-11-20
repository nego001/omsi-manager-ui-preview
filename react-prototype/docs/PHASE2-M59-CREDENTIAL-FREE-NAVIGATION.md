# M59 — Credential-free navigation boundary for desktop renderer

## Finding

The desktop renderer navigation policy checked scheme, host, port, path
and search query against the approved entry URL, but **not URL userinfo**.
A development navigation to `http://user:password@127.0.0.1:4173/`
would therefore satisfy the same-host/same-path check even though
the approved development URL is `http://127.0.0.1:4173/`.
Credentials in HTTP URLs can affect browser authentication behavior.

The packaged renderer still loads a fixed `file:` entry and M53 already
forbids packaged development server mode. This is a **defense-in-depth
correction for the development navigation allowlist**; no exploitation or
host compromise is claimed.

## Change

`isAllowedTopLevelURL` now requires **both** the candidate and the
approved entry to have empty `username` and `password` fields.
The existing origin, pathname and query checks remain unchanged.
Fragment/hash changes to the approved document remain allowed.

Three new offline tests in `electron/security-policy.test.cjs` cover
username-only, password-only, encoded userinfo, hash variants, a
credential-bearing injected approval, and packaged file entry behavior.

The policy is already used by `will-navigate` and the
`preview:inspect-game` IPC sender-origin check; no new IPC authority
or renderer capability is introduced.

## Constraints

No host settings, AppArmor profile, Electron sandbox switch, permissions,
mod installation, game write, merge or release. Strict Ubuntu 24.04 X11
`SIGTRAP` is unchanged and remains a mandatory failed gate. M59 stays
Draft, stacked on M58, pending the administrator-owned A/B/A and independent
sandbox review tracked by issue #4.
