# F4.01a — runtime safety policy, dry-run only

F3 qualified at b7856f4024ecd56ecc3210c1f8a447a1afcd26e4. Closure checkpoint fbf25c97d81679d36bda4d7ac3cfd825dcd017ab. F4 branch descends from that checkpoint, no merge. F1 packaged Linux gate is still open.

The dry-run policy accepts synthetic relative paths and metadata/read-byte intents only. It reserves aggregate/per-file byte caps, depth and entry caps, refuses collisions, traversal, unsupported platforms, write/execute intents and caller-provided authority. Stable digest and immutable result; decision is always deny-real-access. No filesystem open, actual root path, handle, permission, OS isolation or authorization.

## Required operational gates before real access
1. Explicit root chosen by the user, never arbitrary caller path; bind to trusted directory handle and identity.
2. Resolve components without following symlinks/reparse points; reject traversal, aliases, junctions, disallowed mount crossings and non-regular files; implement and test OS-specific primitives on Windows and Linux.
3. Read from the verified same open handle, enforce byte/entry/depth and deadline caps, verify metadata and detect mutation; refuse uncertain identity or races. A path string or prior stat is not proof.
4. Establish isolated unprivileged workers, no network, no script or executable launch, no writes to mod tree, bounded memory/CPU, cancellation and cleanup.
5. Verify safe IPC, UI consent boundaries, no production capabilities inferred from synthetic reports, and packaged Linux F1 gate.
6. Use only intentionally created test trees and legally available representative assets after the appropriate gate is independently verified. No production merge or release without full qualification.

Seven new tests; expected combined 284 per OS and Core-only 90 per OS if existing matrices run on this branch. CI pending; do not claim actual filesystem safety. Next: inspect and reconcile existing F1 guard implementation, design OS-specific handle strategy, and exercise isolated disposable fixture trees only under explicit constraints. No real mod reads.
