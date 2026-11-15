"""Conservative text-structure hints for memory-only CI-generated mod fixtures.

These are NOT OMSI/ETS/ATS format parsers. Never assert a real game, semantic
validity, dependencies, authenticity, malware status, or install readiness.
No filesystem, raw paths, text samples or user-controlled strings are returned.
"""
from __future__ import annotations

import re

TEXT_LIMIT = 16_384
LINE_LIMIT = 256
SUPPORTED = frozenset({"bus", "cfg", "sii"})
BRACKET_DIRECTIVE = re.compile(r"\[[A-Za-z0-9_]{1,64}\]\Z", re.ASCII)
SII_UNIT_DECLARATION = re.compile(
    r"[A-Za-z_][A-Za-z0-9_.]*\s*:\s*[A-Za-z0-9_.]+(?:\.[A-Za-z0-9_.]+)*\Z",
    re.ASCII,
)
ALLOWED_CTRL = frozenset({"\n", "\r", "\t"})

def inspect_fixture_text(suffix: str, payload: bytes) -> str:
    """One of: marker-observed, no-marker, text-unavailable, not-inspected."""
    if suffix not in SUPPORTED or type(payload) is not bytes:
        return "not-inspected"
    if len(payload) > TEXT_LIMIT:
        return "not-inspected"
    try:
        content = payload.decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        return "text-unavailable"
    if any(ord(ch) < 32 and ch not in ALLOWED_CTRL for ch in content):
        return "text-unavailable"
    lines = content.splitlines()
    if len(lines) > LINE_LIMIT:
        return "not-inspected"
    logical = [line.strip() for line in lines
               if line.strip() and not line.lstrip().startswith(("#", "//", ";"))]
    if suffix in ("bus", "cfg"):
        return ("marker-observed" if any(BRACKET_DIRECTIVE.fullmatch(line)
                for line in logical) else "no-marker")
    # A deliberately strict token-only SiiNunit *hint*. Brace tokens on their
    # own lines and a colon declaration are NOT proof of valid SII syntax.
    header = logical[0] == "SiiNunit" if logical else False
    balance = 0
    braces = 0
    unit_lines = 0
    for line in logical[1:]:
        if line == "{":
            balance += 1
            braces += 1
        elif line == "}":
            balance -= 1
            if balance < 0:
                return "no-marker"
        elif SII_UNIT_DECLARATION.fullmatch(line):
            unit_lines += 1
    return ("marker-observed" if header and balance == 0 and braces > 0
            and unit_lines > 0 and logical[-1] == "}" else "no-marker")
