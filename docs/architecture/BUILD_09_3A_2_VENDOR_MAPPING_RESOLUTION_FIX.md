# Build 09.3A.2 — Canonical Vendor Mapping Resolution

Date: 2026-07-18

## Scope and repository state

This change was implemented on branch `fix/vendor-onboarding-permission-denied` at base commit `0aa9e6b`. The working tree already contained the uncommitted Build 09.3A.1 onboarding/rules work; it was preserved and validated together with this fix.

No commit, push, Firestore rules deployment, or hosting deployment was performed.

## Confirmed failure and root cause

`VendorAuthGate.tsx` performed this normal-path read first:

```ts
getDocs(query(collection(db, "vendors"), where("ownerUid", "==", uid), limit(1)))
```

It then attempted an owner-email query as fallback. The first operation was a Firestore collection `list`/query, not an exact document `get`. The deployed vendor list rule required every possible returned document to satisfy tenant ownership and also included `validId(vendorId)`. Firestore rules are not post-query filters, and the query could not prove the document-ID predicate. Firestore therefore returned `permission-denied`, which the old gate collapsed into `POS ACCESS BLOCKED`.

The canonical `vendorUsers/{uid}` mapping created during onboarding was not being used by the gate.

## Implemented resolution path

The runtime path is now:

1. Wait for the Firebase Auth observer callback.
2. Require the live `auth.currentUser` and assert its UID matches the callback/profile UID.
3. `getDoc(vendorUsers/{uid})`.
4. If absent, return typed `VENDOR_USER_NOT_FOUND` and route to onboarding.
5. Validate mapping UID, active status, and non-empty vendor ID.
6. `getDoc(vendors/{vendorId})`.
7. Validate the mapped vendor, owner UID, active status, and vendor ID. Legacy vendor documents may omit the redundant `vendorId` field; their exact document ID remains authoritative.
8. Save the certified owner session, then begin license validation.

The same exact-document resolver is used for restored browser sessions, both Google entry buttons, onboarding completion, and the legacy `VendorFirebaseService` entry point. No vendor collection query remains in `src/sci-auth`.

Typed blocked outcomes distinguish auth state, inactive/conflicting mappings, missing mapped vendors, ownership conflicts, permission denial, Firebase project mismatch, network failure, and unknown failures. Permission denial never routes to onboarding. Development diagnostics contain only project ID, auth UID, exact path, `getDoc`, outcome, and error code.

## Firestore rules change

The Build 09.3A.2 read change is:

```rules
match /vendorUsers/{uid} {
  allow get: if signedIn() && uid == request.auth.uid;
  allow list: if false;
}
```

This lets a signed-in user distinguish an absent own mapping from a denied read. Application code validates mapping activity before granting access. Reads of another user's mapping and all mapping collection listing remain denied.

Vendor collection listing is now explicitly denied because normal resolution no longer requires discovery:

```rules
match /vendors/{vendorId} {
  allow get: if /* existing exact-document tenant checks */;
  allow list: if false;
}
```

This is a security tightening: it does not grant broader vendor visibility. The other rules changes in the working diff belong to the preceding Build 09.3A.1 atomic onboarding work.

## Test evidence

- `npm run lint`: passed.
- `npm run build`: passed; existing Vite chunk-size/dynamic-import warnings remain non-fatal.
- `npm run test:vendor-auth-resolution`: 10/10 passed.
- `npm run test:vendor-onboarding-authority`: 11/11 passed.
- `npm run test:pos-ui-auth`: 22/22 passed.
- `npm run test:firestore-rules`: passed under the Firestore emulator (43 tests: 28 existing rules tests and 15 onboarding/mapping tests).
- Sales authority/idempotency regression: 38/38 passed across four test files.
- `git diff --check`: passed (Git reported only line-ending conversion notices, not whitespace errors).

The tests prove exact own-mapping reads, missing-mapping onboarding routing, inactive/conflicting mapping rejection, exact mapped-vendor resolution, legacy missing-field compatibility, partial-state rejection, owner conflict rejection, deterministic refresh behavior, permission/network classification, license ordering, self-only mapping reads, denied mapping/vendor listing, and cross-tenant exact-read denial.

## Deployment and browser acceptance

Firestore rules were not deployed because explicit deployment approval has not been given. Hosting was not deployed. Consequently, the production-project browser acceptance sequence at `/pos-prototype` has not been rerun against these rules, and reaching Staff Access cannot yet be certified from this workspace.

## Completion Status

BLOCKED
