from __future__ import annotations

import json
import time
from pathlib import Path
from urllib import request
from urllib.error import HTTPError
from uuid import uuid4

from local_api.audio_url import parse_data_audio_segment
from local_api.config import get_public_base_url, settings
from local_api.domain import RewriteMode


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

    def _transcribe_via_doubao(self, audio_file_path: str) -> str:
        request_id = str(uuid4())
        audio_url = self._resolve_audio_url(audio_file_path)

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
            raise RuntimeError(
                f"doubao query failed request_id={request_id} status={status_code} message={message} "
                f"body={body_text[:500]}"
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
    def rewrite(self, mode: RewriteMode, combined_transcript: str, provider: str) -> str:
        raise NotImplementedError


class TemplateRewriteAdapter(RewriteAdapter):
    def __init__(self, templates_dir: str = "prompts") -> None:
        self.templates_dir = Path(templates_dir)

    def _template_path(self, mode: RewriteMode) -> Path:
        return self.templates_dir / f"{mode.value}.txt"

    def rewrite(self, mode: RewriteMode, combined_transcript: str, provider: str) -> str:
        tpl_path = self._template_path(mode)
        if not tpl_path.exists():
            raise FileNotFoundError(f"Missing prompt template: {tpl_path}")
        prompt = tpl_path.read_text(encoding="utf-8").strip()

        if settings.SVI_TEST_MODE:
            return f"[test-rewrite:{mode.value}]\n{combined_transcript}"

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
