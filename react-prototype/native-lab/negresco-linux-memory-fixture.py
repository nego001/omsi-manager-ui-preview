"""Disposable Linux RLIMIT_AS observation; no caller paths, privileges or real Reader jobs."""
import errno
import json
import mmap
import os
import resource
import sys

MIB = 1024 * 1024
CAP = 128 * MIB
SMALL = 8 * MIB

def need(condition):
    if not condition:
        raise RuntimeError("fixture-refused")

def positive_control():
    with mmap.mmap(-1, SMALL, access=mmap.ACCESS_WRITE) as region:
        region[0] = 17
        region[SMALL - 1] = 23
        need(region[0] == 17 and region[SMALL - 1] == 23)

def run():
    need(sys.platform == "linux" and len(sys.argv) == 1)
    previous = resource.getrlimit(resource.RLIMIT_AS)
    need(all(v == resource.RLIM_INFINITY or v >= CAP for v in previous))
    # Limit only this disposable process, not the supervisor or machine.
    resource.setrlimit(resource.RLIMIT_AS, (CAP, CAP))
    need(resource.getrlimit(resource.RLIMIT_AS) == (CAP, CAP))
    positive_control()
    denied = False
    try:
        # This request cannot fit under CAP alongside existing mappings.
        # Do not touch or commit the large mapping if the kernel admits it.
        with mmap.mmap(-1, CAP, access=mmap.ACCESS_WRITE):
            pass
    except OSError as exc:
        need(exc.errno == errno.ENOMEM)
        denied = True
    need(denied)
    positive_control()
    need(resource.getrlimit(resource.RLIMIT_AS) == (CAP, CAP))
    print(json.dumps({
        "scope": "disposable-linux-memory-fixture",
        "mechanism": "RLIMIT_AS",
        "limitBytes": CAP,
        "positiveBeforeBytes": SMALL,
        "refusedRequestBytes": CAP,
        "refusal": "ENOMEM",
        "positiveAfterBytes": SMALL,
        "addressSpaceLimitObserved": True,
        "hardRssLimitVerified": False,
        "readerLimitIntegrated": False,
        "processTreeLimitVerified": False,
        "operationsEnabled": False,
        "realReadsPerformed": False
    }, separators=(",", ":")))

if __name__ == "__main__":
    try:
        run()
    except Exception:
        print("NEGRESCO_LINUX_MEMORY_FIXTURE_REFUSED", file=sys.stderr)
        sys.exit(3)
