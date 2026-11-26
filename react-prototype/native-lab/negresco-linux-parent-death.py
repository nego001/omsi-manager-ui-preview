# Fixed disposable Linux parent-death experiment. No caller PID, path or command.
import ctypes
import json
import os
import select
import signal
import sys
import time

PR_SET_PDEATHSIG = 1
PR_SET_CHILD_SUBREAPER = 36
libc = ctypes.CDLL(None, use_errno=True)
libc.prctl.argtypes = [ctypes.c_int, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong]
libc.prctl.restype = ctypes.c_int

def require(ok, stage):
    if not ok:
        raise RuntimeError(stage)

def prctl(option, value):
    require(libc.prctl(option, value, 0, 0, 0) == 0, "prctl")

def wait_owned(pid, seconds=5):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        got, status = os.waitpid(pid, os.WNOHANG)
        if got == pid:
            return status
        time.sleep(0.01)
    raise RuntimeError("wait-timeout")

def exit_status(status, code):
    return os.WIFEXITED(status) and os.WEXITSTATUS(status) == code

def trial(negative):
    ready_r, ready_w = os.pipe()
    parent_r, parent_w = os.pipe()
    child_r, child_w = os.pipe()
    pid = os.fork()
    if pid == 0:
        try:
            os.close(ready_r)
            os.close(parent_w)
            os.close(child_w)
            owner = os.getpid()
            descendant = os.fork()
            if descendant == 0:
                try:
                    os.close(parent_r)
                    prctl(PR_SET_PDEATHSIG, signal.SIGKILL)
                    require(os.getppid() == owner, "parent-changed")
                    os.write(ready_w, str(os.getpid()).encode("ascii"))
                    os.close(ready_w)
                    readable, _, _ = select.select([child_r], [], [], 12)
                    os._exit(77 if readable and os.read(child_r, 1) == b"C" else 78)
                except BaseException:
                    os._exit(79)
            os.close(ready_w)
            os.close(child_r)
            readable, _, _ = select.select([parent_r], [], [], 12)
            require(readable and os.read(parent_r, 1) == b"P", "parent-release")
            if negative:
                os._exit(0)
            _, status = os.waitpid(descendant, 0)
            os._exit(77 if exit_status(status, 77) else 79)
        except BaseException:
            os._exit(79)
    os.close(ready_w)
    os.close(parent_r)
    os.close(child_r)
    parent_fd = descendant_fd = None
    descendant = None
    parent_reaped = descendant_reaped = False
    try:
        parent_fd = os.pidfd_open(pid)
        require(bool(select.select([ready_r], [], [], 5)[0]), "ready-timeout")
        raw = os.read(ready_r, 32)
        require(raw.isdigit() and len(raw) <= 10, "ready-pid")
        descendant = int(raw)
        require(descendant > 1 and descendant != pid and descendant != os.getpid(), "identity")
        descendant_fd = os.pidfd_open(descendant)
        require(not select.select([parent_fd, descendant_fd], [], [], 0)[0], "alive-before-release")
        if not negative:
            os.write(child_w, b"C")
        os.write(parent_w, b"P")
        parent_status = wait_owned(pid)
        parent_reaped = True
        require(exit_status(parent_status, 0 if negative else 77), "parent-exit")
        if negative:
            child_status = wait_owned(descendant)
            descendant_reaped = True
            require(os.WIFSIGNALED(child_status) and os.WTERMSIG(child_status) == signal.SIGKILL, "descendant-signal")
        require(bool(select.select([descendant_fd], [], [], 1)[0]), "descendant-not-exited")
    finally:
        for fd in (ready_r, parent_w, child_w):
            os.close(fd)
        # Only retained pidfds from the disposable handshake are ever signaled.
        for fd in (descendant_fd, parent_fd):
            if fd is not None:
                try:
                    signal.pidfd_send_signal(fd, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                finally:
                    os.close(fd)
        if not parent_reaped:
            try:
                wait_owned(pid, 3)
            except ChildProcessError:
                pass
        if descendant is not None and not descendant_reaped:
            try:
                wait_owned(descendant, 3)
            except ChildProcessError:
                pass

def main():
    require(sys.platform == "linux" and len(sys.argv) == 1, "admission")
    require(hasattr(os, "pidfd_open") and hasattr(signal, "pidfd_send_signal"), "pidfd-unavailable")
    prctl(PR_SET_CHILD_SUBREAPER, 1)
    trial(False)
    trial(True)
    trial(False)
    print(json.dumps(dict(scope="disposable-linux-parent-death", mechanism="PR_SET_PDEATHSIG",
        positiveBefore=True, childReadyBeforeParentExit=True, parentNaturalExit=True,
        adoptedDescendantReaped=True, descendantSignal="SIGKILL", positiveAfter=True,
        pidfdIdentityUsed=True, directDescendantOnly=True, arbitraryTreeVerified=False,
        readerIntegrated=False, operationsEnabled=False, realReadsPerformed=False),
        separators=(",", ":")))

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        detail = str(exc)
        print("NEGRESCO_LINUX_PARENT_DEATH_REFUSED:" + (detail if detail.isascii() and detail.replace("-", "").isalnum() else "native"), file=sys.stderr)
        sys.exit(3)
