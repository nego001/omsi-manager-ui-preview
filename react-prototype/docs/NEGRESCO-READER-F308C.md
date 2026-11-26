# F3.08c — synthetic sound reference intelligence

F3.08b Reader CI 45724293045: 215/215 per OS, zero failures, skips or cancellations. F1 packaged Linux gate remains open.

OMSI CFG: explicit UTF-8 or Windows-1252, first nonempty value following [sound] or [loopsound] interpreted only as portable relative WAV candidate; other directives retained as uninterpreted metadata. No loop, trigger, pitch, spatial, volume or condition semantics inferred. Reference: https://openomsi.org/docs/formats/ .

SCS SOUNDREF: narrow UTF-8 single source="bank#event" definition, portable relative or game-root bank path and conservative event identifier. Reference: https://modding.scssoft.com/wiki/Documentation/Engine/Sound . BANK: RIFF/FEV form and declared outer length candidate only; no bank payload or event existence verification. Unsupported BANK forms may be legitimate.

Synthetic sound graph validates portable unique supplied paths, indexes SHA-256, re-parses reachable configuration, WAV and BANK candidates, resolves exact relative/root paths in fixture inventory only; separates missing/case-mismatched references from invalid-or-unsupported payload. Caps bytes, entries, edges and serialized report bytes; frozen evidence and deterministic input digest. No actual filesystem dependency resolution, playback, FMOD API, real files, release or merge. Ten new tests; expected 225 per OS. CI pending. F3.08 may close as a synthetic subset after reader matrix passes. Next F3.09: general bounded cross-format dependency graph.
