"""Compare only CI-generated, in-memory ZIP *fixtures*.

The input has no filesystem paths or game context. Individual ZIP bytes are
vetted and CRC-checked by the existing limited reader before *any* cross-ZIP
relationship is considered. Results never contain filenames or target paths.
This is NOT a production package dependency analyser, nor an installer.
"""
from __future__ import annotations

import io
import zipfile

from controlled_definition_hints import TEXT_LIMIT
from controlled_reference_hints import (
    KINDS, empty_counts, inspect_fixture_references, FixtureReferenceLimitExceeded,
)
from controlled_zip_reader import (
    ControlledZipRefused, MAX_ARCHIVE_BYTES, examine_controlled_zip_bytes,
)

MAX_PACKAGES = 4
MAX_COMBINED_INPUT_BYTES = 6_000_000
MAX_COMBINED_EXPANDED_BYTES = 8_000_000
MAX_COMBINED_DECLARATIONS = 512
FIELDS = (
    "declared", "insideOwnFixture", "candidateInOtherFixture",
    "notFoundInProvidedFixtures", "unsafePath", "unsupportedHint",
)

def _refuse():
    raise ControlledZipRefused("CONTROLLED_ZIP_BYTES_REFUSED")

def _blank():
    return {kind: {key: 0 for key in FIELDS} for kind in KINDS}

def examine_fixture_group(payloads: tuple[bytes, ...]) -> dict:
    """Bounded count-only comparison of two to four *synthetic* ZIP objects.

    A candidate means only that a string reference points to an entry name in
    another provided fixture. It proves nothing about contents, compatibility,
    load order, external installed mods or the game's actual path rules.
    """
    if (type(payloads) is not tuple or not 2 <= len(payloads) <= MAX_PACKAGES
            or any(type(payload) is not bytes or not payload
                   or len(payload) > MAX_ARCHIVE_BYTES for payload in payloads)
            or sum(map(len, payloads)) > MAX_COMBINED_INPUT_BYTES):
        _refuse()

    # Gate every package before attempting to use any of its own metadata.
    singles = [examine_controlled_zip_bytes(payload) for payload in payloads]
    if sum(s["actualInflatedBytes"] for s in singles) > MAX_COMBINED_EXPANDED_BYTES:
        _refuse()

    # All metadata below is ephemeral, internal to this function, and derived
    # from immutable bytes whose ZIP entries have already passed vetting.
    indexes = []
    sources = []
    try:
        for payload in payloads:
            with zipfile.ZipFile(io.BytesIO(payload)) as archive:
                entries = archive.infolist()
                file_names = frozenset(info.filename.lower()
                                       for info in entries if not info.is_dir())
                fixtures = []
                for info in entries:
                    if info.is_dir():
                        continue
                    suffix = info.filename.rsplit(".", 1)[-1].lower()
                    if suffix in ("bus", "cfg"):
                        content = (archive.read(info) if info.file_size <= TEXT_LIMIT
                                   else None)
                        fixtures.append((info.filename.lower(), suffix, content))
                indexes.append(file_names)
                sources.append(fixtures)
    except (zipfile.BadZipFile, zipfile.LargeZipFile, RuntimeError,
            EOFError, OSError, NotImplementedError, MemoryError, OverflowError):
        _refuse()

    union = frozenset().union(*indexes)
    output = []
    combined_declarations = 0

    for index, (own, fixtures, checked) in enumerate(zip(indexes, sources, singles)):
        counts = _blank()
        inspected = not_inspected = 0
        verified_local = empty_counts()
        try:
            for filename, suffix, content in fixtures:
                own_counts = (inspect_fixture_references(
                    suffix, content, filename, own) if content is not None else None)
                union_counts = (inspect_fixture_references(
                    suffix, content, filename, union) if content is not None else None)
                if own_counts is None or union_counts is None:
                    not_inspected += 1
                    continue
                inspected += 1
                for kind in KINDS:
                    local = own_counts[kind]
                    across = union_counts[kind]
                    for key in local:
                        verified_local[kind][key] += local[key]
                    candidates = across["presentInFixture"] - local["presentInFixture"]
                    if (candidates < 0 or candidates > local["absentFromFixture"] or
                        local["declared"] != across["declared"] or
                        local["unsafePath"] != across["unsafePath"] or
                        local["unsupportedHint"] != across["unsupportedHint"]):
                        _refuse()
                    current = counts[kind]
                    current["declared"] += local["declared"]
                    current["insideOwnFixture"] += local["presentInFixture"]
                    current["candidateInOtherFixture"] += candidates
                    current["notFoundInProvidedFixtures"] += (
                        local["absentFromFixture"] - candidates
                    )
                    current["unsafePath"] += local["unsafePath"]
                    current["unsupportedHint"] += local["unsupportedHint"]
                    combined_declarations += local["declared"]
                    if combined_declarations > MAX_COMBINED_DECLARATIONS:
                        _refuse()
        except FixtureReferenceLimitExceeded:
            _refuse()
        # Important: reparse and original validated reader must agree. If the
        # parsers ever diverge, fail closed rather than invent relationships.
        if (verified_local != checked["fixtureReferenceCounts"] or
                {"inspected": inspected, "notInspected": not_inspected}
                != checked["fixtureReferenceSources"]):
            _refuse()
        output.append({
            "fixtureSlot": index + 1,
            "inspectedDefinitionSources": inspected,
            "notInspectedDefinitionSources": not_inspected,
            "hints": counts,
        })

    return {
        "mode": "memory-fixture-cross-check-only",
        "fixtureCount": len(output),
        "slots": output,
        "declaredHintCount": combined_declarations,
        "realPackagesRead": False,
        "realDependenciesVerified": False,
        "crossPackageCandidatesVerified": False,
        "gameCompatibilityVerified": False,
        "installationEnabled": False,
        "filesystemAccessEnabled": False,
    }
