# M67 — Cooperative cancellation of stale main-process directory scans

## Problem and scope

M54 already invalidated document epochs on top-level navigation or renderer
death and suppressed late IPC results. However, an already-started metadata
scan could keep enumerating selected directories unnecessarily after the
originating renderer was invalidated.

M67 adds a main-owned `AbortController` to each opaque document epoch:
- `invalidate()` aborts the previous controller and rotates to a new
  controller/proof. `revoke()` aborts permanently.
- `signalFor(proof)` returns the signal only for the current proof.
  Neither signal nor proof is exposed to renderer IPC.
- The main process passes the signal through the one-shot picker grant,
  inspection executor and metadata scanner.
- The scanner checks cancellation before and after awaited root identity
  probes, between groups, after opening a directory, per enumerated entry
  and before returning counts.
- Both grant and executor independently re-check after their awaited
  scanners settle; a test-injected scanner that ignores cancellation
  cannot return a stale report.

The directory iterator is still closed in the existing `finally` on
cancellation. No new native code or operating-system privilege is used.

## Evidence and limitations

Adversarial tests exercise signal rotation, same-document continuity,
main wiring, revoked one-shot grants, a slow scanner resolving after abort,
root lookup cancellation, and cancellation during actual async entry
iteration with descriptor cleanup and untouched synthetic file content.

## Real Electron IPC / reload regression

The existing `desktop-inspection-e2e.mjs` now temporarily intercepts
`node:fs/promises.opendir` **only inside the test Electron main process**
for a disposable `Vehicles` fixture. It pauses an already-authorized
metadata scan, performs an actual renderer `window.reload()`, confirms a
new renderer request is blocked by the one-flight guard while the old
scan remains pending, and releases the paused directory opening.

The cancelled old document never receives a reply; the main scanner
closes the returned directory descriptor without starting entry
enumeration. The test restores the original `opendir` before issuing a
new inspection, checks normal OMSI counts and confirms a synthetic
`.bus` sentinel remains untouched. The test marker is
`PASS_M67_REAL_ELECTRON_ABORTED_METADATA_SCAN_AND_RECOVERY`.

The interception is not included in production. This proves specific
Electron/main-process cancellation and cleanup paths, **not** forceful
interruption of a hung kernel I/O call, a real OS-native folder portal,
atomic pathname containment or Ubuntu24 Chromium sandbox confinement.

This is **cooperative best-effort cancellation**, not immediate OS I/O
interruption. A stalled `lstat`/`opendir` syscall may remain pending
until it settles. This does **not** prove atomic directory-handle-based
containment, eliminate ABA, or certify sandbox isolation. Live Electron
IPC E2E and packaged Windows/Linux tests remain mandatory in CI.

Ubuntu24 strict native X11 `SIGTRAP` / issue #4 remains the release gate.
No `--no-sandbox`, root Electron, host policy/AppArmor/sysctl changes,
actual game/mod writes, CI waiver, merge, installer or release.
M67 stacks on Draft M66.
