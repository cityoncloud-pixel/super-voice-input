from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from local_api.adapters import TemplateRewriteAdapter, VoiceSTTAdapter
from local_api.config import settings
from local_api.domain import RewriteMode
from local_api.service import VoiceService
from local_api.storage import SQLiteStore

app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION)

# Electron 页面跑在 http://127.0.0.1:<随机端口>，请求 API :8000 为跨域，必须放行 CORS，否则前端 fetch 会被浏览器静默拦截。
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(127\.0\.0\.1|localhost):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

service = VoiceService(
    store=SQLiteStore(db_path=settings.DB_PATH),
    stt=VoiceSTTAdapter(),
    rewrite=TemplateRewriteAdapter(templates_dir=settings.PROMPTS_DIR),
)


class CreateSessionRequest(BaseModel):
    title: str = Field(min_length=1)
    mode: RewriteMode
    rewrite_provider: str = settings.DEFAULT_REWRITE_PROVIDER


class AddSegmentRequest(BaseModel):
    audio_file_path: str = Field(min_length=1)
    duration_seconds: float = Field(ge=0)
    stt_provider: str = settings.DEFAULT_STT_PROVIDER


class RerecordSegmentRequest(BaseModel):
    audio_file_path: str = Field(min_length=1)
    duration_seconds: float = Field(ge=0)


class RefinalizeSessionRequest(BaseModel):
    mode: RewriteMode | None = None
    rewrite_provider: str | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/modes")
def list_modes():
    return {"modes": [m.value for m in RewriteMode]}


@app.get("/files/audio/{session_id}/{filename}")
def serve_segment_audio(session_id: str, filename: str):
    """Serve uploaded segment files so Doubao can fetch via SVI_PUBLIC_BASE_URL."""
    safe_name = Path(filename).name
    root = (Path("data") / "audio" / session_id).resolve()
    target = (root / safe_name).resolve()
    try:
        target.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid path") from exc
    if not target.is_file():
        raise HTTPException(status_code=404, detail="audio not found")
    return FileResponse(target)


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


@app.post("/sessions/{session_id}/segments/upload")
async def upload_segment(
    session_id: str,
    file: UploadFile = File(...),
    duration_seconds: float = Form(0),
    stt_provider: str = Form(settings.DEFAULT_STT_PROVIDER),
    auto_transcribe: bool = Query(True),
):
    if not service.get_session(session_id):
        raise HTTPException(status_code=404, detail="session not found")

    suffix = Path(file.filename or "segment.webm").suffix or ".webm"
    target_dir = Path("data") / "audio" / session_id
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / f"{uuid4().hex[:12]}{suffix}"
    content = await file.read()
    target_path.write_bytes(content)

    seg = service.add_segment(
        session_id=session_id,
        audio_file_path=str(target_path.as_posix()),
        duration_seconds=duration_seconds,
        stt_provider=stt_provider,
    )
    if auto_transcribe:
        seg = service.retry_transcribe(seg.id)
    return seg


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


@app.post("/sessions/{session_id}/refinalize")
def refinalize_session(session_id: str, req: RefinalizeSessionRequest):
    try:
        return service.refinalize_session(
            session_id=session_id,
            mode=req.mode,
            rewrite_provider=req.rewrite_provider,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
