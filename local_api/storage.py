from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import List, Optional

from local_api.domain import VoiceSegment, VoiceSession


class SQLiteStore:
    def __init__(self, db_path: str = "data/super_voice_input.db") -> None:
        self.db_path = db_path
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS voice_sessions (
                  id TEXT PRIMARY KEY,
                  title TEXT NOT NULL,
                  mode TEXT NOT NULL,
                  status TEXT NOT NULL,
                  combined_transcript TEXT NOT NULL,
                  final_text TEXT NOT NULL,
                  rewrite_provider TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL,
                  error_message TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS voice_segments (
                  id TEXT PRIMARY KEY,
                  session_id TEXT NOT NULL,
                  order_index INTEGER NOT NULL,
                  audio_file_path TEXT NOT NULL,
                  duration_seconds REAL NOT NULL,
                  raw_transcript TEXT NOT NULL,
                  stt_provider TEXT NOT NULL,
                  status TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  error_message TEXT NOT NULL,
                  FOREIGN KEY(session_id) REFERENCES voice_sessions(id)
                )
                """
            )

    def create_session(self, s: VoiceSession) -> VoiceSession:
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO voice_sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    s.id,
                    s.title,
                    s.mode,
                    s.status,
                    s.combined_transcript,
                    s.final_text,
                    s.rewrite_provider,
                    s.created_at,
                    s.updated_at,
                    s.error_message,
                ),
            )
        return s

    def list_sessions(self) -> List[VoiceSession]:
        with self._conn() as conn:
            rows = conn.execute("SELECT * FROM voice_sessions ORDER BY created_at DESC").fetchall()
        return [VoiceSession(**dict(r)) for r in rows]

    def get_session(self, session_id: str) -> Optional[VoiceSession]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM voice_sessions WHERE id = ?", (session_id,)).fetchone()
        return VoiceSession(**dict(row)) if row else None

    def update_session(self, s: VoiceSession) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                UPDATE voice_sessions
                SET title=?, mode=?, status=?, combined_transcript=?, final_text=?,
                    rewrite_provider=?, created_at=?, updated_at=?, error_message=?
                WHERE id=?
                """,
                (
                    s.title,
                    s.mode,
                    s.status,
                    s.combined_transcript,
                    s.final_text,
                    s.rewrite_provider,
                    s.created_at,
                    s.updated_at,
                    s.error_message,
                    s.id,
                ),
            )

    def next_segment_order(self, session_id: str) -> int:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT COALESCE(MAX(order_index), 0) AS max_idx FROM voice_segments WHERE session_id = ?",
                (session_id,),
            ).fetchone()
        return int(row["max_idx"]) + 1

    def create_segment(self, seg: VoiceSegment) -> VoiceSegment:
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO voice_segments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    seg.id,
                    seg.session_id,
                    seg.order_index,
                    seg.audio_file_path,
                    seg.duration_seconds,
                    seg.raw_transcript,
                    seg.stt_provider,
                    seg.status,
                    seg.created_at,
                    seg.error_message,
                ),
            )
        return seg

    def get_segment(self, segment_id: str) -> Optional[VoiceSegment]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM voice_segments WHERE id = ?", (segment_id,)).fetchone()
        return VoiceSegment(**dict(row)) if row else None

    def list_segments(self, session_id: str) -> List[VoiceSegment]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM voice_segments WHERE session_id = ? ORDER BY order_index ASC",
                (session_id,),
            ).fetchall()
        return [VoiceSegment(**dict(r)) for r in rows]

    def update_segment(self, seg: VoiceSegment) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                UPDATE voice_segments
                SET session_id=?, order_index=?, audio_file_path=?, duration_seconds=?,
                    raw_transcript=?, stt_provider=?, status=?, created_at=?, error_message=?
                WHERE id=?
                """,
                (
                    seg.session_id,
                    seg.order_index,
                    seg.audio_file_path,
                    seg.duration_seconds,
                    seg.raw_transcript,
                    seg.stt_provider,
                    seg.status,
                    seg.created_at,
                    seg.error_message,
                    seg.id,
                ),
            )

    def delete_segment(self, segment_id: str) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM voice_segments WHERE id = ?", (segment_id,))

    def clear_all(self) -> None:
        """Delete all sessions and segments (local-only convenience)."""
        with self._conn() as conn:
            conn.execute("DELETE FROM voice_segments")
            conn.execute("DELETE FROM voice_sessions")
