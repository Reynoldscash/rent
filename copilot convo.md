&#x09;						







\# Project Conversation History

This file preserves the architectural decisions, definitions, and clarifications made during the build of the peer‑to‑peer rental marketplace, including the introduction of supplier tiers (individual + small rental company).



\---



\# 1. Core System Model (Current Build)

The platform is a \*\*peer‑to‑peer rental marketplace\*\*.



Key characteristics:

\- Users authenticate through Supabase Auth.

\- Application data lives in the `profiles` table.

\- One listing = one physical item.

\- Booking flow is simple: request → approve → pickup → return → deposit release.

\- No multi‑location inventory.

\- No enterprise workflows.

\- No quantity system.

\- No staff accounts.

\- No company branches.



This model remains intact.



\---



\# 2. Supplier Tiers (Phase 1)

Two tiers are supported:



\## Tier 1 — Individual

\- Owns the item personally.

\- Uses their `full\_name` on listings.

\- Manages bookings directly.

\- Optional inspections.

\- Optional claims.



\## Tier 2 — Small Rental Company

\- One account represents the business.

\- Inventory is treated as a single pool (no branches).

\- Uses `business\_name` on listings (fallback to `full\_name`).

\- Same booking flow as individuals.

\- Same inspection and claims workflow.

\- No staff accounts yet.

\- No multi‑location support.



\### Implementation Notes

\- `supplier\_type` lives on `profiles`, not `users`.

\- Allowed values: `individual`, `small\_company`.

\- Optional `business\_name` field.

\- Users may switch tiers freely for now.

\- Tier may optionally display a badge on listings.



\---



\# 3. Quantity Model (Important Constraint)

Current rule:

\- \*\*One listing = one physical item.\*\*



Reason:

Supporting quantity requires major schema and workflow changes:

\- Inventory units table

\- Calendar allocation logic

\- Double‑booking prevention per unit

\- Claims per unit

\- Inspections per unit

\- Staff roles

\- Branch logic



This is intentionally excluded from Phase 1.



\---



\# 4. Inspection Workflow (Phase 1)

Inspections protect both parties by documenting item condition.



\## Before Pickup (Supplier → Renter)

\- Photos or video

\- Existing damage notes

\- Accessories included

\- Fuel/battery level (if applicable)

\- Serial number or identifying marks

\- Optional condition summary



\## After Return (Supplier → Platform)

\- Photos or video

\- New damage notes

\- Missing accessories

\- Optional repair estimate



\## Comparison

Platform may compare before/after inspections.



\## Storage

\- Attached to `booking\_id`

\- Visible to supplier, renter, and platform moderators



\---



\# 5. Claims Workflow (Phase 1)

Claims allow suppliers to request compensation for damage or loss.



\## Claim Submission (Supplier)

Includes:

\- Description

\- Photos/video evidence

\- Optional repair estimate

\- Optional references to inspections



\## Renter Response

\- Accept

\- Dispute

\- Provide counter‑evidence



\## Platform Review (Optional)

\- Compare inspections

\- Review evidence

\- Request more documentation



\## Deposit Handling

\- Deduct deposit if claim approved

\- Release deposit if rejected



\## Resolution States

\- Resolved

\- Rejected

\- Closed



\---



\# 6. Files Created in /brain/

The following architecture files were created:



\- `supplier-tiers.md`

\- `inspection-system.md`

\- `claims-system.md`

\- `workflows.md` (pending next step)



These files define the Phase 1 architecture.



\---



\# 7. Outstanding Decisions

These items were clarified and resolved:



\### Tier switching

\- Allowed freely for now.

\- No review process.



\### Business name

\- `business\_name` shown instead of `full\_name` for small companies.



\### Tier visibility

\- Optional badge (“Individual” / “Small Rental Company”).

\- No functional differences.



\### Quantity

\- One listing = one item (confirmed).



\### Multi‑location

\- Not part of Phase 1.

\- Requires future schema expansion.



\---



\# 8. Next Steps

\- Save this file into `/brain/conversation-history.md`.

\- Continue adding architecture files as needed.

\- Once all files are saved, Claude can load them by pasting their contents directly into Claude’s chat.





