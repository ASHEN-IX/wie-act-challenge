# Runbook — RabbitMQ topology v2 migration (per-type delay queues)

**Applies to:** first deploy of the F01 v2 retry topology (AI-COM-06).
**Risk if skipped:** workers/orchestrator crash-loop with `PRECONDITION_FAILED` on boot.

## Background

The v2 topology changed queue declarations:

| Queue | Old args | New args |
|---|---|---|
| `ai.work.<type>` | `x-dead-letter-exchange=ai.dlx` | `+ x-dead-letter-routing-key=<type>` |
| delay queues | 3 global: `ai.delay.1s/4s/16s` | per-type per-step: `ai.delay.<type>.<ms>` (same TTL/DLX args) |

AMQP queues are immutable once declared. A client declaring an existing queue
with **different arguments** receives `PRECONDITION_FAILED` and its channel
closes — every boot, forever, until the stale queues are removed.

## Detection

```
# Any service log:
PRECONDITION_FAILED - inequivalent arg 'x-dead-letter-routing-key' for queue 'ai.work.study.plan.generate'
```

## Fix (dev / staging)

Queues hold no durable state we care about in dev — delete and let services redeclare:

```bash
export DOCKER_HOST=unix:///var/run/docker.sock   # if using Docker Desktop context
for q in $(docker exec <rabbit-container> rabbitmqctl list_queues name \
           | grep '^ai\.' | awk '{print $1}'); do
  docker exec <rabbit-container> rabbitmqctl delete_queue "$q"
done
# restart ai-orchestrator + workers → topology self-declares at boot
```

Exchanges are unchanged (`ai.jobs`, `ai.delay`, `ai.dlx`, `ai.results`) and can stay.

## Fix (production)

In-flight messages must not be dropped:

1. **Freeze publishes** (maintenance flag / stop API pods).
2. **Drain work queues**: let workers consume until
   `rabbitmqctl list_queues name messages_ready messages_unacknowledged` shows 0/0.
3. **Salvage DLQs** with the replay tool *before* deleting anything:

   ```bash
   node apps/api/shared/ai-messaging/dlq-replay.js --type study.search.query --dry-run
   node apps/api/shared/ai-messaging/dlq-replay.js --type study.search.query
   ```

4. Delete queues as above; **deploy the new version**; unfreeze.
5. Verify: `rabbitmqctl list_queues name arguments` shows
   `x-dead-letter-routing-key` on all `ai.work.*` queues.

## Constraint going forward

`AI_RETRY_DELAYS_MS` **must be identical** across ai-orchestrator and all
Python workers. Declaration arguments embed each step's TTL, so a mismatched
override reproduces this exact failure mode. Production should not set the
variable at all (canonical ladder: 1000/4000/16000 ms).
