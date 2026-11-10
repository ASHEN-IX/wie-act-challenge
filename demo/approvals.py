"""Print a bounded, short-lived LLM approval set for the demo (no secrets).

Usage: PYTHON apps/ai python demo/approvals.py   ->  JSON for LLM_APPROVALS_JSON
"""
import json, os, sys, time, uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "ai"))
from utils import llm_client  # noqa: E402

TASKS = ["coach", "nardouch_compact", "nardouch_capable", "visual_lab_selector", "visual_lab_planner", "facilitator", "evaluator", "planner"]
run = uuid.uuid4().hex[:8]
print(json.dumps({
    t: {
        "approvalId": f"demo-{run}-{t}",
        "task": t,
        "model": llm_client.agent_config(t).model,
        "expiresAt": int(time.time()) + 4 * 3600,
        "maxRequests": int(os.environ.get("DEMO_COACH_MAX", 1)) if t == "coach" else 40,
        "maxTokens": 120000,
    }
    for t in TASKS
}))
