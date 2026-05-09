from __future__ import annotations

from local_api.adapters import RewriteAdapter, STTAdapter
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
            seg.raw_transcript = self.stt.transcribe(seg.audio_file_path, seg.stt_provider)
            seg.status = SegmentStatus.TRANSCRIBED.value
        except Exception as exc:
            seg.status = SegmentStatus.ERROR.value
            seg.error_message = str(exc)
        self.store.update_segment(seg)
        return seg

    def delete_segment(self, segment_id: str) -> None:
        self.store.delete_segment(segment_id)

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
