# Privacy, ethics and security

This page summarises the safeguards that exist in the source. It is not a certification.

## Data

- Demo, seed and test data are synthetic. Do not upload personal or private documents to a shared deployment.
- The application stores only what a feature needs. Voice input is transcribed without saving raw audio. No photos, addresses or government identifiers are collected.
- Retrieval embeddings are computed locally (all-MiniLM-L6-v2 + FAISS). Only bounded course excerpts, the learner's current question and short history reach a model provider.
- There is no automatic PII detector. Operators must ensure that uploaded course material is public, synthetic or anonymised.

## Access control

- Identity uses Better Auth cookie sessions. The NestJS API re-checks institution membership, instructor assignment, enrollment, source grants and room membership on every protected read, command and delayed result. See [roles and permissions](roles-and-permissions.md).
- Private attempts and evidence are scoped to their owner. A peer never receives another learner's score or evidence ID.
- Python services are reached with a service credential (`AI_SERVICE_API_KEY`, `INTERNAL_API_SECRET`); the browser never calls them directly.

## AI safeguards

- Every real model call needs an unexpired operator approval bound to the task and exact model; the API ledger reserves a request before dispatch. Without credentials or approval the service fails closed or runs in explicit mock mode. See [model configuration](llm-config.md).
- Model output is schema-validated, citations are checked against authorised evidence, and facilitator proposals are validated for recipient and room sequence before delivery.
- Adaptation uses interaction and self-report only, never gender, region, language level or background. Learning-style output is provisional and never graded.
- The AI supports instructors; it does not publish or grade on their behalf unless an instructor opts in.

## Secrets

Credentials live in untracked `.env` files. Commit only the `.env.example` templates, which contain placeholders. Never place keys in logs, screenshots or demo recordings.
