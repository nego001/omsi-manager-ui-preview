# F3.07b — texture and material reference expansion

F3.07a Reader CI 45689395835: 180/180 per OS, no failures, skips or cancellations. F1 Linux packaged gate remains open.

TGA: bounded legacy header, uncompressed or RLE true-color 24/32-bit and grayscale 8-bit, exact packet/payload extents, no palette, ID field, footer, right-to-left or interleaved layout. JPEG: bounded marker/segment framing of 8-bit baseline single scan, one or three components, SOF/SOS consistency and stuffed bytes, exact EOI; no progressive/multiple scans/restarts, no quantization/Huffman table payload validation or entropy/pixel decoding. JPEG fixtures deliberately test framing only, not valid rendered images.

MAT: strict UTF-8 line-oriented legacy material/effect name, numeric scalar/vector and string attribute structure, texture[N] references to TOBJ. Post-1.47 effect grammar unsupported. TOBJ: generic type 2, documented magic and 40-byte header plus single 8-byte texture record and bounded ASCII DDS path; validates selected sampler enums, not unknown header fields. No cube texture or external dependency resolution. Layout references: https://github.com/mwl4/ConverterPIX/blob/master/src/structs/tobj.h and https://github.com/mwl4/ConverterPIX/blob/master/src/texture/texture_object.cpp and https://github.com/mwl4/ConverterPIX/blob/master/src/material/material.cpp .

All readers are synthetic-only and return frozen metadata/source SHA-256; no real file access, shader execution, rendering, actual transparency determination or full format validation. Nine new tests; expected 189 per OS. CI pending. Next: bounded synthetic PMD→MAT→TOBJ→DDS association, output amplification controls and remaining visual coverage. No merge or release.
