from __future__ import annotations

import shutil
import subprocess
import threading
from pathlib import Path

from local_api.adapters import RewriteAdapter, STTAdapter
from local_api.config import settings
from local_api.domain import (
    RewriteMode,
    SegmentStatus,
    SessionStatus,
    VoiceSegment,
    VoiceSession,
    utc_now_iso,
)
from local_api.storage import SQLiteStore


class VoiceService:
    def __init__(self, store: SQLiteStore, stt: STTAdapter, rewrite: RewriteAdapter) -> None:
        self.store = store
        self.stt = stt
        self.rewrite_adapter = rewrite

    def _ffmpeg_bin(self) -> str | None:
        if settings.SVI_FFMPEG_PATH:
            return settings.SVI_FFMPEG_PATH
        return shutil.which("ffmpeg")

    def _maybe_transcode_for_doubao(self, seg: VoiceSegment) -> VoiceSegment:
        if settings.SVI_TEST_MODE:
            return seg
        if not settings.SVI_TRANSCODE_WEBM:
            return seg
        if seg.stt_provider != "doubao":
            return seg
        p = seg.audio_file_path
        if p.startswith("http://") or p.startswith("https://"):
            return seg

        in_path = Path(p)
        if in_path.suffix.lower() != ".webm":
            return seg

        ffmpeg = self._ffmpeg_bin()
        if not ffmpeg:
            raise RuntimeError(
                "Doubao STT needs a compatible audio format. This project records .webm by default. "
                "Install ffmpeg (make `ffmpeg` available in PATH) or set SVI_FFMPEG_PATH, "
                "or disable transcoding via SVI_TRANSCODE_WEBM=false and upload wav/mp3/ogg instead."
            )

        out_path = in_path.with_suffix(".wav")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        # Convert MediaRecorder webm/opus to 16kHz mono wav for best compatibility.
        cmd = [
            ffmpeg,
            "-y",
            "-i",
            str(in_path),
            "-ac",
            "1",
            "-ar",
            "16000",
            str(out_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            tail = (proc.stderr or proc.stdout or "").strip()[-1200:]
            raise RuntimeError(f"ffmpeg transcode failed (webm->wav). Details:\n{tail}")

        seg.audio_file_path = out_path.as_posix()
        self.store.update_segment(seg)
        return seg

    def create_session(self, title: str, mode: RewriteMode, rewrite_provider: str) -> VoiceSession:
        return self.store.create_session(VoiceSession.create(title, mode, rewrite_provider))

    def list_sessions(self) -> list[VoiceSession]:
        return self.store.list_sessions()

    def get_session(self, session_id: str) -> VoiceSession | None:
        return self.store.get_session(session_id)

    def list_segments(self, session_id: str) -> list[VoiceSegment]:
        return self.store.list_segments(session_id)

    def add_segment(
        self, session_id: str, audio_file_path: str, duration_seconds: float, stt_provider: str
    ) -> VoiceSegment:
        order_index = self.store.next_segment_order(session_id)
        seg = VoiceSegment.create(
            session_id=session_id,
            order_index=order_index,
            audio_file_path=audio_file_path,
            duration_seconds=duration_seconds,
            stt_provider=stt_provider,
        )
        return self.store.create_segment(seg)

    def retry_transcribe(self, segment_id: str) -> VoiceSegment:
        seg = self.store.get_segment(segment_id)
        if not seg:
            raise ValueError("segment not found")
        seg.status = SegmentStatus.TRANSCRIBING.value
        seg.error_message = ""
        self.store.update_segment(seg)
        try:
            seg = self._maybe_transcode_for_doubao(seg)
            seg.raw_transcript = self.stt.transcribe(seg.audio_file_path, seg.stt_provider)
            seg.status = SegmentStatus.TRANSCRIBED.value
        except Exception as exc:
            seg.status = SegmentStatus.ERROR.value
            seg.error_message = str(exc)
        self.store.update_segment(seg)
        return seg

    def start_transcribe_async(self, segment_id: str) -> VoiceSegment:
        """Kick off transcription in a background thread and return immediately.

        Useful in production where STT calls may take minutes; keeps the API responsive.
        """
        seg = self.store.get_segment(segment_id)
        if not seg:
            raise ValueError("segment not found")
        seg.status = SegmentStatus.TRANSCRIBING.value
        seg.error_message = ""
        self.store.update_segment(seg)

        def worker():
            try:
                self.retry_transcribe(segment_id)
            except Exception:
                # retry_transcribe already persists segment status; ignore.
                pass

        threading.Thread(target=worker, name=f"svi-transcribe-{segment_id}", daemon=True).start()
        return seg

    def delete_segment(self, segment_id: str) -> None:
        self.store.delete_segment(segment_id)

    def clear_all(self, delete_audio: bool = True) -> None:
        if delete_audio:
            try:
                shutil.rmtree(Path("data") / "audio", ignore_errors=True)
            except Exception:
                pass
        self.store.clear_all()

    def rerecord_segment(self, segment_id: str, audio_file_path: str, duration_seconds: float) -> VoiceSegment:
        seg = self.store.get_segment(segment_id)
        if not seg:
            raise ValueError("segment not found")
        seg.audio_file_path = audio_file_path
        seg.duration_seconds = duration_seconds
        seg.raw_transcript = ""
        seg.status = SegmentStatus.RECORDED.value
        seg.error_message = ""
        self.store.update_segment(seg)
        return seg

    def finalize_session(self, session_id: str) -> VoiceSession:
        session = self.store.get_session(session_id)
        if not session:
            raise ValueError("session not found")

        session.status = SessionStatus.PROCESSING.value
        session.error_message = ""
        session.updated_at = utc_now_iso()
        self.store.update_session(session)

        segments = self.store.list_segments(session_id)
        valid = [s for s in segments if s.status == SegmentStatus.TRANSCRIBED.value and s.raw_transcript.strip()]
        if not valid:
            session.status = SessionStatus.ERROR.value
            session.error_message = "No valid transcript segments to finalize."
            session.updated_at = utc_now_iso()
            self.store.update_session(session)
            return session

        session.combined_transcript = "\n".join(s.raw_transcript for s in valid)
        try:
            mode = RewriteMode(session.mode)
            session.final_text = self.rewrite_adapter.rewrite(
                mode=mode,
                combined_transcript=session.combined_transcript,
                provider=session.rewrite_provider,
            )
            session.status = SessionStatus.DONE.value
        except Exception as exc:
            session.status = SessionStatus.ERROR.value
            session.error_message = str(exc)

        session.updated_at = utc_now_iso()
        self.store.update_session(session)
        return session

    def refinalize_session(
        self, session_id: str, mode: RewriteMode | None = None, rewrite_provider: str | None = None
    ) -> VoiceSession:
        session = self.store.get_session(session_id)
        if not session:
            raise ValueError("session not found")
        if mode is not None:
            session.mode = mode.value
        if rewrite_provider:
            session.rewrite_provider = rewrite_provider
        session.updated_at = utc_now_iso()
        self.store.update_session(session)
        return self.finalize_session(session_id)
