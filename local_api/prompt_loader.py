from __future__ import annotations

from pathlib import Path

from local_api.mode_registry import get_mode_entry, modes_dir


class PromptTemplateNotFoundError(FileNotFoundError):
    """PROMPT_TEMPLATE_NOT_FOUND"""


class PromptRenderError(RuntimeError):
    """PROMPT_RENDER_FAILED"""


def load_raw_template(mode_id: str, *, prompt_template_filename: str | None = None) -> str:
    fname = prompt_template_filename
    if not fname:
        entry = get_mode_entry(mode_id)
        if not entry:
            raise PromptTemplateNotFoundError(f"PROMPT_TEMPLATE_NOT_FOUND: unknown mode {mode_id!r}")
        fname = entry.get("prompt_template")
        if not fname:
            raise PromptTemplateNotFoundError(f"PROMPT_TEMPLATE_NOT_FOUND: no template for {mode_id!r}")
    path = modes_dir() / str(fname)
    if not path.is_file():
        raise PromptTemplateNotFoundError(f"PROMPT_TEMPLATE_NOT_FOUND: {path.name}")
    return path.read_text(encoding="utf-8")


def render_prompt_template(
    template: str,
    *,
    combined_transcript: str,
    session_title: str = "",
    mode_name: str = "",
) -> str:
    try:
        return (
            template.replace("{{combined_transcript}}", combined_transcript)
            .replace("{{session_title}}", session_title)
            .replace("{{mode_name}}", mode_name)
        )
    except Exception as exc:
        raise PromptRenderError(f"PROMPT_RENDER_FAILED: {exc}") from exc


def load_rendered_prompt_for_mode(
    mode_id: str,
    *,
    combined_transcript: str,
    session_title: str = "",
) -> str:
    entry = get_mode_entry(mode_id)
    mode_name = str(entry.get("name", mode_id)) if entry else mode_id
    raw = load_raw_template(mode_id)
    return render_prompt_template(
        raw,
        combined_transcript=combined_transcript,
        session_title=session_title,
        mode_name=mode_name,
    )
