from __future__ import annotations

import shutil
import subprocess
import threading
from typing import Optional


class CloudflaredTunnel:
    """Minimal trycloudflare tunnel runner.

    Starts `cloudflared tunnel --url <local> --metrics 127.0.0.1:0` and parses the
    generated https://<subdomain>.trycloudflare.com URL from stdout/stderr.
    """

    def __init__(self, exe: str, local_url: str) -> None:
        self.exe = exe
        self.local_url = local_url
        self.process: subprocess.Popen[str] | None = None
        self.public_url: str | None = None
        self._lock = threading.Lock()
        self._stop = threading.Event()

    @staticmethod
    def resolve_exe(preferred: str) -> Optional[str]:
        if preferred:
            return preferred
        return shutil.which("cloudflared")

    def start_async(self) -> None:
        t = threading.Thread(target=self._run, name="cloudflared-tunnel", daemon=True)
        t.start()

    def stop(self) -> None:
        self._stop.set()
        with self._lock:
            p = self.process
        if p and p.poll() is None:
            try:
                p.terminate()
            except Exception:
                pass

    def _run(self) -> None:
        args = ["tunnel", "--url", self.local_url, "--metrics", "127.0.0.1:0"]
        try:
            p = subprocess.Popen(
                [self.exe, *args],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
        except Exception:
            return

        with self._lock:
            self.process = p

        try:
            assert p.stdout is not None
            for line in p.stdout:
                if self._stop.is_set():
                    break
                s = line.strip()
                if "trycloudflare.com" in s and "https://" in s:
                    # Example: "https://xxx.trycloudflare.com"
                    start = s.find("https://")
                    if start >= 0:
                        token = s[start:].split()[0].rstrip(")")
                        if token.endswith(".trycloudflare.com"):
                            with self._lock:
                                self.public_url = token.rstrip("/")
        finally:
            if self._stop.is_set():
                try:
                    p.kill()
                except Exception:
                    pass

