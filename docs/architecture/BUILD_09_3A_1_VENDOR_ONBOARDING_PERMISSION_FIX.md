# Build 09.3A.1 Vendor Onboarding Permission Fix

## Scope

This correction secures and diagnoses the Firebase vendor bootstrap performed by `VendorOnboardingForm`. It covers the atomic vendor/owner membership pair, Phase 2 defaults, duplicate and partial state handling, Firestore mode policy, error categories, project identity, and rules verification.

## Root Cause Evidence

The checked-in onboarding payload succeeds under the checked-in emulator rules when the payload UID is the authenticated UID. Therefore the generic browser `permission-denied` is not caused by the documented payload shape alone.

The client did contain a concrete identity defect: `resolvedUid` preferred the `googleUid` prop over live Firebase Auth. If that prop was stale, both `vendors/{vendorId}` (`ownerUid == request.auth.uid`) and `vendorUsers/{uid}` (`uid == request.auth.uid` and document ID equality) failed. The previous generic error did not log enough safe context to distinguish that mismatch from deployed-rules drift.

The browser environment, `.firebaserc`, emulator configuration, and Firebase CLI all point to `gen-lang-client-0459000055`. Project mismatch is ruled out for this checkout. The deployed rules cannot be claimed current until the tested rules are explicitly approved and deployed.

## Implementation

- `auth.currentUser.uid` and authenticated email are the sole ownership authority.
- The prop UID is only an equality assertion; a mismatch fails with `AUTH_UID_MISMATCH` before Firestore access.
- Missing Auth, Firebase configuration, Firestore, or onboarding write mode fails before writes.
- The operational POS repository mode is not reused for identity bootstrap. Onboarding is an explicit Firebase control-plane write governed by `firebaseSandboxWritesEnabled`; disabled mode resolves to read-only and cannot provision.
- Phase 1 remains one atomic batch containing `vendors/{vendorId}` and `vendorUsers/{uid}`.
- Rules now require both halves through reciprocal `getAfter` checks, so neither can be created alone.
- Narrow deterministic-path `get` access allows a user to inspect only their non-sensitive Phase 1 identity paths. Phase 2 reads remain owner-scoped so a conflicting staff record and its credential fields cannot be exposed.
- Correct duplicate state continues without overwriting. Partial or conflicting Phase 1 state fails safely. Missing Phase 2 records are repaired only after ownership is proven; conflicting records are denied.
- Diagnostics report project ID, authenticated state, Auth UID, resolved UID, vendor ID, mode, operation phase, categorized error, and Firebase error code. Tokens, PINs, and business payloads are not logged.
- User-facing errors map to the required provisioning categories.

## Phase 2

After Phase 1 commits or a correct existing pair is verified, the service checks the deterministic branch, warehouse, owner staff, terminal, demo license, and vendor settings records. Existing records must have the expected document identity and vendor ID. Only missing records are created in a batch. Emulator tests prove Phase 2 is denied before bootstrap and accepted after the owner membership is visible.

## Firestore Rules

`firebase.json` continues to use `firestore.vendor-rooted.rules`. Changes are limited to:

- reciprocal atomic owner bootstrap enforcement;
- self-only deterministic Phase 1 bootstrap existence reads;
- self-only `vendorUsers/{auth.uid}` get access needed to distinguish missing and partial state.

The deny-by-default fallback, tenant ownership, ID consistency, and cross-tenant restrictions remain in place.

## Test Evidence

- `tests/vendorOnboardingAuthority.test.ts`: 11 passing client authority/state tests.
- `tests/firebase/vendorOnboarding.rules.test.ts`: 12 passing emulator rules tests.
- Combined Firestore rules script: 40 passing tests (28 existing plus 12 onboarding).
- POS UI/auth certification: 22 passing tests.
- Sales authority/idempotency regressions: 38 passing tests.
- TypeScript lint and production build pass.
- `npm test` is unavailable because `package.json` has no `test` script; exact relevant Vitest files were run directly.

## Project and Deployment

- Browser project: `gen-lang-client-0459000055`
- `.firebaserc` default: `gen-lang-client-0459000055`
- Firebase CLI active project: `gen-lang-client-0459000055`
- Rules-only dry run: passed
- Rules deployment: not performed; explicit approval is required for the shared-project security change.
- Hosting deployment: not performed.

## Manual Acceptance

Browser acceptance was not performed in this non-interactive terminal session. It remains necessary after the rules deployment to verify sign-out, clean sign-in, both provisioning phases, vendor resolution, license validation, staff entry, refresh without duplication, and logout revocation.

## Completion Decision

BLOCKED
