"""Explicit pinned evaluation-only download; training-data provenance is undisclosed."""

import argparse
import hashlib
import json
from pathlib import Path
from huggingface_hub import snapshot_download

REPO = "oddadmix/lahgtna-chatterbox-v1"
REVISION = "6b37e50d1952f07306dc9ff3f3d4ff4ddaf32541"
FILES = [
    "README.md",
    "conds.pt",
    "grapheme_mtl_merged_expanded_v1.json",
    "t3_mtl23ls_v2.safetensors",
    "s3gen.pt",
    "ve.pt",
    "Cangjie5_TC.json",
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", required=True)
    args = parser.parse_args()
    root = Path(args.directory)
    if root.exists():
        parser.error("Use a new directory")
    snapshot_download(
        REPO, revision=REVISION, local_dir=str(root), allow_patterns=FILES
    )
    hashes = {}
    for name in FILES:
        with (root / name).open("rb") as checkpoint:
            hashes[name] = hashlib.file_digest(checkpoint, "sha256").hexdigest()
    pinned = json.loads(Path(__file__).with_name("lahgtna_checkpoint.json").read_text())
    if hashes != pinned["files"]:
        raise ValueError("Downloaded files differ from the pinned checkpoint hashes")
    (root / "manifest.json").write_text(
        json.dumps(
            {
                "repo": REPO,
                "revision": REVISION,
                "licenseReviewed": True,
                "usage": "evaluation_only",
                "modelLicense": "MIT, according to author card",
                "datasetProvenance": "Not disclosed; production review pending",
                "files": hashes,
            },
            indent=2,
        )
    )
    print(
        json.dumps(
            {
                "files": hashes,
                "bytes": sum((root / name).stat().st_size for name in FILES),
            }
        )
    )


if __name__ == "__main__":
    main()
