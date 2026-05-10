"""Tests for POST /sessions/{id}/outputs (Output Router)."""

from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from local_api.main import app

client = TestClient(app)


def _finalize_session():
    session_resp = client.post(
        "/sessions",
        json={
            "title": "output router",
            "mode": "intent_cleanup",
            "rewrite_provider": "mock-rewrite",
        },
    )
    session_id = session_resp.json()["id"]
    seg_resp = client.post(
        f"/sessions/{session_id}/segments",
        json={
            "audio_file_path": "audio/a.wav",
            "duration_seconds": 1.0,
            "stt_provider": "mock-stt",
        },
    )
    seg_id = seg_resp.json()["id"]
    client.post(f"/segments/{seg_id}/transcribe/retry")
    client.post(f"/sessions/{session_id}/finalize")
    return session_id


def test_outputs_clipboard_requires_client():
    sid = _finalize_session()
    out = client.post(f"/sessions/{sid}/outputs", json={"target": "clipboard"})
    assert out.status_code == 200
    body = out.json()
    assert body["requires_client_execution"] is True
    assert body["final_text"]

    sess = client.get(f"/sessions/{sid}").json()["session"]
    assert sess["last_output_target"] == "clipboard"
    assert sess["last_output_status"] == "pending_client"


def test_outputs_feedback_updates_status():
    sid = _finalize_session()
    client.post(f"/sessions/{sid}/outputs", json={"target": "clipboard"})
    fb = client.post(
        f"/sessions/{sid}/output-feedback",
        json={"target": "clipboard", "success": True},
    )
    assert fb.status_code == 200
    sess = fb.json()["session"]
    assert sess["last_output_status"] == "ok"


def test_outputs_invalid_target():
    sid = _finalize_session()
    bad = client.post(f"/sessions/{sid}/outputs", json={"target": "nope"})
    assert bad.status_code == 400


def test_outputs_markdown_file_writes(tmp_path, monkeypatch):
    import local_api.config as cfg

    monkeypatch.setattr(cfg.settings, "SVI_MARKDOWN_OUTPUT_DIR", str(tmp_path))

    sid = _finalize_session()
    out = client.post(f"/sessions/{sid}/outputs", json={"target": "markdown_file"})
    assert out.status_code == 200
    body = out.json()
    assert body["requires_client_execution"] is False
    assert body["written_path"]
    p = Path(body["written_path"])
    assert p.is_file()
    assert p.read_text(encoding="utf-8")


def test_outputs_obsidian_requires_vault():
    sid = _finalize_session()
    out = client.post(f"/sessions/{sid}/outputs", json={"target": "obsidian_inbox"})
    assert out.status_code == 400


def test_outputs_obsidian_writes(tmp_path, monkeypatch):
    import local_api.config as cfg

    inbox = tmp_path / "00_Inbox"
    monkeypatch.setattr(cfg.settings, "OBSIDIAN_VAULT_ROOT", str(tmp_path))
    monkeypatch.setattr(cfg.settings, "SVI_OBSIDIAN_INBOX_REL", "00_Inbox")

    sid = _finalize_session()
    out = client.post(f"/sessions/{sid}/outputs", json={"target": "obsidian_inbox"})
    assert out.status_code == 200
    written = Path(out.json()["written_path"])
    assert written.is_file()
    assert written.resolve().is_relative_to(tmp_path.resolve())
    assert inbox.exists()


def test_outputs_gaeh_writes(tmp_path, monkeypatch):
    import local_api.config as cfg

    gaeh_inbox = tmp_path / ".gaeh" / "inbox"
    monkeypatch.setattr(cfg.settings, "SVI_GAEH_PROJECT_ROOT", str(tmp_path))

    sid = _finalize_session()
    out = client.post(f"/sessions/{sid}/outputs", json={"target": "gaeh_goal_file"})
    assert out.status_code == 200
    written = Path(out.json()["written_path"])
    assert written.is_file()
    assert written.resolve().is_relative_to(tmp_path.resolve())
    assert gaeh_inbox.exists()
