from __future__ import annotations

import json
import time
from pathlib import Path
from urllib import request
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from uuid import uuid4

from local_api.audio_url import parse_data_audio_segment
from local_api.config import get_public_base_url, settings
from local_api.domain import RewriteMode
from local_api.prompt_loader import (
    PromptRenderError,
    PromptTemplateNotFoundError,
    load_rendered_prompt_for_mode,
)


class STTAdapter:
    def transcribe(self, audio_file_path: str, provider: str) -> str:
        raise NotImplementedError


class VoiceSTTAdapter(STTAdapter):
    """Production STT: Doubao OpenSpeech bigmodel submit/query (official doc)."""

    def transcribe(self, audio_file_path: str, provider: str) -> str:
        if settings.SVI_TEST_MODE:
            return f"[test-transcript:{Path(audio_file_path).name}]"

        if provider != "doubao":
            raise ValueError(f"Unsupported STT provider: {provider}")

        if not settings.DOUBAO_API_KEY:
            raise ValueError("DOUBAO_API_KEY is required for doubao transcription.")

        return self._transcribe_via_doubao(audio_file_path)

    def _reject_localhost_audio_url(self, audio_url: str) -> None:
        """豆包云端无法访问本机回环地址；尽早给出明确错误。"""
        host = (urlparse(audio_url).hostname or "").lower()
        if host == "localhost" or host.startswith("127.") or host == "::1":
            raise ValueError(
                "Doubao cannot fetch audio from localhost/127.0.0.1. "
                "Use a public HTTPS base URL (SVI_PUBLIC_BASE_URL / cloudflared / ngrok), "
                "not http://127.0.0.1:8000.\n"
                f"Resolved URL was: {audio_url[:200]}"
            )

    def _probe_audio_url_downloadable(self, audio_url: str) -> None:
        """Best-effort: 本机能否 GET 到与豆包相同的链接（只读前几 KB；字节跳动侧仍需公网可达）。"""
        if settings.SVI_SKIP_AUDIO_URL_PROBE:
            return
        try:
            with request.urlopen(audio_url, timeout=25) as resp:
                code = resp.getcode()
                if code >= 400:
                    raise RuntimeError(f"HTTP {code}")
                chunk = resp.read(8192)
                if not chunk:
                    raise RuntimeError("empty response body")
        except HTTPError as exc:
            raise RuntimeError(
                "本地无法下载将要提供给豆包的音频 URL（豆包云端也会返回 audio download failed）。请检查：\n"
                "  · cloudflared/ngrok 隧道是否仍有效，SVI_PUBLIC_BASE_URL 是否与当前隧道域名一致\n"
                "  · 浏览器无痕窗口能否直接打开该 URL 并下载音频\n"
                "  · 若探测误报（部分隧道），可在 .env 设置 SVI_SKIP_AUDIO_URL_PROBE=1\n"
                f"URL: {audio_url}\n"
                f"HTTP {exc.code}: {exc.reason}"
            ) from exc
        except URLError as exc:
            raise RuntimeError(
                "本地无法连接音频 URL（豆包也无法拉取）。\n"
                f"URL: {audio_url}\n"
                f"Detail: {exc.reason}"
            ) from exc

    def _transcribe_via_doubao(self, audio_file_path: str) -> str:
        request_id = str(uuid4())
        audio_url = self._resolve_audio_url(audio_file_path)
        self._reject_localhost_audio_url(audio_url)
        self._probe_audio_url_downloadable(audio_url)

        submit_headers = {
            "content-type": "application/json",
            "X-Api-Key": settings.DOUBAO_API_KEY,
            "X-Api-Resource-Id": settings.DOUBAO_RESOURCE_ID,
            "X-Api-Request-Id": request_id,
            "X-Api-Sequence": "-1",
        }
        submit_body: dict = {
            "user": {"uid": settings.DOUBAO_USER_ID},
            "audio": {
                "url": audio_url,
                "format": self._audio_format_from_path(audio_file_path),
            },
            "request": {
                "model_name": "bigmodel",
                "enable_itn": settings.DOUBAO_ENABLE_ITN.lower() == "true",
            },
        }
        if settings.DOUBAO_LANGUAGE:
            submit_body["audio"]["language"] = settings.DOUBAO_LANGUAGE

        self._doubao_submit(request_id, submit_headers, submit_body)
        return self._doubao_poll_result(request_id)

    def _resolve_audio_url(self, audio_file_path: str) -> str:
        if audio_file_path.startswith("http://") or audio_file_path.startswith("https://"):
            return audio_file_path

        parsed = parse_data_audio_segment(audio_file_path)
        public_base = get_public_base_url()
        if parsed and public_base:
            session_id, filename = parsed
            return f"{public_base}/files/audio/{session_id}/{filename}"

        if settings.DOUBAO_AUDIO_URL_PREFIX:
            rel = audio_file_path.replace("\\", "/").lstrip("./")
            return f"{settings.DOUBAO_AUDIO_URL_PREFIX.rstrip('/')}/{rel}"

        raise ValueError(
            "Doubao needs a URL reachable by ByteDance servers. Options:\n"
            "1) Set SVI_PUBLIC_BASE_URL to your tunnel URL (e.g. ngrok) "
            "plus local GET /files/audio/...\n"
            "2) Or set DOUBAO_AUDIO_URL_PREFIX to map local paths to public URLs.\n"
            "3) Or store segments with audio_file_path already as https://..."
        )

    def _audio_format_from_path(self, audio_file_path: str) -> str:
        suffix = Path(audio_file_path).suffix.lower().lstrip(".")
        return suffix or "webm"

    def _doubao_submit(self, request_id: str, headers: dict[str, str], body: dict) -> None:
        req = request.Request(
            url=f"{settings.DOUBAO_BASE_URL}{settings.DOUBAO_SUBMIT_PATH}",
            data=json.dumps(body).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=60) as resp:
                status_code = resp.headers.get("X-Api-Status-Code")
                message = resp.headers.get("X-Api-Message")
                resp_body = ""
                try:
                    resp_body = resp.read().decode("utf-8")
                except Exception:
                    resp_body = ""
                if status_code and status_code != "20000000":
                    raise RuntimeError(
                        "doubao submit failed "
                        f"request_id={request_id} status={status_code} message={message} "
                        f"body={resp_body[:500]}"
                    )
        except HTTPError as exc:
            body = ""
            try:
                body = exc.read().decode("utf-8")
            except Exception:
                body = ""
            raise RuntimeError(
                "doubao submit http error "
                f"request_id={request_id} http_status={exc.code} reason={exc.reason} body={body[:500]}\n\n"
                "Hint: check DOUBAO_API_KEY / DOUBAO_RESOURCE_ID / account permission, and DOUBAO_BASE_URL."
            ) from exc

    def _doubao_poll_result(self, request_id: str) -> str:
        started = time.time()
        headers = {
            "content-type": "application/json",
            "X-Api-Key": settings.DOUBAO_API_KEY,
            "X-Api-Resource-Id": settings.DOUBAO_RESOURCE_ID,
            "X-Api-Request-Id": request_id,
        }
        query_url = f"{settings.DOUBAO_BASE_URL}{settings.DOUBAO_QUERY_PATH}"
        while True:
            req = request.Request(
                url=query_url,
                data=b"{}",
                headers=headers,
                method="POST",
            )
            try:
                with request.urlopen(req, timeout=60) as resp:
                    status_code = resp.headers.get("X-Api-Status-Code")
                    message = resp.headers.get("X-Api-Message")
                    body_text = resp.read().decode("utf-8")
            except HTTPError as exc:
                body = ""
                try:
                    body = exc.read().decode("utf-8")
                except Exception:
                    body = ""
                raise RuntimeError(
                    "doubao query http error "
                    f"request_id={request_id} http_status={exc.code} reason={exc.reason} body={body[:500]}\n\n"
                    "Hint: check DOUBAO_API_KEY / DOUBAO_RESOURCE_ID / account permission."
                ) from exc
            body = json.loads(body_text) if body_text else {}

            if status_code == "20000000":
                text = self._extract_doubao_text(body)
                if not text:
                    raise RuntimeError(
                        f"doubao query empty result request_id={request_id} "
                        f"message={message} body={body_text[:500]}"
                    )
                return text
            if status_code in ("20000001", "20000002"):
                elapsed_ms = int((time.time() - started) * 1000)
                if elapsed_ms > settings.DOUBAO_POLL_TIMEOUT_MS:
                    raise TimeoutError(
                        f"doubao query timeout request_id={request_id} status={status_code} message={message}"
                    )
                time.sleep(settings.DOUBAO_POLL_INTERVAL_MS / 1000)
                continue
            if status_code == "20000003":
                raise ValueError(f"doubao detected silent audio request_id={request_id}")
            extra = ""
            if status_code == "45000006" or (
                message and ("audio" in message.lower() or "download" in message.lower() or "uri" in message.lower())
            ):
                pub = get_public_base_url() or "(runtime SVI_PUBLIC_BASE_URL empty)"
                extra = (
                    "\n\n--- Doubao audio fetch troubleshooting ---\n"
                    "Status 45000006 / Invalid audio URI means ByteDance servers could not HTTP GET your audio URL.\n"
                    f"Current public_base_url (runtime): {pub}\n"
                    "Checklist:\n"
                    "  1) Restart app after tunnel URL changes (trycloudflare hostname rotates).\n"
                    "  2) Open GET /config/status — tunnel_public_url should match public_base_url.\n"
                    "  3) From another network or curl, fetch the exact audio.url shown in logs/debug endpoint.\n"
                    "  4) Do not use http://127.0.0.1 as SVI_PUBLIC_BASE_URL.\n"
                    "  5) Set SVI_SKIP_AUDIO_URL_PROBE=1 only if local probe conflicts with your tunnel.\n"
                )
            raise RuntimeError(
                f"doubao query failed request_id={request_id} status={status_code} message={message} "
                f"body={body_text[:500]}{extra}"
            )

    @staticmethod
    def _extract_doubao_text(body: dict) -> str:
        res = body.get("result")
        if isinstance(res, dict):
            # Common shapes: {"text": "..."} or {"utterances":[{"text":...},...]}
            utt = res.get("utterances")
            if isinstance(utt, list) and utt:
                parts: list[str] = []
                for u in utt:
                    if isinstance(u, dict):
                        t = (u.get("text") or "").strip()
                        if t:
                            parts.append(t)
                if parts:
                    return "\n".join(parts).strip()
            return (res.get("text") or "").strip()
        if isinstance(res, list) and res:
            # Sometimes result is a list of segments; join them to avoid truncation.
            parts: list[str] = []
            for item in res:
                if isinstance(item, dict):
                    t = (item.get("text") or "").strip()
                    if t:
                        parts.append(t)
            if parts:
                return "\n".join(parts).strip()
        return ""


class RewriteAdapter:
    def rewrite(
        self,
        mode: RewriteMode,
        combined_transcript: str,
        provider: str,
        *,
        session_title: str = "",
    ) -> str:
        raise NotImplementedError


class TemplateRewriteAdapter(RewriteAdapter):
    """Loads prompts from ``prompts/modes/*.md`` via Mode Registry (G6)."""

    def rewrite(
        self,
        mode: RewriteMode,
        combined_transcript: str,
        provider: str,
        *,
        session_title: str = "",
    ) -> str:
        mid = mode.value
        if settings.SVI_TEST_MODE:
            return f"[test-rewrite:{mid}]\n{combined_transcript}"

        try:
            prompt = load_rendered_prompt_for_mode(
                mid,
                combined_transcript=combined_transcript,
                session_title=session_title,
            ).strip()
        except PromptTemplateNotFoundError as exc:
            raise ValueError(f"PROMPT_TEMPLATE_NOT_FOUND: {exc}") from exc
        except PromptRenderError as exc:
            raise ValueError(f"PROMPT_RENDER_FAILED: {exc}") from exc

        if provider != "deepseek":
            raise ValueError(f"Unsupported rewrite provider: {provider}")

        if not settings.DEEPSEEK_API_KEY:
            raise ValueError("DEEPSEEK_API_KEY is required for deepseek rewrite.")

        return self._rewrite_via_deepseek(prompt=prompt, text=combined_transcript)

    def _rewrite_via_deepseek(self, prompt: str, text: str) -> str:
        payload = {
            "model": settings.DEEPSEEK_REWRITE_MODEL,
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": text},
            ],
            "temperature": 0.2,
        }
        req = request.Request(
            url=f"{settings.DEEPSEEK_BASE_URL}{settings.DEEPSEEK_REWRITE_PATH}",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        return body["choices"][0]["message"]["content"]
