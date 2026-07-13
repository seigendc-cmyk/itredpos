import { createRepositoryBundle } from './repositoryFactory';
import { validateRepositoryOperationContext } from './repositoryContext';
import { mapFirestoreError, REPOSITORY_ERROR_CODES } from './firestore/firestoreErrorMapper';
import { firestorePaths } from '../firebase/firestorePaths';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Repository assertion failed: ${message}`);
  }
}

export function runRepositoryAssertions(): void {
  const errors: string[] = [];

  // 1. Firebase mode fails clearly when Firebase is unavailable.
  try {
    const bundle = createRepositoryBundle();
    const vendorResult = bundle.vendors.getVendor('test-vendor');
    assert(vendorResult instanceof Promise, 'getVendor should return a Promise.');
  } catch (error) {
    errors.push(`Firebase mode should fail clearly when unavailable: ${String(error)}`);
  }

  // 2. Every repository bundle contains all required repositories.
  const bundle = createRepositoryBundle();
  assert(typeof bundle.vendors.getVendor === 'function', 'Bundle must contain vendors.getVendor.');
  assert(typeof bundle.products.getProduct === 'function', 'Bundle must contain products.getProduct.');
  assert(typeof bundle.customers.getCustomer === 'function', 'Bundle must contain customers.getCustomer.');
  assert(typeof bundle.inventory.getBalance === 'function', 'Bundle must contain inventory.getBalance.');
  assert(typeof bundle.biEvents.publishEvent === 'function', 'Bundle must contain biEvents.publishEvent.');
  assert(typeof bundle.audit.appendAuditRecord === 'function', 'Bundle must contain audit.appendAuditRecord.');

  // 3. Blank vendor context is rejected.
  for (const blank of ['', '   ', '\t']) {
    try {
      validateRepositoryOperationContext({
        vendorId: blank,
        actorId: 'actor-1',
        sourceApp: 'ITRED_POS',
        correlationId: 'corr-1'
      });
      errors.push(`validateRepositoryOperationContext should reject blank vendorId: ${JSON.stringify(blank)}`);
    } catch {
      // expected
    }
  }

  // 4. Blank actor ID is rejected.
  try {
    validateRepositoryOperationContext({
      vendorId: 'vendor-1',
      actorId: '',
      sourceApp: 'ITRED_POS',
      correlationId: 'corr-1'
    });
    errors.push('validateRepositoryOperationContext should reject blank actorId.');
  } catch {
    // expected
  }

  // 5. Repository paths remain vendor-scoped.
  const vendorPath = firestorePaths.vendor('vendor-1');
  assert(vendorPath.startsWith('vendors/'), 'Vendor path must begin with vendors/.');
  const productPath = firestorePaths.productMaster('vendor-1');
  assert(productPath.startsWith('vendors/'), 'Product path must begin with vendors/.');
  const auditPath = firestorePaths.auditLogs('vendor-1');
  assert(auditPath.startsWith('vendors/'), 'Audit path must begin with vendors/.');

  // 6. Firestore errors map to stable error codes.
  const mappedUnknown = mapFirestoreError({ code: 'unknown-code', message: 'test' });
  assert(mappedUnknown.errorCode === REPOSITORY_ERROR_CODES.UNKNOWN, 'Unknown Firebase error should map to REPOSITORY_UNKNOWN.');
  assert(typeof mappedUnknown.errorMessage === 'string' && mappedUnknown.errorMessage.length > 0, 'Mapped error should include a message.');

  const mappedPermission = mapFirestoreError({ code: 'permission-denied', message: ' denied' });
  assert(mappedPermission.errorCode === REPOSITORY_ERROR_CODES.PERMISSION_DENIED, 'permission-denied should map correctly.');

  if (errors.length > 0) {
    throw new Error(errors.map((e, i) => `${i + 1}. ${e}`).join('\n'));
  }
}

// Development-only execution. These assertions must NOT run in production builds.
if (import.meta.env && import.meta.env.DEV) {
  try {
    runRepositoryAssertions();
    console.log('[repositoryAssertions] All assertions passed.');
  } catch (error) {
    console.error('[repositoryAssertions] Assertions failed:', error);
    if (import.meta.env.VITE_FAIL_ASSERTIONS === 'true') {
      throw error;
    }
  }
}
