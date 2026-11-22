# M65 — Reject symlinked folder choices through real Electron IPC

## What is verified

The existing metadata-only scanner rejects a symbolic link selected as
the root directory, and ignores symlinks used in place of known OMSI group
folders. Earlier unit tests covered scanner behavior; M65 verifies that
behavior through the **actual Electron main-process IPC** with a mock
native folder picker.

The E2E test:
1. Creates an isolated temporary OMSI-shaped fixture, ETS2-shaped fixture
   and two symbolic links fully contained within the same temporary tree.
2. Mocks the Electron native folder dialog to choose a **symlink root**.
   The renderer must see only the fixed Portuguese error string, not a
   raw filesystem error, target path or native backend details.
3. Chooses a normal directory with a symlink at the `Vehicles` group
   position. The scan must not follow the link; it reports the group as
   absent and produces the existing `no-known-folders` notice.
4. Chooses the original normal OMSI fixture again. The same Electron
   session must report the expected read-only counts, with no lingering
   grant or dialog lock.
5. Re-reads synthetic sentinel files, ensuring the scan neither reads
   their contents nor modifies the disposable game structures.

No actual native portal, real game folder or mod is used. The symlink
targets and sources both live in the test's temporary tree. This does
not demonstrate atomic containment across races/ABA, prevent privileged
local filesystem replacement, or prove Linux kernel sandbox confinement.

## Safety gate

M65 adds E2E test coverage only. No production capabilities or permissions
are changed. Strict Ubuntu24 native X11 `SIGTRAP` remains the mandatory
release blocker (issue #4), pending independently controlled A/B/A,
renderer sandbox proof and rollback. No host/AppArmor/sysctl modification,
root Electron, `--no-sandbox`, CI waiver, merge, release or installer.
M65 stacks on Draft PR #69.
