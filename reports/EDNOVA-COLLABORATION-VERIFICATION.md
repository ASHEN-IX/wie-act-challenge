# EdNova collaboration verification — 27 October 2026 continuation

The two-learner real PDF A–E browser run passes eight recorded checkpoints,
including canonical activity selection and WebSocket synchronization, separate
right/wrong private grading, lost-response retry, reconnect, presenter denial,
reviewed deterministic facilitation, private debrief, hostile requests and
enrollment/membership revocation. The browsers use independent authenticated
contexts with real Nest/Next/Mongo/RabbitMQ/Python services. Embeddings and model
responses are deterministic fixtures. This is single-API-instance evidence.

[Passing two-learner log](evidence/ednova-execution-20261027/integrated-pdf.log)
and [asserted checkpoints](evidence/ednova-execution-20261027/integrated-pdf/browser-checks.json).

The extended run now passes **all eight A–E checkpoints with four distinct
learner identities and browser contexts**, plus admin, instructor and outsider.
All four join the same reviewed PDF activity and see the authoritative activity
and sequence. Separate correct/incorrect submissions survive reload; foreign
private checks are denied in both directions. The run also verifies reconnect,
presenter denial, reviewed deterministic facilitation, four private debriefs,
hostile inputs and enrollment/membership revocation.

[Four-learner passing log](evidence/ednova-execution-20261027/four-learner-resumed.log),
[exit 0](evidence/ednova-execution-20261027/four-learner-resumed.exit),
[asserted checkpoints](evidence/ednova-execution-20261027/four-learner-resumed/browser-checks.json)
and [copied frontend source hashes](evidence/ednova-execution-20261027/four-learner-resumed/browser-source-copy.json).
The run uses the existing native-text PDF path; it does not establish scanned-PDF
browser acceptance. OCR work during the run is verified separately.

Several earlier runs against the IDE workspace stalled while following a room
link, accompanied by development-server reconnects/refreshes. A trial native-link
change failed and was reverted. The passing runner uses a disposable authored
source copy, declared dependency links, isolated Next output and synthetic data.
The actual production rate limits remain enabled; the harness paces request
batches sharing the loopback address. A previous extra-learner assertion compared
against a stale sequence after an accepted submission; it now obtains a current
authoritative snapshot for each comparison and checks sequence monotonicity.
The previous `four-learner-current` run ended when local services went offline and
has no final pass result. All failed/incomplete evidence is retained.

CI's PDF variant now selects `P0R3_FOUR_LEARNERS=1`; remote CI has not been observed.

Reproduce the extended run with a dedicated broker and isolated Next output:

```bash
P0R3_FOUR_LEARNERS=1 P0R3_SOURCE_PDF=1 \
P0R3_EVIDENCE_DIR=/absolute/path/to/isolated-evidence \
P0R2_PYTHON=/absolute/path/to/locked/python \
node scripts/run-integrated-browser.mjs
```

Do not run this concurrently with another ingestion test using the same broker
queues. The harness's deliberate pacing preserves production rate limits.
Actual distributed fanout, process-restart browser recovery, real-model
misconception quality, declined participation and all optional media acceptance
remain open. Parent ED-07/09/11 tasks remain PARTIAL.

A separate two-learner image-only PDF run also passes all A–E checks plus an
explicit instructor OCR-confidence warning assertion (nine checkpoints). See
[scanned-PDF evidence](EDNOVA-OCR-VERIFICATION.md). This supplements the
four-learner native-text PDF result; it is not four-learner scanned-PDF evidence.

The final implementation mission additionally passes10 four-learner checkpoints
with corrected heading publication,fail-closed instructor analytics,shared
deterministic visualization controls,requester-only help with empty peer history,
reload and final revocation/WS privacy. Evidence is
`evidence/ednova-final-20261027/browser-paced-current.log` and its browser-checks.json.
Join/probe batches preserve production rate limits and use an isolated broker vhost.
The vhost and disposable frontend copy were removed after successful completion.
