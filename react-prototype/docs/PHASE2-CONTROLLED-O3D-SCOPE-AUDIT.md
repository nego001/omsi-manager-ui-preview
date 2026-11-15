# OMSI Manager | Phase 2 / M16 — ZIP-local evidence provenance audit

**Branch:** feat/controlled-zip-o3d-scope-audit-v1
**Parent:** PR #19 / M15. Draft only; no merge or release.

## Objective

M15 correctly groups synthetic structural evidence **per O3D entry**, but
its summary should not be published if the internal stage sets, reported
totals and reference hierarchy contradict each other. M16 adds a
**fail-closed local-scope consistency audit** immediately before the
controlled ZIP reader returns its already sanitized report.

M16 **does not authenticate any third-party mod, source, creator or file**.
It does not prove real OMSI syntax or whether geometry can be rendered.

## Checks performed

1. The accepted path index belongs to the same one-shot, in-memory ZIP
   reader invocation. It has already passed existing ZIP safety gates.
2. Every O3D entry in that vetted index has **exactly one** M15 stage
   state; no unknown or contradictory state can be published.
3. Positive O3D stage sets are monotonic:
   header ⊇ vertices ⊇ triangles ⊇ materials ⊇ matrix ⊇ bones.
   An optional-absence state is matrix-backed but disjoint from actual
   bone evidence.
4. Each per-O3D stage state agrees with all private stage sets; the
   public sealed-state counters are exactly the sum of these entries.
   Forged or negative counts and booleans are refused.
5. Stage-linked *vehicle variants* retain the prior linked hierarchy,
   including `mesh ⊆ linked`, and are prefixes of vetted ZIP paths.
6. A private **SHA-256 receipt** binds the accepted ZIP bytes, each O3D
   path and the full bytes of that same O3D entry. The digest is computed
   during the existing CRC read; a mismatched receipt from a second ZIP,
   even with the same filename, causes the entire fixture to be refused.

The receipts and hashes are **in-memory internal checks**, not digitally
signed provenance, not verification of origin, and not suitable for
authentication of files downloaded from the internet.

## Public result

Only two new fixed fields are exposed:

- `syntheticScopeConsistencyChecked: true` — the current
  synthetic package passed the M16 structural/scope/counter checks.
- `syntheticScopeIsAuthenticatedOrigin: false` — the audit
  does **not** establish source authenticity.

If the internal audit fails, the complete response is refused with
`CONTROLLED_ZIP_BYTES_REFUSED`; paths, hashes, content and other
private values are never included in errors or result JSON.
The legacy game and compatibility classifications are unchanged.

## Security and tests

- Input remains **only synthetic, CI-generated ZIP bytes in memory**.
- Original archive caps, CRC, path validation, and 8192-byte O3D analysis
  prefix remain unchanged. SHA-256 of complete O3D bytes is streamed from
  the same bounded decompression pass.
- Tests verify per-file source scope, absent optional bones, variant links,
  impossible stage sets, forged counts, unknown state labels, changed
  archive/entry receipt, private data non-exposure, API type refusal and
  separate ZIP invocations with identical file paths.
- No real mods, filesystem, game installation, extraction, network,
  IPC, writes, global permissions or sandbox changes.
- `meshFormatVerified`, `gameRecognized`,
  `evidenceAuthenticated`, `realModInspected`,
  `compatibilityVerified`, `installationEnabled`
  remain false. Internal scope coherence is not real provenance.

All PRs remain Draft. Ubuntu 24.04 X11 strict sandbox (issue #4)
remains a blocking homologation gate, regardless of M16 CI success.
