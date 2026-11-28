# Fixed Linux inherited-resource boundary experiment. No user paths or external network.
import errno
import json
import os
import runpy
import select
import signal
import socket
import sys
import tempfile
import time

def need(ok, stage):
    if not ok:
        raise RuntimeError(stage)

def denied(action, expected, stage):
    try:
        value = action()
    except OSError as exc:
        need(exc.errno == expected, stage + "-errno")
        return
    if isinstance(value, socket.socket):
        value.close()
    elif isinstance(value, int) and stage == "reopen":
        os.close(value)
    raise RuntimeError(stage + "-admitted")

def run():
    need(sys.platform == "linux" and len(sys.argv) == 1, "admission")
    here = os.path.dirname(os.path.abspath(__file__))
    landlock = runpy.run_path(os.path.join(here, "negresco-linux-landlock-filesystem.py"))["restrict"]
    seccomp = runpy.run_path(os.path.join(here, "negresco-linux-socket-restriction.py"))["restrict"]
    with tempfile.TemporaryDirectory(prefix="negresco-inherited-") as base:
        allowed = os.path.join(base, "allowed")
        os.mkdir(allowed)
        sentinel = os.path.join(base, "sentinel")
        with open(sentinel, "xb") as f:
            f.write(b"fixture")
        fd = os.open(sentinel, os.O_RDONLY | os.O_CLOEXEC)
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen(1)
            listener.settimeout(2)
            with socket.create_connection(listener.getsockname(), timeout=2) as sender:
                receiver, peer = listener.accept()
                with receiver:
                    need(peer[0] == "127.0.0.1", "peer")
                    receiver.settimeout(3)
                    sender.settimeout(2)
                    r, w = os.pipe()
                    pid = os.fork()
                    if pid == 0:
                        os.close(r)
                        receiver.close()
                        listener.close()
                        try:
                            seccomp()
                            abi = landlock(allowed)
                            # These resources predate both restrictions; their continued
                            # usability is a limitation, not evidence of full isolation.
                            need(os.read(fd, 7) == b"fixture", "inherited-file-read")
                            sender.sendall(b"fixture")
                            socket_fd = sender.fileno()
                            sender.close()
                            os.close(fd)
                            denied(lambda: os.read(fd, 1), errno.EBADF, "closed-file")
                            denied(lambda: os.write(socket_fd, b"x"), errno.EBADF, "closed-socket")
                            denied(lambda: os.open(sentinel, os.O_RDONLY), errno.EACCES, "reopen")
                            denied(lambda: socket.socket(socket.AF_INET, socket.SOCK_STREAM), errno.EPERM, "new-socket")
                            os.write(w, str(abi).encode("ascii"))
                            os._exit(0)
                        except BaseException:
                            os._exit(3)
                    os.close(w)
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
                        data = b""
                        while len(data) < 7:
                            chunk = receiver.recv(7 - len(data))
                            need(bool(chunk), "marker-eof")
                            data += chunk
                        need(data == b"fixture" and receiver.recv(1) == b"", "marker")
                    finally:
                        os.close(r)
                        if pid is not None:
                            # Only the owned, unreaped fork child.
                            try:
                                os.kill(pid, signal.SIGKILL)
                            except ProcessLookupError:
                                pass
                            os.waitpid(pid, 0)
        with open(sentinel, "rb") as f:
            need(f.read() == b"fixture", "sentinel-changed")
    print(json.dumps(dict(scope="disposable-linux-inherited-resources",mechanism="seccomp+Landlock",
        abi=abi, preopenedFileReadObserved=True, preconnectedSocketSendObserved=True,
        parentMarkerObserved=True, closedFileRefused=True, closedSocketRefused=True,
        outsideReopenRefused=True, newSocketRefused=True, fixtureUnchanged=True,
        descriptorBoundaryDemonstrated=True, automaticDescriptorHygieneVerified=False,
        allNetworkDeniedVerified=False, universalFilesystemIsolationVerified=False,
        readerIntegrated=False, operationsEnabled=False, realReadsPerformed=False),separators=(",",":")))

if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        detail = str(exc)
        print("NEGRESCO_LINUX_INHERITED_RESOURCES_REFUSED:" +
              (detail if detail.isascii() and detail.replace("-", "").isalnum() else "native"),file=sys.stderr)
        sys.exit(3)
