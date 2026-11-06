"""Run explicitly against a configured authenticated gateway, never fake quality scores.

NARDOUCH_EVAL_URL=http://localhost:3001
NARDOUCH_EVAL_COOKIE=<private Better Auth cookie>
NARDOUCH_EVAL_COURSE_ID=<accessible published course>
NARDOUCH_EVAL_REVISION_ID=<published revision>
python -m agents.nardouch.evaluation.run --output /private/path/results.json
"""

import argparse
import json
import os
import statistics
import time
from pathlib import Path
import requests


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    names = [
        "NARDOUCH_EVAL_URL",
        "NARDOUCH_EVAL_COOKIE",
        "NARDOUCH_EVAL_COURSE_ID",
        "NARDOUCH_EVAL_REVISION_ID",
    ]
    if any(not os.getenv(name) for name in names):
        parser.error(
            "Configure NARDOUCH_EVAL_URL, COOKIE, COURSE_ID and REVISION_ID privately"
        )
    cases = json.loads(Path(__file__).with_name("cases.json").read_text())["cases"]
    rows = []
    for case in cases:
        start = time.perf_counter()
        row = {
            "id": case["id"],
            "expectedChecks": case["expectedChecks"],
            "manualScores": None,
        }
        try:
            response = requests.post(
                os.environ["NARDOUCH_EVAL_URL"].rstrip("/")
                + "/api/v1/study/nardouch/turn",
                headers={
                    "Cookie": os.environ["NARDOUCH_EVAL_COOKIE"],
                    "Origin": os.getenv(
                        "NARDOUCH_EVAL_ORIGIN", "http://localhost:3000"
                    ),
                },
                json={
                    "courseId": os.environ["NARDOUCH_EVAL_COURSE_ID"],
                    "revisionId": os.environ["NARDOUCH_EVAL_REVISION_ID"],
                    "expectedVersion": 0,
                    "message": case["question"],
                    "mode": case["mode"],
                    "language": case["language"],
                },
                timeout=35,
            )
            row["status"] = response.status_code
            if response.status_code == 200:
                answer = response.json()["conversation"]["messages"][-1]["answer"]
                row.update(
                    {
                        "displayText": answer["displayText"],
                        "evidenceStatus": answer["evidenceStatus"],
                        "usage": answer["usage"],
                    }
                )
        except (requests.RequestException, KeyError, ValueError):
            row["status"] = "transport_or_contract_failure"
        row["latencyMs"] = round((time.perf_counter() - start) * 1000, 2)
        rows.append(row)
    failures = sum(row["status"] != 200 for row in rows)
    report = {
        "cases": rows,
        "requests": len(rows),
        "failures": failures,
        "failureRate": failures / len(rows),
        "medianLatencyMs": statistics.median(r["latencyMs"] for r in rows),
        "educationalCorrectness": None,
        "nativeNaturalness": None,
        "codeSwitchingQuality": None,
        "technicalPreservation": None,
        "reviewStatus": "Awaiting expert and native-speaker scoring",
    }
    # Restrict result permissions before any answer is written.
    descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as out:
        json.dump(report, out, ensure_ascii=False, indent=2)
    print(
        f"Evaluated {len(rows)} requests; {failures} failures. Private results saved. Human scores remain unset."
    )


if __name__ == "__main__":
    main()
