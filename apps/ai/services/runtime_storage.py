"""Container preflight. Never changes ownership or existing source artifacts."""

import os
import sys
import tempfile
from pathlib import Path


def check_storage():
    for name, default in (
        ("INGEST_UPLOADS_DIR", "/app/uploads"),
        ("FAISS_INDEX_DIR", "/app/faiss"),
    ):
        try:
            root = Path(os.getenv(name, default))
            if not root.is_absolute():
                raise ValueError("absolute path required")
            root.mkdir(parents=True, exist_ok=True)
            # A real write also catches read-only mounts and ACL restrictions.
            with tempfile.TemporaryFile(dir=root) as probe:
                probe.write(b"storage-check")
                probe.flush()
        except (OSError, ValueError):
            # Environment values may contain private paths. Log names only.
            print(
                f"Storage preflight failed for {name}: provide a writable mount "
                f"for UID {os.geteuid()} / GID {os.getegid()}. "
                "Existing files were not re-owned; review the storage migration runbook.",
                file=sys.stderr,
            )
            return False
    return True


if __name__ == "__main__":
    sys.exit(0 if check_storage() else 1)
