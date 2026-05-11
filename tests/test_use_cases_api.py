from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from local_api.main import app

client = TestClient(app)


def test_list_use_cases():
    r = client.get("/use-cases")
    assert r.status_code == 200
    rows = r.json()["use_cases"]
    assert len(rows) == 6
    ids = {x["id"] for x in rows}
    assert "thinking_clarify" in ids
    assert "send_to_ai" in ids


def test_create_session_with_use_case():
    r = client.post(
        "/sessions",
        json={
            "title": "uc flow",
            "use_case_id": "send_to_ai",
            "rewrite_provider": "mock-rewrite",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "clean_intent"
    assert body.get("use_case_id") == "send_to_ai"


def test_create_session_use_case_unknown():
    r = client.post(
        "/sessions",
        json={
            "title": "bad",
            "use_case_id": "nope_nope",
            "rewrite_provider": "mock-rewrite",
        },
    )
    assert r.status_code == 400
    assert "UNKNOWN_USE_CASE" in r.json()["detail"]


def test_patch_use_case_updates_mode():
    r = client.post(
        "/sessions",
        json={"title": "p", "use_case_id": "send_to_ai", "rewrite_provider": "mock-rewrite"},
    )
    sid = r.json()["id"]
    p = client.patch(
        f"/sessions/{sid}",
        json={"use_case_id": "obsidian_inbox"},
    )
    assert p.status_code == 200
    assert p.json()["mode"] == "obsidian_note"
    assert p.json()["use_case_id"] == "obsidian_inbox"
