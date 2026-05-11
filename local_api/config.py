from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

_public_base_url_override: str | None = None


def set_public_base_url(value: str) -> None:
    """Set runtime override for SVI_PUBLIC_BASE_URL (useful for desktop auto-tunnel)."""
    global _public_base_url_override
    v = (value or "").strip().rstrip("/")
    _public_base_url_override = v or None


def get_public_base_url() -> str:
    """Get current public base URL for serving uploaded audio to Doubao cloud."""
    if _public_base_url_override:
        return _public_base_url_override
    return os.getenv("SVI_PUBLIC_BASE_URL", "").strip().rstrip("/")


class Settings:
    APP_NAME = "Super Voice Input Local API"
    APP_VERSION = "0.4.0"

    SVI_API_HOST = os.getenv("SVI_API_HOST", "127.0.0.1")
    SVI_API_PORT = os.getenv("SVI_API_PORT", "8000")

    DB_PATH = os.getenv("SVI_DB_PATH", "data/super_voice_input.db")
    PROMPTS_DIR = os.getenv("SVI_PROMPTS_DIR", "prompts")

    # When true, STT/Rewrite adapters return deterministic stubs (pytest only).
    SVI_TEST_MODE = os.getenv("SVI_TEST_MODE", "").lower() in ("1", "true", "yes")

    # When true, auto-transcode recorded .webm into a Doubao-compatible format (wav) before submit.
    # Requires `ffmpeg` available in PATH, or set SVI_FFMPEG_PATH to the executable path.
    SVI_TRANSCODE_WEBM = os.getenv("SVI_TRANSCODE_WEBM", "true").lower() in ("1", "true", "yes")
    SVI_FFMPEG_PATH = os.getenv("SVI_FFMPEG_PATH", "")

    # When true, backend may auto-create a temporary public tunnel (cloudflared) if SVI_PUBLIC_BASE_URL is empty.
    SVI_AUTO_TUNNEL = os.getenv("SVI_AUTO_TUNNEL", "1").lower() not in ("0", "false", "no")
    SVI_CLOUDFLARED_PATH = os.getenv("SVI_CLOUDFLARED_PATH", "")

    DEFAULT_STT_PROVIDER = os.getenv("SVI_DEFAULT_STT_PROVIDER", "doubao")
    DEFAULT_REWRITE_PROVIDER = os.getenv("SVI_DEFAULT_REWRITE_PROVIDER", "deepseek")

    # Official OpenSpeech HTTP API host (bigmodel submit/query).
    DOUBAO_BASE_URL = os.getenv("DOUBAO_BASE_URL", "https://openspeech.bytedance.com/api/v3")
    DOUBAO_API_KEY = os.getenv("DOUBAO_API_KEY", "")
    # Align with verstory defaults: prefer `volc.seedasr.auc` (standard bigmodel ASR resource id).
    # Alternative commonly used id: `volc.bigasr.auc`.
    DOUBAO_RESOURCE_ID = os.getenv("DOUBAO_RESOURCE_ID", "volc.seedasr.auc")
    DOUBAO_USER_ID = os.getenv("DOUBAO_USER_ID", "svi-local-user")
    DOUBAO_LANGUAGE = os.getenv("DOUBAO_LANGUAGE", "")
    DOUBAO_ENABLE_ITN = os.getenv("DOUBAO_ENABLE_ITN", "true")
    DOUBAO_SUBMIT_PATH = os.getenv("DOUBAO_SUBMIT_PATH", "/auc/bigmodel/submit")
    DOUBAO_QUERY_PATH = os.getenv("DOUBAO_QUERY_PATH", "/auc/bigmodel/query")
    DOUBAO_POLL_INTERVAL_MS = int(os.getenv("DOUBAO_POLL_INTERVAL_MS", "1200"))
    DOUBAO_POLL_TIMEOUT_MS = int(os.getenv("DOUBAO_POLL_TIMEOUT_MS", "90000"))
    DOUBAO_AUDIO_URL_PREFIX = os.getenv("DOUBAO_AUDIO_URL_PREFIX", "")
    # 提交豆包前是否对本机发起 GET 探测音频 URL（部分 ngrok 场景可能误报，可设 1 跳过）
    SVI_SKIP_AUDIO_URL_PROBE = os.getenv("SVI_SKIP_AUDIO_URL_PROBE", "").lower() in ("1", "true", "yes")
    # Build Doubao audio.url as {SVI_PUBLIC_BASE_URL}/files/audio/{session_id}/{filename}
    # NOTE: prefer get_public_base_url() for runtime updates (desktop auto-tunnel).
    SVI_PUBLIC_BASE_URL = os.getenv("SVI_PUBLIC_BASE_URL", "").strip().rstrip("/")

    DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_REWRITE_MODEL = os.getenv("DEEPSEEK_REWRITE_MODEL", "deepseek-chat")
    DEEPSEEK_REWRITE_PATH = os.getenv("DEEPSEEK_REWRITE_PATH", "/chat/completions")

    # Output Router — file targets (G2). Paths validated server-side; never trust raw URL paths from UI alone.
    SVI_MARKDOWN_OUTPUT_DIR = os.getenv("SVI_MARKDOWN_OUTPUT_DIR", "").strip()
    OBSIDIAN_VAULT_ROOT = os.getenv("OBSIDIAN_VAULT_ROOT", "").strip()
    SVI_OBSIDIAN_INBOX_REL = os.getenv("SVI_OBSIDIAN_INBOX_REL", "00_Inbox").strip()
    SVI_GAEH_PROJECT_ROOT = os.getenv("SVI_GAEH_PROJECT_ROOT", "").strip()
    SVI_GAEH_INBOX_REL = os.getenv("SVI_GAEH_INBOX_REL", ".gaeh/inbox").strip()


settings = Settings()
