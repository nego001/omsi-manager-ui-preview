# F3.07a — texture structural evidence

F3.06d Reader CI 45688914984: 169/169 tests per OS, zero failures, skips or cancellations. F3.06 closes as a synthetic subset milestone only. Full model format coverage, serialization bound for shared candidate lists, and F1 Linux packaged gate remain open.

F3.07a accepts synthetic buffers only, with SHA-256 source binding and caps on input bytes, dimensions, pixels, chunks and mip levels. DDS: legacy 2D DXT1/DXT3/DXT5 compressed block layouts, exact mip byte extents, no DX10, cubemaps, volume textures or unsupported flags. PNG: 8-bit grayscale/RGB/grayscale-alpha/RGBA, noninterlaced, IHDR/IDAT/IEND only, chunk ordering and CRC checks. IDAT zlib payload is NOT decoded or validated. BMP: 40-byte DIB, uncompressed 24-bit RGB with padded rows, top-down or bottom-up, exact payload size. No pixel decoding, actual transparency determination, color conversion or rendering; no filesystem access or real game inputs. Conservative subset may reject valid files. No merge or release.

11 new tests, expected 180 per OS. CI pending. Next F3.07b: bounded TGA/JPEG structure and MAT/TOBJ references; full format and pixel validation remain separate work.
