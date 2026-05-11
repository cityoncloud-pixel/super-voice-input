from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from local_api.config import settings


@lru_cache
def _registry_path() -> Path:
    return Path(settings.PROMPTS_DIR).resolve() / "modes" / "registry.json"


@lru_cache
def load_registry() -> frozenset[tuple[str, str, str, str]]:
    """Cached registry rows: (id, name, description, prompt_template)."""
    path = _registry_path()
    if not path.is_file():
        return frozenset()
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows: list[tuple[str, str, str, str]] = []
    for row in raw:
        mid = row.get("id")
        if not isinstance(mid, str) or not mid.strip():
            continue
        mid = mid.strip()
        name = str(row.get("name", mid))
        desc = str(row.get("description", ""))
        tpl = str(row.get("prompt_template", f"{mid}.md"))
        rows.append((mid, name, desc, tpl))
    return frozenset(rows)


def _registry_by_id() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for mid, name, desc, tpl in load_registry():
        out[mid] = {"id": mid, "name": name, "description": desc, "prompt_template": tpl}
    return out


def get_mode_entry(mode_id: str) -> dict | None:
    return _registry_by_id().get(mode_id)


def list_modes_public() -> list[dict[str, str]]:
    """Payload for GET /modes (no prompt_template path exposed)."""
    out: list[dict[str, str]] = []
    for mid, name, desc, _tpl in sorted(load_registry(), key=lambda x: x[0]):
        out.append({"id": mid, "name": name, "description": desc})
    return out


def modes_dir() -> Path:
    return Path(settings.PROMPTS_DIR).resolve() / "modes"
