from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from local_api.main import app


client = TestClient(app)


def test_session_segment_transcribe_finalize_flow():
    session_resp = client.post(
        "/sessions",
        json={
            "title": "mvp flow",
            "mode": "intent_cleanup",
            "rewrite_provider": "mock-rewrite",
        },
    )
    assert session_resp.status_code == 200
    session_id = session_resp.json()["id"]

    seg_resp = client.post(
        f"/sessions/{session_id}/segments",
        json={
            "audio_file_path": "audio/seg1.wav",
            "duration_seconds": 3.2,
            "stt_provider": "mock-stt",
        },
    )
    assert seg_resp.status_code == 200
    seg_id = seg_resp.json()["id"]

    transcribe_resp = client.post(f"/segments/{seg_id}/transcribe/retry")
    assert transcribe_resp.status_code == 200
    assert transcribe_resp.json()["status"] == "transcribed"

    finalize_resp = client.post(f"/sessions/{session_id}/finalize")
    assert finalize_resp.status_code == 200
    body = finalize_resp.json()
    assert body["status"] == "done"
    assert body["combined_transcript"]
    assert body["final_text"]


def test_rerecord_resets_segment_state():
    session_resp = client.post(
        "/sessions",
        json={
            "title": "rerecord flow",
            "mode": "faithful_transcript",
            "rewrite_provider": "mock-rewrite",
        },
    )
    session_id = session_resp.json()["id"]

    seg_resp = client.post(
        f"/sessions/{session_id}/segments",
        json={
            "audio_file_path": "audio/old.wav",
            "duration_seconds": 1.0,
            "stt_provider": "mock-stt",
        },
    )
    seg_id = seg_resp.json()["id"]

    client.post(f"/segments/{seg_id}/transcribe/retry")
    rerecord_resp = client.post(
        f"/segments/{seg_id}/rerecord",
        json={"audio_file_path": "audio/new.wav", "duration_seconds": 2.5},
    )
    assert rerecord_resp.status_code == 200
    rerecorded = rerecord_resp.json()
    assert rerecorded["audio_file_path"] == "audio/new.wav"
    assert rerecorded["status"] == "recorded"
    assert rerecorded["raw_transcript"] == ""
