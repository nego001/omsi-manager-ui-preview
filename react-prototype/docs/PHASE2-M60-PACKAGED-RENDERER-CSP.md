# M60 — Production-only Content Security Policy (CSP)

## Scope and threat

The Electron renderer already uses `sandbox:true`, `contextIsolation:true`
and a restricted main-owned IPC. However, the packaged `dist/index.html`
had **no explicit CSP**. An injected script or arbitrary network connection
would therefore lack this additional browser-level restriction.

The UI deliberately loads **game cover images only** from Steam's
`shared.fastly.steamstatic.com`; React uses inline style attributes for
CSS custom properties. Static bundled JavaScript and CSS are local files.
The local development server must retain normal Vite HMR behavior.

## Implementation

- A Vite plugin with `apply:'build'` inserts a strict CSP meta tag **first
  inside the built HTML head**. The source `index.html` and development
  server are unchanged.
- `default-src 'none'`; scripts only from `'self'` (never inline/eval),
  connections, objects, frames, workers, base elements and form submissions
  refused; images allowed from local/data and the specific Steam cover host.
- `style-src 'self' 'unsafe-inline'` is a **deliberate, limited exception**
  for existing inline React style props. It does **not** relax script-src.
- `npm run build` now verifies exact first-in-head CSP presence in the actual
  `dist/index.html` and refuses an artifact if missing, reordered or
  duplicated. Seven offline adversarial security tests cover policy and
  build wiring.

## What this does NOT prove

CSP is defense-in-depth, not proof against all injection or local-file
access. The image host is still an intentional outbound third-party request
and could observe cover loads; it is not a trusted script origin. The CSP
does not certify the Chromium kernel sandbox, AppArmor behavior, user
namespaces, or Ubuntu24 native X11 operation. Future app features requiring
new network origins must be separately reviewed, not silently granted.

No new permission/IPC, real game file change, mod installation, host policy
change, root Electron, sandbox bypass, CI waiver, merge, release or installer.
M60 stacks on Draft M59 and Ubuntu24 issue #4 remains the mandatory blocker.
