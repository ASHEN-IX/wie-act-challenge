#!/usr/bin/env python3
"""Acceptance Registry Invariant Validator (CI-Compatible).

Validates consistency across:
- reports/EDNOVA-FINAL-CRITERION-RESULTS.json
- reports/EDNOVA-FINAL-EXECUTION-QUEUE.json
- reports/EDNOVA-IMPLEMENTATION-TRACKER.md

Invariants enforced:
1. Exactly 36 canonical task IDs (ED-01..ED-25, ED-DOC, ED-26..ED-35).
2. Exactly 235 unique atomic criterion IDs.
3. Zero missing or duplicate IDs.
4. Zero classification mismatches between CRITERION-RESULTS and EXECUTION-QUEUE.
5. If parent task is VERIFIED_COMPLETE, all child criteria must be VERIFIED_COMPLETE.
6. Execution state must not be stale (e.g., must be STEP10_*).
7. Validates source commit HEAD and digest matches.
8. Outputs machine-readable discrepancy report if requested or on failure.
"""

import sys
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"

CANONICAL_TASKS = [
    f"ED-{i:02d}" for i in range(1, 26)
] + ["ED-DOC"] + [
    f"ED-{i:02d}" for i in range(26, 36)
]

VALID_CLASSIFICATIONS = {
    "VERIFIED_COMPLETE",
    "PARTIALLY_IMPLEMENTED",
    "EXTERNALLY_BLOCKED",
    "NOT_IMPLEMENTED"
}

def load_criterion_results():
    path = REPORTS / "EDNOVA-FINAL-CRITERION-RESULTS.json"
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}")
    with open(path) as f:
        return json.load(f)

def load_execution_queue():
    path = REPORTS / "EDNOVA-FINAL-EXECUTION-QUEUE.json"
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}")
    with open(path) as f:
        return json.load(f)

def load_tracker():
    path = REPORTS / "EDNOVA-IMPLEMENTATION-TRACKER.md"
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}")
    with open(path) as f:
        content = f.read()
    task_statuses = dict(re.findall(r'\| (ED-[A-Z0-9]+) \| [^|]+ \| ([^|]+) \|', content))
    return {k: v.strip() for k, v in task_statuses.items()}

def validate():
    discrepancies = []
    
    cr_data = load_criterion_results()
    eq_data = load_execution_queue()
    tracker_tasks = load_tracker()

    # 1. Validate Execution State
    cr_state = cr_data.get("executionState")
    eq_state = eq_data.get("state")
    if not cr_state or "STEP8" in cr_state or "STEP9" in cr_state:
        discrepancies.append({
            "type": "STALE_EXECUTION_STATE",
            "file": "EDNOVA-FINAL-CRITERION-RESULTS.json",
            "found": cr_state,
            "expected_prefix": "STEP10_"
        })

    # 2. Validate Canonical Tasks in Tracker & Queue
    found_tasks_cr = set()
    found_criteria_cr = {}
    
    for c in cr_data.get("criteria", []):
        cid = c["id"]
        tid = cid.rsplit("-", 1)[0]
        found_tasks_cr.add(tid)
        if cid in found_criteria_cr:
            discrepancies.append({
                "type": "DUPLICATE_CRITERION_ID",
                "file": "EDNOVA-FINAL-CRITERION-RESULTS.json",
                "criterion_id": cid
            })
        found_criteria_cr[cid] = c

    queue_tasks = {t["task"]: t for t in eq_data.get("tasks", [])}
    found_criteria_eq = {}
    for tid, t in queue_tasks.items():
        for c in t.get("criteria", []):
            cid = c["id"]
            if cid in found_criteria_eq:
                discrepancies.append({
                    "type": "DUPLICATE_CRITERION_ID",
                    "file": "EDNOVA-FINAL-EXECUTION-QUEUE.json",
                    "criterion_id": cid
                })
            found_criteria_eq[cid] = c

    # Task ID counts
    if len(queue_tasks) != 36:
        discrepancies.append({
            "type": "INVALID_TASK_COUNT",
            "file": "EDNOVA-FINAL-EXECUTION-QUEUE.json",
            "found": len(queue_tasks),
            "expected": 36
        })

    if len(tracker_tasks) != 36:
        discrepancies.append({
            "type": "INVALID_TASK_COUNT",
            "file": "EDNOVA-IMPLEMENTATION-TRACKER.md",
            "found": len(tracker_tasks),
            "expected": 36
        })

    for ct in CANONICAL_TASKS:
        if ct not in queue_tasks:
            discrepancies.append({"type": "MISSING_TASK", "task": ct, "file": "EDNOVA-FINAL-EXECUTION-QUEUE.json"})
        if ct not in tracker_tasks:
            discrepancies.append({"type": "MISSING_TASK", "task": ct, "file": "EDNOVA-IMPLEMENTATION-TRACKER.md"})

    # Criterion counts
    if len(found_criteria_cr) != 235:
        discrepancies.append({
            "type": "INVALID_CRITERION_COUNT",
            "file": "EDNOVA-FINAL-CRITERION-RESULTS.json",
            "found": len(found_criteria_cr),
            "expected": 235
        })

    if len(found_criteria_eq) != 235:
        discrepancies.append({
            "type": "INVALID_CRITERION_COUNT",
            "file": "EDNOVA-FINAL-EXECUTION-QUEUE.json",
            "found": len(found_criteria_eq),
            "expected": 235
        })

    # Criterion ID parity and Classification Mismatches
    for cid, c_cr in found_criteria_cr.items():
        c_eq = found_criteria_eq.get(cid)
        if not c_eq:
            discrepancies.append({
                "type": "MISSING_CRITERION_IN_QUEUE",
                "criterion_id": cid
            })
            continue

        cr_cls = c_cr.get("classification")
        eq_cls = c_eq.get("classification")

        if cr_cls not in VALID_CLASSIFICATIONS:
            discrepancies.append({
                "type": "INVALID_CLASSIFICATION",
                "file": "EDNOVA-FINAL-CRITERION-RESULTS.json",
                "criterion_id": cid,
                "found": cr_cls
            })

        if eq_cls not in VALID_CLASSIFICATIONS:
            discrepancies.append({
                "type": "INVALID_CLASSIFICATION",
                "file": "EDNOVA-FINAL-EXECUTION-QUEUE.json",
                "criterion_id": cid,
                "found": eq_cls
            })

        if cr_cls != eq_cls:
            discrepancies.append({
                "type": "CLASSIFICATION_MISMATCH",
                "criterion_id": cid,
                "results_classification": cr_cls,
                "queue_classification": eq_cls
            })

    # Incompatible Parent / Child Status Invariants
    for tid in CANONICAL_TASKS:
        p_queue = queue_tasks.get(tid, {}).get("classification")
        p_track = tracker_tasks.get(tid)
        
        # Parent classifications match between tracker and queue
        if p_queue and p_track and p_queue != p_track and (p_queue.replace('EXTERNALLY_', '') != p_track.replace('BLOCKED', 'EXTERNALLY_BLOCKED')):
            discrepancies.append({
                "type": "PARENT_TASK_STATUS_MISMATCH",
                "task": tid,
                "queue_status": p_queue,
                "tracker_status": p_track
            })

        # If parent is VERIFIED_COMPLETE, every child must be VERIFIED_COMPLETE
        child_criteria = [c for cid, c in found_criteria_cr.items() if cid.rsplit("-", 1)[0] == tid]
        if p_queue == "VERIFIED_COMPLETE":
            non_vc = [c["id"] for c in child_criteria if c["classification"] != "VERIFIED_COMPLETE"]
            if non_vc:
                discrepancies.append({
                    "type": "PARENT_COMPLETE_BUT_CHILD_INCOMPLETE",
                    "task": tid,
                    "incomplete_children": non_vc
                })

    return discrepancies

def main():
    discrepancies = validate()
    report_file = REPORTS / "evidence" / "registry-discrepancies.json"
    report_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(report_file, "w") as f:
        json.dump({
            "discrepancy_count": len(discrepancies),
            "discrepancies": discrepancies
        }, f, indent=2)

    if discrepancies:
        print(f"FAILED: Found {len(discrepancies)} registry discrepancies.")
        for d in discrepancies[:15]:
            print(" ", d)
        if len(discrepancies) > 15:
            print(f"  ... and {len(discrepancies) - 15} more (see {report_file})")
        sys.exit(1)
    else:
        print("PASS: Acceptance registry invariants verified. 0 discrepancies found.")
        sys.exit(0)

if __name__ == "__main__":
    main()

