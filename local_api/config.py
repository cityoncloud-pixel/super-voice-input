from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME = "Super Voice Input Local API"
    APP_VERSION = "0.2.0"

    DB_PATH = os.getenv("SVI_DB_PATH", "data/super_voice_input.db")
    PROMPTS_DIR = os.getenv("SVI_PROMPTS_DIR", "prompts")

    DEFAULT_STT_PROVIDER = os.getenv("SVI_DEFAULT_STT_PROVIDER", "doubao")
    DEFAULT_REWRITE_PROVIDER = os.getenv("SVI_DEFAULT_REWRITE_PROVIDER", "deepseek")

    DOUBAO_BASE_URL = os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
    DOUBAO_API_KEY = os.getenv("DOUBAO_API_KEY", "")
    DOUBAO_STT_MODEL = os.getenv("DOUBAO_STT_MODEL", "")
    DOUBAO_STT_PATH = os.getenv("DOUBAO_STT_PATH", "/audio/transcriptions")

    DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_REWRITE_MODEL = os.getenv("DEEPSEEK_REWRITE_MODEL", "deepseek-chat")
    DEEPSEEK_REWRITE_PATH = os.getenv("DEEPSEEK_REWRITE_PATH", "/chat/completions")


settings = Settings()
