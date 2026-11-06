"""Explicit provisioning only. Serving never invokes this downloader."""

import argparse
import hashlib
import json
from pathlib import Path
import re


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--directory", required=True)
    parser.add_argument("--license-reviewed", action="store_true", required=True)
    parser.add_argument("--profile", choices=["generic", "silma"], default="generic")
    parser.add_argument(
        "--rights-record", help="Reviewed JSON rights provenance for SILMA"
    )
    args = parser.parse_args()
    rights = None
    if args.profile == "silma":
        if args.repo != "Ghazouaniwala/silma-tts-derja-v2" or not args.rights_record:
            parser.error(
                "SILMA requires its exact repository and a reviewed rights record"
            )
        rights = json.loads(Path(args.rights_record).read_text())
        if any(
            not isinstance(rights.get(k), str) or not rights[k].strip()
            for k in ("model", "baseModel", "dataset", "voice", "vocoder", "reviewer")
        ):
            parser.error(
                "Rights record must identify model, baseModel, dataset, voice, vocoder and reviewer"
            )
    if not re.fullmatch("[a-f0-9]{40}", args.revision):
        parser.error("Use an immutable commit SHA")
    from huggingface_hub import snapshot_download

    root = Path(args.directory)
    if root.exists():
        parser.error("Use a new empty destination")
    snapshot_download(args.repo, revision=args.revision, local_dir=str(root))
    if args.profile == "silma":
        for name in ("model.pt", "vocab.txt", "config.yaml"):
            if not (root / name).is_file():
                parser.error(
                    "Incomplete SILMA checkpoint; no verified manifest created"
                )
    files = {
        str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in root.rglob("*")
        if p.is_file() and ".cache" not in p.parts
    }
    (root / "manifest.json").write_text(
        json.dumps(
            {
                "repo": args.repo,
                "revision": args.revision,
                "licenseReviewed": True,
                "rights": rights,
                "files": files,
            },
            indent=2,
        )
    )
    print(
        json.dumps(
            {
                "files": len(files),
                "bytes": sum((root / p).stat().st_size for p in files),
            }
        )
    )


if __name__ == "__main__":
    main()
