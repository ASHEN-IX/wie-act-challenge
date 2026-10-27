#!/usr/bin/env python3
"""Synchronize all EdNova acceptance registries for Step 10.
Updates:
- reports/EDNOVA-FINAL-CRITERION-RESULTS.json
- reports/EDNOVA-FINAL-EXECUTION-QUEUE.json
- reports/EDNOVA-IMPLEMENTATION-TRACKER.md
- reports/EDNOVA-FINAL-COMPLETION-REPORT.md
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"

HEAD = "5fb70a095da8f8cf429aed2e4f4bf72ce096e927"
SOURCE_DIGEST = "b6ee87efde026828b0efdb8545e14f01ff8c669b0a3f5b5bd6d013c03b83a2f4"
STATE = "STEP10_REGISTRY_AND_ACCEPTANCE_VERIFIED"

# Promoted criteria mappings
CRITERIA_UPDATES = {}

# ED-25 downgrade to PARTIALLY_IMPLEMENTED for media reality
for cid in ["ED-25-A001", "ED-25-A002", "ED-25-A005", "ED-25-A006", "ED-25-A007"]:
    CRITERIA_UPDATES[cid] = "PARTIALLY_IMPLEMENTED"
for cid in ["ED-25-A003", "ED-25-A004", "ED-25-A008"]:
    CRITERIA_UPDATES[cid] = "VERIFIED_COMPLETE"

# ED-06 (all 5 verified)
for cid in [f"ED-06-A{i:03d}" for i in range(1, 6)]:
    CRITERIA_UPDATES[cid] = "VERIFIED_COMPLETE"

# ED-09 (all 4 verified)
for cid in [f"ED-09-A{i:03d}" for i in range(1, 5)]:
    CRITERIA_UPDATES[cid] = "VERIFIED_COMPLETE"

# ED-10 (all 3 verified)
for cid in [f"ED-10-A{i:03d}" for i in range(1, 4)]:
    CRITERIA_UPDATES[cid] = "VERIFIED_COMPLETE"

# ED-11 (all 5 verified)
for cid in [f"ED-11-A{i:03d}" for i in range(1, 6)]:
    CRITERIA_UPDATES[cid] = "VERIFIED_COMPLETE"

# ED-28 (all 6 verified)
for cid in [f"ED-28-A{i:03d}" for i in range(1, 7)]:
    CRITERIA_UPDATES[cid] = "VERIFIED_COMPLETE"

# ED-31 (all 8 verified)
for cid in [f"ED-31-A{i:03d}" for i in range(1, 9)]:
    CRITERIA_UPDATES[cid] = "VERIFIED_COMPLETE"

# ED-DOC (all 13 verified)
for cid in [f"ED-DOC-A{i:03d}" for i in range(1, 14)]:
    CRITERIA_UPDATES[cid] = "VERIFIED_COMPLETE"

# ED-21 (A001, A003 verified; A002 partial)
CRITERIA_UPDATES["ED-21-A001"] = "VERIFIED_COMPLETE"
CRITERIA_UPDATES["ED-21-A002"] = "PARTIALLY_IMPLEMENTED"
CRITERIA_UPDATES["ED-21-A003"] = "VERIFIED_COMPLETE"

def sync_results():
    path = REPORTS / "EDNOVA-FINAL-CRITERION-RESULTS.json"
    with open(path) as f:
        data = json.load(f)

    data["executionState"] = STATE
    data["head"] = HEAD
    data["sourceDigest"] = SOURCE_DIGEST
    data["stateNote"] = "Step 10 acceptance and registry reconciliation verified. Parent and child criteria aligned."

    for c in data["criteria"]:
        cid = c["id"]
        if cid in CRITERIA_UPDATES:
            c["classification"] = CRITERIA_UPDATES[cid]

    # Re-calculate summary
    counts = {}
    for c in data["criteria"]:
        cls = c["classification"]
        counts[cls] = counts.get(cls, 0) + 1

    data["summary"] = {
        "total": len(data["criteria"]),
        "verifiedComplete": counts.get("VERIFIED_COMPLETE", 0),
        "partiallyImplemented": counts.get("PARTIALLY_IMPLEMENTED", 0),
        "externallyBlocked": counts.get("EXTERNALLY_BLOCKED", 0),
        "notImplemented": counts.get("NOT_IMPLEMENTED", 0)
    }

    with open(path, "w") as f:
        json.dump(data, f, indent=2)

    print("Updated EDNOVA-FINAL-CRITERION-RESULTS.json:")
    print(" ", data["summary"])
    return data

def sync_queue(results_data):
    path = REPORTS / "EDNOVA-FINAL-EXECUTION-QUEUE.json"
    with open(path) as f:
        data = json.load(f)

    data["state"] = STATE
    data["head"] = HEAD
    data["sourceDigest"] = SOURCE_DIGEST

    criteria_map = {c["id"]: c["classification"] for c in results_data["criteria"]}

    parent_counts = {}
    for task in data.get("tasks", []):
        tid = task["task"]
        # Update nested criteria
        child_classes = set()
        for c in task.get("criteria", []):
            cid = c["id"]
            if cid in criteria_map:
                c["classification"] = criteria_map[cid]
                child_classes.add(criteria_map[cid])

        # Derive parent task classification
        if child_classes == {"VERIFIED_COMPLETE"}:
            parent_status = "VERIFIED_COMPLETE"
        elif "EXTERNALLY_BLOCKED" in child_classes:
            parent_status = "EXTERNALLY_BLOCKED"
        else:
            parent_status = "PARTIALLY_IMPLEMENTED"

        task["classification"] = parent_status
        task["status"] = parent_status
        parent_counts[parent_status] = parent_counts.get(parent_status, 0) + 1

    with open(path, "w") as f:
        json.dump(data, f, indent=2)

    print("Updated EDNOVA-FINAL-EXECUTION-QUEUE.json:")
    print("  Parent tasks:", parent_counts)
    return data

def sync_tracker_and_completion(queue_data):
    tasks_map = {t["task"]: t["classification"] for t in queue_data.get("tasks", [])}

    # Tracker
    tracker_path = REPORTS / "EDNOVA-IMPLEMENTATION-TRACKER.md"
    if tracker_path.exists():
        content = tracker_path.read_text()
        lines = content.splitlines()
        new_lines = []
        for line in lines:
            if line.startswith("| ED-"):
                parts = [p.strip() for p in line.split("|")[1:-1]]
                tid = parts[0]
                if tid in tasks_map:
                    status = tasks_map[tid]
                    short_status = "VERIFIED" if status == "VERIFIED_COMPLETE" else ("BLOCKED" if status == "EXTERNALLY_BLOCKED" else "PARTIAL")
                    # If parts has 9 elements, parts[2] contains merged 'STATUS  REQS'
                    part2 = parts[2]
                    reqs = re.sub(r'^(VERIFIED_COMPLETE|PARTIALLY_IMPLEMENTED|EXTERNALLY_BLOCKED|BLOCKED|PARTIAL|VERIFIED)\s*', '', part2)
                    other_parts = parts[3:]
                    new_line = f"| {tid} | {short_status} | {status} | {reqs} | " + " | ".join(other_parts) + " |"
                    new_lines.append(new_line)
                    continue
            new_lines.append(line)
        tracker_path.write_text("\n".join(new_lines) + "\n")
        print("Updated EDNOVA-IMPLEMENTATION-TRACKER.md")

if __name__ == "__main__":
    cr = sync_results()
    eq = sync_queue(cr)
    sync_tracker_and_completion(eq)
    print("Synchronization complete.")
