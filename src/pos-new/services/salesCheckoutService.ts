import type { SalesDeliveryPaymentMode, SalesDeliveryPriority, SalesPaymentLine, SalesPaymentMethod } from '../components/SalesCartCard';
import type { CreditDecision } from './customerCreditService';
import type {
  CartItem,
  CashDrawerMovement,
  CustomerRecord,
  PosSession,
  Product,
  ReceiptPrintPreview,
  ReceiptRecord,
  Sale,
  VATMode
} from '../types';
import {
  calculateLineTax,
  type TaxTreatment,
  type VendorTaxSettings
} from './vendorTaxSettingsService';
import {
  getInventoryBalance,
  restoreStockForReturn,
  type InventoryMovementRecord
} from './inventorySyncService';
import { createReceiptFromSale, getReceiptPreview } from './receiptService';
import { createDeliveryRequestFromReceipt } from './deliveryService';
import { createAccountingPostingPlaceholder } from './accountingService';
import { recordPaymentReportEvent } from './paymentReportService';
import { recordCOGSRecoveryFromSale } from './cogsReserveService';
import {
  createCustomerCreditApprovalRequest,
  createCustomerCreditBIAdvice
} from './customerCreditService';
import {
  recordCashRefundMovement,
  recordCashSaleMovement,
  type CanonicalCashMovementDirection,
  type CanonicalCashMovementType,
  type CashMovementApprovalStatus,
  type CashMovementSyncStatus
} from './cashMovementService';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { postCanonicalSaleAtomic } from '../repositories/firestore/FirestoreSalesTransactionRepository';

export const SALES_COLLECTIONS = {
  sales: 'pos_sales',
  saleItems: 'pos_sale_items',
  payments: 'pos_payments',
  cashMovements: 'pos_cash_movements',
  heldSales: 'held_sales',
  returns: 'returns',
  auditLogs: 'audit_logs',
  biEvents: 'biEvents'
} as const;

const SESSION_INCOMPLETE_MESSAGE = 'Your POS session is incomplete. Please sign in again.';

export type CheckoutPaymentMethod =
  | 'Cash'
  | 'Mobile Money'
  | 'Card'
  | 'Bank Transfer'
  | 'Credit'
  | 'Other';

export interface CanonicalCartLine {
  lineId: string;
  productId: string;
  sku: string;
  barcode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  taxCode: string;
  vatRate: number;
  discountType: 'None' | 'Percentage' | 'Fixed Amount';
  discountValue: number;
  discountAmount: number;
  lineSubtotal: number;
  taxableAmount: number;
  lineVat: number;
  lineTotal: number;
  warehouseId: string;
  branchId: string;
  grossAmount: number;
  taxTreatment: TaxTreatment;
  sourceCartItem: CartItem;
}

export interface PosSaleHeader {
  saleId: string;
  saleNumber: string;
  receiptNumber?: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  terminalId: string;
  staffId: string;
  staffName: string;
  customerId: string;
  customerName: string;
  saleDate: string;
  subtotal: number;
  discountTotal: number;
  taxableAmount: number;
  vatTotal: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: 'Paid' | 'Partially Paid' | 'Credit' | 'Unpaid';
  saleStatus: 'Completed' | 'Posting' | 'Failed' | 'Returned' | 'Partially Returned';
  postingStatus: 'Posting' | 'Completed' | 'PendingSync' | 'Failed';
  source: 'POS';
  createdAt: string;
  updatedAt: string;
  heldSaleId?: string;
  notes?: string;
}

export interface PosSaleLine {
  saleLineId: string;
  saleId: string;
  vendorId: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discountAmount: number;
  taxableAmount: number;
  vatRate: number;
  vatAmount: number;
  lineTotal: number;
  isInventoryAsset: boolean;
}

export interface PosPaymentRecord {
  paymentId: string;
  saleId: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  staffId: string;
  paymentMethod: CheckoutPaymentMethod;
  amount: number;
  reference?: string;
  receivedAt: string;
  tendered?: number;
  change?: number;
}

export interface PosCashMovementRecord {
  cashMovementId: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  shiftId: string;
  staffId: string;
  movementType: CanonicalCashMovementType;
  amount: number;
  referenceType: string;
  referenceId: string;
  reason: string;
  approvalStatus: CashMovementApprovalStatus;
  approvedBy?: string;
  direction?: CanonicalCashMovementDirection;
  syncStatus?: CashMovementSyncStatus;
  createdAt: string;
}

export interface CheckoutCustomerInput {
  customerId?: string;
  customerName?: string;
  customerMode?: string;
  phone?: string;
  whatsapp?: string;
  taxNumber?: string;
  billingAddress?: string;
  deliveryAddress?: string;
  record?: CustomerRecord;
  creditDecision?: CreditDecision | null;
  creditOverrideApproved?: boolean;
}

export interface CheckoutPermissions {
  canCompleteSale: boolean;
  canDiscount: boolean;
  canPriceOverride: boolean;
  canCreditSale: boolean;
  canCreditOverride: boolean;
  canNegativeStockOverride: boolean;
  canReturn?: boolean;
  role?: string;
}

export interface CheckoutAdjustments {
  cartDiscountAmount?: number;
  creditRedemptionAmount?: number;
  loyaltyRedemptionAmount?: number;
  deliveryFee?: number;
}

export interface CheckoutDeliveryDetails {
  mode: string;
  address?: string;
  whatsApp?: string;
  notes?: string;
  priority?: SalesDeliveryPriority;
  paymentMode?: SalesDeliveryPaymentMode;
}

export interface CompleteSaleInput {
  session: PosSession | null | undefined;
  customer: CheckoutCustomerInput;
  cartLines: CartItem[];
  paymentLines: SalesPaymentLine[];
  selectedPaymentMethod: SalesPaymentMethod;
  taxSettings: VendorTaxSettings;
  adjustments?: CheckoutAdjustments;
  notes?: string;
  deliveryDetails?: CheckoutDeliveryDetails;
  heldSaleId?: string;
  activeShiftId?: string;
  drawerId?: string;
  permissions: CheckoutPermissions;
  idempotencyKey?: string;
  allowNegativeStock?: boolean;
}

export interface CompleteSaleResult {
  sale: Sale;
  saleHeader: PosSaleHeader;
  saleLines: PosSaleLine[];
  paymentRecords: PosPaymentRecord[];
  inventoryMovements: InventoryMovementRecord[];
  cashMovement?: PosCashMovementRecord;
  cashDrawerMovement?: CashDrawerMovement | null;
  receipt: ReceiptRecord;
  receiptPreview: ReceiptPrintPreview;
  offlineQueued: boolean;
  message: string;
}

export interface SaleReturnInput {
  session: PosSession | null | undefined;
  originalSale: PosSaleHeader;
  originalLines: PosSaleLine[];
  returnLines: Array<{ saleLineId: string; quantity: number }>;
  reason: string;
  activeShiftId?: string;
  drawerId?: string;
  refundCashAmount?: number;
  permissions: CheckoutPermissions;
}

function roundMoney(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function nowIso(): string {
  return new Date().toISOString();
}

function cleanId(value: string): string {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function makeId(prefix: string, seed?: string): string {
  return cleanId(seed ? `${prefix}-${seed}` : `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`);
}

function text(value: unknown, fallback = ''): string {
  const next = String(value ?? '').trim();
  return next || fallback;
}

function productName(product: Product): string {
  return text(product.productName, product.name);
}

function productSku(product: Product): string {
  return text(product.sku, product.code);
}

function productBarcode(product: Product): string {
  return text(product.barcode, product.code);
}

function productPrice(product: Product): number {
  return Number(product.sellingPrice ?? product.price) || 0;
}

function productCost(product: Product): number {
  return Number(product.costPrice ?? product.cost) || 0;
}

function productStock(product: Product): number {
  return Number(product.availableStock ?? product.qtyOnHand ?? product.stock) || 0;
}

function productVendorId(product: Product): string {
  return text((product as unknown as Record<string, unknown>).vendorId);
}

function productBranchId(product: Product): string {
  return text((product as unknown as Record<string, unknown>).branchId);
}

function productWarehouseId(product: Product): string {
  return text((product as unknown as Record<string, unknown>).warehouseId);
}

function productStatus(product: Product): string {
  const row = product as unknown as Record<string, unknown>;
  if (product.isActive === false) return 'Inactive';
  return text(row.productStatus, text(row.status, 'Active'));
}

function productSellable(product: Product): boolean {
  const row = product as unknown as Record<string, unknown>;
  if (row.sellable === false || row.canSell === false || row.salesBlocked === true) return false;
  return true;
}

function isInventoryLine(item: CartItem): boolean {
  return item.lineType !== 'MiscellaneousItem'
    && item.isInventoryAsset !== false
    && item.stockMovementRequired !== false;
}

function lineTaxTreatment(item: CartItem, settings: VendorTaxSettings): TaxTreatment {
  const row = item.product as unknown as Record<string, unknown>;
  const taxCode = text(row.taxCode, text(row.taxClass, ''));
  const explicit = text(row.taxTreatment).toUpperCase();
  if (item.taxable === false) return 'EXEMPT';
  if (explicit === 'EXEMPT') return 'EXEMPT';
  if (explicit === 'ZERO_RATED' || explicit === 'ZERO-RATED') return 'ZERO_RATED';
  if (taxCode && taxCode.toUpperCase() === settings.exemptTaxCode.toUpperCase()) return 'EXEMPT';
  if (taxCode && taxCode.toUpperCase() === settings.zeroRatedTaxCode.toUpperCase()) return 'ZERO_RATED';
  return 'STANDARD';
}

function normalizePaymentMethod(method: string): CheckoutPaymentMethod {
  if (method === 'Cash') return 'Cash';
  if (['EcoCash', 'Innbucks', 'Mukuru', 'ZIPIT', 'Mobile Money'].includes(method)) return 'Mobile Money';
  if (method === 'Card') return 'Card';
  if (method === 'Bank Transfer') return 'Bank Transfer';
  if (method === 'Credit / Account' || method === 'Credit Sale') return 'Credit';
  return 'Other';
}

function receiptPaymentMode(method: SalesPaymentMethod): 'Cash' | 'EcoCash' | 'Swipe' | 'Bank Transfer' | 'Split Payment' | 'Credit Sale' {
  if (method === 'Credit / Account') return 'Credit Sale';
  if (method === 'Card') return 'Swipe';
  if (method === 'Mixed Payment') return 'Split Payment';
  if (method === 'EcoCash') return 'EcoCash';
  if (method === 'Bank Transfer' || method === 'Innbucks' || method === 'Mukuru' || method === 'ZIPIT') return 'Bank Transfer';
  return 'Cash';
}

function salePaymentMethod(method: SalesPaymentMethod): Sale['paymentMethod'] {
  if (method === 'Cash') return 'CASH';
  if (method === 'Mixed Payment') return 'SPLIT';
  if (method === 'Credit / Account') return 'Credit Sale';
  return 'CARD';
}

function requiresPaymentReference(method: SalesPaymentMethod): boolean {
  return ['EcoCash', 'Innbucks', 'Mukuru', 'ZIPIT', 'Bank Transfer', 'Card', 'Already Paid'].includes(method);
}

function assertCompleteSession(session: PosSession | null | undefined): asserts session is PosSession & {
  vendorId: string;
  branchId: string;
  warehouseId: string;
  terminalId: string;
  staffId: string;
} {
  if (!session?.vendorId || !session.branchId || !session.warehouseId || !session.terminalId || !session.staffId) {
    throw new Error(SESSION_INCOMPLETE_MESSAGE);
  }
}

function assertPermissions(input: CompleteSaleInput): void {
  if (!input.permissions.canCompleteSale) {
    throw new Error('You do not have permission to complete a sale.');
  }
  const hasDiscount = input.cartLines.some((line) => Number(line.discount || 0) > 0)
    || Number(input.adjustments?.cartDiscountAmount || 0) > 0;
  if (hasDiscount && !input.permissions.canDiscount) {
    throw new Error('Discount requires approval.');
  }
  const hasPriceOverride = input.cartLines.some((line) => line.overriddenPrice !== undefined && line.overriddenPrice !== productPrice(line.product));
  if (hasPriceOverride && !input.permissions.canPriceOverride) {
    throw new Error('Price change requires approval.');
  }
}

function validateCustomerForCredit(input: CompleteSaleInput, creditAmount: number): void {
  if (creditAmount <= 0) return;
  if (!input.permissions.canCreditSale) throw new Error('You do not have permission to sell on credit.');
  const customerId = text(input.customer.customerId || input.customer.record?.customerId);
  if (!customerId || customerId === 'WALK-IN') throw new Error('Select a registered customer before selling on credit.');
  const customer = input.customer.record;
  if (!customer) throw new Error('Credit sale requires a customer record.');
  const status = text(customer.creditStatus).toLowerCase();
  if (['blocked', 'suspended', 'credit suspended', 'cash only', 'notallowed'].includes(status)) {
    throw new Error('Credit sale blocked for this customer.');
  }
  const decision = input.customer.creditDecision;
  if (!decision) throw new Error('Credit decision is still loading. Try again in a moment.');
  if (decision.decision === 'Blocked') throw new Error(`Credit sale blocked. ${decision.reasonList.join(' ')}`);
  if (decision.decision === 'Requires Approval' && !input.customer.creditOverrideApproved) {
    throw new Error(`Credit sale requires approval. ${decision.reasonList.join(' ')}`);
  }
}

export function buildCanonicalCartLines(input: {
  cartLines: CartItem[];
  session: Pick<PosSession, 'branchId' | 'warehouseId'> & { branchId: string; warehouseId: string };
  taxSettings: VendorTaxSettings;
  cartDiscountAmount?: number;
}): CanonicalCartLine[] {
  if (input.cartLines.length === 0) throw new Error('Cart is empty.');
  const baseRows = input.cartLines.map((item, index) => {
    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) throw new Error(`${productName(item.product)} quantity must be greater than zero.`);
    const unitPrice = roundMoney(Number(item.overriddenPrice ?? productPrice(item.product)) || 0);
    const grossAmount = roundMoney(unitPrice * quantity);
    const lineDiscountPercent = Math.min(100, Math.max(0, Number(item.discount) || 0));
    const lineDiscountAmount = roundMoney(grossAmount * (lineDiscountPercent / 100));
    return { item, index, unitPrice, grossAmount, lineDiscountPercent, lineDiscountAmount };
  });
  const afterLineDiscountTotal = roundMoney(baseRows.reduce((sum, row) => sum + Math.max(0, row.grossAmount - row.lineDiscountAmount), 0));
  const cartDiscount = Math.min(afterLineDiscountTotal, Math.max(0, Number(input.cartDiscountAmount) || 0));

  return baseRows.map(({ item, index, unitPrice, grossAmount, lineDiscountPercent, lineDiscountAmount }) => {
    const afterLineDiscount = Math.max(0, grossAmount - lineDiscountAmount);
    const allocatedCartDiscount = afterLineDiscountTotal > 0 ? roundMoney(cartDiscount * (afterLineDiscount / afterLineDiscountTotal)) : 0;
    const discountAmount = roundMoney(Math.min(grossAmount, lineDiscountAmount + allocatedCartDiscount));
    const taxTreatment = lineTaxTreatment(item, input.taxSettings);
    const taxCode = text((item.product as unknown as Record<string, unknown>).taxCode, taxTreatment === 'EXEMPT' ? input.taxSettings.exemptTaxCode : taxTreatment === 'ZERO_RATED' ? input.taxSettings.zeroRatedTaxCode : 'STANDARD');
    const vatRate = Number(item.vatRate ?? (item.product as unknown as Record<string, unknown>).vatRate ?? input.taxSettings.defaultVatRate) || 0;
    const tax = calculateLineTax({
      lineAmount: grossAmount,
      discountAmount,
      taxTreatment,
      taxCode,
      vatRate
    }, input.taxSettings);
    const warehouseId = text(productWarehouseId(item.product), input.session.warehouseId);
    return {
      lineId: makeId('SL', `${index + 1}-${productSku(item.product) || item.product.id}`),
      productId: item.product.id,
      sku: productSku(item.product),
      barcode: productBarcode(item.product),
      productName: productName(item.product),
      quantity: Number(item.quantity) || 0,
      unitPrice,
      unitCost: productCost(item.product),
      taxCode,
      vatRate: tax.vatRate,
      discountType: discountAmount > 0 ? (lineDiscountPercent > 0 ? 'Percentage' : 'Fixed Amount') : 'None',
      discountValue: lineDiscountPercent > 0 ? lineDiscountPercent : allocatedCartDiscount,
      discountAmount,
      lineSubtotal: tax.netAmount,
      taxableAmount: tax.taxableAmount,
      lineVat: tax.vatAmount,
      lineTotal: tax.total,
      warehouseId,
      branchId: text(productBranchId(item.product), input.session.branchId),
      grossAmount,
      taxTreatment,
      sourceCartItem: item
    };
  });
}

export function calculateCanonicalSaleTotals(lines: CanonicalCartLine[], reductions: { creditRedemptionAmount?: number; loyaltyRedemptionAmount?: number; deliveryFee?: number } = {}) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineSubtotal, 0));
  const lineDiscountTotal = roundMoney(lines.reduce((sum, line) => sum + line.discountAmount, 0));
  const taxableAmount = roundMoney(lines.reduce((sum, line) => sum + line.taxableAmount, 0));
  const vatTotal = roundMoney(lines.reduce((sum, line) => sum + line.lineVat, 0));
  const deliveryFee = roundMoney(Math.max(0, Number(reductions.deliveryFee) || 0));
  const creditRedemption = roundMoney(Math.max(0, Number(reductions.creditRedemptionAmount) || 0));
  const loyaltyRedemption = roundMoney(Math.max(0, Number(reductions.loyaltyRedemptionAmount) || 0));
  const grossTotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0) + deliveryFee);
  const grandTotal = roundMoney(Math.max(0, grossTotal - creditRedemption - loyaltyRedemption));
  return {
    subtotal,
    discountTotal: roundMoney(lineDiscountTotal + creditRedemption + loyaltyRedemption),
    productDiscountTotal: lineDiscountTotal,
    taxableAmount,
    vatTotal,
    deliveryFee,
    grandTotal
  };
}

async function validateStock(input: CompleteSaleInput, lines: CanonicalCartLine[]): Promise<void> {
  const failures: string[] = [];
  for (const line of lines) {
    if (!isInventoryLine(line.sourceCartItem)) continue;
    const product = line.sourceCartItem.product;
    const vendorId = productVendorId(product);
    if (vendorId && vendorId !== input.session!.vendorId) {
      failures.push(`${line.productName}: Wrong vendor product`);
      continue;
    }
    const status = productStatus(product).toLowerCase();
    if (['inactive', 'blocked', 'discontinued'].includes(status)) {
      failures.push(`${line.productName}: Product is inactive`);
      continue;
    }
    if (!productSellable(product)) {
      failures.push(`${line.productName}: Product is not sellable`);
      continue;
    }
    const productWarehouse = productWarehouseId(product);
    if (productWarehouse && productWarehouse !== input.session!.warehouseId) {
      failures.push(`${line.productName}: Product is not available in this warehouse`);
      continue;
    }
    const balance = await getInventoryBalance({
      vendorId: input.session!.vendorId,
      branchId: input.session!.branchId,
      warehouseId: input.session!.warehouseId,
      productId: line.productId
    }).catch(() => null);
    const available = balance ? (balance.quantityAvailable || balance.quantityOnHand) : productStock(product);
    const fallbackAvailable = Math.max(available, productStock(product));
    if (fallbackAvailable < line.quantity && !input.allowNegativeStock && !input.permissions.canNegativeStockOverride) {
      failures.push(`${line.productName}: Insufficient stock`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join(' | '));
  }
}

function buildPaymentRecords(input: CompleteSaleInput, saleId: string, grandTotal: number, createdAt: string): {
  paymentRecords: PosPaymentRecord[];
  amountPaid: number;
  balanceDue: number;
  tendered: number;
  change: number;
  creditAmount: number;
} {
  const payments = input.paymentLines.length > 0
    ? input.paymentLines
    : grandTotal === 0
      ? [{ id: makeId('PAY', saleId), method: 'No Payment Due' as SalesPaymentMethod, amount: 0, reference: 'Zero balance sale' }]
      : [];
  if (payments.length === 0) throw new Error('Select a payment method before checkout.');

  let remaining = grandTotal;
  let tendered = 0;
  let change = 0;
  const records: PosPaymentRecord[] = [];
  for (const payment of payments) {
    const method = normalizePaymentMethod(payment.method);
    const rawAmount = Math.max(0, Number(payment.amount) || 0);
    if (method !== 'Credit' && payment.method !== 'No Payment Due' && rawAmount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }
    if (requiresPaymentReference(payment.method) && !text(payment.reference)) {
      throw new Error(`${payment.method} requires a payment reference.`);
    }
    if (method === 'Credit') {
      records.push({
        paymentId: cleanId(payment.id || `${saleId}_credit`),
        saleId,
        vendorId: input.session!.vendorId!,
        branchId: input.session!.branchId!,
        terminalId: input.session!.terminalId!,
        staffId: input.session!.staffId!,
        paymentMethod: method,
        amount: 0,
        reference: payment.reference,
        receivedAt: createdAt
      });
      continue;
    }
    const applied = method === 'Cash' ? Math.min(rawAmount, remaining) : rawAmount;
    if (method !== 'Cash' && rawAmount > remaining) {
      throw new Error('Payment amount exceeds balance. Use Cash for tender/change or reduce the amount.');
    }
    if (method === 'Cash') {
      tendered += rawAmount;
      change += Math.max(0, rawAmount - remaining);
    }
    remaining = roundMoney(Math.max(0, remaining - applied));
    records.push({
      paymentId: cleanId(payment.id || `${saleId}_${records.length + 1}`),
      saleId,
      vendorId: input.session!.vendorId!,
      branchId: input.session!.branchId!,
      terminalId: input.session!.terminalId!,
      staffId: input.session!.staffId!,
      paymentMethod: method,
      amount: roundMoney(applied),
      reference: payment.reference,
      receivedAt: createdAt,
      tendered: method === 'Cash' ? rawAmount : undefined,
      change: method === 'Cash' ? Math.max(0, rawAmount - applied) : undefined
    });
  }
  const amountPaid = roundMoney(records.filter((payment) => payment.paymentMethod !== 'Credit').reduce((sum, payment) => sum + payment.amount, 0));
  const creditAmount = roundMoney(Math.max(0, grandTotal - amountPaid));
  validateCustomerForCredit(input, creditAmount);
  const balanceDue = creditAmount > 0 ? creditAmount : roundMoney(Math.max(0, grandTotal - amountPaid));
  if (balanceDue > 0 && creditAmount <= 0) throw new Error('Payment is under the sale total.');
  return { paymentRecords: records, amountPaid, balanceDue, tendered, change: roundMoney(change), creditAmount };
}

function saveLocalRows<T extends Record<string, unknown>>(baseKey: string, vendorId: string, rows: T[], idKey: keyof T): void {
  const current = readVendorScopedList<T>(baseKey, [], vendorId);
  const incoming = new Set(rows.map((row) => String(row[idKey])));
  writeVendorScopedList(baseKey, [...rows, ...current.filter((row) => !incoming.has(String(row[idKey])))], vendorId);
}

function saveSaleStage(sale: PosSaleHeader): void {
  saveLocalRows(SALES_COLLECTIONS.sales, sale.vendorId, [sale as unknown as Record<string, unknown>], 'saleId');
}

function saveCheckoutRecords(input: {
  sale: PosSaleHeader;
  saleLines: PosSaleLine[];
  payments: PosPaymentRecord[];
  cashMovement?: PosCashMovementRecord;
  auditLog: Record<string, unknown>;
  biEvent: Record<string, unknown>;
}): void {
  saveLocalRows(SALES_COLLECTIONS.sales, input.sale.vendorId, [input.sale as unknown as Record<string, unknown>], 'saleId');
  saveLocalRows(SALES_COLLECTIONS.saleItems, input.sale.vendorId, input.saleLines as unknown as Record<string, unknown>[], 'saleLineId');
  saveLocalRows(SALES_COLLECTIONS.payments, input.sale.vendorId, input.payments as unknown as Record<string, unknown>[], 'paymentId');
  if (input.cashMovement) {
    saveLocalRows(SALES_COLLECTIONS.cashMovements, input.sale.vendorId, [input.cashMovement as unknown as Record<string, unknown>], 'cashMovementId');
  }
  saveLocalRows(SALES_COLLECTIONS.auditLogs, input.sale.vendorId, [input.auditLog], 'auditLogId');
  saveLocalRows(SALES_COLLECTIONS.biEvents, input.sale.vendorId, [input.biEvent], 'eventId');
}

/** Internal execution pipeline. Callers must use canonicalSalesTransactionService. */
export async function executeCanonicalCheckoutPipeline(input: CompleteSaleInput): Promise<CompleteSaleResult> {
  assertCompleteSession(input.session);
  assertPermissions(input);
  const session = input.session;
  const createdAt = nowIso();
  const saleId = makeId('SALE', input.idempotencyKey || `${session.vendorId}-${session.terminalId}-${Date.now()}`);
  const saleNumber = makeId('INV', saleId);
  const canonicalLines = buildCanonicalCartLines({
    cartLines: input.cartLines,
    session,
    taxSettings: input.taxSettings,
    cartDiscountAmount: input.adjustments?.cartDiscountAmount
  });
  await validateStock(input, canonicalLines);
  const totals = calculateCanonicalSaleTotals(canonicalLines, input.adjustments);
  const payment = buildPaymentRecords(input, saleId, totals.grandTotal, createdAt);
  const cashReceived = payment.paymentRecords.filter((row) => row.paymentMethod === 'Cash').reduce((sum, row) => sum + (row.tendered ?? row.amount), 0);
  const cashApplied = payment.paymentRecords.filter((row) => row.paymentMethod === 'Cash').reduce((sum, row) => sum + row.amount, 0);
  if (cashApplied > 0 && !input.activeShiftId) {
    throw new Error('No open shift. Please open a shift before taking cash.');
  }

  const customerId = text(input.customer.customerId || input.customer.record?.customerId, 'WALK-IN');
  const customerName = text(input.customer.customerName || input.customer.record?.customerName, 'Walk-In Customer');
  const saleHeader: PosSaleHeader = {
    saleId,
    saleNumber,
    vendorId: session.vendorId,
    branchId: session.branchId,
    warehouseId: session.warehouseId,
    terminalId: session.terminalId,
    staffId: session.staffId,
    staffName: text(session.staffName, session.staffId),
    customerId,
    customerName,
    saleDate: createdAt,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxableAmount: totals.taxableAmount,
    vatTotal: totals.vatTotal,
    grandTotal: totals.grandTotal,
    amountPaid: payment.amountPaid,
    balanceDue: payment.balanceDue,
    paymentStatus: payment.balanceDue > 0 ? 'Credit' : payment.amountPaid > 0 ? 'Paid' : 'Unpaid',
    saleStatus: 'Posting',
    postingStatus: 'Posting',
    source: 'POS',
    createdAt,
    updatedAt: createdAt,
    heldSaleId: input.heldSaleId,
    notes: input.notes
  };
  saveSaleStage(saleHeader);

  const saleLines: PosSaleLine[] = canonicalLines.map((line, index) => ({
    saleLineId: cleanId(`${saleId}_${index + 1}_${line.productId}`),
    saleId,
    vendorId: session.vendorId,
    branchId: session.branchId,
    warehouseId: session.warehouseId,
    productId: line.productId,
    sku: line.sku,
    productName: line.productName,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    unitCost: line.unitCost,
    discountAmount: line.discountAmount,
    taxableAmount: line.taxableAmount,
    vatRate: line.vatRate,
    vatAmount: line.lineVat,
    lineTotal: line.lineTotal,
    isInventoryAsset: isInventoryLine(line.sourceCartItem)
  }));

  const sale: Sale = {
    id: saleId,
    invoiceNo: saleNumber,
    date: createdAt,
    operator: text(session.staffName, session.staffId),
    customerName,
    customerId: customerId === 'WALK-IN' ? undefined : customerId,
    customerCode: input.customer.record?.customerCode,
    customerPhone: input.customer.phone || input.customer.record?.phone,
    branch: text(session.branch, session.branchId),
    terminal: text(session.terminal, session.terminalId),
    items: canonicalLines.map((line) => ({
      productId: line.productId,
      name: line.productName,
      code: line.sku,
      quantity: line.quantity,
      price: line.unitPrice,
      total: line.lineTotal,
      unitCost: line.unitCost,
      costPrice: line.unitCost,
      lineType: line.sourceCartItem.lineType,
      isInventoryAsset: line.sourceCartItem.isInventoryAsset !== false,
      requiresManagementReview: line.sourceCartItem.requiresManagementReview,
      biFlagged: line.sourceCartItem.biFlagged
    })),
    subtotal: saleHeader.subtotal,
    tax: saleHeader.vatTotal,
    discount: saleHeader.discountTotal,
    total: saleHeader.grandTotal,
    paymentMethod: salePaymentMethod(input.paymentLines[0]?.method || input.selectedPaymentMethod),
    cashReceived,
    changeGiven: payment.change,
    status: 'COMPLETED'
  };

  let inventoryMovements: InventoryMovementRecord[] = [];
  let cashMovement: PosCashMovementRecord | undefined;
  let cashDrawerMovement: CashDrawerMovement | null = null;

  const receipt = await createReceiptFromSale({
    sale,
    vendorId: session.vendorId,
    businessVendor: text(session.vendor, session.vendorId),
    branchId: session.branchId,
    branch: text(session.branch, session.branchId),
    terminalId: session.terminalId,
    terminal: text(session.terminal, session.terminalId),
    cashierId: session.staffId,
    cashier: text(session.staffName, session.staffId),
    customerId: customerId === 'WALK-IN' ? undefined : customerId,
    customerName,
    customerPhone: input.customer.phone || input.customer.record?.phone,
    customerWhatsApp: input.customer.whatsapp || input.customer.record?.whatsapp,
    customerTaxNumber: input.customer.taxNumber || input.customer.record?.taxNumber,
    customerBillingAddress: input.customer.billingAddress || input.customer.record?.billingAddress,
    customerDeliveryAddress: input.deliveryDetails?.address || input.customer.deliveryAddress || input.customer.record?.deliveryAddress,
    customerCreditStatus: input.customer.record?.creditStatus,
    paymentMode: payment.creditAmount > 0 ? 'Credit Sale' : receiptPaymentMode(input.paymentLines[0]?.method || input.selectedPaymentMethod),
    paymentLines: payment.paymentRecords.map((row) => ({ method: row.paymentMethod, amount: row.amount, reference: row.reference })),
    creditDetails: payment.creditAmount > 0 && input.customer.creditDecision ? {
      paymentType: 'Account / Credit',
      paidAmount: payment.amountPaid,
      balanceDue: payment.creditAmount,
      dueDate: input.customer.creditDecision.dueDate,
      creditTermsDays: input.customer.creditDecision.profile.paymentTermsDays,
      outstandingAccountBalance: input.customer.creditDecision.newBalance,
      reminderNote: 'Please settle your account balance by the due date.'
    } : undefined,
    vatMode: input.taxSettings.vatEnabled && input.taxSettings.vatRegistered
      ? (input.taxSettings.pricesIncludeVat ? 'Inclusive' : 'Exclusive') as VATMode
      : 'Not VAT Registered',
    vatRate: input.taxSettings.defaultVatRate
  });
  const preview = await getReceiptPreview(receipt.receiptNumber, '80mm');
  if (!preview || preview.receipt.receiptNumber !== receipt.receiptNumber) {
    throw new Error('Receipt preview could not be created for the completed sale.');
  }

  const completedSale: PosSaleHeader = {
    ...saleHeader,
    receiptNumber: receipt.receiptNumber,
    saleStatus: 'Completed',
    postingStatus: 'Completed',
    updatedAt: nowIso()
  };
  const auditLog = {
    auditLogId: cleanId(`${saleId}_completed`),
    vendorId: session.vendorId,
    branchId: session.branchId,
    terminalId: session.terminalId,
    staffId: session.staffId,
    eventType: 'SALE_COMPLETED',
    referenceType: 'SALE',
    referenceId: saleId,
    message: `Sale ${receipt.receiptNumber} completed.`,
    createdAt
  };
  const biEvent = {
    eventId: cleanId(`${saleId}_bi`),
    vendorId: session.vendorId,
    branchId: session.branchId,
    terminalId: session.terminalId,
    staffId: session.staffId,
    eventType: payment.balanceDue > 0 ? 'CREDIT_SALE_COMPLETED' : 'SALE_COMPLETED',
    severity: 'INFO',
    payload: { receiptNumber: receipt.receiptNumber, total: completedSale.grandTotal, paymentStatus: completedSale.paymentStatus },
    createdAt
  };

  const atomicPosting = await postCanonicalSaleAtomic({
    sale: completedSale,
    lines: saleLines,
    payments: payment.paymentRecords,
    requestId: input.idempotencyKey!,
    currency: 'USD',
    customerCreditAmount: payment.creditAmount
  });
  inventoryMovements = atomicPosting.inventoryMovements;
  const offlineQueued = false;
  await recordCOGSRecoveryFromSale(sale).catch(() => undefined);

  if (cashApplied > 0) {
    const recordedCash = await recordCashSaleMovement({
      saleId,
      receiptNumber: receipt.receiptNumber,
      shiftId: input.activeShiftId!,
      amount: roundMoney(cashApplied),
      createdAt
    }, session);
    cashMovement = recordedCash.movement as PosCashMovementRecord;
    cashDrawerMovement = recordedCash.drawerMovement;
  }
  saveCheckoutRecords({ sale: completedSale, saleLines, payments: payment.paymentRecords, cashMovement, auditLog, biEvent });

  if (payment.creditAmount > 0 && input.customer.record && input.customer.creditDecision) {
    if (input.customer.creditOverrideApproved) {
      await createCustomerCreditApprovalRequest({
        customerName,
        requestedBy: text(session.staffName, session.staffId),
        requestedByRole: normalizeOperationalRole(input.permissions.role || session.role),
        approvalType: input.customer.creditDecision.reasonList.some((reason) => reason.toLowerCase().includes('overdue')) ? 'OVERDUE_CUSTOMER_OVERRIDE' : 'CREDIT_SALE_OVERRIDE',
        branchId: session.branchId,
        branch: text(session.branch, session.branchId),
        relatedRecord: receipt.receiptNumber,
        amountOrValue: `USD ${payment.creditAmount.toFixed(2)}`,
        risk: 'High',
        reason: 'Credit override used at Sales Terminal.',
        context: input.customer.creditDecision.reasonList.join(' ')
      });
    }
    if (input.customer.creditDecision.profile.overdueBalance > 0) {
      await createCustomerCreditBIAdvice('OVERDUE_CUSTOMER_TRYING_TO_BUY', customerName, `${customerName} has overdue balance before new credit sale.`, 'High');
    }
  }

  if (input.deliveryDetails?.mode && input.deliveryDetails.mode !== 'No Delivery') {
    const delivery = await createDeliveryRequestFromReceipt({
      vendorId: session.vendorId,
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      saleId,
      branchId: session.branchId,
      branchName: text(session.branch, session.branchId),
      warehouseId: session.warehouseId,
      warehouseName: text(session.warehouse, session.warehouseId),
      terminalId: session.terminalId,
      cashierStaffId: session.staffId,
      cashierStaffName: text(session.staffName, session.staffId),
      customerId: customerId === 'WALK-IN' ? undefined : customerId,
      customerName,
      customerPhone: input.customer.phone || input.customer.record?.phone,
      customerWhatsapp: input.deliveryDetails.whatsApp || input.customer.whatsapp || input.customer.record?.whatsapp,
      deliveryMethod: input.deliveryDetails.mode as any,
      priority: input.deliveryDetails.priority || 'Normal',
      deliveryAddress: input.deliveryDetails.address || input.customer.deliveryAddress || input.customer.record?.deliveryAddress || '',
      deliveryNotes: input.deliveryDetails.notes,
      deliveryFee: input.adjustments?.deliveryFee || 0,
      paymentMode: input.deliveryDetails.paymentMode || 'Already Paid',
      totalReceiptAmount: completedSale.grandTotal,
      cashToCollect: input.deliveryDetails.paymentMode === 'Cash On Delivery'
        ? completedSale.grandTotal
        : input.deliveryDetails.paymentMode === 'Delivery Fee Cash'
          ? Number(input.adjustments?.deliveryFee || 0)
          : 0,
      lines: canonicalLines.map((line) => ({
        productId: line.productId,
        sku: line.sku,
        productName: line.productName,
        qty: line.quantity,
        saleLineId: line.lineId
      })),
      session
    });
    void delivery;
  }

  await createAccountingPostingPlaceholder({
    sourceReference: receipt.receiptNumber,
    source: 'Sale',
    branch: text(session.branch, session.branchId),
    amount: completedSale.grandTotal
  }).catch(() => undefined);
  await recordPaymentReportEvent('PAYMENT_BREAKDOWN_VIEWED', text(session.staffName, session.staffId)).catch(() => undefined);
  return {
    sale: { ...sale, invoiceNo: receipt.receiptNumber },
    saleHeader: completedSale,
    saleLines,
    paymentRecords: payment.paymentRecords,
    inventoryMovements,
    cashMovement,
    cashDrawerMovement,
    receipt,
    receiptPreview: preview,
    offlineQueued,
    message: 'Sale completed successfully.'
  };
}

/** Internal return pipeline. Callers must use canonicalSalesTransactionService. */
async function executeCanonicalSaleReturnPipeline(input: SaleReturnInput): Promise<{ returnId: string; restoredMovements: InventoryMovementRecord[]; cashRefund?: PosCashMovementRecord }> {
  assertCompleteSession(input.session);
  if (!input.permissions.canReturn) throw new Error('Return requires approval.');
  if (!text(input.reason)) throw new Error('Return requires a reason.');
  if (input.originalSale.vendorId !== input.session.vendorId) throw new Error('Original sale is not available for this vendor.');
  const returnId = makeId('RETURN', `${input.originalSale.saleId}-${Date.now()}`);
  const restoredMovements: InventoryMovementRecord[] = [];
  for (const request of input.returnLines) {
    const original = input.originalLines.find((line) => line.saleLineId === request.saleLineId);
    if (!original) throw new Error('Return line does not match the original sale.');
    if (request.quantity <= 0 || request.quantity > original.quantity) {
      throw new Error('Returned quantity cannot exceed sold quantity.');
    }
    restoredMovements.push(await restoreStockForReturn({
      movementId: cleanId(`${returnId}_${original.productId}_RETURN`),
      vendorId: input.session.vendorId,
      branchId: input.session.branchId,
      warehouseId: input.session.warehouseId,
      productId: original.productId,
      sku: original.sku,
      productName: original.productName,
      quantityIn: request.quantity,
      unitCost: original.unitCost,
      referenceType: 'RETURN',
      referenceId: returnId,
      staffId: input.session.staffId,
      staffName: text(input.session.staffName, input.session.staffId),
      terminalId: input.session.terminalId,
      notes: input.reason
    }));
  }
  let cashRefund: PosCashMovementRecord | undefined;
  if (Number(input.refundCashAmount) > 0) {
    if (!input.activeShiftId) throw new Error('No open shift. Please open a shift before cash refund.');
    const recordedRefund = await recordCashRefundMovement({
      returnId,
      originalSaleId: input.originalSale.saleId,
      shiftId: input.activeShiftId,
      amount: roundMoney(Number(input.refundCashAmount) || 0),
      reason: input.reason,
      approvedBy: input.session.staffId,
      allowInsufficientDrawerCash: input.permissions.canReturn
    }, input.session);
    cashRefund = recordedRefund.movement as PosCashMovementRecord;
  }
  saveLocalRows(SALES_COLLECTIONS.returns, input.session.vendorId, [{
    returnId,
    vendorId: input.session.vendorId,
    originalSaleId: input.originalSale.saleId,
    reason: input.reason,
    lines: input.returnLines,
    cashRefund,
    createdAt: nowIso(),
    createdBy: input.session.staffId
  }], 'returnId');
  return { returnId, restoredMovements, cashRefund };
}

/** Compatibility adapter: all checkout posting delegates to the canonical sales authority. */
export async function completeSale(input: CompleteSaleInput): Promise<CompleteSaleResult> {
  const { canonicalSalesTransactionService } = await import('./sales/canonicalSalesTransactionService');
  return canonicalSalesTransactionService.completeCheckout(input);
}

/** Compatibility adapter: all supported returns delegate to the canonical sales authority. */
export async function createSaleReturn(input: SaleReturnInput): Promise<{ returnId: string; restoredMovements: InventoryMovementRecord[]; cashRefund?: PosCashMovementRecord }> {
  const { canonicalSalesTransactionService } = await import('./sales/canonicalSalesTransactionService');
  return canonicalSalesTransactionService.returnCheckoutSale(input);
}
import { normalizeOperationalRole } from '../auth/roleNormalization';
