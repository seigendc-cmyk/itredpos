# SCI Build Governance SOT

**Owner:** Digital Commerce (Private) Limited  
**Status:** Controlled Source of Truth  

## Controlled build flow

Business Requirement
-> SOT
-> Architecture
-> Build Plan
-> Implementation
-> Testing
-> Review
-> Versioning
-> Release
-> Deployment
-> Support

## Stage-gate rule

No build advances before the evidence from the current stage is reviewed.

## Required build report

Every build must record:

- Objective.
- Current branch.
- Files changed.
- Business rules.
- Data impact.
- Security impact.
- Permissions.
- BI and audit events.
- Tests completed.
- Known limitations.
- Next stage.
