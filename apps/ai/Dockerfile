# syntax=docker/dockerfile:1
FROM python:3.12-slim-bookworm AS runtime-base

WORKDIR /app

ENV PYTHONPATH=/app:/app/agents/evaluator/src \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH=/opt/venv/bin:$PATH

# Keep downloaded Debian packages and indexes across retries, outside the image.
# Debian's default docker-clean hook would otherwise delete cached .deb files.
RUN --mount=type=cache,id=ednova-ai-apt-archives,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=ednova-ai-apt-lists,target=/var/lib/apt/lists,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils tesseract-ocr libgl1 libglib2.0-0

FROM runtime-base AS build

ENV POETRY_NO_INTERACTION=1
ENV PIP_DEFAULT_TIMEOUT=300
ENV POETRY_REQUESTS_TIMEOUT=300

# Keep Poetry's dependencies separate from the locked application environment.
RUN --mount=type=cache,id=ednova-ai-pip,target=/root/.cache/pip,sharing=locked \
    python -m venv /opt/poetry && /opt/poetry/bin/pip install poetry==2.5.1 \
    && python -m venv /opt/venv
COPY pyproject.toml poetry.lock ./
# Retain verified downloads across interrupted builds without baking wheels into the image.
# Limit competing transfers and tolerate slow connections to the wheel indexes.
RUN --mount=type=cache,id=ednova-ai-poetry,target=/root/.cache/pypoetry,sharing=locked \
    /opt/poetry/bin/poetry check --lock \
    && POETRY_INSTALLER_MAX_WORKERS=4 \
       POETRY_REQUESTS_TIMEOUT=300 \
       POETRY_REQUESTS_MAX_RETRIES=5 \
       /opt/poetry/bin/poetry install --only main --no-ansi

COPY requirements-speech.txt ./
ARG INSTALL_LOCAL_SPEECH=1
RUN --mount=type=cache,id=ednova-ai-pip,target=/root/.cache/pip,sharing=locked     if [ "$INSTALL_LOCAL_SPEECH" = "1" ]; then pip install -r requirements-speech.txt; fi

FROM runtime-base AS runtime

ENV HOME=/home/ednova \
    HF_HOME=/home/ednova/.cache/huggingface

COPY --from=build /opt/venv /opt/venv
COPY . .

# New named volumes inherit these owners. Existing mounts are never re-owned;
# startup fails with an actionable error if their permissions are incompatible.
RUN groupadd --gid 10001 ednova \
    && useradd --uid 10001 --gid ednova --create-home ednova \
    && mkdir -p /app/uploads /app/faiss /home/ednova/.cache \
    && chown ednova:ednova /app/uploads /app/faiss /home/ednova/.cache \
    && chmod 750 /app/uploads /app/faiss \
    && sed -i 's/\r$//' /app/scripts/container-entrypoint.sh \
    && chmod 755 /app/scripts/container-entrypoint.sh

# Course ingestion runs with HF_HUB_OFFLINE=1. Bake the pinned local embedding
# model into the image so a fresh container does not fail at the embedding step.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')" \
    && chown -R ednova:ednova /home/ednova/.cache

RUN mkdir -p /app/tts-state && chown ednova:ednova /app/tts-state && chmod 750 /app/tts-state

USER 10001:10001
ENTRYPOINT ["/app/scripts/container-entrypoint.sh"]

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=5).close()" || exit 1

CMD ["uvicorn", "services.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
