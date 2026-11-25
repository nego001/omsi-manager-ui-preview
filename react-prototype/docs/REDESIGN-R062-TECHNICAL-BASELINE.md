# R06.2 — Technical baseline, visual acceptance still blocked

Pinned run: 45538295900, commit d0110b5c880b5f01659ea7ca638515c504038197. Browser suite: 1121 passed. Ubuntu 22.04 build job and unsigned Windows packaged job succeeded. Strict Ubuntu 24.04 native X11 window check failed; GNOME and KDE Auto/direct controls exited SIGTRAP without a mapped native window. User namespace probe returned permission denied with AppArmor restriction enabled; causality is not certified. No sandbox bypass, host policy change or waiver.

User rejected visual fidelity. Do not treat technical PASS as design approval. No release or merge.

The new browser evidence test records matched viewport captures (1440x900, 1024x768, 850x650, 390x844), region bounds, font and style measurements and screenshot SHA-256. Steam is blocked for reproducibility; bundled art is not the approved game imagery. Existing screenshots of the Windows native runtime are separate evidence. The output intentionally states visualParityVerified=false. It is captured under the existing screenshots artifact path. Run locally with npx playwright test tests/r062-premium-baseline.spec.ts from react-prototype.

Acceptance procedure after obtaining the exact approved concept: record reference file digest and native dimensions; choose identical content viewport and state; map header, sidebar, hero, selector, indicators, library and lower panels; compare bounding rectangles, typography, color and assets; obtain original simulator images with appropriate usage rights; document justified differences due to dynamic data and accessibility; review side-by-side and seek user acceptance. No arbitrary score or fixed tolerance substitutes for user approval. No new runtime behavior or operational permissions in this checkpoint.
