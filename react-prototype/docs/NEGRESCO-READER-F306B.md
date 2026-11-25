# F3.06b — expanded O3D and PMX header evidence

F3.06a CI 45679512402: 139/139 per OS, zero failed/skipped/cancelled. O3D versions 4, 5, 7 now accepted only with the explicit no-scrambling marker 0xffffffff and flags 0 or 1. All other keys and flags remain refused; no cryptographic processing. Reference: https://github.com/openOMSI-org/openOMSI/blob/main/docs/FORMATS.md.

PMX header reader uses bounded synthetic buffers, PMD v4, PMC v6, PMG 0x14/0x15 with gmP signature. Checks counts, known table extents, offsets, non-overlap among nonempty known extents, finite ordered declared PMG bounds and source digest. PMC look/material offsets are checked without interpreting their payloads. PMD and PMC use version and extension, not unique magic. Header validation does not establish payload validity; no material strings, vertex/index streams, collision shapes, PMG 0x13, skinning, real files, rendering, dependency resolution or production authorization. Conservative zero-length offset policy may reject valid real files.

Layout references: https://github.com/mwl4/ConverterPIX/blob/master/src/structs/pmd.h ; https://github.com/mwl4/ConverterPIX/blob/master/src/structs/pmc.h ; https://github.com/mwl4/ConverterPIX/blob/master/src/structs/pmg_0x14.h ; https://github.com/mwl4/ConverterPIX/blob/master/src/structs/pmg_0x15.h .

Two new O3D tests and nine PMX tests, expected 150 per OS. CI pending. F3.06 remains partial; next bounded payload validation for PMC and PMG plus PMD material references. F1 packaged Linux gate remains unresolved. No merge or release.
