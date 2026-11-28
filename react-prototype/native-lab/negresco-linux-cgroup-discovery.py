"""F4.02b.4: read-only cgroup v2 discovery, never creates or modifies cgroups."""
import json
import os
import re
import sys
from pathlib import Path

def need(condition):
    if not condition:
        raise RuntimeError("fixture-refused")

def bounded_text(path, cap=65536):
    with path.open("rb") as handle:
        data = handle.read(cap + 1)
    need(len(data) <= cap)
    return data.decode("utf-8", errors="strict")

def decode_mount(value):
    return re.sub(r"\\([0-7]{3})", lambda m: chr(int(m.group(1), 8)), value)

def components(value):
    need(value.startswith("/") and "\0" not in value)
    parts = value.split("/")[1:]
    if parts == [""]:
        return []
    need(all(p not in ("", ".", "..") for p in parts))
    return parts

def observe():
    need(sys.platform == "linux" and len(sys.argv) == 1)
    mounts = bounded_text(Path("/proc/self/mountinfo"), 1048576)
    membership = bounded_text(Path("/proc/self/cgroup"))
    groups = [line[3:] for line in membership.splitlines() if line.startswith("0::")]
    v2 = []
    for line in mounts.splitlines():
        fields = line.split(" - ", 1)
        if len(fields) == 2 and fields[1].split()[0] == "cgroup2":
            left = fields[0].split()
            need(len(left) >= 6)
            v2.append((decode_mount(left[3]), decode_mount(left[4]), left[5].split(",")))
    available = bool(v2 and len(groups) == 1)
    resolved = False
    readonly = False
    controllers = []
    writable_hint = False
    interfaces = {k:False for k in ["memoryMax", "memoryCurrent", "pidsMax", "cpuMax", "cgroupKill"]}
    if available:
        parts = components(groups[0])
        candidates = []
        for root, mount, options in v2:
            root_parts = components(root)
            if parts[:len(root_parts)] == root_parts:
                candidates.append((len(root_parts), Path(mount).joinpath(*parts[len(root_parts):]), options))
        if candidates:
            _, directory, options = max(candidates, key=lambda item:item[0])
            resolved = directory.is_dir() and (directory / "cgroup.controllers").is_file()
            if resolved:
                readonly = "ro" in options
                raw = bounded_text(directory / "cgroup.controllers", 4096).split()
                controllers = sorted(set(raw) & {"memory", "pids", "cpu"})
                for key,name in [("memoryMax","memory.max"),("memoryCurrent","memory.current"),("pidsMax","pids.max"),("cpuMax","cpu.max"),("cgroupKill","cgroup.kill")]:
                    interfaces[key] = (directory / name).is_file()
                writable_hint = not readonly and os.access(directory, os.W_OK | os.X_OK)
    status = ("unavailable" if not available else "membership-unresolved" if not resolved else "candidate-unverified" if writable_hint else "not-writable")
    return {"scope":"disposable-linux-cgroup-discovery","status":status,
            "cgroupV2Observed":available,"membershipResolved":resolved,"mountReadOnly":readonly,
            "controllers":controllers,"interfaces":interfaces,"directoryWriteAccessHint":writable_hint,
            "delegationVerified":False,"limitsApplied":False,"memoryEnforcementVerified":False,
            "descendantLimitVerified":False,"cgroupKillVerified":False,"realReadsPerformed":False,
            "operationsEnabled":False}

if __name__ == "__main__":
    try:
        print(json.dumps(observe(), separators=(",", ":")))
    except Exception:
        print("NEGRESCO_CGROUP_DISCOVERY_REFUSED", file=sys.stderr)
        sys.exit(3)
