from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from local_api.main import app

client = TestClient(app)


def test_presets_lists_builtin():
    r = client.get("/presets")
    assert r.status_code == 200
    presets = r.json()["presets"]
    assert len(presets) >= 3
    modes = {p["rewrite_mode"] for p in presets}
    assert "clean_intent" in modes
