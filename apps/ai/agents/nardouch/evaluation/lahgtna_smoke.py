"""Real CPU-only evaluation of the pinned Lahgtna fine-tune; no external voice.

Uses published preset conditionals, never user/reference audio. The model author's
fork maps Tunisian `tn` to the pretrained `da` language-token slot. This mapping
is specific to these fine-tuned weights, not the base model's Danish capability.
"""

import argparse
import json
import os
from pathlib import Path
import resource
import socket
import time


def main():
    process_started = time.perf_counter()
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    root = Path(args.model_dir).resolve()
    output = Path(args.output_dir).resolve()
    output.mkdir(parents=True, exist_ok=False)
    os.environ.update(
        HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", CUDA_VISIBLE_DEVICES=""
    )

    def denied(*args, **kwargs):
        raise OSError("Evaluation network access prohibited")

    socket.socket.connect = denied
    import hashlib

    manifest = json.loads((root / "manifest.json").read_text())
    if manifest["revision"] != "6b37e50d1952f07306dc9ff3f3d4ff4ddaf32541":
        raise ValueError("Unexpected checkpoint")
    expected = {
        "README.md",
        "conds.pt",
        "grapheme_mtl_merged_expanded_v1.json",
        "t3_mtl23ls_v2.safetensors",
        "s3gen.pt",
        "ve.pt",
        "Cangjie5_TC.json",
    }
    if set(manifest["files"]) != expected:
        raise ValueError("Checkpoint manifest must cover every required file")
    pinned = json.loads(Path(__file__).with_name("lahgtna_checkpoint.json").read_text())
    if manifest["files"] != pinned["files"]:
        raise ValueError("Manifest differs from the pinned checkpoint hashes")
    for name, digest in manifest["files"].items():
        with (root / name).open("rb") as checkpoint:
            actual = hashlib.file_digest(checkpoint, "sha256").hexdigest()
        if actual != digest:
            raise ValueError("Checkpoint hash mismatch")
    import torch
    import wave
    import numpy as np
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    torch.set_num_threads(4)
    started = time.perf_counter()
    model = ChatterboxMultilingualTTS.from_local(
        root, device="cpu", t3_model="t3_mtl23ls_v2.safetensors"
    )
    initialization = time.perf_counter() - started
    text = "عسلامة، أنا نردوش. شنوة تحب تقرا اليوم؟"
    started = time.perf_counter()
    # Preserve the exact approved text; upstream punctuation rewriting is disabled
    # only for this isolated evaluator, not for any other application/model.
    import chatterbox.mtl_tts as runtime

    runtime.punc_norm = lambda text: text
    samples = (
        model.generate(text, language_id="da", repetition_penalty=2.0)
        .detach()
        .cpu()
        .numpy()
        .reshape(-1)
    )
    latency = time.perf_counter() - started
    if (
        not np.isfinite(samples).all()
        or not model.sr // 10 <= len(samples) <= model.sr * 60
        or np.max(np.abs(samples)) < 1e-4
    ):
        raise ValueError("Invalid or silent synthesis")
    with wave.open(str(output / "answer.wav"), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(model.sr)
        audio.writeframes((np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes())
    result = {
        "totalWallSeconds": time.perf_counter() - process_started,
        "initializationSeconds": initialization,
        "generationSeconds": latency,
        "audioSeconds": len(samples) / model.sr,
        "realTimeFactor": latency / (len(samples) / model.sr),
        "peakRssKiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        "device": "cpu",
        "sampleRate": model.sr,
        "peakVramBytes": 0,
        "checkpointRevision": manifest["revision"],
        "referenceAudioUsed": False,
        "nativeReview": None,
        "text": text,
    }
    (output / "result.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2)
    )
    print(json.dumps(result))


if __name__ == "__main__":
    main()
