from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from local_api.config import settings


@lru_cache
def _registry_path() -> Path:
    return Path(settings.PROMPTS_DIR).resolve() / "use_cases" / "registry.json"


@lru_cache
def load_use_cases_tuples() -> tuple[tuple[str, str, str, str, str], ...]:
    """Rows: (id, label, mode, default_output_target, description)."""
    path = _registry_path()
    if not path.is_file():
        return ()
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows: list[tuple[str, str, str, str, str]] = []
    for row in raw:
        uid = row.get("id")
        if not isinstance(uid, str) or not uid.strip():
            continue
        uid = uid.strip()
        rows.append(
            (
                uid,
                str(row.get("label", uid)),
                str(row.get("mode", "")).strip(),
                str(row.get("default_output_target", "clipboard")).strip(),
                str(row.get("description", "")),
            )
        )
    return tuple(rows)


def list_use_cases_public() -> list[dict[str, str]]:
    """Payload for GET /use-cases."""
    out: list[dict[str, str]] = []
    for uid, label, mode, dot, desc in sorted(load_use_cases_tuples(), key=lambda x: x[0]):
        out.append(
            {
                "id": uid,
                "label": label,
                "mode": mode,
                "default_output_target": dot,
                "description": desc,
            }
        )
    return out


def resolve_use_case(use_case_id: str) -> dict[str, str] | None:
    k = (use_case_id or "").strip()
    for uid, label, mode, dot, desc in load_use_cases_tuples():
        if uid == k:
            return {
                "id": uid,
                "label": label,
                "mode": mode,
                "default_output_target": dot,
                "description": desc,
            }
    return None
