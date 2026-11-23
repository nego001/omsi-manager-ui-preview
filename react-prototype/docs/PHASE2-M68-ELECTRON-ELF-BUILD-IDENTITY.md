# M68 — Read-only exact Electron package and ELF evidence

Electron is declared with a caret range (^38.0.0), and there is no committed
npm lockfile. M68 selects the **installed** exact stable 38.x.y version as an
explicit @electron/packager argument for Linux builds. It records that
version and computes SHA-256 from the actual packaged native ELF bytes.

A bounded, unsigned advisory JSON file is stored within the Linux bundle.
The build CI validates installed npm metadata and packaged ELF bytes.
Both native Ubuntu 22.04 and Ubuntu 24.04 matrix jobs validate the JSON
against the extracted ELF bytes **before** their mandatory X11 tests.

Four adversarial tests reject invalid versions, forged approval flags,
tampered ELF bytes and symlinked evidence. A matching JSON file and ELF
hash do NOT prove independent Electron runtime-version attestation,
software supply-chain authenticity, Chromium renderer isolation or
AppArmor causality. The existing same-run Linux TAR SHA-256 remains
independently required, and the A/B/A administrative VM exercise still
must verify actual package identity and renderer sandbox confinement.

No Electron upgrade, native runtime launch for this check, host-policy
change, sandbox bypass, real mod read/write, merge, installer, release or
Ubuntu24 native X11 gate waiver. M68 stacks on Draft M67.
