# Claims System

The claims system uses the `claims` table and supports:

## Claim Submission
- Owner submits a claim tied to a booking
- Description of issue
- Evidence upload (photos, video, documents)
- Repair estimate provided

## System Freeze
- Booking and inspection records are locked for integrity
- Prevents tampering or modification

## Renter Notification
- Renter receives claim details
- Renter can respond with their own evidence

## Platform Review
- Platform evaluates evidence from both sides
- Additional documentation may be requested

## Deposit Handling
- Repair estimate used for deposit deduction logic
- Partial or full deposit may be applied

## Appeal Window
- Renter or owner may appeal the decision
-# Claims System

This document defines the damage claim workflow for the existing peer‑to‑peer rental marketplace. It does NOT introduce rental companies, supplier tiers, or multi‑location inventory.

## Purpose
Claims allow owners to request compensation when an item is returned damaged or with missing accessories.

## Claim Submission
Only the owner of the item may submit a claim.

A claim includes:
- Description of the issue
- Photos or video evidence
- Optional repair estimate

## Renter Response
The renter may:
- Accept responsibility
- Dispute the claim
- Provide counter‑evidence

## Platform Review
The platform may:
- Review evidence from both sides
- Request additional documentation
- Make a determination

## Deposit Handling
If the booking required a deposit, the platform may:
- Deduct part or all of the deposit
- Release the deposit if the claim is rejected

## Resolution
A claim ends in one of the following states:
- Resolved (deposit applied)
- Rejected (deposit released)
- Closed (no further action)
 
- Additional evidence can be submitted

## Final Resolution
- Claim marked resolved or closed
- All records remain stored for audit and legal protection
