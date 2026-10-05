# Supplier Tiers

## Tier 1 — Individuals
- Occasional rentals
- Long-tail inventory
- High variety, low consistency

## Tier 2 — Small Rental Companies
- 10–100+ items
- Local depth
- More reliable availability

## Tier 3 — Large Rental Companies
- Hundreds/thousands of items
- Immediate inventory
- Brand credibility
- Multi-location support

## Growth Phases
1. Individuals + small rental companies
2. Regional rental companies
3. Multi-location rental companies
4. National rental companies
# Supplier Types (Peer-to-Peer Model)

The current system is a peer‑to‑peer marketplace. All suppliers are individual users listing their own items.

## Supplier Type: Individual
- Owns the item being listed
- Manages their own bookings
- Handles communication with renters
- Performs inspections and claims manually

## Future Expansion (Not Yet Implemented)
The platform may later support:
# Supplier Tiers

This document defines the supplier tiers supported by the platform. The system begins with two tiers:
1. Individuals
2. Small Rental Companies

These tiers expand the existing peer‑to‑peer marketplace without requiring multi‑location inventory, enterprise workflows, or structural schema changes beyond the supplier_type field.

---

## Tier 1 — Individuals
Individuals are the foundation of the marketplace.

Characteristics:
- Own the items they list
- Manage their own bookings
- Communicate directly with renters
- Perform inspections (optional)
- Handle claims (optional)
- Inventory is personal and not shared with other users

Use Cases:
- Occasional rentals
- Hobby equipment
- Tools, gear, household items
- Side‑income listings

---

## Tier 2 — Small Rental Companies
Small rental companies operate similarly to individuals but with more inventory and more consistent availability.

Characteristics:
- 10–100+ items
- Inventory belongs to a single business entity
- One account represents the company
- No multi‑location support yet (all inventory is treated as one pool)
- Same booking flow as individuals
- Same inspection and claims workflow as individuals
- No staff accounts or branch management yet

Use Cases:
- Local rental shops
- Small equipment rental businesses
- Camera/AV rental boutiques
- Tool rental companies

---

## Future Expansion (Not Yet Implemented)
These tiers are NOT active yet but may be added later:

- Large rental companies
- Multi‑location rental companies
- National rental companies
- Branch‑level inventory
- Staff accounts
- Automated availability syncing

These expansions will require schema changes and booking flow updates. They are intentionally excluded from the current build.

---

## Current Implementation Notes
- The `users` table includes a `supplier_type` field.
- Allowed values today:
  - `individual`
  - `small_company`
- No other tiers are recognized by the system.
- All workflows (booking, inspection, claims) behave identically for both tiers.

- Small rental businesses
- Large rental companies
- Multi‑location inventory

These are NOT part of the current build and are NOT assumed by any existing code.
