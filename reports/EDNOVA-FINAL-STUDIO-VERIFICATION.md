# Studio implementation checkpoint — 27 October 2026

Implemented deterministic source-quotation customization through the existing
Course Studio API and editor. Supported prompt languages are English, French,
Arabic and Tunisian Darija; original source quotations remain unchanged and
non-English scaffold quality is explicitly unreviewed. Difficulty changes reviewed
quiz structure (2/4/6 choices) and guided quotation complexity (1/2/3 missing
words), time allowance and attempt limits. These are reproducible complexity
settings, not calibrated academic ability or mastery claims.

The author selects verified section/chunk identity and hint depth (none, first
letter, first letter plus length). Candidates carry a private author evidence
preview and flags for unverified conceptual objective alignment, unknown source
location, unreviewed language and OCR review when applicable. Candidate generation
does not register, approve, publish or overwrite a draft. Unsupported settings,
foreign sections and stale revisions fail without mutation. No frozen public
ActivityDefinition fields or generated executable content were introduced.

The editor now exposes labeled topic/section heading correction and keyboard
reordering. Stable IDs/source references survive rename/reorder. Changes clear the
local review/candidate; explicit reload handles stale conflicts without silently
discarding local edits. Late candidate responses are discarded when local inputs
change, and pending candidates can be discarded. Registration is disabled for
unsaved or mismatched revisions.

Verification in `reports/evidence/ednova-final-20261027/studio/`:

- `drafts-settings.log`: 18 passing real-Mongo test nodes, zero failures/skips.
  Includes correction/readback, stale conflict, learner denial, late ingestion
  protection, invalid tree rejection, author-only proposal/registration, all four
  prompt languages, all difficulty structures and invalid settings/section/stale
  no-mutation checks. Mongo/storage use generated synthetic names and temporary
  directories. The HTTP fixture injects synthetic actors; it does not substitute
  for authenticated browser security acceptance.
- `m14-settings.log`: focused HTTP/Mongo proposal suite, 10 passing nodes.
- `component.log`: current web suite passes (50 tests across 8 files at this
  checkpoint; concurrent independent additions may change later totals).
- `api-lint.log`: zero errors, existing 20 route console warnings.
- `web-types.log`: web typecheck passes. The first API typecheck encountered
  concurrent work in other slices; the main integration run owns final API checks.

Representative human language/pedagogy/OCR review, approved conceptual model
execution and formal contract ownership approval remain external gates. The
parent agent will record integrated browser heading/settings evidence separately.
This checkpoint does not declare ED-05/06/30/31/32 fully complete.
