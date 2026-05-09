from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from local_api.adapters import MockSTTAdapter, TemplateRewriteAdapter
from local_api.domain import RewriteMode
from local_api.service import VoiceService
from local_api.storage import SQLiteStore

app = FastAPI(title="Super Voice Input Local API", version="0.1.0")
service = VoiceService(
    store=SQLiteStore(),
    stt=MockSTTAdapter(),
    rewrite=TemplateRewriteAdapter(),
)


class CreateSessionRequest(BaseModel):
    title: str = Field(min_length=1)
    mode: RewriteMode
    rewrite_provider: str = "mock-rewrite"


class AddSegmentRequest(BaseModel):
    audio_file_path: str = Field(min_length=1)
    duration_seconds: float = Field(ge=0)
    stt_provider: str = "mock-stt"


class RerecordSegmentRequest(BaseModel):
    audio_file_path: str = Field(min_length=1)
    duration_seconds: float = Field(ge=0)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/sessions")
def create_session(req: CreateSessionRequest):
    return service.create_session(req.title, req.mode, req.rewrite_provider)


@app.get("/sessions")
def list_sessions():
    return service.list_sessions()


@app.get("/sessions/{session_id}")
def get_session(session_id: str):
    session = service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    segments = service.list_segments(session_id)
    return {"session": session, "segments": segments}


@app.post("/sessions/{session_id}/segments")
def add_segment(session_id: str, req: AddSegmentRequest):
    if not service.get_session(session_id):
        raise HTTPException(status_code=404, detail="session not found")
    return service.add_segment(
        session_id=session_id,
        audio_file_path=req.audio_file_path,
        duration_seconds=req.duration_seconds,
        stt_provider=req.stt_provider,
    )


@app.post("/segments/{segment_id}/transcribe/retry")
def retry_segment_transcribe(segment_id: str):
    try:
        return service.retry_transcribe(segment_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/segments/{segment_id}")
def delete_segment(segment_id: str):
    service.delete_segment(segment_id)
    return {"deleted": True, "segment_id": segment_id}


@app.post("/segments/{segment_id}/rerecord")
def rerecord_segment(segment_id: str, req: RerecordSegmentRequest):
    try:
        return service.rerecord_segment(
            segment_id=segment_id,
            audio_file_path=req.audio_file_path,
            duration_seconds=req.duration_seconds,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/sessions/{session_id}/finalize")
def finalize_session(session_id: str):
    try:
        return service.finalize_session(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
