"""豆包侧需公网音频 URL：校验 SVI_PUBLIC_BASE_URL 拼接逻辑（与 ngrok 联调一致）。"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from local_api.adapters import VoiceSTTAdapter
from local_api.audio_url import parse_data_audio_segment
from local_api.config import set_public_base_url, settings


def test_parse_data_audio_segment_posix():
    sid, name = parse_data_audio_segment("data/audio/sess-abc/file.webm")
    assert sid == "sess-abc"
    assert name == "file.webm"


def test_parse_data_audio_segment_windows_style():
    sid, name = parse_data_audio_segment(r"data\audio\sess-abc\file.webm")
    assert sid == "sess-abc"
    assert name == "file.webm"


def test_resolve_audio_url_with_svi_public_base_url(monkeypatch):
    """模拟 .env 中 SVI_PUBLIC_BASE_URL=https://xxx.ngrok-free.app"""
    set_public_base_url("https://abc.ngrok-free.app")
    monkeypatch.setattr(settings, "DOUBAO_AUDIO_URL_PREFIX", "")
    adapter = VoiceSTTAdapter()
    url = adapter._resolve_audio_url("data/audio/my-session/seg12.webm")
    assert url == "https://abc.ngrok-free.app/files/audio/my-session/seg12.webm"


def test_resolve_audio_url_https_pass_through(monkeypatch):
    set_public_base_url("")
    adapter = VoiceSTTAdapter()
    u = "https://cdn.example.com/a/b.webm"
    assert adapter._resolve_audio_url(u) == u


def test_resolve_audio_url_raises_when_no_public_mapping(monkeypatch):
    set_public_base_url("")
    monkeypatch.setattr(settings, "DOUBAO_AUDIO_URL_PREFIX", "")
    adapter = VoiceSTTAdapter()
    with pytest.raises(ValueError, match="Doubao needs a URL"):
        adapter._resolve_audio_url("data/audio/s/x.webm")
