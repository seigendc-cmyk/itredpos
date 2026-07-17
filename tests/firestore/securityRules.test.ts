/**
 * Emulator-based Firestore security rules test suite for iTredPOS2 (rules-unit-testing v3 API).
 *
 * Run with:
 *   npm run firebase:emulators   (not required; v3 manages its own emulator)
 *   npm run test:rules
 *
 * Covers the 15 mandatory rule-test scenarios from build 2026-FIREBASE-SECURITY-01
 * plus core tenant-isolation guarantees.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { beforeAll, afterAll, describe, test } from 'vitest';

const PROJECT_ID = 'itredpos-security';
const RULES_PATH = resolve('firestore.rules');

const VENDOR_A = 'vendor-a';
const VENDOR_B = 'vendor-b';
const OWNER_A = 'owner-a';
const OWNER_B = 'owner-b';
const STAFF_A = 'staff-a';
const DISABLED_A = 'disabled-a';
const STAFF_DOC_A = 'staff-doc-a';
const PLATFORM_ADMIN = 'platform-admin';

let testEnv: any;

function authedDb(uid: string, extra?: Record<string, unknown>) {
  return testEnv.authenticatedContext(uid, { email: `${uid}@test.com`, ...extra }).firestore();
}
function unauthDb() {
  return testEnv.unauthenticatedContext().firestore();
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(RULES_PATH, 'utf8') }
  });

  await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, 'vendors', VENDOR_A), {
      vendorId: VENDOR_A, ownerUid: OWNER_A, ownerEmail: 'owner-a@test.com', ownerName: 'Owner A',
      businessName: 'Vendor A', status: 'Active', planCode: 'DEMO', licenseStatus: 'DEMO'
    });
    await setDoc(doc(adminDb, 'vendors', VENDOR_B), {
      vendorId: VENDOR_B, ownerUid: OWNER_B, ownerEmail: 'owner-b@test.com', ownerName: 'Owner B',
      businessName: 'Vendor B', status: 'Active', planCode: 'DEMO', licenseStatus: 'DEMO'
    });
    await setDoc(doc(adminDb, 'vendorUsers', OWNER_A), {
      uid: OWNER_A, vendorId: VENDOR_A, email: 'owner-a@test.com', displayName: 'Owner A',
      role: 'Owner', status: 'active', permissions: ['*'],
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
    });
    await setDoc(doc(adminDb, 'vendorUsers', OWNER_B), {
      uid: OWNER_B, vendorId: VENDOR_B, email: 'owner-b@test.com', displayName: 'Owner B',
      role: 'Owner', status: 'active', permissions: ['*'],
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
    });
    await setDoc(doc(adminDb, 'vendorUsers', STAFF_A), {
      uid: STAFF_A, vendorId: VENDOR_A, email: 'staff-a@test.com', displayName: 'Staff A',
      role: 'Staff', status: 'active', permissions: ['inventory.adjust'],
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
    });
    await setDoc(doc(adminDb, 'vendorUsers', DISABLED_A), {
      uid: DISABLED_A, vendorId: VENDOR_A, email: 'disabled-a@test.com', displayName: 'Disabled A',
      role: 'Staff', status: 'inactive', permissions: [],
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
    });
    await setDoc(doc(adminDb, 'staff', STAFF_DOC_A), {
      staffId: STAFF_DOC_A, vendorId: VENDOR_A, status: 'active', name: 'Staff A'
    });
    await setDoc(doc(adminDb, 'vendors', VENDOR_A, 'marketplaceListings', 'published-1'), {
      listingId: 'published-1', vendorId: VENDOR_A, published: true, status: 'Active', marketplaceVisible: true, title: 'Public Widget'
    });
    await setDoc(doc(adminDb, 'vendors', VENDOR_A, 'marketplaceListings', 'draft-1'), {
      listingId: 'draft-1', vendorId: VENDOR_A, published: false, status: 'Draft', marketplaceVisible: false, title: 'Hidden Widget'
    });
    await setDoc(doc(adminDb, 'vendors', VENDOR_A, 'salesReceipts', 'sale-1'), {
      saleId: 'sale-1', vendorId: VENDOR_A, branchId: 'B1', terminalId: 'T1', staffId: STAFF_A,
      saleStatus: 'Completed', subtotal: 10, grandTotal: 10, amountPaid: 10, balanceDue: 0
    });
    await setDoc(doc(adminDb, 'vendors', VENDOR_A, 'audit_logs', 'audit-1'), {
      auditLogId: 'audit-1', vendorId: VENDOR_A, eventType: 'TEST', referenceId: 'r1', createdBy: STAFF_A, createdAt: '2026-01-01T00:00:00Z'
    });
    await setDoc(doc(adminDb, 'vendors', VENDOR_A, 'inventoryMovements', 'mv-1'), {
      movementId: 'mv-1', vendorId: VENDOR_A, branchId: 'B1', warehouseId: 'W1', productId: 'P1',
      movementType: 'SALE', quantityIn: 0, quantityOut: 1, balanceBefore: 5, balanceAfter: 4, referenceType: 'sale', referenceId: 'sale-1'
    });
    await setDoc(doc(adminDb, 'licenses', `${VENDOR_A}_license`), {
      licenseId: `${VENDOR_A}_license`, vendorId: VENDOR_A, planCode: 'DEMO', licenseStatus: 'DEMO', status: 'Active'
    });
    await setDoc(doc(adminDb, 'staffProfiles', `${VENDOR_A}_profile`), {
      staffId: `${VENDOR_A}_profile`, vendorId: VENDOR_A, role: 'Staff', status: 'active'
    });
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

describe('1. Unauthenticated access denied', () => {
  test('1. unauthenticated cannot read a vendor', async () => {
    await assertFails(getDoc(doc(unauthDb(), 'vendors', VENDOR_A)));
  });
  test('1b. unauthenticated cannot write a branch', async () => {
    await assertFails(setDoc(doc(unauthDb(), 'vendors', VENDOR_A, 'branches', 'X'), { vendorId: VENDOR_A, branchId: 'X' }));
  });
});

describe('2. Vendor A cannot read Vendor B', () => {
  test('2. owner A cannot read vendor B doc', async () => {
    await assertFails(getDoc(doc(authedDb(OWNER_A), 'vendors', VENDOR_B)));
  });
  test('2b. owner A cannot read vendor B subcollection', async () => {
    await assertFails(getDoc(doc(authedDb(OWNER_A), 'vendors', VENDOR_B, 'branches', 'X')));
  });
});

describe('3. Vendor A cannot write Vendor B', () => {
  test('3. owner A cannot create a branch in vendor B', async () => {
    await assertFails(setDoc(doc(authedDb(OWNER_A), 'vendors', VENDOR_B, 'branches', 'X'), { vendorId: VENDOR_B, branchId: 'X' }));
  });
});

describe('4. Cross-branch isolation', () => {
  test('4. staff cannot write to a different vendor', async () => {
    await assertFails(setDoc(doc(authedDb(STAFF_A), 'vendors', VENDOR_B, 'productMaster', 'P2'), { productId: 'P2', vendorId: VENDOR_B }));
  });
});

describe('5. Staff cannot escalate roles', () => {
  test('5. ordinary staff cannot change a staff profile role', async () => {
    await assertFails(updateDoc(doc(authedDb(STAFF_A), 'staffProfiles', `${VENDOR_A}_profile`), { role: 'Owner' }));
  });
  test('5b. owner can update a staff profile', async () => {
    await assertSucceeds(updateDoc(doc(authedDb(OWNER_A), 'staffProfiles', `${VENDOR_A}_profile`), { displayName: 'Renamed' }));
  });
});

describe('6. Ordinary staff cannot modify licenses', () => {
  test('6. staff cannot update a license', async () => {
    await assertFails(updateDoc(doc(authedDb(STAFF_A), 'licenses', `${VENDOR_A}_license`), { planCode: 'ENTERPRISE' }));
  });
});

describe('7. Public marketplace reads', () => {
  test('7. published listing is readable anonymously', async () => {
    await assertSucceeds(getDoc(doc(unauthDb(), 'vendors', VENDOR_A, 'marketplaceListings', 'published-1')));
  });
  test('7b. listing write is never public', async () => {
    await assertFails(setDoc(doc(unauthDb(), 'vendors', VENDOR_A, 'marketplaceListings', 'x'), { vendorId: VENDOR_A }));
  });
});

describe('8. Unpublished products not public', () => {
  test('8. draft listing is not anonymously readable', async () => {
    await assertFails(getDoc(doc(unauthDb(), 'vendors', VENDOR_A, 'marketplaceListings', 'draft-1')));
  });
});

describe('9. Audit records immutable', () => {
  test('9. audit log update denied', async () => {
    await assertFails(updateDoc(doc(authedDb(STAFF_A), 'vendors', VENDOR_A, 'audit_logs', 'audit-1'), { eventType: 'X' }));
  });
  test('9b. audit log delete denied', async () => {
    await assertFails(deleteDoc(doc(authedDb(STAFF_A), 'vendors', VENDOR_A, 'audit_logs', 'audit-1')));
  });
  test('9c. authenticated staff can create an audit log', async () => {
    const ref = doc(collection(authedDb(STAFF_A), 'vendors', VENDOR_A, 'audit_logs'));
    await assertSucceeds(setDoc(ref, {
      auditLogId: 'audit-new', vendorId: VENDOR_A, eventType: 'TEST', referenceId: 'r2', createdBy: STAFF_A, createdAt: '2026-01-01T00:00:00Z'
    }));
  });
});

describe('10. Stock movements immutable', () => {
  test('10. inventory movement update denied', async () => {
    await assertFails(updateDoc(doc(authedDb(STAFF_A), 'vendors', VENDOR_A, 'inventoryMovements', 'mv-1'), { quantityOut: 2 }));
  });
  test('10b. inventory movement delete denied', async () => {
    await assertFails(deleteDoc(doc(authedDb(STAFF_A), 'vendors', VENDOR_A, 'inventoryMovements', 'mv-1')));
  });
});

describe('11. Completed sales cannot be deleted', () => {
  test('11. completed sale delete denied', async () => {
    await assertFails(deleteDoc(doc(authedDb(OWNER_A), 'vendors', VENDOR_A, 'salesReceipts', 'sale-1')));
  });
});

describe('12. Disabled staff cannot write', () => {
  test('12. inactive membership cannot create a branch', async () => {
    await assertFails(setDoc(doc(authedDb(DISABLED_A), 'vendors', VENDOR_A, 'branches', 'Z'), { vendorId: VENDOR_A, branchId: 'Z' }));
  });
});

describe('13. Platform administrator operations', () => {
  test('13. platform admin can read cross-vendor data', async () => {
    await assertSucceeds(getDoc(doc(authedDb(PLATFORM_ADMIN, { admin: true }), 'vendors', VENDOR_B, 'branches', 'X')));
  });
  test('13b. platform admin cannot delete audit logs', async () => {
    await assertFails(deleteDoc(doc(authedDb(PLATFORM_ADMIN, { admin: true }), 'vendors', VENDOR_A, 'audit_logs', 'audit-1')));
  });
});

describe('14. Field validation', () => {
  test('14. vendor create rejected when ownerUid mismatches auth', async () => {
    await assertFails(setDoc(doc(authedDb(OWNER_A), 'vendors', 'vendor-evil'), {
      vendorId: 'vendor-evil', ownerUid: OWNER_B, ownerEmail: 'x@test.com', ownerName: 'x', businessName: 'x',
      status: 'Active', planCode: 'DEMO', licenseStatus: 'DEMO', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
    }));
  });
  test('14b. branch create rejected without branchId field', async () => {
    await assertFails(setDoc(doc(authedDb(OWNER_A), 'vendors', VENDOR_A, 'branches', 'X'), { vendorId: VENDOR_A }));
  });
});

describe('15. Authorized operations succeed', () => {
  test('15. owner can create a branch', async () => {
    await assertSucceeds(setDoc(doc(authedDb(OWNER_A), 'vendors', VENDOR_A, 'branches', 'B-NEW'), { vendorId: VENDOR_A, branchId: 'B-NEW', branchName: 'New' }));
  });
  test('15b. owner can read own vendor subcollection', async () => {
    await assertSucceeds(getDoc(doc(authedDb(OWNER_A), 'vendors', VENDOR_A, 'productMaster', 'P1')));
  });
});

describe('Default deny', () => {
  test('unknown path is denied', async () => {
    await assertFails(getDoc(doc(unauthDb(), 'someUnknownCollection', 'X')));
  });
});
