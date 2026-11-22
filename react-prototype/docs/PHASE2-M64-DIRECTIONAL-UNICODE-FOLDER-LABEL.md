# M64 — Safe rendering of directional Unicode folder names

## Finding
The M62/M63 inspection DTO forwards a bounded `folderName` basename to
the renderer. Its prior validation refused slashes and ASCII controls,
but allowed Unicode **bidirectional formatting controls** (including
right-to-left override, embedding and isolation marks). Such characters
can visually reorder the filename in the report, misleading the user
about which directory they selected.

This is a **display integrity** issue; no arbitrary filesystem access,
mod installation or code execution is claimed.

## Change
- An explicitly allowlisted, main-owned projection now **replaces only
  the displayed label** with `Nome da pasta ocultado por segurança`
  if a bidi control, Unicode line/paragraph separator or malformed
  UTF-16 surrogate occurs.
- The folder path remains private inside the main process and the
  inspection continues. Counts, validation, notices and read-only
  provenance are unchanged.
- Ordinary accented text, Arabic characters (without directional control
  marks), CJK text and complete emoji remain visible.
- Invalid ASCII-control or slash-containing labels remain refused by the
  M62 policy, as before.
- Four adversarial tests cover bidi overrides, normal Unicode,
  split surrogates and full executor output.
- The real Electron IPC E2E now creates a disposable directory whose
  basename embeds a right-to-left override, lets the mock native picker
  choose it, and checks the scanner result, on-screen text and an
  untouched synthetic .bus sentinel. The same test checks ordinary
  accented/emoji names and that absolute paths remain hidden.
  This is a genuine desktop IPC/UI regression, not a real OS portal test.

## Limits / gates
A conservative list of spoofing controls does not establish that every
possible Unicode confusable is handled. No claim is made about mod
compatibility or atomic file identity. Ubuntu 24.04 strict X11 `SIGTRAP`
(issue #4) remains a mandatory failed release gate, requiring an
administrator-owned disposable VM A/B/A, sandbox evidence and rollback.
No host changes, `--no-sandbox`, root Electron, real game writes,
installer, merge, release, or CI waiver.
M64 stacks on Draft M63.
