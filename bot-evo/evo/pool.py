"""Pool of Node workers (bot-evo/worker.ts). Binary frames over stdin/stdout, see the header of worker.ts."""

from __future__ import annotations

import json
import shutil
import struct
import subprocess

import numpy as np

from .layout import OBS_DTYPE, ROOT

RESET, STEP, RESULT, QUIT = 1, 2, 3, 0


class WorkerPool:
    def __init__(self, workers: int):
        node = shutil.which("node")
        if node is None:
            raise RuntimeError("node not found on PATH")
        script = str(ROOT / "bot-evo" / "worker.ts")
        self.procs = [
            subprocess.Popen([node, script], stdin=subprocess.PIPE, stdout=subprocess.PIPE, cwd=ROOT, bufsize=0)
            for _ in range(workers)
        ]
        self.sizes: list[int] = []

    def _send(self, proc, cmd: int, payload: bytes) -> None:
        proc.stdin.write(struct.pack("<BI", cmd, len(payload)) + payload)
        proc.stdin.flush()

    def _recv(self, proc) -> bytes:
        head = proc.stdout.read(4)
        if len(head) < 4:
            raise RuntimeError("worker died (see its error output above)")
        (n,) = struct.unpack("<I", head)
        data = bytearray()
        while len(data) < n:
            chunk = proc.stdout.read(n - len(data))
            if not chunk:
                raise RuntimeError("worker died (see its error output above)")
            data += chunk
        return bytes(data)

    def _observations(self):
        statuses, records = [], []
        for proc, n in zip(self.procs, self.sizes):
            if n == 0:
                continue
            buf = self._recv(proc)
            statuses.append(np.frombuffer(buf, dtype=np.uint8, count=n))
            records.append(np.frombuffer(buf, dtype=OBS_DTYPE, count=n, offset=n))
        return np.concatenate(statuses), np.concatenate(records)

    def reset(self, seed: int, length: int, level_type: str, n: int, limits: dict | None = None):
        w = len(self.procs)
        self.sizes = [n // w + (1 if i < n % w else 0) for i in range(w)]
        for proc, size in zip(self.procs, self.sizes):
            if size:
                msg = {"seed": seed, "length": length, "type": level_type, "n": size, **(limits or {})}
                self._send(proc, RESET, json.dumps(msg).encode())
        return self._observations()

    def step(self, actions: np.ndarray):
        at = 0
        for proc, size in zip(self.procs, self.sizes):
            if size:
                self._send(proc, STEP, actions[at:at + size].tobytes())
            at += size
        return self._observations()

    def results(self) -> np.ndarray:
        for proc, size in zip(self.procs, self.sizes):
            if size:
                self._send(proc, RESULT, b"")
        out = [np.frombuffer(self._recv(p), dtype="<f4").reshape(-1, 6) for p, s in zip(self.procs, self.sizes) if s]
        return np.concatenate(out)

    def close(self) -> None:
        for proc in self.procs:
            try:
                self._send(proc, QUIT, b"")
            except OSError:
                pass
            proc.kill()
