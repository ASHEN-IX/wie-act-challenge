"""Real local inference, caller-supplied consented WAV; never substitutes test audio."""

import argparse
import base64
import json
import time
from pathlib import Path
from agents.nardouch.voice import (
    decode_audio,
    LocalWhisperASRProvider,
    LocalTunisianTTSProvider,
)
from agents.nardouch.local_speech import readiness, shutdown


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("--tts-text")
    parser.add_argument("--output-wav")
    args = parser.parse_args()
    start = time.perf_counter()
    try:
        audio = Path(args.audio).read_bytes()
        decode_audio(base64.b64encode(audio).decode())
        text = LocalWhisperASRProvider().transcribe(audio, "ar-TN")
        report = {
            "transcript": text,
            "asrSeconds": time.perf_counter() - start,
            "worker": readiness(),
        }
        if args.tts_text:
            if not args.output_wav:
                parser.error("--output-wav required for TTS")
            start = time.perf_counter()
            output = LocalTunisianTTSProvider().synthesize(args.tts_text)
            with open(args.output_wav, "xb") as target:
                target.write(output)
            report.update(
                ttsSeconds=time.perf_counter() - start, outputBytes=len(output)
            )
        print(json.dumps(report, ensure_ascii=False))
    finally:
        shutdown()


if __name__ == "__main__":
    main()
