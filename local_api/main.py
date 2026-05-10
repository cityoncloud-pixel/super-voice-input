from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from local_api.adapters import TemplateRewriteAdapter, VoiceSTTAdapter
from local_api.config import get_public_base_url, set_public_base_url, settings
from local_api.domain import RewriteMode
from local_api.output_router import OutputRouter, OutputTarget
from local_api.service import VoiceService
from local_api.storage import SQLiteStore
from local_api.tunnel import CloudflaredTunnel

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
output_router = OutputRouter(store=service.store)

_tunnel: CloudflaredTunnel | None = None


@app.on_event("startup")
def _startup_auto_tunnel() -> None:
    global _tunnel
    if settings.SVI_TEST_MODE:
        return
    if not settings.SVI_AUTO_TUNNEL:
        return
    if get_public_base_url():
        return
    if settings.DEFAULT_STT_PROVIDER != "doubao":
        return

    exe = CloudflaredTunnel.resolve_exe(settings.SVI_CLOUDFLARED_PATH)
    if not exe:
        return
    local_url = f"http://{settings.SVI_API_HOST}:{settings.SVI_API_PORT}"
    # We intentionally always tunnel the API port because `/files/audio/...` is served by this app.
    _tunnel = CloudflaredTunnel(exe=exe, local_url=local_url)
    _tunnel.start_async()


@app.on_event("shutdown")
def _shutdown_auto_tunnel() -> None:
    global _tunnel
    if _tunnel:
        _tunnel.stop()
        _tunnel = None


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


class SessionOutputRequest(BaseModel):
    target: str = Field(min_length=1)


class SessionOutputFeedbackRequest(BaseModel):
    target: str = Field(min_length=1)
    success: bool
    detail: str = ""


class ClearAllRequest(BaseModel):
    delete_audio: bool = True


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/modes")
def list_modes():
    return {"modes": [m.value for m in RewriteMode]}


@app.get("/presets")
def list_presets():
    return {"presets": service.store.list_presets()}


class SetPublicBaseUrlRequest(BaseModel):
    base_url: str = Field(min_length=1)


@app.get("/config/public_base_url")
def get_public_base_url_config():
    return {"public_base_url": get_public_base_url()}


@app.post("/config/public_base_url")
def set_public_base_url_config(req: SetPublicBaseUrlRequest):
    set_public_base_url(req.base_url)
    return {"public_base_url": get_public_base_url()}


@app.get("/config/status")
def config_status():
    """Non-sensitive configuration visibility for debugging in desktop environments."""
    tunnel_public = None
    if _tunnel:
        tunnel_public = _tunnel.public_url
        # Keep runtime public_base_url in sync with the current running tunnel URL.
        # A stale base URL causes Doubao cloud to download from an old/expired hostname.
        if tunnel_public and get_public_base_url() != tunnel_public:
            set_public_base_url(tunnel_public)
    return {
        "public_base_url": get_public_base_url(),
        "auto_tunnel": {
            "enabled": bool(settings.SVI_AUTO_TUNNEL),
            "cloudflared_path": settings.SVI_CLOUDFLARED_PATH or "cloudflared",
            "tunnel_public_url": tunnel_public or "",
        },
        "doubao": {
            "base_url": settings.DOUBAO_BASE_URL,
            "resource_id": settings.DOUBAO_RESOURCE_ID,
            "api_key_set": bool(settings.DOUBAO_API_KEY),
            "resource_id_allowed": settings.DOUBAO_RESOURCE_ID in ("volc.seedasr.auc", "volc.bigasr.auc"),
            "resource_id_examples": ["volc.seedasr.auc", "volc.bigasr.auc"],
        },
        "deepseek": {
            "base_url": settings.DEEPSEEK_BASE_URL,
            "model": settings.DEEPSEEK_REWRITE_MODEL,
            "api_key_set": bool(settings.DEEPSEEK_API_KEY),
        },
        "test_mode": bool(settings.SVI_TEST_MODE),
    }


@app.get("/debug/segments/{segment_id}/audio_url")
def debug_segment_audio_url(segment_id: str):
    """Return the resolved audio.url that will be sent to Doubao for this segment."""
    seg = service.store.get_segment(segment_id)
    if not seg:
        raise HTTPException(status_code=404, detail="segment not found")
    adapter = VoiceSTTAdapter()
    return {"segment_id": segment_id, "audio_file_path": seg.audio_file_path, "audio_url": adapter._resolve_audio_url(seg.audio_file_path)}

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


@app.delete("/sessions")
def clear_sessions(req: ClearAllRequest = ClearAllRequest()):
    """Clear all sessions/segments. Uses DELETE on the collection to avoid route conflicts."""
    service.clear_all(delete_audio=req.delete_audio)
    return {"cleared": True, "delete_audio": bool(req.delete_audio)}


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
        if settings.SVI_TEST_MODE:
            seg = service.retry_transcribe(seg.id)
        else:
            seg = service.start_transcribe_async(seg.id)
    return seg


@app.post("/segments/{segment_id}/transcribe/retry")
def retry_segment_transcribe(segment_id: str):
    try:
        if settings.SVI_TEST_MODE:
            return service.retry_transcribe(segment_id)
        return service.start_transcribe_async(segment_id)
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


@app.post("/sessions/{session_id}/outputs")
def dispatch_session_output(session_id: str, req: SessionOutputRequest):
    try:
        target = OutputTarget(req.target)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid output target") from exc
    res = output_router.dispatch(session_id, target)
    if not res.ok:
        raise HTTPException(status_code=400, detail=res.message)
    return {
        "ok": True,
        "target": res.target,
        "message": res.message,
        "final_text": res.final_text,
        "requires_client_execution": res.requires_client_execution,
        "written_path": res.written_path,
    }


@app.post("/sessions/{session_id}/output-feedback")
def session_output_feedback(session_id: str, req: SessionOutputFeedbackRequest):
    session = output_router.record_client_feedback(session_id, req.target, req.success, req.detail)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    return {"session": session}
