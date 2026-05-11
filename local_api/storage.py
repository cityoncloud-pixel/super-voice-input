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
                  error_message TEXT NOT NULL,
                  last_output_target TEXT NOT NULL DEFAULT '',
                  last_output_status TEXT NOT NULL DEFAULT '',
                  last_output_at TEXT NOT NULL DEFAULT '',
                  last_output_detail TEXT NOT NULL DEFAULT ''
                )
                """
            )
            self._migrate_voice_sessions_output_cols(conn)
            self._migrate_voice_sessions_use_case_id(conn)
            self._migrate_legacy_rewrite_modes(conn)
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
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS voice_presets (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  rewrite_mode TEXT NOT NULL,
                  default_output_target TEXT NOT NULL,
                  sort_order INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            self._seed_builtin_presets(conn)

    def _migrate_voice_sessions_output_cols(self, conn: sqlite3.Connection) -> None:
        rows = conn.execute("PRAGMA table_info(voice_sessions)").fetchall()
        cols = {str(r[1]) for r in rows}
        if "last_output_target" not in cols:
            conn.execute("ALTER TABLE voice_sessions ADD COLUMN last_output_target TEXT NOT NULL DEFAULT ''")
        if "last_output_status" not in cols:
            conn.execute("ALTER TABLE voice_sessions ADD COLUMN last_output_status TEXT NOT NULL DEFAULT ''")
        if "last_output_at" not in cols:
            conn.execute("ALTER TABLE voice_sessions ADD COLUMN last_output_at TEXT NOT NULL DEFAULT ''")
        if "last_output_detail" not in cols:
            conn.execute("ALTER TABLE voice_sessions ADD COLUMN last_output_detail TEXT NOT NULL DEFAULT ''")

    def _migrate_voice_sessions_use_case_id(self, conn: sqlite3.Connection) -> None:
        rows = conn.execute("PRAGMA table_info(voice_sessions)").fetchall()
        cols = {str(r[1]) for r in rows}
        if "use_case_id" not in cols:
            conn.execute("ALTER TABLE voice_sessions ADD COLUMN use_case_id TEXT NOT NULL DEFAULT ''")

    def _migrate_legacy_rewrite_modes(self, conn: sqlite3.Connection) -> None:
        mapping = (
            ("intent_cleanup", "clean_intent"),
            ("task_requirement", "gaeh_goal"),
        )
        for old, new in mapping:
            conn.execute("UPDATE voice_sessions SET mode=? WHERE mode=?", (new, old))
            conn.execute("UPDATE voice_presets SET rewrite_mode=? WHERE rewrite_mode=?", (new, old))

    def _seed_builtin_presets(self, conn: sqlite3.Connection) -> None:
        n = conn.execute("SELECT COUNT(1) AS c FROM voice_presets").fetchone()["c"]
        if int(n) > 0:
            return
        rows = [
            ("preset_chatgpt", "发给 ChatGPT / 对话框", "clean_intent", "clipboard", 10),
            ("preset_obsidian", "写入 Obsidian Inbox", "obsidian_note", "obsidian_inbox", 20),
            ("preset_gaeh", "生成 GAEH 任务稿", "gaeh_goal", "gaeh_goal_file", 30),
            ("preset_faithful_clip", "忠实转录 · 剪贴板", "faithful_transcript", "clipboard", 40),
        ]
        conn.executemany(
            "INSERT INTO voice_presets (id, name, rewrite_mode, default_output_target, sort_order) VALUES (?, ?, ?, ?, ?)",
            rows,
        )

    def list_presets(self) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT id, name, rewrite_mode, default_output_target, sort_order FROM voice_presets ORDER BY sort_order ASC, name ASC"
            ).fetchall()
        return [dict(r) for r in rows]

    def create_session(self, s: VoiceSession) -> VoiceSession:
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO voice_sessions (
                  id, title, mode, status, combined_transcript, final_text, rewrite_provider,
                  created_at, updated_at, error_message,
                  last_output_target, last_output_status, last_output_at, last_output_detail,
                  use_case_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    s.last_output_target,
                    s.last_output_status,
                    s.last_output_at,
                    s.last_output_detail,
                    s.use_case_id,
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
                    rewrite_provider=?, created_at=?, updated_at=?, error_message=?,
                    use_case_id=?,
                    last_output_target=?, last_output_status=?, last_output_at=?, last_output_detail=?
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
                    s.use_case_id,
                    s.last_output_target,
                    s.last_output_status,
                    s.last_output_at,
                    s.last_output_detail,
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
