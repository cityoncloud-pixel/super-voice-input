from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4
from urllib import request

from local_api.config import settings
from local_api.domain import RewriteMode


class STTAdapter:
    def transcribe(self, audio_file_path: str, provider: str) -> str:
        raise NotImplementedError


class MockSTTAdapter(STTAdapter):
    def transcribe(self, audio_file_path: str, provider: str) -> str:
        if provider == "doubao" and settings.DOUBAO_API_KEY:
            return self._transcribe_via_doubao(audio_file_path)
        filename = Path(audio_file_path).name
        return f"[mock:{provider}] transcript from {filename}"

    def _transcribe_via_doubao(self, audio_file_path: str) -> str:
        file_path = Path(audio_file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"audio file not found: {audio_file_path}")
        if not settings.DOUBAO_STT_MODEL:
            raise ValueError("DOUBAO_STT_MODEL is required for doubao transcription.")
        file_bytes = file_path.read_bytes()
        boundary = f"----SVIFormBoundary{uuid4().hex}"
        crlf = b"\r\n"

        parts = []
        parts.append(f"--{boundary}".encode("utf-8"))
        parts.append(b'Content-Disposition: form-data; name="model"')
        parts.append(b"")
        parts.append(settings.DOUBAO_STT_MODEL.encode("utf-8"))

        parts.append(f"--{boundary}".encode("utf-8"))
        parts.append(
            f'Content-Disposition: form-data; name="file"; filename="{file_path.name}"'.encode("utf-8")
        )
        parts.append(b"Content-Type: application/octet-stream")
        parts.append(b"")
        parts.append(file_bytes)
        parts.append(f"--{boundary}--".encode("utf-8"))
        parts.append(b"")
        body = crlf.join(parts)

        req = request.Request(
            url=f"{settings.DOUBAO_BASE_URL}{settings.DOUBAO_STT_PATH}",
            data=body,
            headers={
                "Authorization": f"Bearer {settings.DOUBAO_API_KEY}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
            method="POST",
        )
        with request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data.get("text", "")


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
        if provider == "deepseek" and settings.DEEPSEEK_API_KEY:
            return self._rewrite_via_deepseek(prompt=prompt, text=combined_transcript)
        return (
            f"[mock-rewrite:{provider}]\n"
            f"mode={mode.value}\n"
            f"prompt={prompt}\n\n"
            f"{combined_transcript}"
        )

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
        with request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        return body["choices"][0]["message"]["content"]
