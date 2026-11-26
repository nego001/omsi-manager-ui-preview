# F3.06d — UV and cross-file PMX evidence

F3.06c Reader CI 45688586256: 160/160 per OS, no failed, skipped or cancelled tests. F1 packaged Linux gate remains unresolved.

PMG 0x14/0x15 now accepts a conservative interleaved position, optional normal, and 0–4 contiguous UV channel subset with canonical low-bit mask. Finite UVs and per-channel bounds are checked; no claim to interpret arbitrary masks or validate UV topology. Layout reference: https://github.com/mwl4/ConverterPIX/blob/master/src/model/model.cpp.

New PMX set reader accepts same-stem PMD and PMG with optional PMC, only copied synthetic buffers, not caller-provided reports. Enforces aggregate byte, vertex, triangle and reference caps. Re-parses members; binds ordered source paths and SHA-256 hashes to a deterministic digest. Reports declared piece/part count discrepancies, absent material looks and out-of-range material slots; links material candidates by slot across looks. Collision mesh evidence is independent; no containment or matching-count requirement, no collision simulation. Results are immutable; consistency is restricted to implemented checks, not full semantic verification. No dependency resolution, arbitrary PMG vertex streams, animation, PMC variants or locators, real files, UI, merge or release. Shared material candidate lists are in-memory evidence; serialization amplification still needs a separate bound before integration.

Nine new tests, expected 169 per OS. CI pending. F3.06 may close only as a synthetic subset milestone after the reader matrix passes; full format support remains backlog. Next F3.07 texture and material readers.
