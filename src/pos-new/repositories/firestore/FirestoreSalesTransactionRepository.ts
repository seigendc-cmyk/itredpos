import { doc, runTransaction, serverTimestamp, type DocumentSnapshot } from 'firebase/firestore';
import { CanonicalSalesError } from '../../domain/sales/salesErrors';
import { db, firebaseReady } from '../../firebase/firebaseApp';
import { encodeFirestoreId, firestorePaths } from '../../firebase/firestorePaths';
import { createSalesMutationReceiptId, fingerprintSalesMutation } from '../../services/salesIdempotencyService';
import type { InventoryMovementRecord } from '../../services/inventorySyncService';
import type { PosPaymentRecord, PosSaleHeader, PosSaleLine } from '../../services/salesCheckoutService';

export interface AtomicSalePosting {
  sale: PosSaleHeader;
  lines: PosSaleLine[];
  payments: PosPaymentRecord[];
  requestId: string;
  currency: string;
  customerCreditAmount: number;
  migration?: { migrationRunId: string; sourceFingerprint: string; legacyRecordId: string; migrationVersion: string };
}

export interface AtomicSalePostingResult {
  saleId: string;
  saleLineIds: string[];
  paymentIds: string[];
  inventoryMovements: InventoryMovementRecord[];
  mutationReceiptId: string;
  auditEventId: string;
  biEventId: string;
  customerLedgerEntryId?: string;
  customerBalanceProjectionId?: string;
  replayed?: boolean;
}

const balanceId = (sale: PosSaleHeader, productId: string) =>
  encodeFirestoreId(`${sale.vendorId}_${sale.branchId}_${sale.warehouseId}_${productId}`);
const movementId = (sale: PosSaleHeader, lineId: string) => encodeFirestoreId(`sale_${sale.vendorId}_${sale.saleId}_${lineId}`);

export async function postCanonicalSaleAtomic(input: AtomicSalePosting): Promise<AtomicSalePostingResult> {
  if (!firebaseReady || !db) {
    throw new CanonicalSalesError('SALES_TRANSACTION_FAILED', 'Canonical Firestore sales authority is unavailable.', true);
  }
  const { sale } = input;
  if (!sale.vendorId || !sale.branchId || !sale.warehouseId || !sale.terminalId || !sale.staffId || !input.requestId) {
    throw new CanonicalSalesError('SALES_CONTEXT_INVALID', 'Canonical sale scope and request identity are required.');
  }
  if (new Set(input.lines.map((line) => line.productId)).size !== input.lines.length) {
    throw new CanonicalSalesError('SALES_VALIDATION_FAILED', 'A canonical sale may contain only one line per product.');
  }

  const receiptId = encodeFirestoreId(createSalesMutationReceiptId('complete', sale.vendorId, sale.branchId, input.requestId));
  const fingerprint = await fingerprintSalesMutation('COMPLETE_SALE', {
    sale,
    lines: input.lines,
    payments: input.payments,
    currency: input.currency,
    customerCreditAmount: input.customerCreditAmount
  });
  const saleRef = doc(db, firestorePaths.salesReceipt(sale.vendorId, sale.saleId));
  const mutationRef = doc(db, firestorePaths.mutationReceipt(sale.vendorId, receiptId));
  const auditId = encodeFirestoreId(`SALE_COMPLETED_${sale.saleId}`);
  const biId = encodeFirestoreId(`SALE_COMPLETED_${sale.saleId}`);

  return runTransaction(db, async (transaction) => {
    const inventoryLines = input.lines.filter((line) => line.isInventoryAsset);
    const customerBalanceRef = input.customerCreditAmount > 0 && sale.customerId !== 'WALK-IN'
      ? doc(db!, firestorePaths.customerBalance(sale.vendorId, sale.customerId))
      : undefined;
    const reads = await Promise.all([
      transaction.get(saleRef),
      transaction.get(mutationRef),
      ...inventoryLines.map((line) => transaction.get(doc(db!, `${firestorePaths.productMaster(sale.vendorId)}/${encodeFirestoreId(line.productId)}`))),
      ...inventoryLines.map((line) => transaction.get(doc(db!, firestorePaths.productStockBalance(sale.vendorId, balanceId(sale, line.productId))))),
      ...(customerBalanceRef ? [transaction.get(customerBalanceRef)] : [])
    ]);
    const existingSale = reads[0];
    const existingReceipt = reads[1];
    if (existingReceipt.exists()) {
      const receipt = existingReceipt.data();
      if (receipt.requestFingerprint !== fingerprint) throw new CanonicalSalesError('SALES_IDEMPOTENCY_CONFLICT', 'Sales request identity was reused with different content.');
      if (receipt.status !== 'completed' || !existingSale.exists()) throw new CanonicalSalesError('SALES_STATUS_CONFLICT', 'Sales receipt is not durably completed.');
      return { ...(receipt.result as AtomicSalePostingResult), replayed: true };
    }
    if (existingSale.exists()) throw new CanonicalSalesError('SALES_IDEMPOTENCY_CONFLICT', 'Canonical sale identity already exists.');

    const productSnapshots = reads.slice(2, 2 + inventoryLines.length);
    const balanceSnapshots = reads.slice(2 + inventoryLines.length, 2 + (inventoryLines.length * 2));
    const customerBalanceSnapshot = customerBalanceRef ? reads.at(-1) as DocumentSnapshot : undefined;
    const inventoryMovements: InventoryMovementRecord[] = [];
    inventoryLines.forEach((line, index) => {
      const product = productSnapshots[index];
      if (!product.exists() || (product.data().vendorId && product.data().vendorId !== sale.vendorId)) {
        throw new CanonicalSalesError('SALES_VALIDATION_FAILED', 'Sale product does not belong to this vendor.');
      }
      const snapshot = balanceSnapshots[index];
      const current = snapshot.exists() ? snapshot.data() : {};
      const before = Number(current.quantityOnHand || 0);
      if (!Number.isFinite(line.quantity) || line.quantity <= 0 || before < line.quantity) {
        throw new CanonicalSalesError('SALES_STOCK_CONFLICT', 'Insufficient canonical stock for sale.');
      }
      const after = before - line.quantity;
      const id = balanceId(sale, line.productId);
      const moveId = movementId(sale, line.saleLineId);
      transaction.set(doc(db!, firestorePaths.productStockBalance(sale.vendorId, id)), {
        ...current, balanceId: id, vendorId: sale.vendorId, branchId: sale.branchId, warehouseId: sale.warehouseId,
        productId: line.productId, quantityOnHand: after, quantityAvailable: after - Number(current.quantityReserved || 0),
        updatedAt: serverTimestamp(), updatedBy: sale.staffId
      });
      const movement: InventoryMovementRecord = {
        movementId: moveId, vendorId: sale.vendorId, branchId: sale.branchId, warehouseId: sale.warehouseId,
        productId: line.productId, sku: line.sku, productName: line.productName, movementType: 'SALE',
        quantityIn: 0, quantityOut: line.quantity, balanceBefore: before, balanceAfter: after,
        unitCost: line.unitCost, totalCost: line.unitCost * line.quantity, referenceType: 'SALE', referenceId: sale.saleId,
        staffId: sale.staffId, staffName: sale.staffName, terminalId: sale.terminalId, createdAt: sale.createdAt,
        syncStatus: 'Synced', reason: 'Canonical sale posting.'
      };
      inventoryMovements.push(movement);
      transaction.set(doc(db!, firestorePaths.inventoryMovement(sale.vendorId, moveId)), {
        ...movement, sourceType: 'SALE', sourceId: sale.saleId, sourceLineId: line.saleLineId, quantityDelta: -line.quantity,
        openingBalance: before, closingBalance: after, status: 'Posted', postedAt: serverTimestamp(),
        correlationId: input.requestId, idempotencyKey: receiptId, postedBy: sale.staffId
      });
    });

    transaction.set(saleRef, { ...sale, currency: input.currency, authoritativeVersion: 1, requestId: input.requestId, postedAt: serverTimestamp() });
    input.lines.forEach((line) => transaction.set(doc(db!, firestorePaths.salesReceiptLine(sale.vendorId, line.saleLineId)), { ...line, status: 'Posted' }));
    input.payments.forEach((payment) => transaction.set(doc(db!, firestorePaths.payment(sale.vendorId, payment.paymentId)), { ...payment, currency: input.currency, status: 'Completed', requestId: input.requestId }));

    let customerLedgerEntryId: string | undefined;
    let customerBalanceProjectionId: string | undefined;
    if (customerBalanceRef && customerBalanceSnapshot) {
      customerLedgerEntryId = encodeFirestoreId(`${sale.saleId}_CUSTOMER_DEBT`);
      customerBalanceProjectionId = sale.customerId;
      const current = customerBalanceSnapshot.exists() ? Number(customerBalanceSnapshot.data()?.outstandingBalanceMinor || 0) : 0;
      const creditMinor = Math.round(input.customerCreditAmount * 100);
      transaction.set(doc(db!, firestorePaths.customerLedgerEntry(sale.vendorId, customerLedgerEntryId)), {
        entryId: customerLedgerEntryId, vendorId: sale.vendorId, branchId: sale.branchId, customerId: sale.customerId,
        saleId: sale.saleId, debitMinor: creditMinor, creditMinor: 0, requestId: input.requestId, status: 'Posted', createdAt: serverTimestamp()
      });
      transaction.set(customerBalanceRef, {
        vendorId: sale.vendorId, customerId: sale.customerId, outstandingBalanceMinor: current + creditMinor,
        version: Number(customerBalanceSnapshot.data()?.version || 0) + 1, updatedAt: serverTimestamp(),
        lastRequestId: input.requestId, lastSaleId: sale.saleId
      });
    }

    transaction.set(doc(db!, `${firestorePaths.auditLogs(sale.vendorId)}/${auditId}`), {
      auditId, vendorId: sale.vendorId, branchId: sale.branchId, terminalId: sale.terminalId, staffId: sale.staffId,
      action: 'SALE_COMPLETED', entityType: 'SALE', entityId: sale.saleId, requestId: input.requestId,
      resultStatus: 'completed', createdAt: serverTimestamp()
    });
    transaction.set(doc(db!, `${firestorePaths.biEvents(sale.vendorId)}/${biId}`), {
      eventId: biId, eventType: 'SALE_COMPLETED', vendorId: sale.vendorId, branchId: sale.branchId, saleId: sale.saleId,
      currency: input.currency, grossTotal: sale.subtotal + sale.vatTotal, netTotal: sale.grandTotal,
      taxTotal: sale.vatTotal, discountTotal: sale.discountTotal, paymentStatus: sale.paymentStatus,
      itemCount: input.lines.length, timestamp: serverTimestamp()
    });
    const durable: AtomicSalePostingResult = {
      saleId: sale.saleId, saleLineIds: input.lines.map((line) => line.saleLineId), paymentIds: input.payments.map((payment) => payment.paymentId),
      inventoryMovements, mutationReceiptId: receiptId, auditEventId: auditId, biEventId: biId,
      customerLedgerEntryId, customerBalanceProjectionId
    };
    transaction.set(mutationRef, {
      receiptDocumentId: receiptId, idempotencyKey: receiptId, vendorId: sale.vendorId, branchId: sale.branchId,
      terminalId: sale.terminalId, requestId: input.requestId,
      operation: 'COMPLETE_SALE', entityType: 'SALE', entityId: sale.saleId, requestFingerprint: fingerprint,
      status: 'completed', result: durable, resultPath: firestorePaths.salesReceipt(sale.vendorId, sale.saleId),
      correlationId: input.requestId, actorId: sale.staffId, actorRole: 'POS_OPERATOR',
      attemptCount: 1, authorityVersion: 1,
      migration: input.migration,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), completedAt: serverTimestamp()
    });
    return durable;
  });
}
