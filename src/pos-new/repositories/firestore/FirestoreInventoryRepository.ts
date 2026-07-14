import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  type QueryConstraint,
  type Transaction
} from 'firebase/firestore';
import { db, firebaseReady } from '../../firebase/firebaseApp';
import { COMMERCE_SCHEMA_VERSION, type CommerceSourceApp, type SharedInventoryBalanceRecord, type SharedInventoryMovementRecord, type SharedInventoryMovementType } from '../../firebase/commerceDataContract';
import { encodeFirestoreId, firestorePaths } from '../../firebase/firestorePaths';
import type {
  AdjustStockCommand,
  InventoryBalanceFilters,
  InventoryCommandResult,
  InventoryMovementFilters,
  InventoryRepository,
  PostStocktakeVarianceCommand,
  ReceiveStockCommand,
  TransferStockCommand
} from '../InventoryRepository';
import { validateRepositoryOperationContext, type RepositoryOperationContext } from '../repositoryContext';
import { mapFirestoreError, REPOSITORY_ERROR_CODES } from './firestoreErrorMapper';

const NEGATIVE_STOCK = 'NEGATIVE_STOCK_BLOCKED';

function nowIso(): string {
  return new Date().toISOString();
}

function clean(value: string): string {
  return value.trim();
}

function makeId(...parts: Array<string | undefined>): string {
  return encodeFirestoreId(parts.filter(Boolean).join('_'));
}

function readyError(): InventoryCommandResult | null {
  if (firebaseReady && db) return null;
  return { success: false, errorCode: REPOSITORY_ERROR_CODES.UNAVAILABLE, errorMessage: 'Firebase is not configured or Firestore is not available.' };
}

function validateContext(context: RepositoryOperationContext): InventoryCommandResult | null {
  try {
    validateRepositoryOperationContext(context);
    return null;
  } catch (error) {
    return {
      success: false,
      errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION,
      errorMessage: error instanceof Error ? error.message : 'Invalid repository operation context.'
    };
  }
}

function asIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return '';
}

function normalizeBalance(data: Record<string, unknown>, vendorId: string): SharedInventoryBalanceRecord {
  const quantityOnHand = Number(data.quantityOnHand ?? data.qtyOnHand ?? 0);
  const quantityReserved = Number(data.quantityReserved ?? data.qtyReserved ?? 0);
  const averageCost = Number(data.averageCost ?? 0);
  return {
    sciId: typeof data.sciId === 'string' ? data.sciId : String(data.balanceId || ''),
    balanceId: typeof data.balanceId === 'string' ? data.balanceId : '',
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : vendorId,
    branchId: typeof data.branchId === 'string' ? data.branchId : '',
    warehouseId: typeof data.warehouseId === 'string' ? data.warehouseId : undefined,
    productId: typeof data.productId === 'string' ? data.productId : '',
    shelfLocation: typeof data.shelfLocation === 'string' ? data.shelfLocation : undefined,
    quantityOnHand,
    quantityReserved,
    quantityInTransit: Number(data.quantityInTransit ?? 0),
    quantityAvailable: quantityOnHand - quantityReserved,
    averageCost,
    stockValue: Number(data.stockValue ?? quantityOnHand * averageCost),
    lastMovementId: typeof data.lastMovementId === 'string' ? data.lastMovementId : undefined,
    lastMovementAt: asIso(data.lastMovementAt),
    syncStatus: typeof data.syncStatus === 'string' ? data.syncStatus : 'Synced',
    schemaVersion: Number(data.schemaVersion ?? COMMERCE_SCHEMA_VERSION),
    status: typeof data.status === 'string' ? data.status : 'Active',
    sourceApp: (typeof data.sourceApp === 'string' ? data.sourceApp : 'SYSTEM') as CommerceSourceApp,
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    lastSyncAt: asIso(data.lastSyncAt) || undefined
  };
}

function normalizeMovement(data: Record<string, unknown>, vendorId: string): SharedInventoryMovementRecord {
  return {
    sciId: typeof data.sciId === 'string' ? data.sciId : String(data.movementId || ''),
    movementId: typeof data.movementId === 'string' ? data.movementId : '',
    vendorId: typeof data.vendorId === 'string' ? data.vendorId : vendorId,
    branchId: typeof data.branchId === 'string' ? data.branchId : '',
    warehouseId: typeof data.warehouseId === 'string' ? data.warehouseId : undefined,
    productId: typeof data.productId === 'string' ? data.productId : '',
    movementType: (typeof data.movementType === 'string' ? data.movementType : 'MANUAL_CORRECTION') as SharedInventoryMovementType,
    quantityDelta: Number(data.quantityDelta ?? data.qtyDelta ?? 0),
    quantityBefore: Number(data.quantityBefore ?? 0),
    quantityAfter: Number(data.quantityAfter ?? 0),
    unitCost: typeof data.unitCost === 'number' ? data.unitCost : undefined,
    valueImpact: typeof data.valueImpact === 'number' ? data.valueImpact : undefined,
    referenceType: typeof data.referenceType === 'string' ? data.referenceType : '',
    referenceId: typeof data.referenceId === 'string' ? data.referenceId : '',
    actorId: typeof data.actorId === 'string' ? data.actorId : '',
    correlationId: typeof data.correlationId === 'string' ? data.correlationId : '',
    staffId: typeof data.staffId === 'string' ? data.staffId : undefined,
    schemaVersion: Number(data.schemaVersion ?? COMMERCE_SCHEMA_VERSION),
    status: typeof data.status === 'string' ? data.status : 'Posted',
    sourceApp: (typeof data.sourceApp === 'string' ? data.sourceApp : 'SYSTEM') as CommerceSourceApp,
    createdAt: asIso(data.createdAt),
    updatedAt: asIso(data.updatedAt),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    lastSyncAt: asIso(data.lastSyncAt) || undefined
  };
}

function balanceId(vendorId: string, branchId: string, warehouseId: string | undefined, productId: string): string {
  return makeId(vendorId, branchId, warehouseId || 'NO_WAREHOUSE', productId);
}

function balanceRecord(context: RepositoryOperationContext, productId: string, branchId: string, warehouseId: string | undefined, id: string, data?: Record<string, unknown>): SharedInventoryBalanceRecord {
  const timestamp = nowIso();
  if (data) return normalizeBalance(data, context.vendorId);
  return {
    sciId: id,
    balanceId: id,
    vendorId: context.vendorId,
    branchId,
    warehouseId,
    productId,
    quantityOnHand: 0,
    quantityReserved: 0,
    quantityInTransit: 0,
    quantityAvailable: 0,
    averageCost: 0,
    stockValue: 0,
    syncStatus: 'Synced',
    schemaVersion: COMMERCE_SCHEMA_VERSION,
    status: 'Active',
    sourceApp: context.sourceApp,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: context.actorId,
    updatedBy: context.actorId
  };
}

function biType(type: SharedInventoryMovementType): string {
  if (type === 'GOODS_RECEIVED') return 'GOODS_RECEIVED';
  if (type.startsWith('STOCK_ADJUSTMENT')) return 'STOCK_ADJUSTED';
  if (type.startsWith('TRANSFER')) return 'STOCK_TRANSFERRED';
  if (type.startsWith('STOCKTAKE')) return 'STOCKTAKE_POSTED';
  return 'INVENTORY_SYNC_COMPLETED';
}

function auditAction(type: SharedInventoryMovementType): string {
  if (type === 'GOODS_RECEIVED') return 'POST_GOODS_RECEIPT';
  if (type.startsWith('STOCK_ADJUSTMENT')) return 'POST_STOCK_ADJUSTMENT';
  if (type.startsWith('TRANSFER')) return 'POST_STOCK_TRANSFER';
  if (type.startsWith('STOCKTAKE')) return 'POST_STOCKTAKE';
  return 'POST_INVENTORY_MOVEMENT';
}

async function validateScopeInTransaction(transaction: Transaction, context: RepositoryOperationContext, productId: string, branchId: string, warehouseId?: string): Promise<void> {
  const reads = [
    transaction.get(doc(db!, firestorePaths.productMaster(context.vendorId), productId)),
    transaction.get(doc(db!, firestorePaths.branches(context.vendorId), branchId))
  ];
  if (warehouseId) reads.push(transaction.get(doc(db!, firestorePaths.warehouses(context.vendorId), warehouseId)));
  const snapshots = await Promise.all(reads);
  if (!snapshots[0].exists()) throw new Error('Product does not exist in this vendor tenancy.');
  const productVendor = snapshots[0].data()?.vendorId;
  if (productVendor && productVendor !== context.vendorId) throw new Error('Cross-vendor product access is rejected.');
  if (!snapshots[1].exists()) throw new Error('Branch does not exist in this vendor tenancy.');
  if (warehouseId) {
    const warehouse = snapshots[2];
    if (!warehouse?.exists()) throw new Error('Warehouse does not exist in this vendor tenancy.');
    const warehouseData = warehouse.data();
    if (warehouseData.vendorId && warehouseData.vendorId !== context.vendorId) throw new Error('Cross-vendor warehouse access is rejected.');
    if (warehouseData.branchId && warehouseData.branchId !== branchId) throw new Error('Warehouse does not belong to the selected branch.');
  }
}

function writeSideEffects(transaction: Transaction, context: RepositoryOperationContext, before: SharedInventoryBalanceRecord, after: SharedInventoryBalanceRecord, movement: SharedInventoryMovementRecord, reason: string, override = false): void {
  const suffix = makeId(context.correlationId, movement.movementId);
  transaction.set(doc(db!, firestorePaths.productLedger(context.vendorId), movement.movementId), { ...movement, ledgerId: movement.movementId });
  transaction.set(doc(db!, firestorePaths.auditLogs(context.vendorId), `inventory_${suffix}`), {
    vendorId: context.vendorId,
    branchId: movement.branchId,
    warehouseId: movement.warehouseId || '',
    terminalId: context.terminalId || '',
    staffId: context.staffId || '',
    actorId: context.actorId,
    actorRole: context.actorRole || '',
    action: override ? 'OVERRIDE_NEGATIVE_STOCK' : auditAction(movement.movementType),
    entityType: 'INVENTORY_BALANCE',
    entityId: after.balanceId,
    before,
    after,
    reason,
    sourceApp: context.sourceApp,
    correlationId: context.correlationId,
    createdAt: movement.createdAt
  });
  transaction.set(doc(db!, firestorePaths.biEvents(context.vendorId), `inventory_${suffix}`), {
    eventId: `inventory_${suffix}`,
    eventType: override ? 'NEGATIVE_STOCK_OVERRIDE' : biType(movement.movementType),
    vendorId: context.vendorId,
    branchId: movement.branchId,
    warehouseId: movement.warehouseId || '',
    productId: movement.productId,
    terminalId: context.terminalId || '',
    staffId: context.staffId || '',
    sourceApp: context.sourceApp,
    entityType: 'INVENTORY_MOVEMENT',
    entityId: movement.movementId,
    timestamp: movement.createdAt,
    correlationId: context.correlationId,
    severity: override ? 'HIGH' : 'INFO',
    actionRequired: override,
    metadata: { quantityDelta: movement.quantityDelta, quantityBefore: movement.quantityBefore, quantityAfter: movement.quantityAfter, referenceType: movement.referenceType, referenceId: movement.referenceId, reason },
    schemaVersion: COMMERCE_SCHEMA_VERSION
  });
  if (after.quantityAvailable <= 5 && after.quantityAvailable >= 0) {
    transaction.set(doc(db!, firestorePaths.biEvents(context.vendorId), `low_stock_${suffix}`), {
      eventId: `low_stock_${suffix}`,
      eventType: 'LOW_STOCK_ALERT',
      vendorId: context.vendorId,
      branchId: movement.branchId,
      warehouseId: movement.warehouseId || '',
      productId: movement.productId,
      entityId: after.balanceId,
      staffId: context.staffId || '',
      sourceApp: context.sourceApp,
      timestamp: movement.createdAt,
      correlationId: context.correlationId,
      metadata: { quantityAvailable: after.quantityAvailable }
    });
  }
  if (movement.movementType === 'STOCKTAKE_GAIN' || movement.movementType === 'STOCKTAKE_LOSS') {
    transaction.set(doc(db!, firestorePaths.biEvents(context.vendorId), `stock_variance_${suffix}`), {
      eventId: `stock_variance_${suffix}`,
      eventType: 'STOCK_VARIANCE_FOUND',
      vendorId: context.vendorId,
      branchId: movement.branchId,
      warehouseId: movement.warehouseId || '',
      productId: movement.productId,
      entityId: movement.referenceId,
      staffId: context.staffId || '',
      sourceApp: context.sourceApp,
      timestamp: movement.createdAt,
      correlationId: context.correlationId,
      metadata: { varianceQty: movement.quantityDelta, valueVariance: movement.valueImpact || 0 }
    });
  }
}

async function writeNegativeBlockedEvent(context: RepositoryOperationContext, productId: string, branchId: string, warehouseId: string | undefined, entityId: string): Promise<void> {
  if (!db) return;
  const id = `negative_blocked_${makeId(context.correlationId, productId, warehouseId || branchId)}`;
  await setDoc(doc(db, firestorePaths.biEvents(context.vendorId), id), {
    eventId: id,
    eventType: NEGATIVE_STOCK,
    vendorId: context.vendorId,
    branchId,
    warehouseId: warehouseId || '',
    productId,
    entityId,
    staffId: context.staffId || '',
    sourceApp: context.sourceApp,
    timestamp: nowIso(),
    correlationId: context.correlationId,
    metadata: {}
  }).catch(() => undefined);
}

type MovementOperation = {
  productId: string;
  branchId?: string;
  warehouseId?: string;
  movementId?: string;
  movementType: SharedInventoryMovementType;
  quantityDelta: number;
  unitCost?: number;
  referenceType: string;
  referenceId: string;
  reason?: string;
  allowNegativeStock?: boolean;
  hasNegativeStockOverridePermission?: boolean;
  negativeStockOverrideReason?: string;
  systemQty?: number;
  countedQty?: number;
  varianceRisk?: string;
};

function writeReferenceDocuments(transaction: Transaction, context: RepositoryOperationContext, operation: MovementOperation, movement: SharedInventoryMovementRecord): void {
  const posted = { vendorId: context.vendorId, branchId: movement.branchId, warehouseId: movement.warehouseId || '', status: 'Posted', postedAt: movement.createdAt, postedBy: context.actorId, correlationId: context.correlationId };
  if (movement.movementType === 'GOODS_RECEIVED') {
    transaction.set(doc(db!, firestorePaths.goodsReceivingNotes(context.vendorId), operation.referenceId), { grnId: operation.referenceId, ...posted }, { merge: true });
    transaction.set(doc(db!, firestorePaths.goodsReceivingLines(context.vendorId), movement.movementId), { lineId: movement.movementId, grnId: operation.referenceId, productId: movement.productId, quantityReceived: movement.quantityDelta, unitCost: movement.unitCost || 0, movementId: movement.movementId, ...posted }, { merge: true });
  } else if (movement.movementType.startsWith('STOCK_ADJUSTMENT')) {
    transaction.set(doc(db!, firestorePaths.stockAdjustments(context.vendorId), operation.referenceId), { adjustmentId: operation.referenceId, reasonCode: operation.reason || '', ...posted }, { merge: true });
    transaction.set(doc(db!, firestorePaths.stockAdjustmentLines(context.vendorId), movement.movementId), { lineId: movement.movementId, adjustmentId: operation.referenceId, productId: movement.productId, quantityDelta: movement.quantityDelta, quantityBefore: movement.quantityBefore, quantityAfter: movement.quantityAfter, reasonCode: operation.reason || '', movementId: movement.movementId, ...posted }, { merge: true });
  } else if (movement.movementType.startsWith('STOCKTAKE')) {
    transaction.set(doc(db!, firestorePaths.stocktakes(context.vendorId), operation.referenceId), { stocktakeId: operation.referenceId, ...posted }, { merge: true });
    transaction.set(doc(db!, firestorePaths.stocktakeLines(context.vendorId), movement.movementId), {
      lineId: movement.movementId,
      stocktakeId: operation.referenceId,
      productId: movement.productId,
      systemQty: operation.systemQty ?? movement.quantityBefore,
      countedQty: operation.countedQty ?? movement.quantityAfter,
      varianceQty: movement.quantityDelta,
      unitCost: movement.unitCost || 0,
      valueVariance: movement.valueImpact || 0,
      varianceRisk: operation.varianceRisk || 'Low',
      status: 'Posted',
      countedBy: context.actorId,
      approvedBy: context.actorId,
      postedAt: movement.createdAt,
      movementId: movement.movementId,
      vendorId: context.vendorId,
      branchId: movement.branchId,
      warehouseId: movement.warehouseId || ''
    }, { merge: true });
  }
}

async function applyMovement(context: RepositoryOperationContext, operation: MovementOperation): Promise<InventoryCommandResult> {
  const invalid = validateContext(context) || readyError();
  if (invalid) return invalid;
  const productId = clean(operation.productId || '');
  const branchId = clean(operation.branchId || context.branchId || '');
  const warehouseId = clean(operation.warehouseId || context.warehouseId || '') || undefined;
  if (!productId || !branchId || !operation.referenceType?.trim() || !operation.referenceId?.trim() || !Number.isFinite(operation.quantityDelta) || operation.quantityDelta === 0) {
    return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Product, branch, reference, and a non-zero quantity are required.' };
  }
  if (operation.allowNegativeStock && (!operation.hasNegativeStockOverridePermission || !operation.negativeStockOverrideReason?.trim())) {
    return { success: false, errorCode: REPOSITORY_ERROR_CODES.PERMISSION_DENIED, errorMessage: 'Negative stock override requires explicit permission and a reason.' };
  }
  const id = operation.movementId || makeId(context.vendorId, operation.referenceType, operation.referenceId, productId, operation.movementType, warehouseId || branchId);
  const bId = balanceId(context.vendorId, branchId, warehouseId, productId);
  try {
    const result = await runTransaction(db!, async (transaction) => {
      await validateScopeInTransaction(transaction, context, productId, branchId, warehouseId);
      const movementRef = doc(db!, firestorePaths.inventoryMovements(context.vendorId), id);
      const balanceRef = doc(db!, firestorePaths.productStockBalances(context.vendorId), bId);
      const transferRef = operation.movementType.startsWith('TRANSFER') ? doc(db!, firestorePaths.stockTransfers(context.vendorId), operation.referenceId) : null;
      const transferLineRef = operation.movementType.startsWith('TRANSFER') ? doc(db!, firestorePaths.stockTransferLines(context.vendorId), makeId(operation.referenceId, productId)) : null;
      const [existingMovement, existingBalance, transferSnapshot] = await Promise.all([
        transaction.get(movementRef),
        transaction.get(balanceRef),
        transferLineRef ? transaction.get(transferLineRef) : Promise.resolve(null)
      ]);
      if (existingMovement.exists()) {
        const movement = normalizeMovement(existingMovement.data(), context.vendorId);
        const balance = existingBalance.exists() ? normalizeBalance(existingBalance.data(), context.vendorId) : undefined;
        return { movement, balance };
      }
      if (operation.movementType === 'TRANSFER_IN' && (!transferSnapshot || !transferSnapshot.exists() || !transferSnapshot.data().outgoingMovementId)) {
        throw new Error('Transfer receipt is blocked until the linked source movement is posted.');
      }
      const sourceTransitRef = operation.movementType === 'TRANSFER_IN' && transferSnapshot?.exists() && transferSnapshot.data().sourceBalanceId
        ? doc(db!, firestorePaths.productStockBalances(context.vendorId), String(transferSnapshot.data().sourceBalanceId))
        : null;
      const sourceTransitSnapshot = sourceTransitRef ? await transaction.get(sourceTransitRef) : null;
      const before = balanceRecord(context, productId, branchId, warehouseId, bId, existingBalance.exists() ? existingBalance.data() : undefined);
      if (before.vendorId !== context.vendorId || before.productId !== productId) throw new Error('Cross-vendor or cross-product balance access is rejected.');
      const quantityOnHand = before.quantityOnHand + operation.quantityDelta;
      const quantityAvailable = quantityOnHand - before.quantityReserved;
      if (quantityAvailable < 0 && !operation.allowNegativeStock) throw new Error(NEGATIVE_STOCK);
      const timestamp = nowIso();
      const receivingValue = operation.quantityDelta > 0 ? operation.quantityDelta * Number(operation.unitCost ?? before.averageCost) : 0;
      const averageCost = operation.quantityDelta > 0 && quantityOnHand > 0
        ? Number((((before.quantityOnHand * before.averageCost) + receivingValue) / quantityOnHand).toFixed(4))
        : before.averageCost;
      const movement: SharedInventoryMovementRecord = {
        sciId: id,
        movementId: id,
        vendorId: context.vendorId,
        branchId,
        warehouseId,
        productId,
        movementType: operation.movementType,
        quantityDelta: operation.quantityDelta,
        quantityBefore: before.quantityOnHand,
        quantityAfter: quantityOnHand,
        unitCost: operation.unitCost,
        valueImpact: Number((operation.quantityDelta * Number(operation.unitCost ?? averageCost)).toFixed(2)),
        referenceType: operation.referenceType,
        referenceId: operation.referenceId,
        staffId: context.staffId,
        actorId: context.actorId,
        correlationId: context.correlationId,
        sourceApp: context.sourceApp,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: context.actorId,
        updatedBy: context.actorId,
        schemaVersion: COMMERCE_SCHEMA_VERSION,
        status: 'Posted'
      };
      const after: SharedInventoryBalanceRecord = {
        ...before,
        quantityOnHand,
        quantityInTransit: operation.movementType === 'TRANSFER_OUT'
          ? before.quantityInTransit + Math.abs(operation.quantityDelta)
          : before.quantityInTransit,
        quantityAvailable,
        averageCost,
        stockValue: Number((quantityOnHand * averageCost).toFixed(2)),
        lastMovementId: id,
        lastMovementAt: timestamp,
        syncStatus: 'Synced',
        sourceApp: context.sourceApp,
        updatedAt: timestamp,
        updatedBy: context.actorId,
        lastSyncAt: timestamp
      };
      transaction.set(movementRef, movement);
      transaction.set(balanceRef, after);
      if (operation.movementType === 'TRANSFER_OUT' && transferRef) {
        transaction.set(transferRef, {
          transferId: operation.referenceId,
          vendorId: context.vendorId,
          productId,
          sourceBranchId: branchId,
          sourceWarehouseId: warehouseId || '',
          quantity: Math.abs(operation.quantityDelta),
          status: 'In Transit',
          dispatchedAt: timestamp,
          correlationId: context.correlationId
        }, { merge: true });
        transaction.set(transferLineRef!, { lineId: makeId(operation.referenceId, productId), transferId: operation.referenceId, vendorId: context.vendorId, productId, sourceBalanceId: bId, outgoingMovementId: id, quantity: Math.abs(operation.quantityDelta), status: 'In Transit', dispatchedAt: timestamp }, { merge: true });
      }
      if (operation.movementType === 'TRANSFER_IN' && transferRef) {
        if (sourceTransitRef && sourceTransitSnapshot?.exists()) {
          const sourceTransit = normalizeBalance(sourceTransitSnapshot.data(), context.vendorId);
          transaction.set(sourceTransitRef, {
            ...sourceTransit,
            quantityInTransit: Math.max(0, sourceTransit.quantityInTransit - Math.abs(operation.quantityDelta)),
            updatedAt: timestamp,
            updatedBy: context.actorId
          });
        }
        transaction.set(transferRef, { destinationBranchId: branchId, destinationWarehouseId: warehouseId || '', incomingMovementId: id, status: 'Posted', receivedAt: timestamp, receivedBy: context.actorId }, { merge: true });
        transaction.set(transferLineRef!, { destinationBranchId: branchId, destinationWarehouseId: warehouseId || '', incomingMovementId: id, status: 'Posted', receivedAt: timestamp }, { merge: true });
      }
      writeSideEffects(transaction, context, before, after, movement, operation.negativeStockOverrideReason || operation.reason || operation.referenceType, Boolean(operation.allowNegativeStock));
      writeReferenceDocuments(transaction, context, operation, movement);
      return { movement, balance: after };
    });
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof Error && error.message === NEGATIVE_STOCK) {
      await writeNegativeBlockedEvent(context, productId, branchId, warehouseId, bId);
      return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Quantity available cannot fall below zero.' };
    }
    const mapped = mapFirestoreError(error);
    return { success: false, errorCode: mapped.errorCode, errorMessage: error instanceof Error ? error.message : mapped.errorMessage };
  }
}

export function createFirestoreInventoryRepository(): InventoryRepository {
  return {
    async getBalance(context, productId, locationId) {
      const invalid = validateContext(context) || readyError();
      if (invalid) return invalid;
      if (!productId?.trim() || !locationId?.trim()) return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'productId and locationId are required.' };
      try {
        const constraints: QueryConstraint[] = [where('vendorId', '==', context.vendorId), where('productId', '==', productId)];
        constraints.push(where(context.warehouseId ? 'warehouseId' : 'branchId', '==', locationId));
        const snapshot = await getDocs(query(collection(db!, firestorePaths.productStockBalances(context.vendorId)), ...constraints));
        if (snapshot.empty) return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Inventory balance not found.' };
        const data = normalizeBalance(snapshot.docs[0].data(), context.vendorId);
        return data.vendorId === context.vendorId ? { success: true, data } : { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor balance access is rejected.' };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, ...mapped };
      }
    },

    async listBalances(context, filters?: InventoryBalanceFilters) {
      const invalid = validateContext(context) || readyError();
      if (invalid) return { ...invalid, records: [] };
      try {
        const constraints: QueryConstraint[] = [where('vendorId', '==', context.vendorId)];
        if (filters?.productId) constraints.push(where('productId', '==', filters.productId));
        if (filters?.branchId) constraints.push(where('branchId', '==', filters.branchId));
        if (filters?.warehouseId) constraints.push(where('warehouseId', '==', filters.warehouseId));
        const snapshot = await getDocs(query(collection(db!, firestorePaths.productStockBalances(context.vendorId)), ...constraints));
        const records = snapshot.docs.map((item) => normalizeBalance(item.data(), context.vendorId)).filter((item) => item.vendorId === context.vendorId);
        return { success: true, records };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, records: [], ...mapped };
      }
    },

    subscribeBalances(context, listener) {
      if (validateContext(context) || readyError()) return { unsubscribe: () => undefined };
      const unsubscribe = onSnapshot(query(collection(db!, firestorePaths.productStockBalances(context.vendorId)), where('vendorId', '==', context.vendorId)), (snapshot) => {
        listener(snapshot.docs.map((item) => normalizeBalance(item.data(), context.vendorId)).filter((item) => item.vendorId === context.vendorId));
      });
      return { unsubscribe };
    },

    async listMovements(context, filters?: InventoryMovementFilters) {
      const invalid = validateContext(context) || readyError();
      if (invalid) return { ...invalid, records: [] };
      try {
        const constraints: QueryConstraint[] = [where('vendorId', '==', context.vendorId)];
        if (filters?.productId) constraints.push(where('productId', '==', filters.productId));
        if (filters?.movementType) constraints.push(where('movementType', '==', filters.movementType));
        if (filters?.branchId) constraints.push(where('branchId', '==', filters.branchId));
        if (filters?.warehouseId) constraints.push(where('warehouseId', '==', filters.warehouseId));
        if (filters?.referenceId) constraints.push(where('referenceId', '==', filters.referenceId));
        if (filters?.referenceType) constraints.push(where('referenceType', '==', filters.referenceType));
        const snapshot = await getDocs(query(collection(db!, firestorePaths.inventoryMovements(context.vendorId)), ...constraints));
        const records = snapshot.docs.map((item) => normalizeMovement(item.data(), context.vendorId)).filter((item) => item.vendorId === context.vendorId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return { success: true, records };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, records: [], ...mapped };
      }
    },

    async getMovement(context, movementId) {
      const invalid = validateContext(context) || readyError();
      if (invalid) return invalid;
      if (!movementId?.trim()) return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'movementId is required.' };
      try {
        const snapshot = await getDoc(doc(db!, firestorePaths.inventoryMovements(context.vendorId), movementId));
        if (!snapshot.exists()) return { success: false, errorCode: REPOSITORY_ERROR_CODES.NOT_FOUND, errorMessage: 'Movement not found.' };
        const data = normalizeMovement(snapshot.data(), context.vendorId);
        return data.vendorId === context.vendorId ? { success: true, data } : { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Cross-vendor movement access is rejected.' };
      } catch (error) {
        const mapped = mapFirestoreError(error);
        return { success: false, ...mapped };
      }
    },

    async postMovement(context, movement) {
      if (movement.vendorId !== context.vendorId || movement.actorId !== context.actorId || movement.correlationId !== context.correlationId) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Movement tenant, actor, and correlation must match the operation context.' };
      }
      const result = await applyMovement(context, { ...movement, movementId: movement.movementId, branchId: movement.branchId, quantityDelta: movement.quantityDelta });
      return result.success ? { success: true, data: result.movement } : result;
    },

    receiveStock(context, command: ReceiveStockCommand) {
      return applyMovement(context, { ...command, movementType: 'GOODS_RECEIVED', quantityDelta: Math.abs(command.quantity), reason: command.reason });
    },

    adjustStock(context, command: AdjustStockCommand) {
      return applyMovement(context, { ...command, movementType: command.quantityDelta > 0 ? 'STOCK_ADJUSTMENT_IN' : 'STOCK_ADJUSTMENT_OUT' });
    },

    async transferStock(context, command: TransferStockCommand) {
      const invalid = validateContext(context) || readyError();
      if (invalid) return invalid;
      const sourceBranchId = clean(command.sourceBranchId || context.branchId || '');
      const destinationBranchId = clean(command.destinationBranchId || '');
      const sourceWarehouseId = clean(command.sourceWarehouseId || context.warehouseId || '') || undefined;
      const destinationWarehouseId = clean(command.destinationWarehouseId || '') || undefined;
      const productId = clean(command.productId || '');
      const quantity = Math.abs(Number(command.quantity));
      if (!sourceBranchId || !destinationBranchId || !productId || !quantity || (sourceBranchId === destinationBranchId && sourceWarehouseId === destinationWarehouseId)) {
        return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Transfer requires a product, positive quantity, and different source and destination locations.' };
      }
      const outId = makeId(context.vendorId, command.referenceType, command.referenceId, productId, 'TRANSFER_OUT', sourceWarehouseId || sourceBranchId);
      const inId = makeId(context.vendorId, command.referenceType, command.referenceId, productId, 'TRANSFER_IN', destinationWarehouseId || destinationBranchId);
      try {
        const result = await runTransaction(db!, async (transaction) => {
          await Promise.all([
            validateScopeInTransaction(transaction, context, productId, sourceBranchId, sourceWarehouseId),
            validateScopeInTransaction(transaction, context, productId, destinationBranchId, destinationWarehouseId)
          ]);
          const sourceBalanceId = balanceId(context.vendorId, sourceBranchId, sourceWarehouseId, productId);
          const destinationBalanceId = balanceId(context.vendorId, destinationBranchId, destinationWarehouseId, productId);
          const refs = {
            out: doc(db!, firestorePaths.inventoryMovements(context.vendorId), outId),
            incoming: doc(db!, firestorePaths.inventoryMovements(context.vendorId), inId),
            source: doc(db!, firestorePaths.productStockBalances(context.vendorId), sourceBalanceId),
            destination: doc(db!, firestorePaths.productStockBalances(context.vendorId), destinationBalanceId)
          };
          const [existingOut, existingIn, sourceSnapshot, destinationSnapshot] = await Promise.all([transaction.get(refs.out), transaction.get(refs.incoming), transaction.get(refs.source), transaction.get(refs.destination)]);
          if (existingOut.exists() || existingIn.exists()) {
            if (!existingOut.exists() || !existingIn.exists()) throw new Error('Transfer is partially posted and requires reconciliation.');
            return {
              movements: [normalizeMovement(existingOut.data(), context.vendorId), normalizeMovement(existingIn.data(), context.vendorId)],
              balance: destinationSnapshot.exists() ? normalizeBalance(destinationSnapshot.data(), context.vendorId) : undefined
            };
          }
          const sourceBefore = balanceRecord(context, productId, sourceBranchId, sourceWarehouseId, sourceBalanceId, sourceSnapshot.exists() ? sourceSnapshot.data() : undefined);
          const destinationBefore = balanceRecord(context, productId, destinationBranchId, destinationWarehouseId, destinationBalanceId, destinationSnapshot.exists() ? destinationSnapshot.data() : undefined);
          if (sourceBefore.quantityAvailable - quantity < 0) throw new Error(NEGATIVE_STOCK);
          const timestamp = nowIso();
          const common = { vendorId: context.vendorId, productId, unitCost: sourceBefore.averageCost, referenceType: command.referenceType, referenceId: command.referenceId, staffId: context.staffId, actorId: context.actorId, correlationId: context.correlationId, sourceApp: context.sourceApp, createdAt: timestamp, updatedAt: timestamp, createdBy: context.actorId, updatedBy: context.actorId, schemaVersion: COMMERCE_SCHEMA_VERSION, status: 'Posted' } as const;
          const outgoing: SharedInventoryMovementRecord = { ...common, sciId: outId, movementId: outId, branchId: sourceBranchId, warehouseId: sourceWarehouseId, movementType: 'TRANSFER_OUT', quantityDelta: -quantity, quantityBefore: sourceBefore.quantityOnHand, quantityAfter: sourceBefore.quantityOnHand - quantity, valueImpact: -quantity * sourceBefore.averageCost };
          const incoming: SharedInventoryMovementRecord = { ...common, sciId: inId, movementId: inId, branchId: destinationBranchId, warehouseId: destinationWarehouseId, movementType: 'TRANSFER_IN', quantityDelta: quantity, quantityBefore: destinationBefore.quantityOnHand, quantityAfter: destinationBefore.quantityOnHand + quantity, valueImpact: quantity * sourceBefore.averageCost };
          const sourceAfter: SharedInventoryBalanceRecord = { ...sourceBefore, quantityOnHand: outgoing.quantityAfter, quantityAvailable: outgoing.quantityAfter - sourceBefore.quantityReserved, stockValue: Number((outgoing.quantityAfter * sourceBefore.averageCost).toFixed(2)), lastMovementId: outId, lastMovementAt: timestamp, updatedAt: timestamp, updatedBy: context.actorId, sourceApp: context.sourceApp };
          const destinationAfter: SharedInventoryBalanceRecord = { ...destinationBefore, quantityOnHand: incoming.quantityAfter, quantityAvailable: incoming.quantityAfter - destinationBefore.quantityReserved, averageCost: sourceBefore.averageCost || destinationBefore.averageCost, stockValue: Number((incoming.quantityAfter * (sourceBefore.averageCost || destinationBefore.averageCost)).toFixed(2)), lastMovementId: inId, lastMovementAt: timestamp, updatedAt: timestamp, updatedBy: context.actorId, sourceApp: context.sourceApp };
          transaction.set(refs.out, outgoing);
          transaction.set(refs.incoming, incoming);
          transaction.set(refs.source, sourceAfter);
          transaction.set(refs.destination, destinationAfter);
          writeSideEffects(transaction, context, sourceBefore, sourceAfter, outgoing, command.reason || 'Stock transfer');
          writeSideEffects(transaction, context, destinationBefore, destinationAfter, incoming, command.reason || 'Stock transfer');
          transaction.set(doc(db!, firestorePaths.stockTransfers(context.vendorId), command.referenceId), { transferId: command.referenceId, vendorId: context.vendorId, productId, sourceBranchId, sourceWarehouseId: sourceWarehouseId || '', destinationBranchId, destinationWarehouseId: destinationWarehouseId || '', quantity, status: 'Posted', postedAt: timestamp, postedBy: context.actorId, correlationId: context.correlationId }, { merge: true });
          transaction.set(doc(db!, firestorePaths.stockTransferLines(context.vendorId), makeId(command.referenceId, productId)), { lineId: makeId(command.referenceId, productId), transferId: command.referenceId, vendorId: context.vendorId, productId, quantity, sourceMovementId: outId, destinationMovementId: inId, status: 'Posted', postedAt: timestamp }, { merge: true });
          return { movements: [outgoing, incoming], balance: destinationAfter };
        });
        return { success: true, ...result };
      } catch (error) {
        if (error instanceof Error && error.message === NEGATIVE_STOCK) {
          await writeNegativeBlockedEvent(context, productId, sourceBranchId, sourceWarehouseId, command.referenceId);
          return { success: false, errorCode: REPOSITORY_ERROR_CODES.FAILED_PRECONDITION, errorMessage: 'Transfer would reduce quantity available below zero.' };
        }
        const mapped = mapFirestoreError(error);
        return { success: false, errorCode: mapped.errorCode, errorMessage: error instanceof Error ? error.message : mapped.errorMessage };
      }
    },

    postStocktakeVariance(context, command: PostStocktakeVarianceCommand) {
      const variance = Number(command.countedQty) - Number(command.systemQty);
      if (!Number.isFinite(variance) || variance === 0) return Promise.resolve({ success: true });
      return applyMovement(context, { ...command, movementType: variance > 0 ? 'STOCKTAKE_GAIN' : 'STOCKTAKE_LOSS', quantityDelta: variance, reason: command.notes || 'Stocktake variance' });
    }
  };
}
