# Noveris proposed business model

Noveris proposes a hybrid institutional B2B2C and independent B2C business. The product architecture supports both contexts under one identity. Commercial packages, price points, customer demand and financial outcomes remain hypotheses. Source code for user tiers or billing is implementation infrastructure rather than evidence of paying customers.

## Customers, users and purchases

| Path | Paying customer | Users | Proposed purchase |
| --- | --- | --- | --- |
| Institutional B2B2C | University or training centre | Institution administrators, instructors and enrolled students | Cohort-based or annual access with active-learner capacity, bounded AI allowance and defined support |
| Independent B2C | Individual learner subscribing to Pro | Learner with no institutional relationship required | Higher bounded AI allowance and selected premium capabilities above a limited free adoption tier |

Institutional students receive the institution-covered entitlement while their institution's package is active. Their membership, course enrollment, source permissions and private records remain separate domain concerns. A learner may also own personal resources and have an individual package outside the institution. The precedence and reconciliation of overlapping commercial allowances need an explicit implementation contract before launch.

## Institutional value proposition

An institution would buy a managed course-to-practice workflow with instructor review, controlled publication, course access administration, peer discussion and private evidence. The value hypothesis is the combined workflow and administration around the institution's material. A pilot must establish whether instructors and learners value it enough to adopt and pay.

Institution administrators manage the institution's instructor and student memberships, course assignments and enrollment. Assigned instructors manage their material. Students learn within those grants. Institutional onboarding currently uses a platform-admin bootstrap. Commercial onboarding, contracting, billing contact management and organisation subscription activation remain to be integrated.

## Independent adoption

Direct account registration opens a personal workspace. The proposed free tier offers enough bounded use to evaluate the core learning loop. Individual Pro would increase AI allowance and enable selected premium features. The specific allowance, feature list and conversion design require cost and user research. Existing trial, normal and paid-tier implementation should not be renamed in commercial claims without aligning the actual entitlement rules.

## Capacity and usage design

A package should define an active-learner capacity, the allowance period, request or token units, eligible model categories, rollover policy and handling of exhausted capacity. Each commercial customer needs an auditable usage account and idempotent charges. Institutional and personal usage should preserve source and actor attribution without disclosing private learning content to a billing administrator.

The existing exact-model approval ledger reserves provider requests before execution and supports usage, expiry and revocation. This protects an approved inference budget. It does not yet allocate and reconcile customer subscription allowances. Integration must map eligible actors and operations to a package, reserve a bounded allowance, retain uncertain consumption safely and expose an understandable exhausted-allowance state.

Compact and capable models have different latency and usage behavior. Bounded routing, validated course-only reuse and reduced redundant calls can control demand. No measured financial saving is claimed. Automatic cross-provider fallback is disabled under the current exact-model approval policy.

## Gross margin and operating costs

A fixed subscription has a variable inference cost. More tokens, capable requests and uncached calls raise cost per active learner. Gross margin depends on revenue after direct service costs, including inference and relevant hosting/support costs under the chosen accounting policy. Storage, source processing, embeddings, indexing, realtime infrastructure and support add cost.

Do not offer an unbounded usage promise before observing workload. A pilot should measure the usage distribution rather than just its average. A small group of heavy users may determine capacity requirements. The commercial offer should define caps, optional additional capacity, billing visibility and user feedback before an allowance is exhausted.

## Pilot and expansion

1. Identify one institution and one instructor willing to evaluate a course pilot. No partnership is currently claimed.
2. Configure scoped memberships and enroll a voluntary cohort using appropriate source material.
3. Observe activation, repeated use, instructor preparation effort and whether learners can use hints and complete independent checks.
4. Measure tokens and requests by model category, active learners, storage growth, failures and support effort.
5. Test willingness to pay for a specified capacity and support package. Discuss renewal conditions and procurement requirements.
6. Expand to another cohort after validating adoption and unit economics. Additional institutions require tested isolation, support processes and commercial onboarding.

For independent adoption, measure registration-to-practice activation, useful free-tier usage, willingness to upgrade and retention. These are proposed experiments, not existing conversion figures.

## Current implementation and proposed work

| Area | Current foundation | Commercial work required |
| --- | --- | --- |
| Identity and scope | Better Auth, personal ownership and institution memberships | Organisation customer lifecycle and billing contacts |
| Course access | Assignment, enrollment, publication and public-read rules | Entitlement behavior when a paid package expires |
| Billing | Existing Stripe routes and user-tier records | Validate current billing flow and map proposed Free/Pro offers |
| Inference | Exact-model approvals and API-owned request/usage ledger | Package-level allowances, metering and reconciliation |
| Growth | Institution and course invitation mechanisms | Pilot process, pricing validation and procurement |

See [product](product-specification.md), [permissions](roles-and-permissions.md) and [AI configuration](llm-config.md).
