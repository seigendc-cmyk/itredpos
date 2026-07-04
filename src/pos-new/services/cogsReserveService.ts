import type {
  COGSReserveMovement,
  COGSReserveMovementDirection,
  COGSReserveMovementType,
  COGSReserveStatus,
  COGSReserveSummary,
  Sale
} from '../types';
import { createAccountingPostingPlaceholder } from './accountingService';
import { createBIAdviceFromTrigger } from './biAdviceService';

const MOVEMENT_KEY = 'itred_pos_cogs_reserve_movements_v1';

function nowIso(): string {
  return new Date().toISOString();
}

function today(): string {
  return nowIso().slice(0, 10);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function readList<T>(key: string, fallback: T[] = []): T[] {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function saveList<T>(key: string, value: T[]): T[] {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local/mock reserve persistence can be unavailable.
    }
  }
  return value;
}

const seedMovements: COGSReserveMovement[] = [
  {
    movementId: 'COGS-MOV-DEV-OPEN',
    movementNumber: 'COGS-0001',
    movementDate: today(),
    type: 'OpeningReserve',
    direction: 'In',
    amount: 1800,
    sourceReferenceType: 'ManualAdjustment',
    sourceReferenceId: 'BUILD-19AO',
    sourceReferenceNumber: 'Opening Reserve',
    staffId: 'ST-OWNER',
    staffName: 'Owner',
    reserveBalanceAfter: 1800,
    protected: true,
    requiresApproval: false,
    notes: 'COGS reserve opening balance. Management-control only.',
    createdAt: nowIso()
  },
  {
    movementId: 'COGS-MOV-DEV-LOW',
    movementNumber: 'COGS-0002',
    movementDate: today(),
    type: 'ReserveLeakage',
    direction: 'Out',
    amount: 220,
    sourceReferenceType: 'CashControl',
    sourceReferenceId: 'CASH-DEV',
    sourceReferenceNumber: 'Reserve leakage review',
    staffId: 'ST-MANAGER',
    staffName: 'Manager',
    reserveBalanceAfter: 1580,
    protected: false,
    requiresApproval: true,
    notes: 'Reserve leakage example for BI review.',
    createdAt: nowIso()
  }
];

function nextMovementNumber(movements: COGSReserveMovement[]): string {
  const highest = movements.reduce((max, movement) => {
    const match = movement.movementNumber.match(/COGS-(\d+)/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `COGS-${String(highest + 1).padStart(4, '0')}`;
}

function signedAmount(type: COGSReserveMovementType, direction: COGSReserveMovementDirection, amount: number): number {
  if (direction === 'In') return amount;
  if (direction === 'Out') return -amount;
  if (type === 'ReserveLeakage') return -amount;
  return 0;
}

export function calculateReserveStatus(summary: Pick<COGSReserveSummary, 'currentReserveBalance' | 'requiredReserveLevel'>): COGSReserveStatus {
  if (summary.currentReserveBalance < 0) return 'Overdrawn';
  if (summary.currentReserveBalance <= summary.requiredReserveLevel * 0.25) return 'Critical';
  if (summary.currentReserveBalance <= summary.requiredReserveLevel * 0.5) return 'Low';
  if (summary.currentReserveBalance <= summary.requiredReserveLevel * 0.8) return 'Watch';
  return 'Healthy';
}

export function getCOGSReserveMovements(filters: Partial<{ type: COGSReserveMovementType; from: string; to: string; supplierId: string }> = {}): COGSReserveMovement[] {
  return readList<COGSReserveMovement>(MOVEMENT_KEY, seedMovements).filter((movement) => {
    if (filters.type && movement.type !== filters.type) return false;
    if (filters.supplierId && movement.supplierId !== filters.supplierId) return false;
    if (filters.from && movement.movementDate < filters.from) return false;
    if (filters.to && movement.movementDate > filters.to) return false;
    return true;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function calculateRequiredReserveLevel(): number {
  const movements = getCOGSReserveMovements();
  const recentRecovered = movements.filter((movement) => movement.type === 'COGSRecoveredFromSale').reduce((sum, movement) => sum + movement.amount, 0);
  return Math.max(1200, Math.round(recentRecovered * 1.25));
}

export function getCOGSReserveSummary(): COGSReserveSummary {
  const movements = getCOGSReserveMovements();
  const openingReserve = movements.filter((m) => m.type === 'OpeningReserve').reduce((sum, m) => sum + m.amount, 0);
  const recoveredFromSales = movements.filter((m) => m.type === 'COGSRecoveredFromSale').reduce((sum, m) => sum + m.amount, 0);
  const usedForSupplierPayments = movements.filter((m) => m.type === 'SupplierPayment' || m.type === 'StockPurchaseCreditSettlement').reduce((sum, m) => sum + m.amount, 0);
  const usedForCashStockPurchases = movements.filter((m) => m.type === 'StockPurchaseCash').reduce((sum, m) => sum + m.amount, 0);
  const adjustments = movements.filter((m) => m.type === 'ReserveAdjustment' || m.type === 'ReserveProtectionCorrection').reduce((sum, m) => sum + signedAmount(m.type, m.direction, m.amount), 0);
  const leakage = movements.filter((m) => m.type === 'ReserveLeakage').reduce((sum, m) => sum + m.amount, 0);
  const currentReserveBalance = movements.reduce((sum, movement) => sum + signedAmount(movement.type, movement.direction, movement.amount), 0);
  const requiredReserveLevel = calculateRequiredReserveLevel();
  const reserveShortfall = Math.max(0, requiredReserveLevel - currentReserveBalance);
  const reserveCoveragePercent = requiredReserveLevel > 0 ? Math.round((currentReserveBalance / requiredReserveLevel) * 100) : 100;
  const reserveStatus = calculateReserveStatus({ currentReserveBalance, requiredReserveLevel });
  return {
    openingReserve,
    recoveredFromSales,
    usedForSupplierPayments,
    usedForCashStockPurchases,
    adjustments,
    leakage,
    currentReserveBalance,
    requiredReserveLevel,
    reserveShortfall,
    reserveStatus,
    reserveCoveragePercent,
    lastUpdatedAt: nowIso()
  };
}

export async function createCOGSReserveMovement(payload: Omit<COGSReserveMovement, 'movementId' | 'movementNumber' | 'reserveBalanceAfter' | 'createdAt'> & { movementId?: string; movementNumber?: string }): Promise<COGSReserveMovement> {
  const current = getCOGSReserveMovements();
  const balanceBefore = getCOGSReserveSummary().currentReserveBalance;
  const movement: COGSReserveMovement = {
    ...payload,
    movementId: payload.movementId || makeId('COGS-MOV'),
    movementNumber: payload.movementNumber || nextMovementNumber(current),
    reserveBalanceAfter: Number((balanceBefore + signedAmount(payload.type, payload.direction, payload.amount)).toFixed(2)),
    createdAt: nowIso()
  };
  saveList(MOVEMENT_KEY, [movement, ...current]);
  await createAccountingPostingPlaceholder({ source: 'Manual Placeholder', sourceReference: movement.movementNumber, branch: movement.branchId || 'Local Branch', amount: movement.amount });
  if (movement.type === 'ReserveLeakage' || movement.reserveBalanceAfter < calculateRequiredReserveLevel()) {
    await createBIAdviceFromTrigger({
      id: movement.movementId,
      eventType: movement.type === 'ReserveLeakage' ? 'COGS_RESERVE_USED_FOR_EXPENSES' : 'COGS_RESERVE_BELOW_SAFE_LEVEL',
      domain: 'Supplier / Purchase Discipline',
      severity: movement.reserveBalanceAfter < 0 ? 'Critical' : 'High',
      description: movement.notes,
      recommendedAction: 'Review supplier payments, reserve leakage and purchase commitments before releasing replacement stock cash.'
    });
  }
  return movement;
}

export function calculateCOGSRecoveredFromSale(sale: Sale): { cogs: number; missingCostLines: string[] } {
  const missingCostLines: string[] = [];
  const cogs = sale.items.reduce((sum, item) => {
    const unitCost = Number((item as unknown as { unitCost?: number; costPrice?: number; cost?: number }).unitCost ?? (item as unknown as { costPrice?: number }).costPrice ?? (item as unknown as { cost?: number }).cost ?? 0);
    if (item.isInventoryAsset !== false && unitCost <= 0) missingCostLines.push(item.name);
    return sum + Math.max(0, unitCost) * item.quantity;
  }, 0);
  return { cogs: Number(cogs.toFixed(2)), missingCostLines };
}

export async function recordCOGSRecoveryFromSale(sale: Sale): Promise<COGSReserveMovement | null> {
  if (sale.status !== 'COMPLETED') return null;
  const { cogs, missingCostLines } = calculateCOGSRecoveredFromSale(sale);
  if (missingCostLines.length > 0) {
    await createBIAdviceFromTrigger({
      id: `${sale.id}-missing-cost`,
      eventType: 'SALE_WITH_MISSING_COST_NO_COGS_RESERVE',
      domain: 'Supplier / Purchase Discipline',
      severity: 'High',
      description: `${sale.invoiceNo} has missing cost values for ${missingCostLines.join(', ')}.`,
      recommendedAction: 'Update item cost before relying on gross profit or reserve protection.'
    });
  }
  if (cogs <= 0) return null;
  const cashReceived = Math.max(0, sale.cashReceived || 0);
  return createCOGSReserveMovement({
    movementDate: sale.date.slice(0, 10),
    type: 'COGSRecoveredFromSale',
    direction: 'In',
    amount: cogs,
    sourceReferenceType: 'Sale',
    sourceReferenceId: sale.id,
    sourceReferenceNumber: sale.invoiceNo,
    saleId: sale.id,
    branchId: 'Local Branch',
    terminalId: sale.terminal,
    staffId: sale.operator,
    staffName: sale.operator,
    protected: cashReceived >= cogs,
    requiresApproval: cashReceived < cogs,
    notes: cashReceived >= cogs
      ? 'COGS reserve requirement recovered from sale cash.'
      : 'COGS reserve requirement created, but physical cash is not fully available yet.'
  });
}

export function previewSupplierPaymentReserveImpact(paymentAmount: number): { before: number; after: number; statusAfter: COGSReserveStatus; shortfallAfter: number } {
  const summary = getCOGSReserveSummary();
  const after = Number((summary.currentReserveBalance - Math.max(0, paymentAmount)).toFixed(2));
  const statusAfter = calculateReserveStatus({ currentReserveBalance: after, requiredReserveLevel: summary.requiredReserveLevel });
  return { before: summary.currentReserveBalance, after, statusAfter, shortfallAfter: Math.max(0, summary.requiredReserveLevel - after) };
}

export function validateCOGSReserveForSupplierPayment(paymentAmount: number): { allowed: boolean; warnings: string[] } {
  const impact = previewSupplierPaymentReserveImpact(paymentAmount);
  const warnings: string[] = [];
  if (impact.after < 0) warnings.push('COGS Reserve would be overdrawn.');
  if (impact.statusAfter === 'Critical' || impact.statusAfter === 'Low') warnings.push('COGS Reserve would fall below safe level.');
  return { allowed: impact.after >= 0, warnings };
}

export function reserveForStockPurchase(payload: { amount: number; reference: string; staffId: string; staffName: string }) {
  return createCOGSReserveMovement({ movementDate: today(), type: 'StockPurchaseCash', direction: 'Out', amount: payload.amount, sourceReferenceType: 'PurchaseOrder', sourceReferenceId: payload.reference, sourceReferenceNumber: payload.reference, staffId: payload.staffId, staffName: payload.staffName, protected: true, requiresApproval: false, notes: 'Reserve used for cash stock purchase placeholder.' });
}

export function releaseReserveForSupplierPayment(payload: { amount: number; paymentId: string; paymentNumber: string; supplierId: string; supplierName: string; staffId: string; staffName: string }) {
  return createCOGSReserveMovement({ movementDate: today(), type: 'SupplierPayment', direction: 'Out', amount: payload.amount, sourceReferenceType: 'SupplierPayment', sourceReferenceId: payload.paymentId, sourceReferenceNumber: payload.paymentNumber, supplierId: payload.supplierId, supplierName: payload.supplierName, staffId: payload.staffId, staffName: payload.staffName, protected: true, requiresApproval: false, notes: 'COGS Reserve released for supplier payment. Management-control only.' });
}

export function flagReserveLeakage(payload: { amount: number; reference: string; reason: string; staffId: string; staffName: string }) {
  return createCOGSReserveMovement({ movementDate: today(), type: 'ReserveLeakage', direction: 'Out', amount: payload.amount, sourceReferenceType: 'CashControl', sourceReferenceId: payload.reference, sourceReferenceNumber: payload.reference, staffId: payload.staffId, staffName: payload.staffName, protected: false, requiresApproval: true, notes: payload.reason });
}

export function createReserveAdjustment(payload: { amount: number; direction: COGSReserveMovementDirection; reference: string; reason: string; staffId: string; staffName: string }) {
  return createCOGSReserveMovement({ movementDate: today(), type: 'ReserveAdjustment', direction: payload.direction, amount: payload.amount, sourceReferenceType: 'ManualAdjustment', sourceReferenceId: payload.reference, sourceReferenceNumber: payload.reference, staffId: payload.staffId, staffName: payload.staffName, protected: true, requiresApproval: true, notes: payload.reason });
}
