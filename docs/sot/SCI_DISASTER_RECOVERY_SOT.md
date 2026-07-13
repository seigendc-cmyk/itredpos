# SCI Disaster Recovery and Continuity SOT

**Owner:** Digital Commerce (Private) Limited  
**Status:** Controlled Source of Truth  

## Recovery scope

This SOT covers:

- GitHub repositories.
- Source-code tags.
- Databases.
- Database backups.
- Deployment platforms.
- Environment configuration.
- Secrets.
- Domains.
- Documentation.
- Administrative accounts.

## Recovery requirements

Every critical service must define:

- Recovery Time Objective.
- Recovery Point Objective.
- Backup owner.
- Restore procedure.
- Recovery credentials.
- Previous safe version.
- Escalation authority.

## Restore-test rule

A backup is not considered reliable until restoration has been tested and
evidence recorded.
