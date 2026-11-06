"""Pinned non-commercial evaluation voice; explicit provisioning, no serving downloads."""

import hashlib
import json
from pathlib import Path
import argparse
from huggingface_hub import snapshot_download

REPO = "OpenVoiceOS/phoonnx_ar-SA_miro_espeak"
REVISION = "d5cf31ab113941464d4a9e5e0b81b64b7454b234"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--directory", required=True)
    p.add_argument("--noncommercial-evaluation", action="store_true", required=True)
    args = p.parse_args()
    root = Path(args.directory)
    if root.exists():
        p.error("Use a new destination")
    snapshot_download(
        REPO,
        revision=REVISION,
        local_dir=str(root),
        allow_patterns=["miro_ar.onnx", "miro_ar.piper.json", "README.md"],
    )
    names = ["miro_ar.onnx", "miro_ar.piper.json", "README.md"]
    files = {
        name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in names
    }
    (root / "manifest.json").write_text(
        json.dumps(
            {
                "repo": REPO,
                "revision": REVISION,
                "licenseReviewed": True,
                "usage": "noncommercial_evaluation",
                "license": "CC-BY-NC-ND-4.0",
                "attribution": "TigreGotico Lda; OpenVoiceOS",
                "model": "miro_ar.onnx",
                "config": "miro_ar.piper.json",
                "files": files,
            },
            indent=2,
        )
    )
    print(
        json.dumps(
            {
                "revision": REVISION,
                "files": files,
                "bytes": sum((root / name).stat().st_size for name in names),
            }
        )
    )


if __name__ == "__main__":
    main()
