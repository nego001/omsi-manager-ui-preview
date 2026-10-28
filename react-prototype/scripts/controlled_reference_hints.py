"""Limited reference HINTS for memory-only OMSI-like ZIP fixtures.

This deliberately accepts a tiny, synthetic marker-then-next-line dialect.
Do NOT mistake this for a real OMSI .bus/.cfg parser or a game dependency
resolver. Ref names are never returned or logged, only safe aggregate counts.
"""
from __future__ import annotations

import re
from controlled_definition_hints import TEXT_LIMIT, LINE_LIMIT, ALLOWED_CTRL

MAX_REFERENCES_PER_SOURCE = 64
MAX_REFERENCES_ALL = 256
NAME = re.compile(r"[A-Za-z0-9_./\\-]{1,160}\Z", re.ASCII)
DIRECTIVE = re.compile(r"\[([A-Za-z0-9_]{1,64})\]\Z", re.ASCII)
# Exactly the marker-based contexts this tiny fixture format understands.
KINDS = ("model", "mesh", "texture", "sound")
DIRECTIVES = {
    "model": ("model", frozenset(("cfg",))),
    "mesh": ("mesh", frozenset(("o3d",))),
    "texture": ("texture", frozenset(("dds", "png", "jpg"))),
    "sound": ("sound", frozenset(("cfg",))),
}
RESERVED = re.compile(r"(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?\Z",
                      re.IGNORECASE)

class FixtureReferenceLimitExceeded(ValueError):
    """Fixed message only; never include paths or referenced text."""

def empty_counts():
    return {key: {"declared": 0, "presentInFixture": 0,
                  "absentFromFixture": 0, "unsafePath": 0,
                  "unsupportedHint": 0} for key in KINDS}

def inspect_fixture_references(suffix: str, content: bytes,
                               source: str, paths: frozenset[str],
                               other_indexes: tuple[frozenset[str], ...] = ()):
    """Return counts, or None if the bounded source cannot be interpreted.

    Does not follow references, open files, infer game compatibility or expose
    filenames. All entries in paths MUST come from the already vetted ZIP
    central index, not from outside the memory fixture.

    Optional other_indexes distinguishes a unique filename match in exactly
    one other fixture from an ambiguous match in multiple other fixtures.
    The default stays unchanged for the single-ZIP reader. No target is
    ever returned or exposed.
    """
    if suffix not in ("bus", "cfg") or type(content) is not bytes or len(content) > TEXT_LIMIT:
        return None
    try:
        text = content.decode("utf-8", "strict")
    except UnicodeDecodeError:
        return None
    if any(ord(c) < 32 and c not in ALLOWED_CTRL for c in text):
        return None
    lines = text.splitlines()
    if len(lines) > LINE_LIMIT:
        return None
    logical = [line.strip() for line in lines
               if line.strip() and not line.lstrip().startswith(("#", "//", ";"))]
    counts = empty_counts()
    if other_indexes:
        for item in counts.values():
            item["candidateInOtherFixture"] = 0
            item["ambiguousAcrossFixtures"] = 0
    n = 0
    for i, line in enumerate(logical):
        matched = DIRECTIVE.fullmatch(line)
        if not matched or matched.group(1).lower() not in DIRECTIVES:
            continue
        if i + 1 >= len(logical) or DIRECTIVE.fullmatch(logical[i+1]):
            continue
        kind, extensions = DIRECTIVES[matched.group(1).lower()]
        value = logical[i+1]
        n += 1
        if n > MAX_REFERENCES_PER_SOURCE:
            raise FixtureReferenceLimitExceeded("FIXTURE_REFERENCE_LIMIT")
        result = counts[kind]
        result["declared"] += 1
        normalized = value.replace("\\", "/")
        pieces = normalized.split("/")
        if (not NAME.fullmatch(value) or normalized.startswith("/") or
                any(segment in ("", ".", "..") or segment.endswith(".") or
                    RESERVED.fullmatch(segment) for segment in pieces)):
            result["unsafePath"] += 1
            continue
        ext = pieces[-1].rsplit(".", 1)[-1].lower()
        if ext not in extensions:
            result["unsupportedHint"] += 1
            continue
        source_dir = source.rsplit("/", 1)[0] if "/" in source else ""
        target = (source_dir + "/" if source_dir else "") + normalized.lower()
        if target in paths:
            result["presentInFixture"] += 1
        elif other_indexes:
            matches = sum(target in other for other in other_indexes)
            if matches == 1:
                result["candidateInOtherFixture"] += 1
            elif matches > 1:
                result["ambiguousAcrossFixtures"] += 1
            else:
                result["absentFromFixture"] += 1
        else:
            result["absentFromFixture"] += 1
    return counts
