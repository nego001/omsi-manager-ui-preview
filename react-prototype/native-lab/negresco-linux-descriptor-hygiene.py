# Disposable Linux descriptor hygiene fixture. No caller paths or external endpoints.
import ctypes
import errno
import json
import os
import platform
import runpy
import select
import signal
import socket
import stat
import sys
import tempfile
import time

def need(ok, stage):
    if not ok:
        raise RuntimeError(stage)

def closed(fd):
    try:
        os.fstat(fd)
    except OSError as exc:
        need(exc.errno == errno.EBADF, "descriptor-errno")
        return
    raise RuntimeError("descriptor-still-open")

def reject_open(path):
    try:
        fd = os.open(path, os.O_RDONLY)
    except OSError as exc:
        need(exc.errno == errno.EACCES, "outside-errno")
        return
    os.close(fd)
    raise RuntimeError("outside-admitted")

def reject_socket():
    try:
        s = socket.socket()
    except OSError as exc:
        need(exc.errno == errno.EPERM, "socket-errno")
        return
    s.close()
    raise RuntimeError("socket-admitted")

def prune(keep):
    # close_range on supported Linux architectures, in the owned fork only.
    need(platform.machine() in ("x86_64", "aarch64") and keep >= 3, "architecture-or-pipe")
    libc = ctypes.CDLL(None, use_errno=True)
    libc.syscall.restype = ctypes.c_long
    for first, last in ((3, keep-1), (keep+1, 0xffffffff)):
        if first <= last:
            need(libc.syscall(ctypes.c_long(436), ctypes.c_uint(first),
                 ctypes.c_uint(last), ctypes.c_uint(0)) == 0, "close-range")
    # /proc enumeration opens a transient fd; recheck after enumeration.
    actual = []
    for entry in os.listdir("/proc/self/fd"):
        fd = int(entry)
        try:
            os.fstat(fd)
            actual.append(fd)
        except OSError as exc:
            need(exc.errno == errno.EBADF, "enumeration")
    need(set(actual) == {0, 1, 2, keep}, "unexpected-descriptors")
    for fd in (0, 1, 2, keep):
        need(stat.S_ISFIFO(os.fstat(fd).st_mode), "non-pipe-channel")

def main():
    need(sys.platform == "linux" and len(sys.argv) == 1, "admission")
    here = os.path.dirname(os.path.abspath(__file__))
    landlock = runpy.run_path(os.path.join(here, "negresco-linux-landlock-filesystem.py"))["restrict"]
    seccomp = runpy.run_path(os.path.join(here, "negresco-linux-socket-restriction.py"))["restrict"]
    with tempfile.TemporaryDirectory(prefix="negresco-prune-") as base:
        allowed = os.path.join(base, "allowed")
        os.mkdir(allowed)
        sentinel = os.path.join(base, "sentinel")
        sample = os.path.join(allowed, "input")
        for path in (sentinel, sample):
            with open(path, "xb") as f:
                f.write(b"fixture")
        fd = os.open(sentinel, os.O_RDONLY)
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen(1)
            listener.settimeout(2)
            with socket.create_connection(listener.getsockname(), timeout=2) as sender:
                receiver, peer = listener.accept()
                with receiver:
                    need(peer[0] == "127.0.0.1", "peer")
                    receiver.settimeout(3)
                    need(os.read(fd, 7) == b"fixture", "positive-file")
                    os.lseek(fd, 0, os.SEEK_SET)
                    sender.sendall(b"fixture")
                    marker = b""
                    while len(marker) < 7:
                        part = receiver.recv(7-len(marker))
                        need(bool(part), "positive-eof")
                        marker += part
                    need(marker == b"fixture", "positive-socket")
                    socket_fd = sender.fileno()
                    r, w = os.pipe()
                    # Normalize stdio to owned pipes independently of CI capture.
                    channels = [os.pipe() for _ in range(3)]
                    pid = os.fork()
                    if pid == 0:
                        try:
                            os.dup2(channels[0][0], 0)
                            os.dup2(channels[1][1], 1)
                            os.dup2(channels[2][1], 2)
                            need(os.fstat(fd).st_size == 7, "inherited-file")
                            need(stat.S_ISSOCK(os.fstat(socket_fd).st_mode), "inherited-socket")
                            prune(w)
                            closed(fd)
                            closed(socket_fd)
                            seccomp()
                            abi = landlock(allowed)
                            reject_open(sentinel)
                            reject_socket()
                            with open(sample, "rb") as f:
                                need(f.read() == b"fixture", "authorized-read")
                            os.write(w, str(abi).encode("ascii"))
                            os._exit(0)
                        except BaseException:
                            os._exit(3)
                    os.close(w)
                    for pair in channels:
                        for channel in pair:
                            os.close(channel)
                    os.close(fd)
                    sender.close()
                    try:
                        need(bool(select.select([r], [], [], 5)[0]), "child-timeout")
                        report = os.read(r, 32)
                        deadline = time.monotonic() + 3
                        while True:
                            got, status = os.waitpid(pid, os.WNOHANG)
                            if got:
                                pid = None
                                break
                            need(time.monotonic() < deadline, "exit-timeout")
                            time.sleep(0.01)
                        need(os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0, "child-refused")
                        abi = int(report)
                        need(abi >= 3, "abi")
                        need(receiver.recv(1) == b"", "unexpected-socket-data")
                    finally:
                        os.close(r)
                        if pid is not None:
                            # Only our unreaped direct child.
                            try:
                                os.kill(pid, signal.SIGKILL)
                            except ProcessLookupError:
                                pass
                            os.waitpid(pid, 0)
        with open(sentinel, "rb") as f:
            need(f.read() == b"fixture", "sentinel-changed")
    print(json.dumps(dict(scope="disposable-linux-descriptor-hygiene",mechanism="close_range+seccomp+Landlock",
        abi=abi,positiveFileControl=True,positiveSocketControl=True,preexistingDescriptorsObserved=True,
        closeRangeSucceeded=True,exactPipeAllowlistVerified=True,preopenedFileClosed=True,
        preconnectedSocketClosed=True,receiverEofObserved=True,outsideReopenRefused=True,
        newSocketRefused=True,allowedRead=True,fixtureUnchanged=True,
        readerIntegrated=False,automaticProductionHygieneVerified=False,allNetworkDeniedVerified=False,
        universalFilesystemIsolationVerified=False,operationsEnabled=False,realReadsPerformed=False),
        separators=(",",":")))

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        detail = str(exc)
        print("NEGRESCO_LINUX_DESCRIPTOR_HYGIENE_REFUSED:" +
            (detail if detail.isascii() and detail.replace("-", "").isalnum() else "native"),file=sys.stderr)
        sys.exit(3)
