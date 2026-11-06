"""Blocked checkpoint integration: no model or quality claims, no remote calls."""

import pytest
from agents.nardouch.voice import tts_provider, VoiceUnavailable
from agents.nardouch.silma import LocalSilmaTTSProvider, silma_readiness
from agents.nardouch.speech_adaptation import adapt_for_speech


def test_silma_selection_preserves_disabled_default(monkeypatch):
    monkeypatch.delenv("NARDOUCH_TTS_PROVIDER", raising=False)
    from agents.nardouch.voice import LocalPiperTTSProvider

    assert isinstance(tts_provider(), LocalPiperTTSProvider)
    monkeypatch.setenv("NARDOUCH_TTS_PROVIDER", "disabled")
    with pytest.raises(VoiceUnavailable):
        tts_provider()
    monkeypatch.setenv("NARDOUCH_TTS_PROVIDER", "local_silma")
    assert isinstance(tts_provider(), LocalSilmaTTSProvider)


def test_missing_checkpoint_never_downloads_or_falls_back(monkeypatch, tmp_path):
    monkeypatch.setenv("NARDOUCH_SPEECH_MODEL_DIR", str(tmp_path))
    assert silma_readiness()["status"] == "missing_verified_checkpoint"
    with pytest.raises(VoiceUnavailable, match="weights are unavailable"):
        LocalSilmaTTSProvider().synthesize("شنوة الفرق بين stack و queue؟")
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize(
    "text",
    [
        "El récursivité تستحق base case: factorial(0)=1.",
        "Binary search: O(log n), شرط tableau trié.",
        "stack LIFO; queue FIFO; push(x); pop().",
        "La dérivée de x^2 est 2*x; f(3)=9.",
        "P(A|B)=P(A∩B)/P(B), P(B)>0; 3lech?",
    ],
)
def test_pronunciation_examples_preserve_technical_meaning(text):
    result = adapt_for_speech(text)
    assert result.replace("L I F O", "LIFO").replace("F I F O", "FIFO") == text
