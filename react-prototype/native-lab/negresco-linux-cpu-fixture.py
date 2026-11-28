"""F4.02c.2: bounded disposable CPU time experiment, no global resource changes."""
import json
import os
import resource
import signal
import subprocess
import sys
import time

def need(ok):
    if not ok:
        raise RuntimeError("fixture refused")

def child(mode):
    need(mode in ("control", "soft", "hard"))
    resource.setrlimit(resource.RLIMIT_CPU, (1, 2))
    need(resource.getrlimit(resource.RLIMIT_CPU) == (1, 2))
    if mode == "control":
        need(sum(range(10000)) == 49995000)
        os.write(1, b"control-ok")
        return
    if mode == "soft":
        def on_limit(signum, frame):
            os.write(1, b"sigxcpu")
            os._exit(77)
        signal.signal(signal.SIGXCPU, on_limit)
    else:
        signal.signal(signal.SIGXCPU, signal.SIG_IGN)
    # At most three CPU seconds even if the kernel fails to enforce the limit.
    # Parent also has an independent wall-clock timeout.
    start = time.process_time()
    x = 0
    while time.process_time() - start < 3:
        for i in range(4096):
            x = (x + i) & 0xffffffff
    os._exit(78)

def launch(mode):
    return subprocess.run([sys.executable, "-I", "-B", __file__, mode],
                          capture_output=True, timeout=12, check=False)

def main():
    need(sys.platform == "linux")
    if len(sys.argv) == 2:
        child(sys.argv[1])
        return
    need(len(sys.argv) == 1)
    before = launch("control")
    need(before.returncode == 0 and before.stdout == b"control-ok" and not before.stderr)
    soft = launch("soft")
    need(soft.returncode == 77 and soft.stdout == b"sigxcpu" and not soft.stderr)
    hard = launch("hard")
    need(hard.returncode == -signal.SIGKILL and not hard.stdout and not hard.stderr)
    after = launch("control")
    need(after.returncode == 0 and after.stdout == b"control-ok" and not after.stderr)
    print(json.dumps({"scope":"disposable-linux-cpu-fixture","mechanism":"RLIMIT_CPU",
                      "softSeconds":1,"hardSeconds":2,"positiveBefore":True,
                      "softSignal":"SIGXCPU","softHandlerExit":77,"hardSignal":"SIGKILL",
                      "positiveAfter":True,"cpuTimeLimitObserved":True,
                      "cpuRateThrottleVerified":False,"processTreeLimitVerified":False,
                      "readerLimitIntegrated":False,"operationsEnabled":False,
                      "realReadsPerformed":False}, separators=(",", ":")))

if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("NEGRESCO_LINUX_CPU_FIXTURE_REFUSED", file=sys.stderr)
        sys.exit(3)
