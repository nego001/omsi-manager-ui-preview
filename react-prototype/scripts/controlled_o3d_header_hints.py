"""Only bounded O3D header *hints* from synthetic CI fixture bytes.

Not a format parser, renderer, decompressor or certification step.
The ZIP reader already verified CRC and size; this helper only classifies
the first 8 bytes and never returns the bytes or paths.
"""
from __future__ import annotations

O3D_HEADER_CLASSES = (
    "plausiblePrefix", "truncatedPrefix", "unknownVersion", "magicMismatch"
)
# Observed revisions, not an exhaustive list of possible future versions.
OBSERVED_VERSIONS = frozenset((1, 3, 4, 5, 7))
MAGIC = bytes((0x84, 0x19))


def classify_o3d_header_prefix(prefix: bytes) -> str:
    """Fixed safe label. Plausible header != valid model."""
    if type(prefix) is not bytes or len(prefix) > 8:
        raise ValueError("CONTROLLED_O3D_PREFIX_REFUSED")
    if len(prefix) < 2:
        return "truncatedPrefix" if MAGIC.startswith(prefix) else "magicMismatch"
    if prefix[:2] != MAGIC:
        return "magicMismatch"
    if len(prefix) < 3:
        return "truncatedPrefix"
    version = prefix[2]
    if version not in OBSERVED_VERSIONS:
        return "unknownVersion"
    minimum = 3 if version == 1 else 4 if version == 3 else 8
    return "plausiblePrefix" if len(prefix) >= minimum else "truncatedPrefix"
