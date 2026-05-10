from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import uuid4


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


class SessionStatus(str, Enum):
    OPEN = "open"
    PROCESSING = "processing"
    DONE = "done"
    ERROR = "error"


class SegmentStatus(str, Enum):
    RECORDED = "recorded"
    TRANSCRIBING = "transcribing"
    TRANSCRIBED = "transcribed"
    ERROR = "error"


class RewriteMode(str, Enum):
    INTENT_CLEANUP = "intent_cleanup"
    OBSIDIAN_NOTE = "obsidian_note"
    TASK_REQUIREMENT = "task_requirement"
    FAITHFUL_TRANSCRIPT = "faithful_transcript"


@dataclass
class VoiceSession:
    id: str
    title: str
    mode: str
    status: str
    combined_transcript: str
    final_text: str
    rewrite_provider: str
    created_at: str
    updated_at: str
    error_message: str
    last_output_target: str = ""
    last_output_status: str = ""
    last_output_at: str = ""
    last_output_detail: str = ""

    @staticmethod
    def create(title: str, mode: RewriteMode, rewrite_provider: str) -> "VoiceSession":
        now = utc_now_iso()
        return VoiceSession(
            id=new_id("vs"),
            title=title,
            mode=mode.value,
            status=SessionStatus.OPEN.value,
            combined_transcript="",
            final_text="",
            rewrite_provider=rewrite_provider,
            created_at=now,
            updated_at=now,
            error_message="",
            last_output_target="",
            last_output_status="",
            last_output_at="",
            last_output_detail="",
        )


@dataclass
class VoiceSegment:
    id: str
    session_id: str
    order_index: int
    audio_file_path: str
    duration_seconds: float
    raw_transcript: str
    stt_provider: str
    status: str
    created_at: str
    error_message: str

    @staticmethod
    def create(
        session_id: str,
        order_index: int,
        audio_file_path: str,
        duration_seconds: float,
        stt_provider: str,
    ) -> "VoiceSegment":
        return VoiceSegment(
            id=new_id("seg"),
            session_id=session_id,
            order_index=order_index,
            audio_file_path=audio_file_path,
            duration_seconds=duration_seconds,
            raw_transcript="",
            stt_provider=stt_provider,
            status=SegmentStatus.RECORDED.value,
            created_at=utc_now_iso(),
            error_message="",
        )
