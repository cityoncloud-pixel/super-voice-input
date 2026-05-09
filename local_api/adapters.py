from __future__ import annotations

from pathlib import Path

from local_api.domain import RewriteMode


class STTAdapter:
    def transcribe(self, audio_file_path: str, provider: str) -> str:
        raise NotImplementedError


class MockSTTAdapter(STTAdapter):
    def transcribe(self, audio_file_path: str, provider: str) -> str:
        filename = Path(audio_file_path).name
        return f"[mock:{provider}] transcript from {filename}"


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
        return (
            f"[mock-rewrite:{provider}]\n"
            f"mode={mode.value}\n"
            f"prompt={prompt}\n\n"
            f"{combined_transcript}"
        )
