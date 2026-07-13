# SCI Coding Standard SOT

**Owner:** Digital Commerce (Private) Limited  
**Status:** Controlled Source of Truth  

## Principles

SCI code must be:

- Readable.
- Strongly typed.
- Modular.
- Testable.
- Auditable.
- Secure.
- Tenant-aware.

## Separation requirements

Separate:

- User interface.
- Business logic.
- Validation.
- Domain services.
- Repository interfaces.
- Database implementations.
- Reporting.
- Security checks.

## Tenant rules

Every tenant-scoped operation must enforce vendorId.

Branch-scoped operations must enforce branchId.

Terminal-scoped operations must enforce terminalId.

## TypeScript rules

- Avoid uncontrolled use of any.
- Use explicit interfaces.
- Validate external data.
- Handle loading, empty, success and failure states.
- Do not silently ignore errors.
