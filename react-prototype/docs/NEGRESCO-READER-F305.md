# F3.05 — ETS2/ATS SII and SUI synthetic definition reader

F3.04 reader CI 45678561423: 114/114 tests per OS, zero failures, skipped or cancelled. F1 Linux packaged gate remains unresolved.

F3.05 implements an isolated, bounded UTF-8 text subset: SiiNunit envelope, named units with unique IDs, ordered attributes and optional array markers, quoted unescaped strings, finite decimal numbers, booleans, simple tokens, full-line comments, and SUI attribute fragments. Braces may follow unit declarations on the same or next line. Includes are recorded, never expanded. String values with a selected asset extension become reference candidates (not proof of semantic dependency); portable relative paths and game-virtual-root paths are checked using F3.01 without filesystem access. Evidence includes SHA-256, line numbers, types, unit IDs and frozen structured metadata. Non-reference scalar values are omitted. Caps apply to bytes, lines, line length, units, fields and references.

Not full SCS grammar: tuples, hexadecimal float encodings, escaped strings, inline/block comments, same-line nested declarations, encoded/binary SII, Unicode paths, parent traversal, and many real constructs are unsupported. Array cardinality and unit semantics are not validated. ETS2 versus ATS is not inferred. No real game files, HashFS extraction, include resolution, asset loading, IPC, production authorization, release or merge. Synthetic scope label alone is not a real security boundary.

12 new synthetic tests; expected 126 per OS. CI required. Next F3.06: bounded synthetic 3D format structure reader after F3.05 test evidence.
