# Inspection System

The inspection system uses the `inspections` table and supports:

## Before Pickup Inspection
- Walkaround video
- Photos
- Scratches / dents / damage
- Mileage / hours
- Fuel / battery level
- Accessories
- Serial number
- Condition notes
- Renter receives digital report and confirms

## After Return Inspection
- Owner repeats inspection
- System compares before vs after
- Evidence stored
- Supports claim initiation
# Inspection System

This document defines the optional inspection workflow for the existing peer‑to‑peer rental marketplace. It does NOT introduce rental companies, supplier tiers, or multi‑location inventory. It is compatible with the current schema and booking flow.

## Before Pickup Inspection
Performed by the owner.

Includes:
- Photos or video of the item
- Notes about existing damage
- Notes about accessories included
- Notes about fuel/battery level (if applicable)
- Notes about serial number or identifying marks

The renter can view this inspection before confirming pickup.

## After Return Inspection
Performed by the owner.

Includes:
- Photos or video of the item after return
- Notes about new damage (if any)
- Notes about missing accessories (if any)

## Comparison
The platform may compare before/after inspections to support dispute resolution.

## Storage
Inspection records are stored per booking. Only the owner and renter involved in the booking may view them.
