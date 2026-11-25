# F1.02 — Dependency and distribution identity consolidation

## Dependency audit
Both Linux and Windows build jobs currently run npm install with semver ranges and no tracked package-lock.json. The isolated execution environment cannot resolve registry.npmjs.org (npm ping returned EAI_AGAIN); do not invent a lockfile. The new PR-scoped workflow resolves a genuine npm v3 lock from the public registry without lifecycle scripts, checks direct dependencies and registry/integrity metadata, records source revision and SHA-256, then checks identical bytes with npm ci --ignore-scripts on Linux and Windows. Output is an unapproved, temporary proposal, not a dependency security audit, signed artifact or build. After both clean installs succeed, retrieve and inspect the actual proposal, review dependency/security implications and commit its exact bytes before switching the existing build jobs to npm ci. Then run full runtime/packaging regression. Existing main CI remains unchanged in this step.

## Distribution name inventory
| Layer | Current identity | Decision |
|---|---|---|
| Visible HTML title | Negresco Tools — Gerenciador de Simuladores | Preserve |
| BrowserWindow initial title | OMSI Manager · Prévia segura | Legacy native startup contract; review in a separate regression-tested change |
| Linux XDG menu | Negresco Tools (N09.8) | Preserve; wait for exact revision CI |
| npm name/version | omsi-manager-nine-screens / 0.1.0 | Internal; no version bump or rename |
| ELF/Windows EXE | OMSI-Manager-Preview | Preserve; strict launcher and ownership checks use this name |
| Native Linux Auto launcher | OMSI-Manager-Auto | Preserve |
| XDG desktop ID | org.omsi_manager.Preview.desktop | Preserve existing shortcuts |
| Archive names / CI artifact names | OMSI-Manager-Preview-*-x64-UNSIGNED | Preserve until all producers/consumers migrate together |
| Advisory manifest filename/product | OMSI-Manager-Preview-build.json / OMSI Manager Preview | Preserve schema V1 and exact-match verifiers |
| IPC / local preference keys | omsiPreview / omsi-* | Preserve compatibility, no permission changes |

Use Negresco Tools in user-facing documentation and menu. A future presentation layer can expose the new brand without changing executable identities or provenance contracts. Do not rename archives in isolation: multiple downstream CI jobs use fixed artifact names. No package is signed, no release or merge authorized, no real game reads/writes enabled. The Ubuntu24 strict gate remains mandatory. Track F1 in issue #167, PR #168.
