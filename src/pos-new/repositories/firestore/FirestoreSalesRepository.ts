import { collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, where } from 'firebase/firestore';
import { COMMERCE_SCHEMA_VERSION, type SharedInventoryMovementRecord } from '../../firebase/commerceDataContract';
import { db, firebaseReady } from '../../firebase/firebaseApp';
import { encodeFirestoreId, firestorePaths } from '../../firebase/firestorePaths';
import type { CommittedSalesTransaction, RefundSaleCommand, SalesListFilters, SalesRepository, SalesReversalResult, SalesTransactionCommit, SalesTransactionInventoryLine } from '../SalesRepository';
import { validateRepositoryOperationContext, type RepositoryOperationContext } from '../repositoryContext';
import { mapFirestoreError, REPOSITORY_ERROR_CODES } from './firestoreErrorMapper';
import type { PosPaymentRecord, PosSaleHeader, PosSaleLine } from '../../services/salesCheckoutService';

const balanceId = (context: RepositoryOperationContext, line: SalesTransactionInventoryLine): string => encodeFirestoreId([context.vendorId, line.branchId, line.warehouseId || 'NO_WAREHOUSE', line.productId].join('_'));
const movementId = (saleId: string, productId: string): string => encodeFirestoreId(`${saleId}_${productId}_SALE`);
const clean = (row: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));

function salesMatch(row: PosSaleHeader, filters?: SalesListFilters): boolean {
  if (!filters) return true;
  if (filters.branchId && row.branchId !== filters.branchId) return false;
  if (filters.terminalId && row.terminalId !== filters.terminalId) return false;
  if (filters.customerId && row.customerId !== filters.customerId) return false;
  if (filters.status && row.saleStatus !== filters.status) return false;
  if (filters.dateFrom && row.saleDate < `${filters.dateFrom}T00:00:00`) return false;
  if (filters.dateTo && row.saleDate > `${filters.dateTo}T23:59:59.999`) return false;
  if (filters.search) {
    const term = filters.search.trim().toLowerCase();
    if (term && ![row.saleId, row.saleNumber, row.receiptNumber, row.customerId, row.customerName, row.staffName].join(' ').toLowerCase().includes(term)) return false;
  }
  return true;
}

function validate(context: RepositoryOperationContext, input: SalesTransactionCommit): string | null {
  try { validateRepositoryOperationContext(context); } catch (error) { return error instanceof Error ? error.message : 'Invalid sales context.'; }
  if (!firebaseReady || !db) return 'Firebase is not configured or Firestore is unavailable.';
  if (!input.idempotencyKey.trim() || !input.sale.saleId.trim()) return 'Sale and idempotency identifiers are required.';
  if (input.sale.vendorId !== context.vendorId || input.sale.branchId !== context.branchId || input.sale.terminalId !== context.terminalId) return 'Cross-scope sale commit is rejected.';
  if (!input.shiftId.trim()) return 'An open shift is required for checkout.';
  if (input.cashMovement && input.payments.every((payment) => payment.paymentMethod !== 'Cash')) return 'Cash movement is only valid for a cash payment.';
  return null;
}

function reversalId(type: 'REFUND' | 'VOID', saleId: string, idempotencyKey: string): string {
  return encodeFirestoreId(`${type}_${saleId}_${idempotencyKey}`);
}

async function runSalesReversal(context: RepositoryOperationContext, saleId: string, type: 'REFUND' | 'VOID', input: RefundSaleCommand): Promise<{ success: boolean; data?: SalesReversalResult; errorCode?: string; errorMessage?: string }> {
  try {
    validateRepositoryOperationContext(context);
    if (!firebaseReady || !db) return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Firebase is not configured or Firestore is unavailable.' };
    if (!saleId.trim() || !input.idempotencyKey.trim() || !input.reason.trim()) return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Sale, idempotency key, and reason are required.' };

    const [lineQuery, paymentQuery] = await Promise.all([
      getDocs(query(collection(db, firestorePaths.salesReceiptLines(context.vendorId)), where('saleId', '==', saleId))),
      getDocs(query(collection(db, firestorePaths.payments(context.vendorId)), where('saleId', '==', saleId)))
    ]);
    const allLines = lineQuery.docs.map((item) => item.data() as PosSaleLine).filter((line) => line.vendorId === context.vendorId);
    const originalPayments = paymentQuery.docs.map((item) => item.data() as PosPaymentRecord).filter((payment) => payment.vendorId === context.vendorId && (!payment.recordType || payment.recordType === 'PAYMENT') && payment.amount > 0);
    if (!allLines.length) return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Sale lines were not found.' };

    const requested = new Map<string, number>();
    (type === 'VOID' ? allLines.map((line) => ({ saleLineId: line.saleLineId, quantity: line.quantity })) : input.lines).forEach((line) => requested.set(line.saleLineId, (requested.get(line.saleLineId) || 0) + Number(line.quantity)));
    if (!requested.size || [...requested.values()].some((quantity) => !Number.isFinite(quantity) || quantity <= 0)) return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'At least one positive return quantity is required.' };
    const selectedLines = [...requested.entries()].map(([lineId, quantity]) => {
      const line = allLines.find((candidate) => candidate.saleLineId === lineId);
      if (!line) throw new Error(`Sale line ${lineId} was not found in this sale.`);
      return { line, quantity };
    });
    const id = reversalId(type, saleId, input.idempotencyKey);
    const result = await runTransaction(db, async (transaction): Promise<SalesReversalResult> => {
      const reversalRef = doc(db!, firestorePaths.salesReturn(context.vendorId, id));
      const existingReversal = await transaction.get(reversalRef);
      if (existingReversal.exists()) return { ...(existingReversal.data() as SalesReversalResult), duplicate: true };
      const saleRef = doc(db!, firestorePaths.salesReceipts(context.vendorId), saleId);
      const saleSnapshot = await transaction.get(saleRef);
      if (!saleSnapshot.exists()) throw new Error('Sale was not found.');
      const sale = saleSnapshot.data() as PosSaleHeader;
      if (sale.vendorId !== context.vendorId) throw new Error('Cross-vendor sale reversal is rejected.');
      if (sale.saleStatus === 'Voided') throw new Error('Sale has already been voided.');
      if (!['Completed', 'Partially Returned'].includes(sale.saleStatus)) throw new Error('Only completed sales can be refunded or voided.');
      const previouslyRefunded = { ...(sale.refundedQuantities || {}) };
      if (type === 'VOID' && (sale.refundedAmount || 0) > 0) throw new Error('A partially refunded sale cannot be voided.');
      selectedLines.forEach(({ line, quantity }) => {
        if (line.vendorId !== context.vendorId || line.saleId !== saleId) throw new Error('Cross-vendor or cross-sale line reference is rejected.');
        if (quantity + Number(previouslyRefunded[line.saleLineId] || 0) > line.quantity) throw new Error(`Refund quantity exceeds the remaining quantity for ${line.productName}.`);
      });
      const refundAmount = Number(selectedLines.reduce((sum, item) => sum + (item.line.lineTotal / item.line.quantity) * item.quantity, 0).toFixed(2));
      if (refundAmount <= 0 || refundAmount > sale.grandTotal - Number(sale.refundedAmount || 0) + 0.01) throw new Error('Refund amount exceeds the remaining sale value.');

      const inventoryGroups = new Map<string, { productId: string; branchId: string; warehouseId: string; quantity: number; unitCost: number }>();
      selectedLines.filter(({ line }) => line.stockMovementRequired !== false).forEach(({ line, quantity }) => {
        const key = [line.branchId, line.warehouseId, line.productId].join('|');
        const current = inventoryGroups.get(key);
        inventoryGroups.set(key, current ? { ...current, quantity: current.quantity + quantity } : { productId: line.productId, branchId: line.branchId, warehouseId: line.warehouseId, quantity, unitCost: line.unitCost });
      });
      const inventoryRows = [...inventoryGroups.values()];
      const balanceRefs = inventoryRows.map((line) => doc(db!, firestorePaths.productStockBalance(context.vendorId, balanceId(context, line))));
      const lineRefs = selectedLines.map(({ line }) => doc(db!, firestorePaths.salesReceiptLines(context.vendorId), line.saleLineId));
      const paymentRefs = originalPayments.map((payment) => doc(db!, firestorePaths.payments(context.vendorId), payment.paymentId));
      const shiftRef = sale.shiftId ? doc(db!, firestorePaths.shift(context.vendorId, sale.shiftId)) : null;
      const [lineSnapshots, paymentSnapshots, balanceSnapshots, shiftSnapshot] = await Promise.all([
        Promise.all(lineRefs.map((ref) => transaction.get(ref))),
        Promise.all(paymentRefs.map((ref) => transaction.get(ref))),
        Promise.all(balanceRefs.map((ref) => transaction.get(ref))),
        shiftRef ? transaction.get(shiftRef) : Promise.resolve(null)
      ]);
      lineSnapshots.forEach((snapshot) => { if (!snapshot.exists() || snapshot.data().vendorId !== context.vendorId || snapshot.data().saleId !== saleId) throw new Error('Sale line tenancy validation failed.'); });
      paymentSnapshots.forEach((snapshot) => { if (!snapshot.exists() || snapshot.data().vendorId !== context.vendorId || snapshot.data().saleId !== saleId) throw new Error('Payment tenancy validation failed.'); });

      const timestamp = new Date().toISOString();
      const inventoryMovements: SharedInventoryMovementRecord[] = inventoryRows.map((line, index) => {
        const snapshot = balanceSnapshots[index];
        if (!snapshot.exists()) throw new Error(`Inventory balance is missing for product ${line.productId}.`);
        const before = snapshot.data();
        if (before.vendorId !== context.vendorId || before.branchId !== line.branchId || before.warehouseId !== line.warehouseId) throw new Error('Cross-scope inventory balance access is rejected.');
        const quantityBefore = Number(before.quantityOnHand || 0);
        const quantityAfter = quantityBefore + line.quantity;
        const movementKey = encodeFirestoreId(`${id}_${line.productId}_SALE_RETURN`);
        const movement: SharedInventoryMovementRecord = { sciId: movementKey, movementId: movementKey, vendorId: context.vendorId, branchId: line.branchId, warehouseId: line.warehouseId, productId: line.productId, movementType: 'SALE_RETURN', quantityDelta: line.quantity, quantityBefore, quantityAfter, unitCost: line.unitCost, valueImpact: line.quantity * line.unitCost, referenceType: type === 'VOID' ? 'SALE_VOID' : 'SALE_REFUND', referenceId: id, staffId: context.staffId || context.actorId, actorId: context.actorId, correlationId: input.idempotencyKey, sourceApp: context.sourceApp, createdAt: timestamp, updatedAt: timestamp, createdBy: context.actorId, updatedBy: context.actorId, schemaVersion: COMMERCE_SCHEMA_VERSION, status: 'Posted' };
        transaction.set(balanceRefs[index], clean({ ...before, quantityOnHand: quantityAfter, quantityAvailable: quantityAfter - Number(before.quantityReserved || 0), stockValue: quantityAfter * Number(before.averageCost || line.unitCost), lastMovementId: movementKey, lastMovementAt: timestamp, updatedAt: timestamp, updatedBy: context.actorId, syncStatus: 'Synced' }));
        transaction.set(doc(db!, firestorePaths.inventoryMovement(context.vendorId, movementKey)), clean({ ...movement }));
        transaction.set(doc(db!, firestorePaths.productLedgerEntry(context.vendorId, movementKey)), clean({ ...movement, ledgerId: movementKey }));
        return movement;
      });

      let remaining = refundAmount;
      const refundPayments: PosPaymentRecord[] = [];
      originalPayments.forEach((payment) => {
        if (remaining <= 0) return;
        const amount = Number(Math.min(payment.amount, remaining).toFixed(2));
        remaining = Number((remaining - amount).toFixed(2));
        if (amount <= 0) return;
        const paymentId = encodeFirestoreId(`${id}_${payment.paymentId}_REFUND`);
        const refund: PosPaymentRecord = { paymentId, saleId, vendorId: context.vendorId, branchId: sale.branchId, terminalId: sale.terminalId, staffId: context.staffId || context.actorId, paymentMethod: payment.paymentMethod, amount: -amount, reference: input.reason, receivedAt: timestamp, recordType: type === 'VOID' ? 'VOID_REVERSAL' : 'REFUND', originalPaymentId: payment.paymentId, refundId: id };
        refundPayments.push(refund);
        transaction.set(doc(db!, firestorePaths.payments(context.vendorId), paymentId), clean({ ...refund }));
      });
      if (remaining > 0.01) throw new Error('Refund could not be allocated across original payments.');
      const cashRefund = Math.abs(refundPayments.filter((payment) => payment.paymentMethod === 'Cash').reduce((sum, payment) => sum + payment.amount, 0));
      if (cashRefund > 0 && (!shiftRef || !shiftSnapshot?.exists())) throw new Error('The original shift is required for a cash refund.');
      const cashMovement = cashRefund > 0 ? { cashMovementId: encodeFirestoreId(`${id}_CASH_REFUND`), vendorId: context.vendorId, branchId: sale.branchId, terminalId: sale.terminalId, shiftId: sale.shiftId!, staffId: context.staffId || context.actorId, movementType: 'CASH_REFUND' as const, amount: cashRefund, referenceType: type === 'VOID' ? 'SALE_VOID' : 'SALE_REFUND', referenceId: id, reason: input.reason, approvalStatus: 'NotRequired' as const, direction: 'OUT' as const, syncStatus: 'Synchronized' as const, createdAt: timestamp } : undefined;
      if (cashMovement) transaction.set(doc(db!, firestorePaths.posCashMovements(context.vendorId), cashMovement.cashMovementId), clean({ ...cashMovement }));
      if (shiftRef && shiftSnapshot?.exists()) {
        const shift = shiftSnapshot.data();
        if (shift.vendorId && shift.vendorId !== context.vendorId) throw new Error('Cross-vendor shift access is rejected.');
        transaction.update(shiftRef, clean({ refundCount: Number(shift.refundCount || 0) + (type === 'REFUND' ? 1 : 0), refundTotal: Number(shift.refundTotal || 0) + (type === 'REFUND' ? refundAmount : 0), voidCount: Number(shift.voidCount || 0) + (type === 'VOID' ? 1 : 0), voidTotal: Number(shift.voidTotal || 0) + (type === 'VOID' ? refundAmount : 0), netSales: Number(shift.netSales ?? shift.totalSales ?? 0) - refundAmount, cashRefunds: Number(shift.cashRefunds || 0) + cashRefund, expectedCash: Number(shift.expectedCash || shift.openingFloat || 0) - cashRefund, updatedAt: timestamp }));
      }
      selectedLines.forEach(({ line, quantity }) => { previouslyRefunded[line.saleLineId] = Number(previouslyRefunded[line.saleLineId] || 0) + quantity; });
      const totalRefunded = Number((Number(sale.refundedAmount || 0) + refundAmount).toFixed(2));
      const isFullRefund = allLines.every((line) => Number(previouslyRefunded[line.saleLineId] || 0) >= line.quantity);
      const updatedSale: PosSaleHeader = { ...sale, saleStatus: type === 'VOID' ? 'Voided' : isFullRefund ? 'Returned' : 'Partially Returned', paymentStatus: type === 'VOID' ? 'Voided' : isFullRefund ? 'Refunded' : 'Partially Refunded', refundedAmount: totalRefunded, refundedQuantities: previouslyRefunded, updatedAt: timestamp, voidedAt: type === 'VOID' ? timestamp : sale.voidedAt, voidReason: type === 'VOID' ? input.reason : sale.voidReason };
      transaction.set(saleRef, clean({ ...updatedSale }));
      const auditId = encodeFirestoreId(`${id}_AUDIT`);
      transaction.set(doc(db!, firestorePaths.auditLogs(context.vendorId), auditId), clean({ auditLogId: auditId, vendorId: context.vendorId, branchId: sale.branchId, terminalId: sale.terminalId, staffId: context.staffId || context.actorId, actorId: context.actorId, action: type === 'VOID' ? 'SALE_VOIDED' : 'SALE_REFUNDED', entityType: 'SALE', entityId: saleId, eventType: type === 'VOID' ? 'SALE_VOIDED' : 'SALE_REFUNDED', referenceType: 'SALE', referenceId: saleId, reason: input.reason, sourceApp: context.sourceApp, correlationId: input.idempotencyKey, createdAt: timestamp }));
      const events = [type === 'VOID' ? 'SALE_VOIDED' : 'SALE_REFUNDED', 'PAYMENT_REFUNDED', ...(inventoryMovements.length ? ['STOCK_RETURNED'] : [])];
      events.forEach((eventType) => { const eventId = encodeFirestoreId(`${id}_${eventType}`); transaction.set(doc(db!, firestorePaths.biEvents(context.vendorId), eventId), clean({ eventId, eventType, vendorId: context.vendorId, branchId: sale.branchId, terminalId: sale.terminalId, staffId: context.staffId || context.actorId, sourceApp: context.sourceApp, entityType: 'SALE', entityId: saleId, correlationId: input.idempotencyKey, severity: 'INFO', actionRequired: false, metadata: { reversalId: id, amount: refundAmount, reason: input.reason }, timestamp })); });
      const storedResult: SalesReversalResult = { reversalId: id, reversalType: type, sale: updatedSale, refundedLines: selectedLines.map(({ line, quantity }) => ({ saleLineId: line.saleLineId, quantity })), refundPayments, inventoryMovements, ...(cashMovement ? { cashMovement } : {}), duplicate: false };
      transaction.set(reversalRef, clean({ ...storedResult, vendorId: context.vendorId, saleId, idempotencyKey: input.idempotencyKey, reason: input.reason, notes: input.notes || '', createdAt: timestamp }));
      return storedResult;
    });
    return { success: true, data: result };
  } catch (error) {
    const mapped = mapFirestoreError(error);
    return { success: false, errorCode: mapped.errorCode, errorMessage: error instanceof Error ? error.message : mapped.errorMessage };
  }
}

export function createFirestoreSalesRepository(): SalesRepository {
  return {
    async listSales(context, filters) {
      try {
        validateRepositoryOperationContext(context);
        if (!firebaseReady || !db) return { success: false, records: [], errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Firebase is not configured or Firestore is unavailable.' };
        const snapshot = await getDocs(collection(db, firestorePaths.salesReceipts(context.vendorId)));
        const records = snapshot.docs.map((item) => item.data() as PosSaleHeader).filter((row) => row.vendorId === context.vendorId && salesMatch(row, filters)).sort((a, b) => b.saleDate.localeCompare(a.saleDate));
        return { success: true, records };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, records: [], errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },
    async getSaleDetails(context, saleId) {
      try {
        validateRepositoryOperationContext(context);
        if (!firebaseReady || !db || !saleId.trim()) return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Firebase and sale identifier are required.' };
        const saleSnapshot = await getDoc(doc(db, firestorePaths.salesReceipts(context.vendorId), saleId));
        if (!saleSnapshot.exists()) return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Sale was not found.' };
        const sale = saleSnapshot.data() as PosSaleHeader;
        if (sale.vendorId !== context.vendorId) return { success: false, errorCode: REPOSITORY_ERROR_CODES.PERMISSION_DENIED, errorMessage: 'Cross-vendor sale access is rejected.' };
        const [lineSnapshot, paymentSnapshot] = await Promise.all([
          getDocs(query(collection(db, firestorePaths.salesReceiptLines(context.vendorId)), where('saleId', '==', saleId))),
          getDocs(query(collection(db, firestorePaths.payments(context.vendorId)), where('saleId', '==', saleId)))
        ]);
        return { success: true, data: { sale, saleLines: lineSnapshot.docs.map((item) => item.data() as PosSaleLine), payments: paymentSnapshot.docs.map((item) => item.data() as PosPaymentRecord) } };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: mapped.errorMessage };
      }
    },
    subscribeSales(context, listener) {
      try {
        validateRepositoryOperationContext(context);
        if (!firebaseReady || !db) return { unsubscribe: () => {} };
        const unsubscribe = onSnapshot(collection(db, firestorePaths.salesReceipts(context.vendorId)), (snapshot) => listener(snapshot.docs.map((item) => item.data() as PosSaleHeader).filter((row) => row.vendorId === context.vendorId).sort((a, b) => b.saleDate.localeCompare(a.saleDate))), () => listener([]));
        return { unsubscribe };
      } catch {
        return { unsubscribe: () => {} };
      }
    },
    voidSale(context, saleId, reason) {
      return runSalesReversal(context, saleId, 'VOID', { idempotencyKey: `void-${saleId}`, lines: [], reason });
    },
    refundSale(context, saleId, command) {
      return runSalesReversal(context, saleId, 'REFUND', command);
    },
    async commitSaleTransaction(context, input) {
      const validation = validate(context, input);
      if (validation) return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: validation };
      try {
        const result = await runTransaction(db!, async (transaction): Promise<CommittedSalesTransaction> => {
          const saleRef = doc(db!, firestorePaths.salesReceipts(context.vendorId), input.sale.saleId);
          const existingSale = await transaction.get(saleRef);
          if (existingSale.exists()) {
            const existing = existingSale.data() as PosSaleHeader & { idempotencyKey?: string };
            if (existing.idempotencyKey !== input.idempotencyKey) throw new Error('Sale identifier already belongs to a different checkout request.');
            return { sale: existing, saleLines: input.saleLines, payments: input.payments, inventoryMovements: [], cashMovement: input.cashMovement, duplicate: true };
          }

          const aggregated = new Map<string, SalesTransactionInventoryLine>();
          input.inventoryLines.forEach((line) => {
            const key = [line.branchId, line.warehouseId, line.productId].join('|');
            const current = aggregated.get(key);
            aggregated.set(key, current ? { ...current, quantity: current.quantity + line.quantity } : { ...line });
          });
          const inventoryLines = [...aggregated.values()];
          const shiftRef = doc(db!, firestorePaths.shift(context.vendorId, input.shiftId));
          const productRefs = inventoryLines.map((line) => doc(db!, firestorePaths.productMaster(context.vendorId), line.productId));
          const balanceRefs = inventoryLines.map((line) => doc(db!, firestorePaths.productStockBalance(context.vendorId, balanceId(context, line))));
          const [shiftSnapshot, productSnapshots, balanceSnapshots] = await Promise.all([
            transaction.get(shiftRef),
            Promise.all(productRefs.map((ref) => transaction.get(ref))),
            Promise.all(balanceRefs.map((ref) => transaction.get(ref)))
          ]);
          if (!shiftSnapshot.exists()) throw new Error('Open shift was not found in Firestore.');
          const shift = shiftSnapshot.data();
          if (shift.vendorId && shift.vendorId !== context.vendorId) throw new Error('Cross-vendor shift access is rejected.');
          if (shift.status && !['Open', 'OPEN', 'Active', 'ACTIVE'].includes(String(shift.status))) throw new Error('The selected shift is not open.');

          const inventoryMovements: SharedInventoryMovementRecord[] = [];
          inventoryLines.forEach((line, index) => {
            const product = productSnapshots[index];
            if (!product.exists()) throw new Error(`Product ${line.productId} does not exist in this vendor.`);
            if (product.data().vendorId && product.data().vendorId !== context.vendorId) throw new Error('Cross-vendor product access is rejected.');
            const snapshot = balanceSnapshots[index];
            if (!snapshot.exists()) throw new Error(`Inventory balance is missing for product ${line.productId}.`);
            const before = snapshot.data();
            if (before.vendorId !== context.vendorId || before.branchId !== line.branchId || before.warehouseId !== line.warehouseId) throw new Error('Cross-scope inventory balance access is rejected.');
            const quantityOnHand = Number(before.quantityOnHand || 0);
            const quantityReserved = Number(before.quantityReserved || 0);
            const afterQuantity = quantityOnHand - line.quantity;
            if (afterQuantity - quantityReserved < 0) throw new Error(`Insufficient stock for product ${line.productId}.`);
            const id = movementId(input.sale.saleId, line.productId);
            const movement: SharedInventoryMovementRecord = { sciId: id, movementId: id, vendorId: context.vendorId, branchId: line.branchId, warehouseId: line.warehouseId, productId: line.productId, movementType: 'SALE_ISSUE', quantityDelta: -line.quantity, quantityBefore: quantityOnHand, quantityAfter: afterQuantity, unitCost: line.unitCost, valueImpact: -(line.quantity * line.unitCost), referenceType: 'SALE', referenceId: input.sale.saleId, staffId: context.staffId, actorId: context.actorId, correlationId: context.correlationId, sourceApp: context.sourceApp, createdAt: input.sale.createdAt, updatedAt: input.sale.createdAt, createdBy: context.actorId, updatedBy: context.actorId, schemaVersion: COMMERCE_SCHEMA_VERSION, status: 'Posted' };
            inventoryMovements.push(movement);
            transaction.set(balanceRefs[index], clean({ ...before, quantityOnHand: afterQuantity, quantityAvailable: afterQuantity - quantityReserved, stockValue: afterQuantity * Number(before.averageCost || line.unitCost), lastMovementId: id, lastMovementAt: input.sale.createdAt, updatedAt: input.sale.createdAt, updatedBy: context.actorId, syncStatus: 'Synced' }));
            transaction.set(doc(db!, firestorePaths.inventoryMovement(context.vendorId, id)), clean({ ...movement }));
            transaction.set(doc(db!, firestorePaths.productLedgerEntry(context.vendorId, id)), clean({ ...movement, ledgerId: id }));
          });

          transaction.set(saleRef, clean({ ...input.sale, idempotencyKey: input.idempotencyKey }));
          input.saleLines.forEach((line) => transaction.set(doc(db!, firestorePaths.salesReceiptLines(context.vendorId), line.saleLineId), clean({ ...line })));
          input.payments.forEach((payment) => transaction.set(doc(db!, firestorePaths.payments(context.vendorId), payment.paymentId), clean({ ...payment })));
          if (input.cashMovement) transaction.set(doc(db!, firestorePaths.posCashMovements(context.vendorId), input.cashMovement.cashMovementId), clean({ ...input.cashMovement }));
          transaction.update(shiftRef, clean({ salesCount: Number(shift.salesCount || 0) + 1, totalSales: Number(shift.totalSales || 0) + input.sale.grandTotal, cashSales: Number(shift.cashSales || 0) + (input.cashMovement?.amount || 0), expectedCash: Number(shift.expectedCash || shift.openingFloat || 0) + (input.cashMovement?.amount || 0), updatedAt: input.sale.updatedAt }));
          transaction.set(doc(db!, firestorePaths.auditLogs(context.vendorId), String(input.auditRecord.auditLogId)), clean(input.auditRecord));
          transaction.set(doc(db!, firestorePaths.biEvents(context.vendorId), String(input.biEvent.eventId)), clean(input.biEvent));
          return { sale: input.sale, saleLines: input.saleLines, payments: input.payments, inventoryMovements, cashMovement: input.cashMovement, duplicate: false };
        });
        if (result.duplicate) {
          const [lineSnapshot, paymentSnapshot] = await Promise.all([
            getDocs(query(collection(db!, firestorePaths.salesReceiptLines(context.vendorId)), where('saleId', '==', result.sale.saleId))),
            getDocs(query(collection(db!, firestorePaths.payments(context.vendorId)), where('saleId', '==', result.sale.saleId)))
          ]);
          return { success: true, data: { ...result, saleLines: lineSnapshot.docs.map((item) => item.data() as PosSaleLine), payments: paymentSnapshot.docs.map((item) => item.data() as PosPaymentRecord) } };
        }
        return { success: true, data: result };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: error instanceof Error ? error.message : mapped.errorMessage };
      }
    }
  };
}
