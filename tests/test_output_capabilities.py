"""GET /output-capabilities — G8 env precognition for OutputTargets."""

from unittest.mock import MagicMock, patch

import pytest

from local_api.config import settings
from local_api.output_router import OutputRouter


@pytest.fixture()
def client():
    from local_api.main import app
    from fastapi.testclient import TestClient

    return TestClient(app)


def test_output_capabilities_structure(client):
    r = client.get("/output-capabilities")
    assert r.status_code == 200
    data = r.json()
    assert "targets" in data
    targets = data["targets"]
    ids = {t["id"] for t in targets}
    assert "clipboard" in ids
    assert "active_window_paste" in ids
    assert "markdown_file" in ids
    assert "obsidian_inbox" in ids
    assert "gaeh_goal_file" in ids
    for t in targets:
        assert "available" in t
        assert "reason" in t


def test_list_capabilities_marks_unconfigured_paths():
    router = OutputRouter(MagicMock())
    with patch.object(settings, "SVI_MARKDOWN_OUTPUT_DIR", ""):
        with patch.object(settings, "OBSIDIAN_VAULT_ROOT", ""):
            with patch.object(settings, "SVI_GAEH_PROJECT_ROOT", ""):
                caps = router.list_capabilities()
    by_id = {x["id"]: x for x in caps["targets"]}
    assert by_id["markdown_file"]["available"] is False
    assert "SVI_MARKDOWN_OUTPUT_DIR" in (by_id["markdown_file"]["reason"] or "")
    assert by_id["obsidian_inbox"]["available"] is False
    assert by_id["gaeh_goal_file"]["available"] is False
