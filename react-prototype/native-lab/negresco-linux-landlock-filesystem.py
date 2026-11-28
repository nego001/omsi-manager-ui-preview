# Disposable Landlock filesystem experiment. No personal data or caller paths.
import ctypes
import errno
import json
import os
import platform
import subprocess
import sys
import tempfile

READ_FILE = 1 << 2
READ_DIR = 1 << 3
WRITE_FILE = 1 << 1
REMOVE_DIR = 1 << 4
REMOVE_FILE = 1 << 5
MAKE_REG = 1 << 8
MAKE_DIR = 1 << 7
REFER = 1 << 13
TRUNCATE = 1 << 14

class Ruleset(ctypes.Structure):
    _fields_ = [("handled_access_fs", ctypes.c_uint64)]

class PathRule(ctypes.Structure):
    _pack_ = 1
    _fields_ = [("allowed_access", ctypes.c_uint64), ("parent_fd", ctypes.c_int32)]

def need(ok, stage):
    if not ok:
        raise RuntimeError(stage)

def restrict(root):
    need(platform.machine() in ("x86_64", "aarch64"), "architecture")
    libc = ctypes.CDLL(None, use_errno=True)
    libc.syscall.restype = ctypes.c_long
    libc.prctl.argtypes = [ctypes.c_int, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong]
    libc.prctl.restype = ctypes.c_int
    abi = libc.syscall(ctypes.c_long(444), ctypes.c_void_p(), ctypes.c_size_t(0), ctypes.c_uint(1))
    need(abi >= 3, "landlock-abi-unavailable")
    # Handle all filesystem rights from ABI 3; only read access is granted.
    mask = (1 << 15) - 1
    rules = Ruleset(mask)
    fd = libc.syscall(ctypes.c_long(444), ctypes.byref(rules), ctypes.c_size_t(ctypes.sizeof(rules)), ctypes.c_uint(0))
    need(fd >= 0, "ruleset")
    try:
        parent = os.open(root, os.O_PATH | os.O_DIRECTORY | os.O_CLOEXEC)
        try:
            rule = PathRule(READ_FILE | READ_DIR, parent)
            need(libc.syscall(ctypes.c_long(445), ctypes.c_int(fd), ctypes.c_int(1), ctypes.byref(rule), ctypes.c_uint(0)) == 0, "path-rule")
        finally:
            os.close(parent)
        need(libc.prctl(38, 1, 0, 0, 0) == 0, "no-new-privileges")
        need(libc.syscall(ctypes.c_long(446), ctypes.c_int(fd), ctypes.c_uint(0)) == 0, "restrict-self")
    finally:
        os.close(fd)
    return abi

def denied(action, stage):
    try:
        action()
    except OSError as exc:
        need(exc.errno == errno.EACCES, stage + "-errno")
        return
    raise RuntimeError(stage + "-admitted")

def read(path):
    with open(path, "rb") as f:
        return f.read(32)

def write(path):
    with open(path, "r+b") as f:
        f.write(b"fixture")

def child(base, mode):
    root = os.path.join(base, "allowed")
    inside = os.path.join(root, "input.txt")
    outside = os.path.join(base, "outside", "sentinel.txt")
    created = os.path.join(root, "new.txt")
    if mode == "restricted":
        abi = restrict(root)
        need(read(inside) == b"fixture", "inside-read")
        need("input.txt" in os.listdir(root), "inside-list")
        denied(lambda: read(outside), "outside-read")
        denied(lambda: os.listdir(os.path.dirname(outside)), "outside-list")
        denied(lambda: write(inside), "inside-write")
        denied(lambda: os.truncate(inside, 0), "inside-truncate")
        denied(lambda: open(created, "xb").close(), "inside-create")
        denied(lambda: os.unlink(inside), "inside-delete")
        print(abi)
    elif mode == "control":
        need(read(inside) == read(outside) == b"fixture", "control-read")
        write(inside)
        with open(created, "xb") as f:
            f.write(b"control")
        os.unlink(created)
        print("control")
    else:
        raise RuntimeError("mode")

def main():
    need(sys.platform == "linux" and len(sys.argv) == 1, "admission")
    with tempfile.TemporaryDirectory(prefix="negresco-landlock-") as base:
        for name, file in (("allowed", "input.txt"), ("outside", "sentinel.txt")):
            directory = os.path.join(base, name)
            os.mkdir(directory)
            with open(os.path.join(directory, file), "xb") as f:
                f.write(b"fixture")
        abi = None
        # Fork only this owned test process; no externally selectable filesystem scope.
        for mode in ("control", "restricted", "control"):
            r, w = os.pipe()
            pid = os.fork()
            if pid == 0:
                os.close(r)
                try:
                    sys.stdout = os.fdopen(w, "w")
                    child(base, mode)
                    sys.stdout.flush()
                    os._exit(0)
                except BaseException:
                    os._exit(3)
            os.close(w)
            import select
            import signal
            import time
            try:
                need(bool(select.select([r], [], [], 5)[0]), "child-timeout")
                data = os.read(r, 64).decode("ascii").strip()
                end = time.monotonic() + 3
                while True:
                    got, status = os.waitpid(pid, os.WNOHANG)
                    if got:
                        pid = None
                        break
                    need(time.monotonic() < end, "child-exit-timeout")
                    time.sleep(0.01)
                need(os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0, mode + "-refused")
                if mode == "restricted":
                    abi = int(data)
                    need(abi >= 3, "abi")
                else:
                    need(data == "control", "control-marker")
            finally:
                os.close(r)
                if pid is not None:
                    # This is our unreaped direct child, not a caller-supplied PID.
                    try:
                        os.kill(pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    os.waitpid(pid, 0)
        need(read(os.path.join(base, "allowed", "input.txt")) == b"fixture", "input-changed")
        need(read(os.path.join(base, "outside", "sentinel.txt")) == b"fixture", "sentinel-changed")
        need(os.listdir(os.path.join(base, "allowed")) == ["input.txt"], "unexpected-file")
    print(json.dumps(dict(scope="disposable-linux-landlock-filesystem", mechanism="Landlock",
        abi=abi, positiveBefore=True, positiveAfter=True, allowedRead=True, allowedList=True,
        outsideReadRefused=True, outsideListRefused=True, writeRefused=True, truncateRefused=True,
        createRefused=True, deleteRefused=True, refusal="EACCES", fixturesUnchanged=True,
        inheritedDescriptorsVerified=False, universalFilesystemIsolationVerified=False,
        readerIntegrated=False, operationsEnabled=False, realReadsPerformed=False), separators=(",", ":")))

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        detail = str(exc)
        print("NEGRESCO_LINUX_LANDLOCK_REFUSED:" + (detail if detail.isascii() and detail.replace("-", "").isalnum() else "native"), file=sys.stderr)
        sys.exit(3)
