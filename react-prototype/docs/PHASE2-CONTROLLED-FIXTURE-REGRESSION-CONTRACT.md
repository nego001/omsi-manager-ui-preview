# OMSI Manager | Phase 2 / M18: same-fixture regression contracts

**Branch:** feat/controlled-fixture-regression-contract-v1
**Base:** PR #21 / M17 (Draft). No merge or release.

## Goal: detect unexplained changes without false regression claims

M17 explains why one **synthetic test ZIP** received a fixture classification.
M18 defines a deliberately narrow CI-only regression check that can compare
the *same fixture bytes* under two versions of this controlled analysis code.

The M18 snapshot is **private**, immutable, scoped to a SHA-256 digest of
the exact ZIP bytes, and contains a fixed list of previously sanitized fields.
It is not a user-facing file, not automatically persisted, and never used on
real mods. The comparison output contains only fixed schema/group names.

A change in fixture contents, even a harmless ZIP entry reorder or an
unrelated notes file, changes the private digest. Comparing that new ZIP
with the old one is refused rather than misreported as a code regression.
For actual *cross-commit* comparison, both versions must explicitly analyze
the **same exact byte fixture**; M18 does not yet fetch or execute a prior
commit, persist signed baselines, or authenticate a reference result.

## Captured contracts

The private baseline contains only a fixed snapshot of:
- assessment (the seven M8 synthetic fixture labels);
- selected M17 rule ID and the seven rule outcomes;
- ordered counts for all declared BUS/CFG/O3D/variant linked hints;
- ordered counts of all six O3D synthetic layout hint tables;
- M15 per-entry evidence-state totals;
- the already-false real-format, identity, compatibility, provenance and
  installation safety flags.

No arbitrary map keys or strings from user data can enter the diff result.
Never return or log the full snapshot: it contains a private ZIP fingerprint.

## Result contract

The comparison either returns:
- comparison: stable; changedContractGroups: empty, or
- comparison: reviewRequired; changedContractGroups: one or more of the
  seven *static* group IDs listed above.

A change is **not automatically proven to be a regression**; a developer
must inspect intent and verify any fixture evolution. There is no
automatic "approve baseline" operation. The output also always says:
sameSyntheticZipBytesCompared:true,
changeIsAutomaticallyProvenRegression:false,
baselineAuthenticityEstablished:false,
realModValidated:false,
installationAuthorized:false.

Malformed snapshots, mismatched hashes, extra or unknown labels, changed
security invariant values or wrong types raise the fixed error
CONTROLLED_FIXTURE_REGRESSION_REFUSED. No paths, bytes, hashes, names or
other private input values are included in the return value or error.

## CI acceptance criteria

1. Golden synthetic ZIP fixtures enforce each of the **seven M8/M17
   classifications and rule IDs**, including mixed OMSI/SII markers.
2. The same bytes produce stable snapshots and identical comparisons.
3. Deliberately modified sanitized counters, structural hint counts or
   an assessment/rule pair return reviewRequired with exact static groups.
4. Missing or wrong scope, malformed digest or a raised safety flag refuse.
5. Different ZIP bytes, including entry reordering, are incomparable even
   if their sanitized assessments are identical.
6. No private paths, test marker content or SHA-256 digest is disclosed.

The existing Python CI discovery pattern includes the M18 unit tests.
M18 does NOT add any job that downloads arbitrary archives, opens real
OMSI directories, runs untrusted mod parsing, changes sandbox permissions
or interacts with installers.

## Unchanged blockers and disclaimers

All work is confined to CI-generated in-memory test archives and existing
ZIP/CRC budgets. No real mod validation, filesystem operations, extraction,
network/IPC, installation, merge or release.

M8's fixture candidate continues to mean only an in-ZIP reference pattern.
Even all M9-M16 hints and a stable M18 snapshot cannot establish game
identity, authenticity, renderability, compatibility or installation safety.
Ubuntu 24.04 X11 strict sandbox remains a blocking homologation issue (#4).
