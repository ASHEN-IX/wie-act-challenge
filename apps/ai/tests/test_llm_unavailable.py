"""Missing provider configuration must not silently execute a test responder."""
from unittest.mock import Mock, patch

import pytest

from utils import llm_client


@pytest.mark.parametrize("mock_setting", [None, "0"])
def test_missing_provider_is_unavailable_without_explicit_mock(monkeypatch, mock_setting):
    for key in llm_client.PROVIDER_KEY_ENV.values():
        monkeypatch.delenv(key, raising=False)
    monkeypatch.delenv("LLM_MOCK", raising=False)
    if mock_setting is not None:
        monkeypatch.setenv("LLM_MOCK", mock_setting)
    responder = Mock(return_value="synthetic answer")
    with patch.object(llm_client, "build_router") as router:
        with pytest.raises(llm_client.LLMRequestError, match="UNAVAILABLE"):
            llm_client.ask("coach", "system", "synthetic question", mock_fn=responder)
    responder.assert_not_called()
    router.assert_not_called()
