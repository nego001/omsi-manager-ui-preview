# F3.09b — integrated leaf evidence and explicit lookup policy

F3.09a Reader CI 45727000996: 236/236 per OS, zero failures, skips or cancellations. F1 packaged Linux gate remains open.

Graph now invokes existing texture (DDS/PNG/BMP/TGA/JPEG), audio (WAV/OGG/Opus/MP3), and PMG/PMC subset readers on reachable buffers, checks their source path and digest against the indexed source, and emits compact typed metadata. Matched paths and parsed payload status remain independent; scripts and unknown formats stay indexed-only. Existing invalid WAV/DDS fixtures now explicitly assert invalid-or-unsupported status. Summary counts distinguish parsed, indexed-only, signature-only, unreadable, matched/unmatched and cycle groups.

Optional separate policy entrypoint accepts at most 16 explicitly supplied portable virtual texture roots. It never assumes actual OMSI lookup order. Zero hits are missing, multiple hits ambiguous (including folded case candidates), single exact hit matched, single folded-only hit case-mismatch. No implicit lookup if no policy; roots are canonicalized and included in the input digest. No actual filesystem or game access, semantic dependency verification, pixel/audio decoding, script execution, merge or release.

Seven new tests; expected 243 per OS. CI pending. F3.09 can close as a synthetic subset milestone only after the matrix passes. Next F3.10: bounded evidence fusion across readers, diagnostics and source provenance.
