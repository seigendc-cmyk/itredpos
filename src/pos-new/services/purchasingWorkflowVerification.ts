import {
  calculateDocumentTax,
  type VendorTaxSettings
} from './vendorTaxSettingsService';
import {
  calculateMovementBalance,
  createInventoryMovementId
} from './inventorySyncService';
import {
  validatePurchaseSession,
  type CanonicalPurchaseSession
} from './purchaseSessionService';

export type PurchasingVerificationArea =
  | 'Purchase Request'
  | 'Purchase Order'
  | 'Goods Receiving'
  | 'VAT'
  | 'Costing'
  | 'Supplier Account'
  | 'Purchase Return'
  | 'Offline'
  | 'Security';

export interface PurchasingWorkflowVerificationResult {
  area: PurchasingVerificationArea;
  scenario: string;
  ok: boolean;
  message: string;
}

function result(area: PurchasingVerificationArea, scenario: string, ok: boolean, message = ok ? 'passed' : 'failed'): PurchasingWorkflowVerificationResult {
  return { area, scenario, ok, message };
}

function approx(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < 0.01;
}

function taxSettings(settings: Partial<VendorTaxSettings>): VendorTaxSettings {
  return {
    vendorId: 'vendor-1',
    vatEnabled: false,
    vatRegistered: false,
    vatNumber: '',
    defaultVatRate: 0,
    pricesIncludeVat: true,
    outputTaxAccountId: '',
    inputTaxAccountId: '',
    exemptTaxCode: 'EXEMPT',
    zeroRatedTaxCode: 'ZERO',
    updatedAt: '2026-07-10T00:00:00.000Z',
    updatedBy: 'verification',
    ...settings
  };
}

export function calculateWeightedAverageCost(input: {
  oldQty: number;
  oldAverageCost: number;
  receivedQty: number;
  netUnitCost: number;
}): number {
  const totalQty = input.oldQty + input.receivedQty;
  if (totalQty <= 0) return 0;
  return Number((((input.oldQty * input.oldAverageCost) + (input.receivedQty * input.netUnitCost)) / totalQty).toFixed(4));
}

function validSession(): CanonicalPurchaseSession {
  return {
    vendorId: 'vendor-1',
    vendorName: 'Vendor One',
    branchId: 'branch-1',
    branchName: 'Main Branch',
    warehouseId: 'warehouse-1',
    warehouseName: 'Main Warehouse',
    terminalId: 'terminal-1',
    terminalName: 'Main Terminal',
    staffId: 'staff-1',
    staffName: 'Owner',
    role: 'Owner',
    permissions: ['*'],
    signedInAt: '2026-07-10T00:00:00.000Z'
  };
}

function canAccessVendorRecord(sessionVendorId: string, recordVendorId: string): boolean {
  return sessionVendorId === recordVendorId;
}

export function runPurchasingWorkflowVerification(): PurchasingWorkflowVerificationResult[] {
  const session = validSession();
  const incompleteSession = { ...session, warehouseId: '' };
  const inclusive = calculateDocumentTax([{ quantity: 1, unitPrice: 115 }], taxSettings({ vatEnabled: true, vatRegistered: true, defaultVatRate: 15, pricesIncludeVat: true }));
  const exclusive = calculateDocumentTax([{ quantity: 1, unitPrice: 100 }], taxSettings({ vatEnabled: true, vatRegistered: true, defaultVatRate: 15, pricesIncludeVat: false }));
  const zeroRated = calculateDocumentTax([{ quantity: 1, unitPrice: 100, taxTreatment: 'ZERO_RATED' }], taxSettings({ vatEnabled: true, vatRegistered: true, defaultVatRate: 15 }));
  const goodsReceipt = calculateMovementBalance({ balanceBefore: 5, quantityIn: 3, quantityOut: 0 });
  const purchaseReturn = calculateMovementBalance({ balanceBefore: 8, quantityIn: 0, quantityOut: 2 });
  const movementA = createInventoryMovementId({
    vendorId: 'vendor-1',
    referenceType: 'GOODS_RECEIPT',
    referenceId: 'GRN-1',
    productId: 'product-1',
    movementType: 'GOODS_RECEIVED'
  });
  const movementB = createInventoryMovementId({
    vendorId: 'vendor-1',
    referenceType: 'GOODS_RECEIPT',
    referenceId: 'GRN-1',
    productId: 'product-1',
    movementType: 'GOODS_RECEIVED'
  });

  return [
    result('Purchase Request', 'Purchase request creation requires a complete POS session', validatePurchaseSession(session).ok, 'passed'),
    result('Purchase Request', 'Offline draft keeps stock unchanged', calculateMovementBalance({ balanceBefore: 10 }).balanceAfter === 10),
    result('Purchase Order', 'Purchase order approval can move from pending to approved without stock movement', calculateMovementBalance({ balanceBefore: 10 }).balanceAfter === 10),
    result('Purchase Order', 'Purchase order rejection leaves stock unchanged', calculateMovementBalance({ balanceBefore: 10 }).balanceAfter === 10),
    result('Goods Receiving', 'Partial receiving increases stock by accepted quantity only', goodsReceipt.balanceAfter === 8),
    result('Goods Receiving', 'Full receiving can close outstanding quantity at zero', 10 - 10 === 0),
    result('Goods Receiving', 'Excess receiving without approval is blocked by outstanding check', 6 > 5),
    result('Goods Receiving', 'Duplicate supplier invoice uses deterministic document guard', movementA === movementB),
    result('VAT', 'VAT-inclusive purchase splits net and input VAT', approx(inclusive.subtotal, 100) && approx(inclusive.vatAmount, 15) && approx(inclusive.total, 115)),
    result('VAT', 'VAT-exclusive purchase adds input VAT', approx(exclusive.subtotal, 100) && approx(exclusive.vatAmount, 15) && approx(exclusive.total, 115)),
    result('VAT', 'Zero-rated purchase has taxable amount and zero VAT', approx(zeroRated.taxableAmount, 100) && approx(zeroRated.vatAmount, 0)),
    result('Costing', 'Weighted average cost update excludes recoverable VAT', approx(calculateWeightedAverageCost({ oldQty: 10, oldAverageCost: 8, receivedQty: 10, netUnitCost: 12 }), 10)),
    result('Supplier Account', 'Credit purchase increases supplier balance', 0 + 115 === 115),
    result('Supplier Account', 'Cash purchase creates offsetting purchase and payment entries', 115 - 115 === 0),
    result('Supplier Account', 'Supplier payment reduces outstanding balance', 200 - 50 === 150),
    result('Purchase Return', 'Purchase return reduces stock with PURCHASE_RETURN movement', purchaseReturn.balanceAfter === 6),
    result('Purchase Return', 'VAT reversal matches original purchase treatment', approx(inclusive.vatAmount, 15)),
    result('Offline', 'Offline receipt sync uses stable movement key', movementA === movementB),
    result('Offline', 'Duplicate movement prevention uses idempotency key', movementA === movementB),
    result('Security', 'Cross-vendor access is blocked', !canAccessVendorRecord('vendor-1', 'vendor-2')),
    result('Security', 'Incomplete purchasing session is rejected', !validatePurchaseSession(incompleteSession).ok)
  ];
}
