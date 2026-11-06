"""Genuine local Piper benchmark. Writes review WAVs only on explicit invocation."""

import argparse
import json
from pathlib import Path
import time
import subprocess
from agents.nardouch.voice import LocalPiperTTSProvider
from agents.nardouch.local_speech import readiness, shutdown

PHRASES = [
    "عسلامة، شنوة تحب تقرا اليوم؟",
    "الريكيرسيفيتي تستحق شرط توقّف.",
    "الستاك يخدم بمبدأ LIFO.",
    "الباينري سيرش يستحق ليستة مرتبة.",
    "شنوة الفرق بين stack و queue؟",
]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--output-dir", required=True)
    args = p.parse_args()
    root = Path(args.output_dir)
    root.mkdir(exist_ok=False, parents=True)
    rows = []
    try:
        for i, text in enumerate(PHRASES):
            start = time.perf_counter()
            audio = LocalPiperTTSProvider().synthesize(text)
            (root / f"{i+1}.wav").write_bytes(audio)
            state = readiness()
            try:
                gpu = subprocess.run(
                    [
                        "nvidia-smi",
                        "--query-compute-apps=pid,used_memory",
                        "--format=csv,noheader,nounits",
                    ],
                    capture_output=True,
                    text=True,
                    check=True,
                    timeout=5,
                )
                state["ttsGpuMemoryMiB"] = sum(
                    int(line.split(",")[1].strip())
                    for line in gpu.stdout.splitlines()
                    if line.split(",")[0].strip() == str(state["workerPid"])
                )
            except (OSError, ValueError, subprocess.SubprocessError):
                state["ttsGpuMemoryMiB"] = None
            metrics = state["metrics"]
            metrics["cpuCorePercent"] = (
                100 * metrics["cpuSeconds"] / metrics["requestSeconds"]
            )
            rows.append(
                {
                    "text": text,
                    "wallSeconds": time.perf_counter() - start,
                    "worker": state,
                    "nativeNaturalness": None,
                    "intelligibility": None,
                    "technicalPreservation": None,
                }
            )
        (root / "results.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=2)
        )
        print(json.dumps(rows, ensure_ascii=False))
    finally:
        shutdown()


if __name__ == "__main__":
    main()
