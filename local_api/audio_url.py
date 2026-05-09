from __future__ import annotations

from pathlib import Path


def parse_data_audio_segment(local_path: str) -> tuple[str, str] | None:
    """Parse data/audio/<session_id>/<filename> from stored segment path."""
    norm = local_path.replace("\\", "/")
    parts = norm.split("/")
    try:
        i = parts.index("audio")
    except ValueError:
        return None
    if i + 2 >= len(parts):
        return None
    session_id = parts[i + 1]
    filename = parts[i + 2]
    if not session_id or not filename:
        return None
    return session_id, filename
