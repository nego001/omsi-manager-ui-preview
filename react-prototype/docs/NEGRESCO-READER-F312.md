# F3.12 — final synthetic qualification candidate

F3.11 Reader/Core CI 45732379198: 271/271 on Windows and Ubuntu; independent Core CI 45732379164: 82/82 on both. Zero failures, cancellations or skips.

## Audit correction
Node Buffer ASCII decoding masks the high bit on decoding. Exact binary signature comparisons in WAV/Ogg/Opus/Vorbis, DDS/FourCC/PNG/BMP, RIFF/FEV BANK and PMG now use byte-preserving Latin-1 decoding. ZIP and TOBJ string decoding already checks every byte against printable ASCII before conversion. Regression cases flip the high bit and recompute Ogg/PNG checksums where necessary. An end-to-end Core test changes a matched WAV from valid fixture to unreadable subset and verifies diagnostics, changed report identity, no cache/persistence eligibility and no operational authority.

## Milestone inventory
F3.01 index; F3.02 identification; F3.03 ZIP subset; F3.04 OMSI config subset; F3.05 SII/SUI subset; F3.06 O3D and PMX subsets; F3.07 textures and materials; F3.08 audio and sound references; F3.09 dependency graph; F3.10 evidence fusion; F3.11 Core bridge; F3.12 regression qualification.

## Required final matrix
Six new tests: expected combined 277 per OS and Core-only 83 per OS. Both must pass at the final commit, with no failures, skipped or cancelled tests. Until verified, F3.12 is pending. This audit is targeted, not an exhaustive security assessment.

## Non-waivable limitations
Synthetic fixtures only. No real filesystem reads, archive extraction to disk, game compatibility certification, complete format coverage, shader/audio rendering, script execution, installation, production IPC, or production authorization. RAR/7z/SCS HashFS full reading, encrypted archives and unsupported format variants remain backlog. The independent F1 packaged Linux GUI gate remains open. No merge or release authorized by this milestone. Subsequent production work requires explicit real-input security policy, isolation, runtime and UI integration, representative legally available fixtures, and release gates.
