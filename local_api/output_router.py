from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path

from local_api.config import settings
from local_api.domain import SessionStatus, VoiceSession, utc_now_iso
from local_api.storage import SQLiteStore


class OutputTarget(str, Enum):
    CLIPBOARD = "clipboard"
    ACTIVE_WINDOW_PASTE = "active_window_paste"
    MARKDOWN_FILE = "markdown_file"
    OBSIDIAN_INBOX = "obsidian_inbox"
    GAEH_GOAL_FILE = "gaeh_goal_file"


@dataclass
class OutputDispatchResult:
    ok: bool
    target: str
    message: str
    final_text: str
    requires_client_execution: bool
    written_path: str | None = None


def _safe_under_root(child: Path, root: Path) -> Path:
    r = root.resolve()
    c = child.resolve()
    try:
        c.relative_to(r)
    except ValueError as exc:
        raise ValueError("resolved path escapes configured root") from exc
    return c


class OutputRouter:
    def __init__(self, store: SQLiteStore) -> None:
        self.store = store

    def _touch_session(self, session: VoiceSession) -> None:
        session.updated_at = utc_now_iso()
        self.store.update_session(session)

    def _persist_output_meta(
        self, session: VoiceSession, target: str, status: str, detail: str = ""
    ) -> None:
        session.last_output_target = target
        session.last_output_status = status
        session.last_output_at = utc_now_iso()
        session.last_output_detail = (detail or "")[:4000]
        self._touch_session(session)

    def dispatch(self, session_id: str, target: OutputTarget) -> OutputDispatchResult:
        session = self.store.get_session(session_id)
        if not session:
            return OutputDispatchResult(False, target.value, "session not found", "", False)

        if session.status != SessionStatus.DONE.value:
            return OutputDispatchResult(
                False,
                target.value,
                "会话未完成整理：请先成功生成终稿（status 需为 done）。",
                session.final_text or "",
                False,
            )

        text = (session.final_text or "").strip()
        if not text:
            self._persist_output_meta(session, target.value, "failed", "final_text 为空")
            return OutputDispatchResult(False, target.value, "final_text 为空", "", False)

        if target == OutputTarget.CLIPBOARD:
            self._persist_output_meta(session, target.value, "pending_client", "")
            return OutputDispatchResult(True, target.value, "ok", text, True)

        if target == OutputTarget.ACTIVE_WINDOW_PASTE:
            self._persist_output_meta(session, target.value, "pending_client", "")
            return OutputDispatchResult(True, target.value, "ok", text, True)

        if target == OutputTarget.MARKDOWN_FILE:
            return self._write_markdown_file(session, text)

        if target == OutputTarget.OBSIDIAN_INBOX:
            return self._write_obsidian_inbox(session, text)

        if target == OutputTarget.GAEH_GOAL_FILE:
            return self._write_gaeh_goal(session, text)

        return OutputDispatchResult(False, target.value, "unsupported target", text, False)

    def _timestamp_slug(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")

    def _write_markdown_file(self, session: VoiceSession, text: str) -> OutputDispatchResult:
        root_raw = (settings.SVI_MARKDOWN_OUTPUT_DIR or "").strip()
        if not root_raw:
            self._persist_output_meta(session, OutputTarget.MARKDOWN_FILE.value, "failed", "未配置 SVI_MARKDOWN_OUTPUT_DIR")
            return OutputDispatchResult(
                False,
                OutputTarget.MARKDOWN_FILE.value,
                "未配置 SVI_MARKDOWN_OUTPUT_DIR",
                text,
                False,
            )
        root = Path(root_raw)
        root.mkdir(parents=True, exist_ok=True)
        fname = f"voice-{self._timestamp_slug()}-{session.id[:8]}.md"
        target_path = _safe_under_root(root / fname, root)
        try:
            target_path.write_text(text, encoding="utf-8")
        except OSError as exc:
            self._persist_output_meta(session, OutputTarget.MARKDOWN_FILE.value, "failed", str(exc))
            return OutputDispatchResult(False, OutputTarget.MARKDOWN_FILE.value, str(exc), text, False)
        self._persist_output_meta(session, OutputTarget.MARKDOWN_FILE.value, "ok", "")
        return OutputDispatchResult(
            True,
            OutputTarget.MARKDOWN_FILE.value,
            "ok",
            text,
            False,
            written_path=str(target_path),
        )

    def _write_obsidian_inbox(self, session: VoiceSession, text: str) -> OutputDispatchResult:
        vault = (settings.OBSIDIAN_VAULT_ROOT or "").strip()
        if not vault:
            self._persist_output_meta(session, OutputTarget.OBSIDIAN_INBOX.value, "failed", "未配置 OBSIDIAN_VAULT_ROOT")
            return OutputDispatchResult(
                False,
                OutputTarget.OBSIDIAN_INBOX.value,
                "未配置 OBSIDIAN_VAULT_ROOT",
                text,
                False,
            )
        vault_root = Path(vault).resolve()
        rel = (settings.SVI_OBSIDIAN_INBOX_REL or "00_Inbox").strip().strip("/\\")
        parts = [p for p in rel.replace("\\", "/").split("/") if p and p not in (".", "..")]
        inbox_dir = vault_root.joinpath(*parts)
        inbox_dir.mkdir(parents=True, exist_ok=True)
        fname = f"voice-{self._timestamp_slug()}.md"
        target_path = _safe_under_root(inbox_dir / fname, vault_root)
        try:
            target_path.write_text(text, encoding="utf-8")
        except OSError as exc:
            self._persist_output_meta(session, OutputTarget.OBSIDIAN_INBOX.value, "failed", str(exc))
            return OutputDispatchResult(False, OutputTarget.OBSIDIAN_INBOX.value, str(exc), text, False)
        self._persist_output_meta(session, OutputTarget.OBSIDIAN_INBOX.value, "ok", "")
        return OutputDispatchResult(
            True,
            OutputTarget.OBSIDIAN_INBOX.value,
            "ok",
            text,
            False,
            written_path=str(target_path),
        )

    def _write_gaeh_goal(self, session: VoiceSession, text: str) -> OutputDispatchResult:
        proj = (settings.SVI_GAEH_PROJECT_ROOT or "").strip()
        if not proj:
            self._persist_output_meta(session, OutputTarget.GAEH_GOAL_FILE.value, "failed", "未配置 SVI_GAEH_PROJECT_ROOT")
            return OutputDispatchResult(
                False,
                OutputTarget.GAEH_GOAL_FILE.value,
                "未配置 SVI_GAEH_PROJECT_ROOT",
                text,
                False,
            )
        proj_root = Path(proj).resolve()
        rel = (settings.SVI_GAEH_INBOX_REL or ".gaeh/inbox").strip().strip("/\\")
        parts = [p for p in rel.replace("\\", "/").split("/") if p and p not in (".", "..")]
        inbox_dir = proj_root.joinpath(*parts)
        inbox_dir.mkdir(parents=True, exist_ok=True)
        fname = f"voice-goal-{self._timestamp_slug()}.md"
        target_path = _safe_under_root(inbox_dir / fname, proj_root)
        try:
            target_path.write_text(text, encoding="utf-8")
        except OSError as exc:
            self._persist_output_meta(session, OutputTarget.GAEH_GOAL_FILE.value, "failed", str(exc))
            return OutputDispatchResult(False, OutputTarget.GAEH_GOAL_FILE.value, str(exc), text, False)
        self._persist_output_meta(session, OutputTarget.GAEH_GOAL_FILE.value, "ok", "")
        return OutputDispatchResult(
            True,
            OutputTarget.GAEH_GOAL_FILE.value,
            "ok",
            text,
            False,
            written_path=str(target_path),
        )

    def record_client_feedback(
        self, session_id: str, target: str, success: bool, detail: str = ""
    ) -> VoiceSession | None:
        session = self.store.get_session(session_id)
        if not session:
            return None
        if success:
            self._persist_output_meta(session, target, "ok", "")
        else:
            self._persist_output_meta(session, target, "failed", detail or "client reported failure")
        return session
