# Commerce Security SOT v1.0

## Purpose

Security is a foundational service of the seiGEN Commerce Operating System.

Every application must enforce tenant isolation, role-based access control, device trust, and auditability.

Applications include:

- iTredPOS
- iDeliver
- Vendor Discovery
- Console
- Licensing
- Commerce BI

---

## Security Principles

1. Every request is authenticated.
2. Every action is authorized.
3. Every critical action is audited.
4. Every tenant is isolated.
5. Least privilege applies to every user.
6. No application bypasses the security layer.

---

## Authentication

Supported authentication providers:

- Google
- Email & Password
- Future Enterprise Identity Providers

Users authenticate once and receive access only to authorized tenants.

---

## Authorization

Authorization is role-based.

Permissions may exist at:

- Vendor level
- Branch level
- Warehouse level
- Terminal level
- Module level
- Feature level

---

## Device Trust

Every POS terminal should be registered.

Device records should include:

terminalId

deviceId

deviceName

operatingSystem

applicationVersion

lastSeen

status

---

## Tenant Isolation

Every operational record must belong to one vendorId.

Users may never access another tenant's operational records.

Firestore security rules must enforce this isolation.

---

## Sensitive Operations

Require elevated permissions:

- Refunds
- Discount overrides
- Price overrides
- License activation
- Stock adjustments
- Stock transfers
- Product transformation approval
- Role management
- User management
- Branch creation
- Warehouse creation

---

## Audit Requirements

Every sensitive action must produce:

- Audit record
- Commerce event
- Risk score

---

## Future Security

Planned enhancements:

- MFA
- Device attestation
- API keys
- OAuth service accounts
- Security anomaly detection
- Login risk scoring

---

## Build Rule

Every new feature must define:

- authentication requirement
- authorization requirement
- audit requirement
- event requirement
- risk classification

before implementation.
