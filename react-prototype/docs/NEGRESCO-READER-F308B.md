# F3.08b — synthetic compressed audio evidence

F3.08a Reader CI 45724001716: 209/209 per OS, no failures, skips or cancellations. F1 packaged Linux gate remains unresolved.

Ogg Vorbis: single stream, complete packets per page, identification header version, channels/rate/block-size exponents, nominal bitrate when positive, bounded comment header and setup packet signature, page CRC/sequence and monotonic granules. Setup body and audio packet payload are opaque; no codec decode, codebook verification or packet-derived duration. Duration uses declared final granule.

MP3: MPEG-1/2/2.5 Layer III frame headers and exact frame extents, constant version/sample rate/channel count, fixed or varying bitrate, padding, bounded frame and sample counts. No free-format bitrate, ID3 tags, CRC-protected frames, resynchronization, side-information verification, bit-reservoir interpretation or gapless trimming. Nominal bitrate is exposed for constant header bitrate only. Duration is the frame sample count divided by sample rate, not decoded audio duration.

Six new tests; expected 215 per OS. CI pending. No real inputs, playback, merge or release. Next F3.08c: conservative synthetic OMSI sound configuration and SOUNDREF reference evidence, FMOD BANK identification without undocumented binary decoding, bounded audio dependency association. Full format support remains backlog.
