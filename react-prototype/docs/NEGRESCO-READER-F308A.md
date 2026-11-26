# F3.08a — synthetic audio structure

F3.07c Reader CI 45718306864: 200/200 per OS, zero failures, skips or cancellations. F3.07 closes in the synthetic subset only. General CI 45718306903 failed packaged Linux ELF GUI and dependent jobs; F1 remains open.

WAV: exact RIFF/WAVE size, one 16-byte PCM integer fmt and one nonempty aligned data chunk, 8/16/24/32-bit samples, bounded JUNK/PAD, zero odd-byte padding, channel/rate/block alignment and byte rate validation. Duration derived from PCM frame count. No RF64, extensible PCM, float, compressed WAV, arbitrary ancillary chunks or sample decoding.

OGG/OPUS: single logical stream, mapping family 0, mono/stereo, version 1 OpusHead, bounded OpusTags, contiguous page sequence, complete packets per page, CRC, BOS/EOS, monotonic declared granules and preskip. Duration is declared end granule minus preskip at 48 kHz, not verified against packet durations. No continued packets, chained streams, Vorbis, codec payload validation or playback. Synthetic audio packet bytes deliberately need not be valid Opus frames.

All inputs bounded and copied; immutable source-bound evidence. No real files, execution, playback, release or merge. Nine new tests; expected 209 per OS, pending CI. Next F3.08b: Vorbis/MP3 structural evidence and audio references. Full format support remains backlog.
