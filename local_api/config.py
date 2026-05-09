from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME = "Super Voice Input Local API"
    APP_VERSION = "0.2.0"

    DB_PATH = os.getenv("SVI_DB_PATH", "data/super_voice_input.db")
    PROMPTS_DIR = os.getenv("SVI_PROMPTS_DIR", "prompts")

    DEFAULT_STT_PROVIDER = os.getenv("SVI_DEFAULT_STT_PROVIDER", "mock-stt")
    DEFAULT_REWRITE_PROVIDER = os.getenv("SVI_DEFAULT_REWRITE_PROVIDER", "mock-rewrite")

    OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_STT_MODEL = os.getenv("OPENAI_STT_MODEL", "whisper-1")
    OPENAI_REWRITE_MODEL = os.getenv("OPENAI_REWRITE_MODEL", "gpt-4o-mini")


settings = Settings()
