import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  VendorProvisioningError,
  assertVendorOnboardingAuthority,
  classifyExistingBootstrap,
  expectedVendorId,
  resolveOnboardingWriteMode
} from '../src/sci-auth/VendorOnboardingService';

const user = { uid: 'firebase-user-a', email: 'owner-a@example.test' };
const authority = { uid: user.uid, vendorId: `vendor-${user.uid}` };
const validVendor = (overrides: Record<string, unknown> = {}) => ({
  vendorId: authority.vendorId,
  ownerUid: authority.uid,
  status: 'Active',
  planCode: 'DEMO',
  licenseStatus: 'Trial',
  activationStatus: 'PendingConsoleVerification',
  verificationStatus: 'Pending',
  accountStatus: 'Trial',
  ...overrides
});

function errorCode(run: () => unknown): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return error instanceof VendorProvisioningError ? error.code : 'unexpected';
  }
}

describe('vendor onboarding authority', () => {
  test('signed-out or unresolved Firebase Auth cannot onboard', () => {
    expect(errorCode(() => assertVendorOnboardingAuthority({ currentUser: null, firebaseConfigured: true, firestoreAvailable: true, mode: 'FirestoreReadWrite' }))).toBe('AUTH_NOT_READY');
  });

  test('a stale prop UID cannot replace live Firebase authority', () => {
    expect(errorCode(() => assertVendorOnboardingAuthority({ currentUser: user as never, expectedUid: 'stale-local-user', firebaseConfigured: true, firestoreAvailable: true, mode: 'FirestoreReadWrite' }))).toBe('AUTH_UID_MISMATCH');
  });

  test('authenticated UID determines the vendor document ID', () => {
    const result = assertVendorOnboardingAuthority({ currentUser: user as never, expectedUid: user.uid, firebaseConfigured: true, firestoreAvailable: true, mode: 'FirestoreReadWrite' });
    expect(result).toEqual({ ...user, email: user.email.toLowerCase(), vendorId: `vendor-${user.uid}` });
    expect(expectedVendorId(user.uid)).toBe(`vendor-${user.uid}`);
  });

  test('Firebase must be configured and Firestore available', () => {
    expect(errorCode(() => assertVendorOnboardingAuthority({ currentUser: user as never, firebaseConfigured: false, firestoreAvailable: true, mode: 'FirestoreReadWrite' }))).toBe('FIREBASE_NOT_CONFIGURED');
    expect(errorCode(() => assertVendorOnboardingAuthority({ currentUser: user as never, firebaseConfigured: true, firestoreAvailable: false, mode: 'FirestoreReadWrite' }))).toBe('FIREBASE_NOT_CONFIGURED');
  });

  test('read-only and local repository modes never provision', () => {
    for (const mode of ['FirestoreReadOnly', 'FirestoreDisabled', 'MockLocal', 'LocalStorage'] as const) {
      expect(errorCode(() => assertVendorOnboardingAuthority({ currentUser: user as never, firebaseConfigured: true, firestoreAvailable: true, mode }))).toBe('FIREBASE_NOT_CONFIGURED');
    }
    expect(resolveOnboardingWriteMode(false)).toBe('FirestoreReadOnly');
    expect(resolveOnboardingWriteMode(true)).toBe('FirestoreReadWrite');
  });

  test('a correct existing vendor and owner pair resolves safely', () => {
    expect(classifyExistingBootstrap({
      vendor: validVendor(),
      vendorUser: { uid: authority.uid, vendorId: authority.vendorId, role: 'Owner', status: 'active' }
    }, authority)).toBe('correct');
  });

  test('a conflicting existing vendor is denied', () => {
    expect(errorCode(() => classifyExistingBootstrap({
      vendor: validVendor({ ownerUid: 'other-user' }),
      vendorUser: { uid: authority.uid, vendorId: authority.vendorId, role: 'Owner', status: 'active' }
    }, authority))).toBe('EXISTING_VENDOR_CONFLICT');
  });

  test('a conflicting vendorUser is denied', () => {
    expect(errorCode(() => classifyExistingBootstrap({
      vendor: validVendor(),
      vendorUser: { uid: authority.uid, vendorId: 'vendor-other', role: 'Owner', status: 'active' }
    }, authority))).toBe('EXISTING_VENDOR_USER_CONFLICT');
  });

  test('either incomplete bootstrap state is recoverable but not overwritten', () => {
    expect(errorCode(() => classifyExistingBootstrap({ vendor: validVendor() }, authority))).toBe('PROVISIONING_PARTIAL_STATE');
    expect(errorCode(() => classifyExistingBootstrap({ vendorUser: { uid: authority.uid, vendorId: authority.vendorId, role: 'Owner', status: 'active' } }, authority))).toBe('PROVISIONING_PARTIAL_STATE');
  });

  test('browser storage is not referenced as an identity authority', () => {
    const service = readFileSync(resolve('src/sci-auth/VendorOnboardingService.ts'), 'utf8');
    expect(service).toContain('auth?.currentUser');
    expect(service).not.toMatch(/localStorage\.getItem|sessionStorage\.getItem/);
  });

  test('Phase 2 is sequenced after the Phase 1 commit', () => {
    const service = readFileSync(resolve('src/sci-auth/VendorOnboardingService.ts'), 'utf8');
    expect(service.indexOf('await phase1.commit()')).toBeGreaterThan(-1);
    expect(service.indexOf('const phase2Entries')).toBeGreaterThan(service.indexOf('await phase1.commit()'));
  });
});
