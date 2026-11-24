# M81C — documented format subset (lab only)

Reviewed 2026-11-24. Sources: [OMSI Wiki configuration files](https://wiki.omnibussimulator.de/omsiwikineu/index.php?title=Configuration_File), [OMSI WebDisk vehicles](https://reboot.omsi-webdisk.de/wiki/entry/29-vehicles-in-omsi/), [passenger routes](https://reboot.omsi-webdisk.de/wiki/entry/27-passenger-routes/), [keyword community reference](https://roadhog123.co.uk/omsi-wiki/quick-reference/keywords), [openOMSI format notes](https://github.com/openOMSI-org/openOMSI/blob/main/docs/FORMATS.md). The latter is independent implementation evidence, not official OMSI conformance certification.

- Keyword/value text structure is documented; full arity, comment syntax and unknown-block parsing remain unimplemented.
- Map global and tile files: lab admits only BOM-marked UTF-16LE. Vehicle definition/model: explicit UTF-8, Windows-1250/1251/1252, no encoding guessing. This is an admission subset, not a claim all real files conform.
- Vehicle-relative configuration paths and model-directory-relative mesh paths are distinct candidate contexts. The lab exports fixed context labels only; no filesystem resolution, no assertion of all fallback semantics. Sound path variants, model directory layout variants, scripts, textures, scenery/splines and map references require more evidence.
- In-memory synthetic fixtures only. No production imports, IPC, path or content access; no game data collected. Sixteen-bit map text decoding is not map parsing. No compatibility claims or write permissions. Five new tests.
- M81D: explicit pure virtual path resolution with separate roots, no traversal, exact/case collision status, unsupported references not labelled missing. Strict Ubuntu24 gate remains mandatory; no merge/release.
