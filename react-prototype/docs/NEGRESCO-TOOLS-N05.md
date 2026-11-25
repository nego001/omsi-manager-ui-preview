# N05 — Exact approved binary art integrated

All six original WebP crops from the user's approved red/amber Negresco Tools concept were reconstructed from the exact N03 Git binary patch. GitHub create_blob returned the exact expected Git object ID for every file. No re-encoding, image replacement or synthetic data. Assets are committed under src/art/negresco/. The N04 manifest SHA-256 gate remains in place; run `node scripts/verify-negresco-art.mjs` from react-prototype. Runtime rendering, full visual parity and CI are still pending. N04 Windows job passed. Separate stacked branch preserves in-progress N04 browser CI. No native identity, workflow, IPC, security, merge or release changes.

- ats.webp: c32f2b938ce5bafc83f5083727c8be21b0a3f4b2
- ets2.webp: 0a02af848135a4ec4f32808737152f5648450046
- hero.webp: 8017e0721f245013e725df42d4d1484dd6811883
- mark.webp: 8dc9baa32af548e34a702c22d2baf002fb303636
- omsi.webp: 2b292fb3d97c2583b7c564ef28fce904825f207e
- sidebar-bus.webp: cccd8a6eef94682190c101e7790195f4efa28c76
