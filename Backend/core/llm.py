"""Shared OpenRouter LLM provider and controlled provider errors."""
from __future__ import annotations

from config import settings


class LLMResult:
    def __init__(self, text: str, provider: str, model: str):
        self.text = text
        self.provider = provider
        self.model = model


class LLMError(Exception):
    pass


class LLMNotConfiguredError(LLMError):
    """OpenRouter credentials or model configuration are unavailable."""


class LLMAuthError(LLMError):
    pass


class LLMRateLimitError(LLMError):
    pass


class LLMTimeoutError(LLMError):
    pass


class LLMUnavailableError(LLMError):
    pass


class LLMBadResponseError(LLMError):
    """OpenRouter answered, but returned no usable content."""


class BaseProvider:
    name = "base"

    def chat(
        self, system: str, user: str, json_mode: bool = False, response_schema=None
    ) -> LLMResult:
        """Send one prompt; callers validate structured responses themselves."""
        raise NotImplementedError


class OpenRouterProvider(BaseProvider):
    """OpenRouter's OpenAI-compatible chat completions endpoint."""

    name = "openrouter"

    def __init__(self, api_key: str, base_url: str, model: str, timeout: float):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def chat(
        self, system: str, user: str, json_mode: bool = False, response_schema=None
    ) -> LLMResult:
        import httpx

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.0 if json_mode or response_schema is not None else 0.3,
        }
        if json_mode or response_schema is not None:
            payload["response_format"] = {"type": "json_object"}
        headers = {
            "Authorization": "Bearer " + self.api_key,
            "Content-Type": "application/json",
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(
                    self.base_url + "/chat/completions",
                    json=payload,
                    headers=headers,
                )
                response.raise_for_status()
                data = response.json()
        except httpx.TimeoutException as exc:
            raise LLMTimeoutError("OpenRouter request timed out") from exc
        except httpx.TransportError as exc:
            raise LLMUnavailableError("OpenRouter is unreachable") from exc
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status in (401, 403):
                raise LLMAuthError("OpenRouter rejected credentials") from exc
            if status == 429:
                raise LLMRateLimitError("OpenRouter rate limited the request") from exc
            if status in (408, 504):
                raise LLMTimeoutError("OpenRouter request timed out") from exc
            if status == 404:
                raise LLMNotConfiguredError("OpenRouter model or endpoint not found") from exc
            if status >= 500:
                raise LLMUnavailableError("OpenRouter is unavailable") from exc
            raise LLMError("OpenRouter rejected request (%d)" % status) from exc
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LLMBadResponseError("OpenRouter returned an invalid response") from exc
        except Exception as exc:
            # Transport/provider exception text can contain prompts or credentials.
            raise LLMError(
                "OpenRouter request failed: " + type(exc).__name__
            ) from exc

        try:
            text = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMBadResponseError("OpenRouter returned an invalid response") from exc
        if not isinstance(text, str) or not text.strip():
            raise LLMBadResponseError("OpenRouter returned empty content")
        return LLMResult(text=text, provider=self.name, model=self.model)


def get_provider(name: str | None = None) -> BaseProvider:
    """Return the sole configured LLM gateway; never fall back to another provider."""
    if name not in (None, "default", "openrouter"):
        raise LLMNotConfiguredError("unknown provider")
    if not settings.OPENROUTER_API_KEY:
        raise LLMNotConfiguredError("OPENROUTER_API_KEY is not set")
    return OpenRouterProvider(
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        model=settings.OPENROUTER_MODEL,
        timeout=settings.LLM_TIMEOUT,
    )
