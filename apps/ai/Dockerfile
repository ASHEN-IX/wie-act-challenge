FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONPATH=/app:/app/agents/evaluator/src \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH=/opt/venv/bin:$PATH \
    POETRY_NO_INTERACTION=1

# Native document/OCR/image libraries used by the existing ingestion pipeline.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl poppler-utils tesseract-ocr libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Keep Poetry's dependencies separate from the locked application environment.
RUN python -m venv /opt/poetry && /opt/poetry/bin/pip install --no-cache-dir poetry==2.5.1 \
    && python -m venv /opt/venv
COPY pyproject.toml poetry.lock ./
# Retain verified downloads across interrupted builds without baking wheels into the image.
RUN --mount=type=cache,id=ednova-ai-poetry-artifacts,target=/root/.cache/pypoetry/artifacts,sharing=locked \
    /opt/poetry/bin/poetry check --lock \
    && /opt/poetry/bin/poetry install --only main --no-ansi

COPY . .

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=5).close()" || exit 1

CMD ["uvicorn", "services.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
