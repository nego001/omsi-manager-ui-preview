# Phase 2 / M17 | Deterministic, privacy-safe synthetic decision trace

**Branch:** feat/controlled-fixture-decision-trace-v1
**Base:** PR #20 / M16. All PRs are Draft; no merge or release.

## Motivation and non-goals

M16 protects the **integrity of a single synthetic test ZIP invocation** and
its O3D entry-level evidence. M17 explains *why* the older M8 fixture
classification was selected, using a deterministic, bounded, fixed-vocabulary
rule trace. This is an explanation of **test fixture patterns**, not a
statement about whether any real OMSI/ETS/ATS mod is valid, compatible,
authentic or ready for installation.

The trace is derived **only after the M16 scope audit reports success**.
It does not use an O3D's global aggregate stage counts to promote a game
identity. A single fixture candidate may have an invalid/fake O3D body;
the M8 label only means the **BUS → marked CFG → declared O3D path** is
linked inside the same synthetic ZIP and vehicle variant.

## Rule precedence (highest first)

| ID | Corresponding assessment | Fixed reason |
|---|---|---|
| mixedMarkers | mixed-markers-ambiguous | BUS/CFG markers coexist with shared SII markers |
| linkedMesh | omsi-fixture-candidate | BUS refers to CFG that refers to O3D in same variant |
| linkedModelWithoutMesh | omsi-model-mesh-unconfirmed | BUS→CFG, but no qualifying linked mesh |
| sharedSii | ets2-ats-shared-format-ambiguous | SII shared markers cannot decide ETS2 vs ATS |
| pairedWithoutLink | unlinked-omsi-fixture-markers | BUS and CFG markers share a variant but lack a link |
| isolatedOmSiMarker | insufficient-omsi-fixture-evidence | Partial isolated BUS/CFG fixture markers |
| noRecognizableMarkers | no-recognizable-fixture-evidence | No supported definition marker |

For each fixed rule M17 provides:
- `selected`: this is the first applicable rule and governs the assessment.
- `matchedButOverridden`: another applicable rule has lower priority.
- `notMatched`: this rule's condition was not met.

The trace is **exactly seven fixed-size entries** with stable rule IDs, an
authored (never user-derived) reason sentence, and a fixed schema. No paths,
file names, hashes, raw O3D data, counts of private file contents, or
timestamps are included in the diagnostic explanations.

## Independent acceptance contract

The M17 helper independently reconstructs the expected assessment from
six internal M8 fixture counters (paired, linked, meshLinked, bus, cfg,
truck). It requires:
- strictly typed non-negative integers; booleans are not accepted as counts;
- the exact declared counter fields with no caller-provided extras;
- an M16 scope result of the boolean `True`;
- the hierarchy `meshLinked <= linked <= paired <= min(bus,cfg)`;
- agreement between independently derived assessment and the M8 assessment.

A mismatch raises the fixed error:
`CONTROLLED_FIXTURE_DECISION_TRACE_REFUSED`.

The package does not produce a trustworthy explanation from contradictory
counters. The original classification field `assessment`
and all prior O3D evidence/ZIP safety gates remain unchanged.

## Output flags and security gates

The wrapper exposes `syntheticDecisionTrace` with:
- `schema`, `selectedRuleId`, `selectedReason`,
  `orderedRuleOutcomes`;
- `decisionDerivedFromLinkedFixtureMarkersOnly: true`;
- `aggregateO3dStatesCannotPromoteDecision: true`;
- `realGameIdentityEstablished: false`;
- `realFormatValidated: false`;
- `compatibilityEstablished: false`;
- `installationAuthorized: false`.

Contradictions in the earlier M15/M16 structural ledger still fail closed
at the ZIP reader before an M17 explanation is generated.

Tests cover all seven decisions; precedence when SII and linked OMSI hints
coexist; stability under ZIP-entry reordering; unrelated O3D entries;
synthetic packages with different bytes but identical paths; private strings
and names; forged scope results, mismatched assessments, negative/boolean
counts, counter-hierarchy breaches and absence of BUS/CFG evidence.

No real mod scans, filesystem, extraction, network/IPC, installation,
signature verification, real-game identity, sandbox relaxations, merge or
release. Ubuntu 24.04 strict X11 sandbox remains a mandatory blocker in
issue #4.
