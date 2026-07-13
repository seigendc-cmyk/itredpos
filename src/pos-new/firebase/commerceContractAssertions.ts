import {
  firestoreCollectionNames,
  firestorePaths,
  encodeFirestoreId
} from './firestorePaths';
import { COMMERCE_SCHEMA_VERSION, type CommerceSourceApp, type SharedCommerceDocument } from './commerceDataContract';
import { collectionGovernanceRules } from './collectionGovernance';
import {
  validateVendorId,
  validateTenantScope,
  validateSharedDocument,
  type CommerceValidationResult
} from './commerceContractValidation';

const REQUIRED_COLLECTION_NAMES = [
  'warehouses',
  'shifts',
  'cashDrawers',
  'marketplaceListings',
  'marketplaceOrders',
  'marketplaceOrderLines',
  'marketplaceCategories',
  'marketplaceEnquiries',
  'customerAddresses',
  'customerInteractions',
  'vendorAppAccess',
  'integrationEvents'
];

const REQUIRED_PATH_HELPERS: Array<{ name: string; args: number; expectsVendorPrefix: boolean }> = [
  { name: 'warehouses', args: 1, expectsVendorPrefix: true },
  { name: 'warehouse', args: 2, expectsVendorPrefix: true },
  { name: 'shifts', args: 1, expectsVendorPrefix: true },
  { name: 'shift', args: 2, expectsVendorPrefix: true },
  { name: 'cashDrawers', args: 1, expectsVendorPrefix: true },
  { name: 'cashDrawer', args: 2, expectsVendorPrefix: true },
  { name: 'marketplaceListings', args: 1, expectsVendorPrefix: true },
  { name: 'marketplaceListing', args: 2, expectsVendorPrefix: true },
  { name: 'marketplaceOrders', args: 1, expectsVendorPrefix: true },
  { name: 'marketplaceOrder', args: 2, expectsVendorPrefix: true },
  { name: 'marketplaceOrderLines', args: 1, expectsVendorPrefix: true },
  { name: 'marketplaceCategories', args: 1, expectsVendorPrefix: true },
  { name: 'marketplaceEnquiries', args: 1, expectsVendorPrefix: true },
  { name: 'customerAddresses', args: 1, expectsVendorPrefix: true },
  { name: 'customerInteractions', args: 1, expectsVendorPrefix: true },
  { name: 'vendorAppAccess', args: 1, expectsVendorPrefix: true },
  { name: 'integrationEvents', args: 1, expectsVendorPrefix: true }
];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Commerce contract assertion failed: ${message}`);
  }
}

export function runCommerceContractAssertions(): void {
  const errors: string[] = [];

  for (const name of REQUIRED_COLLECTION_NAMES) {
    if (!(name in firestoreCollectionNames)) {
      errors.push(`Missing collection name: ${name}`);
    }
  }

  for (const helper of REQUIRED_PATH_HELPERS) {
    const pathHelper = (firestorePaths as unknown as Record<string, (...args: unknown[]) => string>)[helper.name];
    if (typeof pathHelper !== 'function') {
      errors.push(`Missing path helper: ${helper.name}`);
      continue;
    }

    const args: unknown[] = helper.args === 1 ? ['vendor-1'] : ['vendor-1', 'id-1'];
    try {
      const path = pathHelper(...args);
      if (helper.expectsVendorPrefix && !path.startsWith(`vendors/${encodeFirestoreId('vendor-1')}/`)) {
        errors.push(`Path helper ${helper.name} does not return vendor-scoped path: ${path}`);
      }
    } catch {
      errors.push(`Path helper ${helper.name} threw for args: ${JSON.stringify(args)}`);
    }
  }

  const vendorPaths = [
    firestorePaths.vendor('vendor-1'),
    firestorePaths.warehouses('vendor-1'),
    firestorePaths.marketplaceOrders('vendor-1'),
    firestorePaths.integrationEvents('vendor-1')
  ];
  for (const path of vendorPaths) {
    if (!path.includes('/vendors/vendor-1/')) {
      errors.push(`Vendor-scoped path omits vendors prefix: ${path}`);
    }
  }

  try {
    validateVendorId('');
    errors.push('validateVendorId should reject blank string');
  } catch {
    // expected
  }

  try {
    validateVendorId('   ');
    errors.push('validateVendorId should reject whitespace-only string');
  } catch {
    // expected
  }

  try {
    validateTenantScope({ vendorId: '' } as Parameters<typeof validateTenantScope>[0]);
    errors.push('validateTenantScope should reject blank vendorId');
  } catch {
    // expected
  }

  try {
    validateSharedDocument({
      vendorId: 'vendor-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      createdBy: '',
      updatedBy: 'user-1',
      sourceApp: 'ITRED_POS',
      schemaVersion: 1,
      status: 'Active'
    } as unknown as SharedCommerceDocument);
    errors.push('validateSharedDocument should reject blank createdBy');
  } catch {
    // expected
  }

  try {
    validateSharedDocument({
      vendorId: 'vendor-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      createdBy: 'user-1',
      updatedBy: 'user-1',
      sourceApp: '',
      schemaVersion: 1,
      status: 'Active'
    } as unknown as SharedCommerceDocument);
    errors.push('validateSharedDocument should reject blank sourceApp');
  } catch {
    // expected
  }

  try {
    validateSharedDocument({
      vendorId: 'vendor-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      createdBy: 'user-1',
      updatedBy: 'user-1',
      sourceApp: 'ITRED_POS',
      schemaVersion: 2,
      status: 'Active'
    } as unknown as SharedCommerceDocument);
    errors.push('validateSharedDocument should reject invalid schemaVersion');
  } catch {
    // expected
  }

  if (COMMERCE_SCHEMA_VERSION !== 1) {
    errors.push('COMMERCE_SCHEMA_VERSION must be 1');
  }

  if (collectionGovernanceRules.length === 0) {
    errors.push('collectionGovernanceRules must not be empty');
  }

  if (errors.length > 0) {
    throw new Error(errors.map((e, i) => `${i + 1}. ${e}`).join('\n'));
  }
}

if (import.meta.env.DEV) {
  try {
    runCommerceContractAssertions();
    console.log('[commerceContractAssertions] All assertions passed.');
  } catch (error) {
    console.error('[commerceContractAssertions] Assertions failed:', error);
    if (import.meta.env.VITE_FAIL_ASSERTIONS === 'true') {
      throw error;
    }
  }
}
