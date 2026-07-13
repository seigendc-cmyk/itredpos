# SCI Semantic Versioning and Release Management SOT

**Document status:** Build-Control Source of Truth  
**SOT reference:** SCI-SEMVER-SOT  
**SOT version:** 1.0.0  
**Initial SCI baseline:** v0.8.0-alpha.1  
**Owner:** Digital Commerce (Private) Limited  
**Platform:** seiGEN Commerce Infrastructure  
**Effective date:** 13 July 2026  

---

## 1. Purpose

This Source of Truth establishes the official versioning, release, tagging,
documentation, testing, deployment, recovery and rollback rules for the
seiGEN Commerce Infrastructure.

Every significant SCI change must be:

- Planned.
- Traceable.
- Tested.
- Documented.
- Reproducible.
- Recoverable.
- Approved before release.

The first formally controlled SCI baseline is:

SCI v0.8.0-alpha.1

This version establishes a controlled integration baseline. It does not declare
SCI production-ready.

---

## 2. Version Format

SCI uses Semantic Versioning:

MAJOR.MINOR.PATCH

Example:

0.8.0

### MAJOR

Increment the MAJOR version when a release introduces breaking architectural,
database, API or operational changes.

Example:

1.0.0 to 2.0.0

### MINOR

Increment the MINOR version when backward-compatible functionality is added.

Example:

0.8.0 to 0.9.0

### PATCH

Increment the PATCH version when backward-compatible defects are corrected.

Example:

0.8.0 to 0.8.1

---

## 3. Pre-Release Versions

SCI uses the following pre-release sequence:

alpha -> beta -> rc -> stable

Examples:

0.8.0-alpha.1
0.8.0-alpha.2
0.8.0-beta.1
0.8.0-rc.1
0.8.0

### Alpha

Used for active development and internal integration.

### Beta

Used when core functionality is substantially complete and wider testing is
required.

### Release Candidate

Used when the build is believed to be suitable for stable release.

### Stable

Used only after testing, security review, documentation and release approval.

---

## 4. Version Authority

SCI must have one authoritative version definition.

Recommended file:

src/platform/version.ts

No page, service or module may independently hard-code a different SCI version.

The version should be displayed where practical in:

- Login.
- Settings.
- About.
- Support.
- Error reports.
- Audit metadata.
- BI event metadata.
- Deployment metadata.

---

## 5. Release Branches

Recommended branch structure:

main
develop
integration/sci-v0.8
feature/*
fix/*
security/*
release/*
hotfix/*

### main

Contains formally approved releases and accepted baselines.

### develop

Contains the latest approved development work.

### integration/*

Contains controlled integration work for a planned release line.

### feature/*

Contains isolated new functionality.

### fix/*

Contains backward-compatible corrections.

### security/*

Contains security-sensitive corrections.

### release/*

Contains a frozen release-preparation build.

### hotfix/*

Contains urgent corrections to an already published stable release.

---

## 6. SCI v0.8.0-alpha.1 Baseline Requirements

Before publishing SCI v0.8.0-alpha.1, Digital Commerce must:

1. Confirm the authoritative repository.
2. Confirm the active branch.
3. Review uncommitted work.
4. Commit valid current work.
5. Push approved work to GitHub.
6. Create a recovery branch.
7. Create a recovery tag.
8. Record the release commit SHA.
9. Document implemented features.
10. Document known limitations.
11. Document build configuration.
12. Document environment-variable names.
13. Document database and migration status.
14. Run lint, type checking, tests and production build.
15. Complete primary workflow testing.
16. Review authentication and tenant isolation.
17. Review licensing and permissions.
18. Create release notes.
19. Create the release branch.
20. Create the annotated Git tag.
21. Publish the GitHub Release.
22. Record rollback instructions.

---

## 7. Required Release Documentation

Every release must include:

- Version number.
- Release date.
- Release title.
- Release purpose.
- Products affected.
- Modules affected.
- New functionality.
- Improvements.
- Resolved defects.
- Security changes.
- Database changes.
- Migration requirements.
- Configuration changes.
- Compatibility information.
- Known limitations.
- Testing completed.
- Deployment instructions.
- Rollback instructions.
- Approval record.

---

## 8. Release Blocking Conditions

A release must be blocked when any of the following exists:

- Required work is uncommitted.
- Critical work is not pushed.
- Production build fails.
- TypeScript validation fails.
- Critical runtime errors remain unresolved.
- Authentication is broken.
- Vendor tenancy is not enforced.
- Licensing can be bypassed.
- Cross-tenant access is possible.
- Financial or stock records can be silently changed.
- Required migration instructions are missing.
- Rollback instructions are missing.
- Secrets are exposed.
- Release notes are incomplete.
- The tag does not match the approved release commit.

---

## 9. Database Migration Rule

Every release must state:

Migration required: YES or NO

Where migration is required, document:

- Migration identifier.
- Source schema version.
- Target schema version.
- Collections or tables affected.
- Index changes.
- Security-rule changes.
- Backup requirements.
- Backfill requirements.
- Validation procedure.
- Rollback procedure.
- Data-loss risk.

Database changes must not be hidden inside an ordinary feature release.

---

## 10. Rollback Rule

Every published release must identify:

- Previous safe version.
- Previous safe tag.
- Previous safe commit.
- Deployment rollback procedure.
- Database rollback requirements.
- Configuration rollback requirements.
- Data recovery procedure.
- Expected service impact.
- Approval authority.

A Git rollback does not automatically reverse database migrations.

---

## 11. Commit Message Standard

Use the following commit prefixes:

foundation:
build:
feat:
fix:
security:
refactor:
test:
docs:
migration:
release:
hotfix:

Examples:

docs: add SCI semantic versioning SOT

build: establish SCI v0.8 integration baseline

fix: restore terminal context after session refresh

security: enforce Firestore tenant isolation

release: stamp SCI v0.8.0-alpha.1

---

## 12. Release Approval

No coding agent may independently approve or publish an SCI release.

Approval must consider:

- Technical verification.
- Business workflow verification.
- Security verification.
- Data-integrity verification.
- Deployment verification.
- Documentation verification.
- Rollback readiness.
- Formal owner approval.

Allowed decisions:

APPROVED FOR RELEASE
APPROVED WITH DOCUMENTED LIMITATIONS
CORRECTION REQUIRED
RELEASE BLOCKED

---

## 13. Agentic Tool Directive

Every coding or release agent must:

- Inspect the current repository before editing.
- Work only within the approved scope.
- Preserve working architecture.
- Protect vendorId, branchId and terminalId boundaries.
- Protect authentication and licensing.
- Protect stock and financial integrity.
- Record every file created or modified.
- Run validation commands.
- Report errors and unresolved risks.
- Never move an existing release tag.
- Never rewrite published release history.
- Stop after completing the assigned stage.

---

## 14. Principal Release Directive

Semantic Versioning is a controlled chain:

Business requirement
-> Source of Truth
-> Design
-> Development
-> Testing
-> Documentation
-> Commit
-> Branch
-> Tag
-> GitHub Release
-> Deployment
-> Recovery

No SCI release may be published without traceability across this chain.

The official first controlled baseline is:

SCI v0.8.0-alpha.1
Controlled Integration Baseline
