"""Local integration host: real FastAPI/FAISS/Mongo, deterministic test embeddings.
No production test hooks or heavyweight model download. Outbound guard is supplied
by the evidence/CI harness; all model calls are explicitly mock mode.
"""

import hashlib
import os
import sys
import numpy as np
from services.vector_store import embedder


class LocalEmbeddingFixture:
    def encode(self, texts, **kwargs):
        rows = []
        for text in texts:
            vec = np.zeros(384, dtype="float32")
            for word in text.lower().split():
                vec[int(hashlib.sha256(word.encode()).hexdigest()[:8], 16) % 384] += 1
            norm = np.linalg.norm(vec)
            rows.append(vec / norm if norm else vec)
        return np.array(rows, dtype="float32")

    def encode_one(self, text):
        return self.encode([text])[0]


embedder.EmbeddingService = LocalEmbeddingFixture
embedder.get_embedder = lambda: LocalEmbeddingFixture()
from services.vector_store import adapter

adapter.get_embedder = lambda: LocalEmbeddingFixture()
if "--worker" in sys.argv:
    from workers.ingestion_worker import IngestionWorker
    from workers.idempotency import InMemoryIdempotencyStore

    IngestionWorker(idempotency_store=InMemoryIdempotencyStore()).run()
else:
    import uvicorn

    uvicorn.run(
        "services.api.main:app",
        host="127.0.0.1",
        port=int(os.environ["P0R2_AI_PORT"]),
        log_level="warning",
    )
