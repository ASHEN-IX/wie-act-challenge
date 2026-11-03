# AI Message Contract (F01 — AI-COM-02 / AI-COM-03)

**Version:** 1
**Transport:** RabbitMQ, vhost `mindflow`, persistent work queues + result events
**Sources of truth:**

- Node: `apps/api/shared/ai-messaging/envelope.js`
- Python: `apps/ai/messaging/envelope.py`

Both sides validate every message **on publish and on consume**. Invalid
messages are rejected before entering business logic. Any schema change must be
applied to both implementations and to this document in the same commit; the
TEST-04 contract tests fail CI on drift.

## Field semantics

| Field           | Type      | Semantics |
|-----------------|-----------|-----------|
| `messageId`     | UUID v4   | Consumer idempotency key (dedup). Results **echo** the request's `messageId`. |
| `correlationId` | UUID v4   | Connects request → AI result → persisted job. Generated once by the orchestrator. |
| `type`          | string    | AI operation identifier. Same value used on request and result. |
| `version`       | `"1"`     | Envelope schema version for future evolution. |
| `userId`        | string    | Owner of the operation. Set by Node from the authenticated JWT — **never** taken from a client body. |
| `requestId`     | string    | Distributed tracing id, propagated from the inbound HTTP request (`X-Request-ID`). |
| `timestamp`     | ISO-8601  | Publish time (UTC). Observability/debugging. |
| `payload`       | object    | Operation-specific data. Validated by per-agent schemas (PLAN-02, COACH-02, EVAL-02, SEARCH-02, INGEST-05). |

## Job envelope (Node → Python)

```json
{
  "messageId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "correlationId": "0f8e2d1a-3b4c-5d6e-7f80-91a2b3c4d5e6",
  "type": "study.plan.generate",
  "version": "1",
  "userId": "60f1e2b3c4d5e6f7a8b9c0d1",
  "requestId": "req-9f8e7d6c",
  "timestamp": "2026-08-19T08:00:00Z",
  "payload": { "goal": "...", "concepts": ["..."] }
}
```

Rules:

- `type` must be one of the registered job types:
  - `study.plan.generate`
  - `study.coach.nudge`
  - `study.eval.step`
  - `study.search.query`
  - `study.ingest.course`
- No `status`/`error`/`result` fields are permitted on job envelopes.
- Unknown fields are rejected (`extra=forbid` / explicit key checks).

## Result envelope (Python → Node)

```json
{
  "messageId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "correlationId": "0f8e2d1a-3b4c-5d6e-7f80-91a2b3c4d5e6",
  "type": "study.plan.generate",
  "version": "1",
  "requestId": "req-9f8e7d6c",
  "timestamp": "2026-08-19T08:00:03Z",
  "status": "completed",
  "payload": { "plan": { } }
}
```

Failure shape:

```json
{
  "messageId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "correlationId": "0f8e2d1a-3b4c-5d6e-7f80-91a2b3c4d5e6",
  "type": "study.plan.generate",
  "version": "1",
  "requestId": "req-9f8e7d6c",
  "timestamp": "2026-08-19T08:00:03Z",
  "status": "failed",
  "error": "LLM provider timeout after retries"
}
```

Rules:

- `status` is `completed` or `failed`.
- On `completed`: `payload` required, `error` forbidden.
- On `failed`: `error` required and **sanitized** — max 512 chars, no stack
  traces, no DB connection strings (audit §7.5). Full details go to server logs.
- `messageId` echoes the originating job's `messageId` so the orchestrator can
  deduplicate result delivery.

## Failure classification (AI-COM-06)

| Class | Examples | Handling |
|---|---|---|
| Retryable | LLM timeout, broker hiccup, transient OCR error | NACK → retry queue with backoff (1s → 4s → 16s) |
| Terminal  | Envelope/schema validation failure, rejected output | Straight to DLQ with failure reason |

## Change process

1. Update `envelope.js` and `envelope.py` together.
2. Bump `ENVELOPE_VERSION` if breaking.
3. Update this document.
4. Run contract tests (TEST-04) in both repos.
