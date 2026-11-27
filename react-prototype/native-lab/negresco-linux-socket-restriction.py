# Disposable Linux socket syscall restriction laboratory. Loopback only.
import ctypes
import errno
import json
import os
import select
import socket
import subprocess
import sys

def need(ok, stage):
    if not ok:
        raise RuntimeError(stage)

def restrict():
    libc = ctypes.CDLL(None, use_errno=True)
    libc.prctl.argtypes = [ctypes.c_int, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong]
    libc.prctl.restype = ctypes.c_int
    need(libc.prctl(38, 1, 0, 0, 0) == 0, "no-new-privs")
    need(libc.prctl(39, 0, 0, 0, 0) == 1, "no-new-privs-readback")
    sec = ctypes.CDLL("libseccomp.so.2")
    sec.seccomp_init.argtypes = [ctypes.c_uint32]
    sec.seccomp_init.restype = ctypes.c_void_p
    sec.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
    sec.seccomp_syscall_resolve_name.restype = ctypes.c_int
    sec.seccomp_rule_add.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint]
    sec.seccomp_rule_add.restype = ctypes.c_int
    sec.seccomp_load.argtypes = [ctypes.c_void_p]
    sec.seccomp_load.restype = ctypes.c_int
    sec.seccomp_release.argtypes = [ctypes.c_void_p]
    sec.seccomp_release.restype = None
    ctx = sec.seccomp_init(0x7fff0000)
    need(bool(ctx), "seccomp-init")
    try:
        for name in (b"socket", b"socketpair", b"connect"):
            nr = sec.seccomp_syscall_resolve_name(name)
            need(nr >= 0, "syscall-resolution")
            need(sec.seccomp_rule_add(ctx, 0x00050000 | errno.EPERM, nr, 0) == 0, "seccomp-rule")
        need(sec.seccomp_load(ctx) == 0, "seccomp-load")
    finally:
        sec.seccomp_release(ctx)

def refused(call, stage):
    try:
        value = call()
    except OSError as exc:
        need(exc.errno == errno.EPERM, stage + "-errno")
        return
    if isinstance(value, tuple):
        for item in value:
            item.close()
    elif isinstance(value, socket.socket):
        value.close()
    raise RuntimeError(stage + "-admitted")

def child(mode, port):
    need(mode in ("control", "restricted") and 1 <= port <= 65535, "child-admission")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as existing:
        existing.settimeout(2)
        if mode == "restricted":
            restrict()
            refused(lambda: socket.socket(socket.AF_INET, socket.SOCK_STREAM), "inet")
            refused(lambda: socket.socket(socket.AF_INET6, socket.SOCK_STREAM), "inet6")
            refused(lambda: socket.socket(socket.AF_UNIX, socket.SOCK_STREAM), "unix")
            refused(socket.socketpair, "socketpair")
            refused(lambda: existing.connect(("127.0.0.1", port)), "preexisting-connect")
        else:
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM):
                pass
            a, b = socket.socketpair()
            a.close()
            b.close()
            existing.connect(("127.0.0.1", port))
            existing.sendall(b"fixture")
    print(mode)

def main():
    need(sys.platform == "linux", "platform")
    if len(sys.argv) == 3:
        child(sys.argv[1], int(sys.argv[2]))
        return
    need(len(sys.argv) == 1, "admission")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(2)
        listener.settimeout(2)
        port = listener.getsockname()[1]
        for mode in ("control", "restricted", "control"):
            p = subprocess.run([sys.executable, "-I", "-B", __file__, mode, str(port)],
                               capture_output=True, timeout=8, close_fds=True)
            need(p.returncode == 0 and p.stdout == (mode + "\n").encode() and not p.stderr,
                 mode + "-child-refused")
            if mode == "control":
                conn, addr = listener.accept()
                with conn:
                    conn.settimeout(2)
                    need(addr[0] == "127.0.0.1", "unexpected-peer")
                    data = b""
                    while len(data) < 7:
                        part = conn.recv(7-len(data))
                        need(bool(part), "control-eof")
                        data += part
                    need(data == b"fixture" and conn.recv(1) == b"", "control-marker")
            else:
                need(not select.select([listener], [], [], 0.25)[0], "unexpected-connection")
    print(json.dumps(dict(scope="disposable-linux-socket-restriction", mechanism="seccomp",
        positiveBefore=True, positiveAfter=True, noNewPrivilegesReadback=True,
        inetSocketRefused=True, inet6SocketRefused=True, unixSocketRefused=True,
        socketpairRefused=True, preexistingSocketConnectRefused=True,
        refusal="EPERM", loopbackListenerUnreached=True,
        inheritedConnectedSocketsVerified=False, allNetworkDeniedVerified=False,
        readerIntegrated=False, operationsEnabled=False, realReadsPerformed=False),
        separators=(",", ":")))

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        detail = str(exc)
        print("NEGRESCO_LINUX_SOCKET_RESTRICTION_REFUSED:" +
              (detail if detail.isascii() and detail.replace("-", "").isalnum() else "native"),
              file=sys.stderr)
        sys.exit(3)
