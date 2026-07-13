# SCI Deployment SOT

**Owner:** Digital Commerce (Private) Limited  
**Status:** Controlled Source of Truth  

## Environments

SCI distinguishes:

- Development.
- Preview.
- Staging.
- Production.

## Deployment record

Every deployment must record:

- Version.
- Commit SHA.
- Git tag.
- Environment.
- Operator.
- Configuration changes.
- Migration status.
- Start time.
- Completion time.
- Smoke-test result.
- Rollback reference.

## Production rule

Only an approved release reference may be deployed to production.
