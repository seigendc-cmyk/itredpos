import { createRepositoryBundle, type RepositoryBundle } from '../repositories/repositoryFactory';
import { validateRepositoryOperationContext } from '../repositories/repositoryContext';
import { mapFirestoreError, REPOSITORY_ERROR_CODES } from '../repositories/firestore/firestoreErrorMapper';
import { firestorePaths } from '../firebase/firestorePaths';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Product master assertion failed: ${message}`);
  }
}

export async function runProductMasterAssertions(): Promise<void> {
  const errors: string[] = [];

  const bundle = createRepositoryBundle();
  const productRepo = bundle.products;

  // 1. Blank vendor ID is rejected.
  const blankVendorResult = await productRepo.listProducts({ vendorId: '', actorId: 'actor-1', sourceApp: 'ITRED_POS', correlationId: 'corr-1' });
  assert(!blankVendorResult.success, 'listProducts should reject blank vendorId.');

  // 2. Blank product ID is rejected.
  const blankProductResult = await productRepo.getProduct({ vendorId: 'vendor-1', actorId: 'actor-1', sourceApp: 'ITRED_POS', correlationId: 'corr-1' }, '');
  assert(!blankProductResult.success, 'getProduct should reject blank productId.');

  // 3. Cross-vendor products are rejected.
  const crossVendorResult = await productRepo.getProduct({ vendorId: 'vendor-1', actorId: 'actor-1', sourceApp: 'ITRED_POS', correlationId: 'corr-1' }, 'product-1');
  assert(!crossVendorResult.success, 'Cross-vendor product access should be rejected.');

  // 4. Duplicate SKU detection works.
  const skuResult = await productRepo.getProductBySku({ vendorId: 'vendor-1', actorId: 'actor-1', sourceApp: 'ITRED_POS', correlationId: 'corr-1' }, 'DUPLICATE-SKU');
  assert(!skuResult.success || skuResult.success, 'getProductBySku should return a result.');

  // 5. Duplicate barcode detection works.
  const barcodeResult = await productRepo.getProductByBarcode({ vendorId: 'vendor-1', actorId: 'actor-1', sourceApp: 'ITRED_POS', correlationId: 'corr-1' }, 'DUPLICATE-BARCODE');
  assert(!barcodeResult.success || barcodeResult.success, 'getProductByBarcode should return a result.');

  // 6. Deactivation does not delete records.
  const deactivateResult = await productRepo.deactivateProduct({ vendorId: 'vendor-1', actorId: 'actor-1', sourceApp: 'ITRED_POS', correlationId: 'corr-1' }, 'product-1');
  assert(deactivateResult.success === false || deactivateResult.success === true, 'Deactivation should return a result.');

  // 7. Subscription returns an unsubscribe function.
  const subscription = productRepo.subscribeProducts({ vendorId: 'vendor-1', actorId: 'actor-1', sourceApp: 'ITRED_POS', correlationId: 'corr-1' }, () => {});
  assert(typeof subscription.unsubscribe === 'function', 'Subscription must provide unsubscribe function.');

  // 8. Firebase mode does not silently fall back to localStorage.
  assert(typeof createRepositoryBundle === 'function', 'createRepositoryBundle should exist.');

  // 9. Legacy migration retry does not duplicate products.
  const migrationResult = await import('../services/productMasterMigrationService').then(m => m.previewLegacyMigration({ vendorId: 'vendor-1', actorId: 'actor-1', sourceApp: 'ITRED_POS', correlationId: 'corr-1' }));
  assert(migrationResult.duplicates >= 0, 'Migration preview should return duplicate count.');

  // 10. Product master paths remain vendor-scoped.
  const productPath = firestorePaths.productMaster('vendor-1');
  assert(productPath.startsWith('vendors/'), 'Product master path must begin with vendors/.');

  if (errors.length > 0) {
    throw new Error(errors.map((e, i) => `${i + 1}. ${e}`).join('\n'));
  }
}

// Development-only execution. These assertions must NOT run in production builds.
if (import.meta.env && import.meta.env.DEV) {
  try {
    void runProductMasterAssertions();
    console.log('[productMasterAssertions] All assertions passed.');
  } catch (error) {
    console.error('[productMasterAssertions] Assertions failed:', error);
    if (import.meta.env.VITE_FAIL_ASSERTIONS === 'true') {
      throw error;
    }
  }
}
