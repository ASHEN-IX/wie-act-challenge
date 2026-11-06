"""Explicit paid audition only. No retries, no voice cloning, no automatic A/B runs.

--check-account performs metadata requests only. --generate submits one phrase.
Supply a fresh --case-id deliberately; repeated IDs never reissue paid requests.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import time
from agents.nardouch.elevenlabs import (
    ElevenLabsTTSProvider,
    account_catalog,
    validate_mp3,
)

PHRASES = [
    "عسلامة، أنا نردوش. شنوة تحب تقرا اليوم؟",
    "الريكيرسيفيتي هي كي الفونكسيون تعاود تعيط لروحها.",
    "الباينري سيرش يلزمها ليستة مرتبة.",
    "الستاك يخدم بمبدأ LIFO.",
    "شنوة الفرق بين stack و queue؟",
    "توا نعملو exercice صغير باش نتأكدو اللي فهمت.",
]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--usage", action="store_true")
    p.add_argument("--check-account", action="store_true")
    p.add_argument("--generate", action="store_true")
    p.add_argument("--phrase", type=int, choices=range(1, 7), default=1)
    p.add_argument("--case-id")
    p.add_argument("--output-dir")
    args = p.parse_args()
    if args.usage:
        from agents.nardouch.elevenlabs import usage_status

        print(json.dumps(usage_status()))
    if args.check_account:
        print(json.dumps(account_catalog()))
    if args.generate:
        if not args.case_id or not args.output_dir:
            p.error("--case-id and --output-dir required for paid generation")
        root = Path(args.output_dir)
        root.mkdir(mode=0o700, parents=True, exist_ok=False)
        text = PHRASES[args.phrase - 1]
        start = time.perf_counter()
        audio = ElevenLabsTTSProvider().synthesize(
            text, hashlib.sha256(("audition:" + args.case_id).encode()).hexdigest()
        )
        (root / "answer.mp3").write_bytes(audio)
        report = {
            "model": os.getenv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5"),
            "voice": os.getenv("ELEVENLABS_VOICE_ID"),
            "phrase": args.phrase,
            "submittedCharacters": len(text),
            "latencySeconds": time.perf_counter() - start,
            "audioSeconds": validate_mp3(audio),
            "providerMeteredCharacters": None,
            "estimatedCost": None,
            "nativePronunciation": None,
            "intelligibility": None,
            "codeSwitching": None,
            "pacing": None,
            "warmth": None,
        }
        (root / "result.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2)
        )
        print(json.dumps(report))
    if not args.generate and not args.check_account and not args.usage:
        p.error("Select --check-account or --generate explicitly")


if __name__ == "__main__":
    main()
